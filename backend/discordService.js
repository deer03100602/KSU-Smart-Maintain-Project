// ============================================================
// discordService.js — Multi-Channel Discord Webhook Notification Service
// Separated channels:
// 1. แจ้งเตือนเร่งด่วน (Urgent / High Priority)
// 2. ยอดเงินและการชำระเงิน (Payments & Budget Verification)
// 3. ออเดอร์ใหม่ / งานแจ้งซ่อมใหม่ (New Orders / New Maintenance Tickets)
// 4. ข้อผิดพลาดของระบบ (System Errors / Failures)
// ============================================================

const fs = require('fs');
const path = require('path');

const DISCORD_LOGS_PATH = path.join(__dirname, 'data', 'discord_logs.json');
const DEDUPE_CACHE_MS = 60 * 1000; // ป้องกันการส่งซ้ำภายใน 60 วินาที
const sentEventsCache = new Map();

// Helper: บันทึกประวัติการส่ง Discord
function logDiscordDelivery({ channel, eventType, identifier, success, error, payload }) {
    try {
        let logs = [];
        if (fs.existsSync(DISCORD_LOGS_PATH)) {
            try { logs = JSON.parse(fs.readFileSync(DISCORD_LOGS_PATH, 'utf8')); } catch (e) {}
        }
        logs.unshift({
            id: 'dsc-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
            channel,
            eventType,
            identifier,
            success,
            error: error || null,
            timestamp: new Date().toISOString()
        });
        if (logs.length > 300) logs = logs.slice(0, 300);
        fs.writeFileSync(DISCORD_LOGS_PATH, JSON.stringify(logs, null, 2), 'utf8');
    } catch (e) {
        console.warn('⚠️ ไม่สามารถบันทึกประวัติการส่ง Discord log ได้:', e.message);
    }
}

// Helper: ดึง Webhook URL ของแต่ละห้องจาก Environment Variables หรือ Server Config (ห้ามส่งออก Frontend)
function getDiscordWebhookUrl(channel) {
    let settingsWebhook = '';
    try {
        const settingsPath = path.join(__dirname, 'data', 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            settingsWebhook = s.discord_webhook_url || '';
        }
    } catch (e) {}

    let url = '';
    switch (channel) {
        case 'URGENT':
            url = process.env.DISCORD_WEBHOOK_URGENT || process.env.DISCORD_WEBHOOK_URL || settingsWebhook;
            break;
        case 'PAYMENT':
            url = process.env.DISCORD_WEBHOOK_PAYMENT || process.env.DISCORD_WEBHOOK_URL || settingsWebhook;
            break;
        case 'NEW_ORDER':
            url = process.env.DISCORD_WEBHOOK_NEW_ORDER || process.env.DISCORD_WEBHOOK_URL || settingsWebhook;
            break;
        case 'SYSTEM_ERROR':
            url = process.env.DISCORD_WEBHOOK_ERROR || process.env.DISCORD_WEBHOOK_URL || settingsWebhook;
            break;
        case 'ACTIVITY':
            url = process.env.DISCORD_WEBHOOK_ACTIVITY || process.env.DISCORD_WEBHOOK_URL || settingsWebhook;
            break;
        default:
            url = process.env.DISCORD_WEBHOOK_URL || settingsWebhook;
            break;
    }
    return (url || '').replace('discordapp.com', 'discord.com');
}

// Helper: Extract images (base64 or URLs) from markdown or ticket text
function extractImagesFromTicket(ticket) {
    const images = [];
    const text = String(ticket.description || '') + ' ' + String(ticket.resolution_note || '');
    
    // 1. Embedded base64 images
    const base64Regex = /(?:\[([^\]]+)\]\()?(data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=\s\r\n]+))\)?/g;
    let match;
    let idx = 0;
    while ((match = base64Regex.exec(text)) !== null) {
        try {
            const rawName = match[1] || `image_${idx}.png`;
            const filename = rawName.replace(/[^a-zA-Z0-9._-]/g, '_') || `image_${idx}.png`;
            const mimeType = `image/${match[3]}`;
            const cleanBase64 = match[4].replace(/\s+/g, '');
            const buffer = Buffer.from(cleanBase64, 'base64');
            if (buffer.length > 0 && buffer.length < 8 * 1024 * 1024) {
                images.push({ filename, mimeType, buffer });
                idx++;
            }
        } catch (e) {}
    }

    // 2. Uploaded files on disk (/uploads/...)
    const uploadRegex = /\[?([^\]\n]*)\]?\(?(\/uploads\/([^)\s]+))\)?/gi;
    let upMatch;
    while ((upMatch = uploadRegex.exec(text)) !== null) {
        const fname = upMatch[3];
        const searchPaths = [
            path.join(__dirname, 'public', 'uploads', fname),
            path.join(__dirname, 'uploads', fname),
            path.join(__dirname, '..', 'backend', 'public', 'uploads', fname),
            path.join(__dirname, '..', 'backend', 'uploads', fname),
            path.join(__dirname, '..', 'frontend', 'public', 'uploads', fname)
        ];
        for (const p of searchPaths) {
            if (fs.existsSync(p)) {
                try {
                    const ext = path.extname(fname).toLowerCase();
                    const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : (ext === '.gif' ? 'image/gif' : (ext === '.webp' ? 'image/webp' : 'image/png'));
                    images.push({ filename: fname, mimeType, buffer: fs.readFileSync(p) });
                    break;
                } catch (e) {}
            }
        }
    }

    // 3. Direct web image URLs: [name](http...) or http...
    const urlRegex = /\[?([^\]\n]*)\]?\(?(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|webp|gif))\)?/gi;
    while ((match = urlRegex.exec(text)) !== null) {
        images.push({ url: match[2], filename: match[1] || 'image.png' });
    }

    return images;
}

// Master Sender with deduplication, error handling, retry safety, and file attachments
async function sendDiscordWebhook(channel, payload, dedupeKey, attachedFiles = []) {
    const webhookUrl = getDiscordWebhookUrl(channel);

    if (!webhookUrl || !webhookUrl.startsWith('http')) {
        console.warn(`ℹ️ Discord channel [${channel}] Webhook URL is not configured.`);
        return { success: false, skipped: true, reason: 'Webhook URL not configured' };
    }

    // 1. ตรวจสอบการส่งซ้ำ (Deduplication Check)
    global.__sentDiscordEvents = global.__sentDiscordEvents || new Map();
    const now = Date.now();
    if (dedupeKey) {
        const lastSent = global.__sentDiscordEvents.get(dedupeKey);
        if (lastSent && (now - lastSent) < DEDUPE_CACHE_MS) {
            console.log(`⏩ [Discord Dedupe] ข้ามการส่งข้อความซ้ำ (${channel}): ${dedupeKey}`);
            return { success: true, deduped: true };
        }
    }

    // 2. ส่งข้อมูลไปยัง Discord (รองรับ FormData + Multipart Form Data เมื่อมีไฟล์แนบ)
    try {
        let response;
        if (attachedFiles && attachedFiles.length > 0) {
            try {
                const formData = new FormData();
                formData.append('payload_json', JSON.stringify(payload));
                attachedFiles.forEach((f, i) => {
                    const fname = f.filename || `attachment_${i}.png`;
                    const mtype = f.mimeType || 'image/png';
                    const blob = new Blob([f.buffer], { type: mtype });
                    formData.append(`files[${i}]`, blob, fname);
                });
                response = await fetch(webhookUrl, {
                    method: 'POST',
                    body: formData
                });
            } catch (formErr) {
                // Fallback to manual multipart boundary
                const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
                const parts = [];

                parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(payload)}\r\n`));

                attachedFiles.forEach((f, i) => {
                    const fname = f.filename || `attachment_${i}.png`;
                    const mtype = f.mimeType || 'image/png';
                    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files[${i}]"; filename="${fname}"\r\nContent-Type: ${mtype}\r\n\r\n`));
                    parts.push(f.buffer);
                    parts.push(Buffer.from(`\r\n`));
                });

                parts.push(Buffer.from(`--${boundary}--\r\n`));
                response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
                    body: Buffer.concat(parts)
                });
            }
        } else {
            response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Discord API responded with status ${response.status}: ${errText}`);
        }

        if (dedupeKey) {
            global.__sentDiscordEvents.set(dedupeKey, now);
            sentEventsCache.set(dedupeKey, now);
        }

        logDiscordDelivery({
            channel,
            eventType: payload.eventType || 'NOTIFICATION',
            identifier: dedupeKey,
            success: true
        });

        console.log(`💬 [Discord: ${channel}] ส่งแจ้งเตือนเรียบร้อยแล้ว (ไฟล์แนบ: ${attachedFiles.length})`);
        return { success: true };
    } catch (err) {
        console.error(`❌ [Discord: ${channel}] ส่งแจ้งเตือนล้มเหลว:`, err.message);
        logDiscordDelivery({
            channel,
            eventType: payload.eventType || 'NOTIFICATION',
            identifier: dedupeKey,
            success: false,
            error: err.message
        });
        return { success: false, error: err.message };
    }
}

// Helper: Clean description for Discord embeds
function cleanDiscordDescription(desc) {
    if (!desc) return 'ไม่มีรายละเอียดเพิ่มเติม';
    let clean = String(desc);
    clean = clean.replace(/\*\*ไฟล์แนบ:\*\*[\s\S]*$/i, '');
    clean = clean.replace(/\[([^\]]+)\]\(data:image\/[^)]+\)/gi, '');
    clean = clean.replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\s\r\n]+/gi, '');
    clean = clean.replace(/\[([^\]]+)\]\(\/uploads\/[^)]+\)/gi, '');
    clean = clean.replace(/📎\s*\[.*?\]\(.*?\)/gi, '');
    clean = clean.replace(/📷\s*\[.*?\]\(.*?\)/gi, '');
    clean = clean.replace(/📎/g, '').replace(/📷/g, '').trim();
    if (!clean) clean = 'มีรูปภาพ/ไฟล์แนบประกอบการแจ้งซ่อม';
    if (clean.length > 500) clean = clean.substring(0, 500) + '...';
    return clean;
}

// ─────────────────────────────────────────────────────────────
// 1. แจ้งเตือนเร่งด่วน (Urgent / Critical Alerts)
// ─────────────────────────────────────────────────────────────
async function notifyDiscordUrgent(ticket, reason = 'งานด่วนที่สุด / ต้องการการดำเนินการทันที') {
    const mention = '<@1553459941778399262>';
    const extractedImages = extractImagesFromTicket(ticket);
    const attachedFiles = [];

    const cleanDesc = cleanDiscordDescription(ticket.description);

    const embed = {
        title: `🚨 [แจ้งเตือนเร่งด่วน] Ticket #${ticket.ticket_no}: ${ticket.title}`,
        description: `⚠️ **ความเร่งด่วน: ${ticket.priority}**\n${cleanDesc}\n\n**หมายเหตุ:** ${reason}`,
        color: 0xef4444, // สีแดง
        fields: [
            { name: '📍 สถานที่', value: ticket.location || '-', inline: true },
            { name: '🏷️ ประเภท', value: ticket.issue_type || '-', inline: true },
            { name: '👤 ผู้แจ้ง', value: ticket.requester_name || '-', inline: true },
            { name: '🛠️ ผู้รับผิดชอบ', value: ticket.assigned_to || 'ยังไม่ได้มอบหมาย', inline: true }
        ],
        footer: { text: `KSU Smart Maintain • แจ้งเตือนด่วน (${new Date().toLocaleString('th-TH')})` }
    };

    if (extractedImages.length > 0) {
        const firstImg = extractedImages[0];
        if (firstImg.buffer) {
            const filename = firstImg.filename || 'preview.png';
            attachedFiles.push({ filename, mimeType: firstImg.mimeType, buffer: firstImg.buffer });
            embed.image = { url: `attachment://${filename}` };
        } else if (firstImg.url) {
            embed.image = { url: firstImg.url };
        }
    }

    return await sendDiscordWebhook('URGENT', {
        content: `🚨 **แจ้งเตือนเร่งด่วน** ถึง ${mention}`,
        embeds: [embed],
        eventType: 'URGENT_ALERT'
    }, `URGENT_${ticket.ticket_no}_${ticket.updated_at || ticket.created_at}`, attachedFiles);
}

// ─────────────────────────────────────────────────────────────
// 2. ยอดเงินและการชำระเงิน (Payments & Budget Verification)
// * ต้องยืนยันจากระบบหลังบ้านหรือผู้ให้บริการชำระเงินก่อนแจ้งว่าสำเร็จ *
// ─────────────────────────────────────────────────────────────
async function notifyDiscordPayment(expense, ticket, paymentVerification = {}) {
    const isVerified = paymentVerification.verified === true;
    const amount = Number(expense.net_amount || expense.total_price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
    
    // Status text & Color
    let title = '';
    let color = 0x10b981; // สีเขียว
    let statusText = '';

    if (isVerified) {
        title = `💳 [ยืนยันการชำระเงินสำเร็จ] #${ticket.ticket_no} - ${expense.description}`;
        statusText = `✅ **สถานะ: ชำระเงินเรียบร้อยแล้ว (Verified)**\nตรวจสอบและยืนยันผ่านระบบหลังบ้าน/ผู้ให้บริการแล้ว`;
        color = 0x10b981;
    } else if (expense.status === 'APPROVED') {
        title = `💰 [อนุมัติงบประมาณและค่าใช้จ่าย] #${ticket.ticket_no} - ${expense.description}`;
        statusText = `✅ **สถานะ: อนุมัติเบิกจ่ายเรียบร้อยแล้ว**\nผู้อนุมัติ: ${expense.approved_by || 'ผู้มีอำนาจ'}`;
        color = 0x3b82f6; // สีน้ำเงิน
    } else {
        title = `📝 [เสนองบประมาณ/รอตรวจสอบชำระเงิน] #${ticket.ticket_no} - ${expense.description}`;
        statusText = `⏳ **สถานะ: รอดำเนินการตรวจสอบ/รอชำระเงิน**`;
        color = 0xf59e0b; // สีส้ม
    }

    const embed = {
        title,
        description: statusText,
        color,
        fields: [
            { name: '💵 ยอดเงินสุทธิ', value: `฿${amount}`, inline: true },
            { name: '📦 หมวดหมู่', value: expense.category || 'อุปกรณ์', inline: true },
            { name: '🧾 เลขที่ใบเสร็จ', value: expense.receipt_no || '-', inline: true },
            { name: '🏪 ร้านค้า/ผู้ให้บริการ', value: expense.vendor_name || '-', inline: true },
            { name: '🆔 อ้างอิงระบบ', value: paymentVerification.transaction_id || expense.id || '-', inline: true },
            { name: '📋 งานที่เกี่ยวข้อง', value: `${ticket.ticket_no}: ${ticket.title}`, inline: true }
        ],
        footer: { text: `KSU Smart Maintain • ระบบงบประมาณและการเงิน (${new Date().toLocaleString('th-TH')})` }
    };

    return await sendDiscordWebhook('PAYMENT', {
        content: `💰 **แจ้งเตือนยอดเงินและการชำระเงิน** (ไอดีดิส: <@1553459941778399262>)`,
        embeds: [embed],
        eventType: 'PAYMENT_EVENT'
    }, `PAYMENT_${expense.id}_${expense.status}_${isVerified ? 'VERIFIED' : 'PENDING'}`);
}

// ─────────────────────────────────────────────────────────────
// 3. ออเดอร์ใหม่ / งานแจ้งซ่อมใหม่ (New Orders / Maintenance Requests)
// ─────────────────────────────────────────────────────────────
async function notifyDiscordNewOrder(ticket) {
    const extractedImages = extractImagesFromTicket(ticket);
    const attachedFiles = [];

    const cleanDesc = cleanDiscordDescription(ticket.description);

    const embed = {
        title: `📦 [มีงานแจ้งซ่อม / ออเดอร์ใหม่] #${ticket.ticket_no}: ${ticket.title}`,
        description: cleanDesc,
        color: 0x3b82f6, // สีฟ้า
        fields: [
            { name: '🏷️ ประเภทปัญหา', value: ticket.issue_type || '-', inline: true },
            { name: '⚡ ความเร่งด่วน', value: ticket.priority || 'Medium', inline: true },
            { name: '📍 สถานที่', value: ticket.location || '-', inline: true },
            { name: '👤 ผู้แจ้งรายการ', value: ticket.requester_name || '-', inline: true },
            { name: '📧 อีเมลผู้แจ้ง', value: ticket.requester_email || '-', inline: true },
            { name: '📌 สถานะเริ่มต้น', value: ticket.status || 'Open', inline: true }
        ],
        footer: { text: `KSU Smart Maintain • รายการใหม่ (${new Date().toLocaleString('th-TH')})` }
    };

    // If there is an image, attach it so Discord displays the actual image preview!
    if (extractedImages.length > 0) {
        const firstImg = extractedImages[0];
        if (firstImg.buffer) {
            const filename = firstImg.filename || 'preview.png';
            attachedFiles.push({ filename, mimeType: firstImg.mimeType, buffer: firstImg.buffer });
            embed.image = { url: `attachment://${filename}` };
        } else if (firstImg.url) {
            embed.image = { url: firstImg.url };
        }
    }

    return await sendDiscordWebhook('NEW_ORDER', {
        content: `🔔 **มีงานแจ้งซ่อม/ออเดอร์ใหม่ในระบบ** (ถึง <@1553459941778399262>)`,
        embeds: [embed],
        eventType: 'NEW_ORDER'
    }, `NEW_ORDER_${ticket.ticket_no}`, attachedFiles);
}

// ─────────────────────────────────────────────────────────────
// 4. ข้อผิดพลาดของระบบ (System Errors / Exception Alerts)
// ─────────────────────────────────────────────────────────────
async function notifyDiscordSystemError(errorDetails) {
    const { message, stack, route, context, user } = errorDetails;
    const embed = {
        title: `🔥 [ตรวจพบข้อผิดพลาดของระบบ] ${message || 'System Error'}`,
        description: `เกิดข้อผิดพลาดในการทำงานของระบบ Backend / Server กรุณาตรวจสอบและดำเนินการแก้ไข`,
        color: 0x991b1b, // สีแดงเข้ม
        fields: [
            { name: '🛣️ Endpoint / Route', value: route || 'N/A', inline: true },
            { name: '👤 ผู้ใช้งานที่เกิดปัญหา', value: user ? `${user.name || user.email || user.id}` : 'Guest / System', inline: true },
            { name: '⏰ เวลาที่เกิดเหตุ', value: new Date().toLocaleString('th-TH'), inline: false },
            { name: '📋 Stack Trace / รายละเอียด', value: `\`\`\`js\n${String(stack || message || 'Unknown error').substring(0, 600)}\n\`\`\``, inline: false }
        ],
        footer: { text: `KSU Smart Maintain • System Monitor` }
    };

    return await sendDiscordWebhook('SYSTEM_ERROR', {
        content: `🚨 **แจ้งเตือนข้อผิดพลาดระบบ (System Failure)** ถึง <@1553459941778399262>`,
        embeds: [embed],
        eventType: 'SYSTEM_ERROR'
    }, `ERROR_${route}_${String(message).substring(0, 30)}_${Math.floor(Date.now() / 60000)}`);
}

// ─────────────────────────────────────────────────────────────
// 5. บันทึกกิจกรรมของระบบ (Activity Logs)
// แจ้งประวัติการรับงาน, เปลี่ยนสถานะ, อัปเดตงาน, อัปโหลดหลักฐาน, ส่งตรวจรับ, ปิดงาน
// ─────────────────────────────────────────────────────────────
async function notifyDiscordActivity({ title, description, actor, ticket, action, details }) {
    let color = 0x64748b; // เทา
    if (action === 'COMPLETED' || action === 'CLOSED') color = 0x10b981; // เขียว
    else if (action === 'ACCEPTED' || action === 'START') color = 0x3b82f6; // ฟ้า
    else if (action === 'RETURNED_FOR_REVISE') color = 0xf59e0b; // ส้ม
    else if (action === 'CANCELLED') color = 0xef4444; // แดง

    const embed = {
        title: `📌 [Activity Log] ${title || 'มีกิจกรรมเกิดขึ้นในระบบ'}`,
        description: description || '-',
        color,
        fields: [
            { name: '👤 ผู้ดำเนินการ', value: actor?.name ? `${actor.name} (${actor.group || actor.role || 'ผู้ใช้งาน'})` : 'ระบบอัตโนมัติ', inline: true },
            { name: '🎫 Ticket', value: ticket?.ticket_no ? `#${ticket.ticket_no} - ${ticket.title || ''}` : '-', inline: true },
            { name: '⚙️ การกระทำ (Action)', value: action || 'UPDATE', inline: true }
        ],
        footer: { text: `KSU Smart Maintain • Activity Log (${new Date().toLocaleString('th-TH')})` }
    };

    if (details && typeof details === 'object') {
        const extraText = Object.entries(details).map(([k, v]) => `• **${k}**: ${v}`).join('\n');
        if (extraText) embed.fields.push({ name: 'รายละเอียดเพิ่มเติม', value: extraText, inline: false });
    }

    const attachedFiles = [];
    if (details?.url && typeof details.url === 'string') {
        const matches = details.url.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=\s\r\n]+)$/);
        if (matches) {
            const filename = 'evidence_preview.png';
            const cleanBase64 = matches[2].replace(/\s+/g, '');
            const buffer = Buffer.from(cleanBase64, 'base64');
            attachedFiles.push({ filename, mimeType: `image/${matches[1]}`, buffer });
            embed.image = { url: `attachment://${filename}` };
        } else if (details.url.startsWith('http')) {
            embed.image = { url: details.url };
        }
    }

    return await sendDiscordWebhook('ACTIVITY', {
        content: `📋 **บันทึกกิจกรรมในระบบ (Activity Log)**`,
        embeds: [embed],
        eventType: 'ACTIVITY_LOG'
    }, `ACT_${ticket?.ticket_no || 'SYS'}_${action}_${Date.now()}`, attachedFiles);
}

module.exports = {
    getDiscordWebhookUrl,
    extractImagesFromTicket,
    notifyDiscordUrgent,
    notifyDiscordPayment,
    notifyDiscordNewOrder,
    notifyDiscordSystemError,
    notifyDiscordActivity
};
