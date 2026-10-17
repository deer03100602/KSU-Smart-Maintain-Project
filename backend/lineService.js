// ============================================================
// lineService.js — LINE Messaging API Notification Service
// Sends rich maintenance ticket alerts to LINE Official Account (LINE OA)
// Supports Push Message, Multicast, Webhook, and Auto ID Detection
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LINE_LOGS_PATH = path.join(__dirname, 'data', 'line_logs.json');
const LINE_CONTACTS_PATH = path.join(__dirname, 'data', 'line_contacts.json');
const SETTINGS_PATH = path.join(__dirname, 'data', 'settings.json');

// Deduplication cache to prevent duplicate alerts within 60 seconds
const sentEventsCache = new Map();
const DEDUPE_TIMEOUT_MS = 60 * 1000;

// Helper: Read server settings from settings.json
function getStoredSettings() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
        }
    } catch (e) {
        console.warn('⚠️ Error reading settings.json in lineService:', e.message);
    }
    return {};
}

// Helper: Save updated settings to settings.json
function updateStoredSettings(partial) {
    try {
        const current = getStoredSettings();
        const updated = { ...current, ...partial };
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2), 'utf8');
        return updated;
    } catch (e) {
        console.error('❌ Failed to update settings in lineService:', e.message);
        throw e;
    }
}

// Helper: Format application URLs for frontend (supporting React HashRouter)
function formatAppUrl(baseUrl, path) {
    const cleanBase = (baseUrl || 'http://localhost:5173').replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (cleanBase.includes('#')) {
        return `${cleanBase}${cleanPath}`;
    }
    return `${cleanBase}/#${cleanPath}`;
}

// Get active LINE configuration (Environment variables take precedence over settings.json)
function getLineConfig() {
    const settings = getStoredSettings();
    const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || settings.line_channel_access_token || '').trim();
    const secret = (process.env.LINE_CHANNEL_SECRET || settings.line_channel_secret || '').trim();
    const groupId = (process.env.LINE_GROUP_ID || process.env.LINE_TARGET_ID || settings.line_group_id || settings.line_target_id || '').trim();
    const isEnabled = process.env.LINE_NOTIFY_ENABLED !== undefined
        ? (process.env.LINE_NOTIFY_ENABLED === 'true' || process.env.LINE_NOTIFY_ENABLED === '1')
        : (settings.line_notify_enabled !== false);
    const baseUrl = (process.env.APP_BASE_URL || settings.app_base_url || 'http://localhost:5173').trim().replace(/\/$/, '');

    const isConfigured = Boolean(token && groupId);

    return {
        token,
        secret,
        targetId: groupId,
        groupId,
        isEnabled: isEnabled && isConfigured,
        baseUrl,
        isConfigured
    };
}

// Helper: Mask sensitive token for public/admin display
function maskSecret(str) {
    if (!str || typeof str !== 'string') return '';
    const clean = str.trim();
    if (clean.length <= 10) return '********';
    return clean.substring(0, 6) + '...' + clean.substring(clean.length - 4);
}

// Helper: Get sanitized public status for Admin UI (never expose raw token)
function getPublicLineStatus() {
    const config = getLineConfig();
    const logs = getLineLogs(5);
    const contacts = getLineContacts();

    let targetType = 'NONE';
    if (config.groupId) {
        if (config.groupId.startsWith('C') || config.groupId.startsWith('R')) targetType = 'GROUP';
        else if (config.groupId.startsWith('U')) targetType = 'USER';
        else targetType = 'CUSTOM';
    }

    return {
        status: config.isConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED',
        configured: config.isConfigured,
        hasToken: Boolean(config.token),
        hasSecret: Boolean(config.secret),
        targetConfigured: Boolean(config.groupId),
        enabled: config.isEnabled,
        maskedToken: maskSecret(config.token),
        targetId: config.groupId,
        groupId: config.groupId,
        targetType,
        recentLogs: logs,
        knownContactsCount: contacts.length,
        lastSuccess: logs.find(l => l.success)?.timestamp || null,
        lastError: logs.find(l => !l.success)?.error || null
    };
}

// Helper: Record LINE delivery attempt in line_logs.json
function logLineDelivery({ eventType, ticketNo, targetId, success, error, statusCode }) {
    try {
        let logs = [];
        if (fs.existsSync(LINE_LOGS_PATH)) {
            try { logs = JSON.parse(fs.readFileSync(LINE_LOGS_PATH, 'utf8')); } catch (e) {}
        }
        logs.unshift({
            id: 'line-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
            eventType,
            ticketNo: ticketNo || '-',
            targetId: targetId ? maskSecret(targetId) : '-',
            success: Boolean(success),
            statusCode: statusCode || (success ? 200 : 500),
            error: error || null,
            timestamp: new Date().toISOString()
        });
        if (logs.length > 300) logs = logs.slice(0, 300);
        fs.writeFileSync(LINE_LOGS_PATH, JSON.stringify(logs, null, 2), 'utf8');
    } catch (e) {
        console.warn('⚠️ Failed to save line_logs.json:', e.message);
    }
}

// Helper: Retrieve logs
function getLineLogs(limit = 100) {
    try {
        if (fs.existsSync(LINE_LOGS_PATH)) {
            const logs = JSON.parse(fs.readFileSync(LINE_LOGS_PATH, 'utf8'));
            return Array.isArray(logs) ? logs.slice(0, limit) : [];
        }
    } catch (e) {}
    return [];
}

// Helper: Record auto-detected LINE User/Group from Webhook in line_contacts.json
function recordLineContact(contact) {
    try {
        let contacts = getLineContacts();
        const existingIdx = contacts.findIndex(c => c.id === contact.id);
        const entry = {
            id: contact.id,
            type: contact.type || (contact.id.startsWith('U') ? 'user' : 'group'),
            name: contact.name || (contact.id.startsWith('U') ? 'LINE User' : 'LINE Group'),
            source: contact.source || 'webhook',
            lastSeen: new Date().toISOString()
        };

        if (existingIdx >= 0) {
            contacts[existingIdx] = { ...contacts[existingIdx], ...entry };
        } else {
            contacts.unshift(entry);
        }
        if (contacts.length > 50) contacts = contacts.slice(0, 50);
        fs.writeFileSync(LINE_CONTACTS_PATH, JSON.stringify(contacts, null, 2), 'utf8');
        return entry;
    } catch (e) {
        console.warn('⚠️ Failed to record LINE contact:', e.message);
    }
}

// Helper: Retrieve known contacts
function getLineContacts() {
    try {
        if (fs.existsSync(LINE_CONTACTS_PATH)) {
            const data = JSON.parse(fs.readFileSync(LINE_CONTACTS_PATH, 'utf8'));
            return Array.isArray(data) ? data : [];
        }
    } catch (e) {}
    return [];
}

// Helper: Format Thai Date
function formatThaiDateTime(dateInput) {
    try {
        const d = dateInput ? new Date(dateInput) : new Date();
        return d.toLocaleString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Bangkok'
        });
    } catch (e) {
        return String(dateInput);
    }
}

// Helper: Get color and label for priority
function getPriorityMeta(priority) {
    switch (priority) {
        case 'Urgent':
            return { color: '#dc2626', label: 'ด่วนที่สุด (Urgent)', badgeColor: '#fee2e2' };
        case 'High':
            return { color: '#ea580c', label: 'สำคัญมาก (High)', badgeColor: '#ffedd5' };
        case 'Low':
            return { color: '#16a34a', label: 'ทั่วไป/ต่ำ (Low)', badgeColor: '#dcfce7' };
        case 'Medium':
        default:
            return { color: '#2563eb', label: 'ปานกลาง (Medium)', badgeColor: '#dbeafe' };
    }
}

// Helper: Get event header metadata
function getEventMeta(eventType) {
    switch (eventType) {
        case 'CREATED':
            return { title: '🔔 แจ้งซ่อมใหม่ (New Ticket)', color: '#2563eb', icon: '📝' };
        case 'ASSIGNED':
            return { title: '📌 มอบหมายงานแล้ว', color: '#7c3aed', icon: '👷' };
        case 'ACCEPTED':
            return { title: '👷 เจ้าหน้าที่รับงานซ่อมแล้ว', color: '#0284c7', icon: '👍' };
        case 'STARTED':
            return { title: '⚙️ เริ่มดำเนินการซ่อม', color: '#16a34a', icon: '🛠️' };
        case 'WAITING_PARTS':
            return { title: '⏳ รออะไหล่ / งบประมาณ', color: '#d97706', icon: '📦' };
        case 'SUBMITTED_INSPECTION':
            return { title: '📋 ส่งงานตรวจรับแล้ว', color: '#9333ea', icon: '🔍' };
        case 'RETURNED_FOR_REVISE':
            return { title: '⚠️ ส่งกลับแก้ไขงาน', color: '#dc2626', icon: '🔄' };
        case 'COMPLETED':
        case 'Resolved':
            return { title: '🎉 ตรวจรับเสร็จสิ้นสมบูรณ์', color: '#16a34a', icon: '✅' };
        case 'Closed':
            return { title: '🔒 ปิดงานแจ้งซ่อมเรียบร้อย', color: '#475569', icon: '📁' };
        case 'Cancelled':
            return { title: '❌ ยกเลิกรายการแจ้งซ่อม', color: '#dc2626', icon: '🚫' };
        case 'EXPENSE_PROPOSED':
            return { title: '💰 เสนองบประมาณ/ค่าใช้จ่าย', color: '#d97706', icon: '💵' };
        case 'EXPENSE_APPROVED':
            return { title: '✅ อนุมัติงบประมาณแล้ว', color: '#16a34a', icon: '💳' };
        case 'EVIDENCE_UPLOADED':
            return { title: '📷 อัปโหลดรูปภาพหลักฐานใหม่', color: '#0284c7', icon: '📸' };
        case 'UPDATED':
        default:
            return { title: 'ℹ️ อัปเดตข้อมูลงานซ่อม', color: '#4b5563', icon: '🔔' };
    }
}

// Generate LINE Flex Message (Bubble layout)
function buildTicketFlexMessage(ticket, eventType, baseUrl) {
    const eventMeta = getEventMeta(eventType);
    const priorityMeta = getPriorityMeta(ticket.priority);
    const dateFormatted = formatThaiDateTime(ticket.created_at || new Date());
    const ticketNo = ticket.ticket_no || ticket.id || '-';
    const ticketUrl = formatAppUrl(baseUrl, `/tickets/${ticket.id || ticket.ticket_no}`);
    const adminUrl = formatAppUrl(baseUrl, `/admin`);

    const altText = `[${eventMeta.icon} ${ticketNo}] ${eventMeta.title}: ${ticket.title || '-'}`;

    const flexContainer = {
        type: 'bubble',
        size: 'mega',
        header: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '16px',
            backgroundColor: eventMeta.color,
            contents: [
                {
                    type: 'text',
                    text: 'KSU SMART MAINTAIN',
                    weight: 'bold',
                    size: 'xs',
                    color: '#ffffffcc',
                    letterSpacing: '1px'
                },
                {
                    type: 'text',
                    text: eventMeta.title,
                    weight: 'bold',
                    size: 'lg',
                    color: '#ffffff',
                    margin: 'xs',
                    wrap: true
                }
            ]
        },
        body: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '16px',
            spacing: 'md',
            contents: [
                // Ticket Number & Priority Badge
                {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                        {
                            type: 'text',
                            text: `#${ticketNo}`,
                            weight: 'bold',
                            size: 'md',
                            color: '#1e293b',
                            flex: 1
                        },
                        {
                            type: 'box',
                            layout: 'vertical',
                            paddingStart: '8px',
                            paddingEnd: '8px',
                            paddingTop: '2px',
                            paddingBottom: '2px',
                            backgroundColor: priorityMeta.badgeColor,
                            cornerRadius: '4px',
                            contents: [
                                {
                                    type: 'text',
                                    text: ticket.priority || 'Medium',
                                    size: 'xxs',
                                    weight: 'bold',
                                    color: priorityMeta.color
                                }
                            ]
                        }
                    ]
                },
                // Title
                {
                    type: 'text',
                    text: ticket.title || '-',
                    weight: 'bold',
                    size: 'sm',
                    color: '#0f172a',
                    wrap: true
                },
                {
                    type: 'separator',
                    color: '#e2e8f0',
                    margin: 'sm'
                },
                // Details Grid
                {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'xs',
                    contents: [
                        {
                            type: 'box',
                            layout: 'horizontal',
                            contents: [
                                { type: 'text', text: '🏢 สถานที่:', size: 'xs', color: '#64748b', width: '75px' },
                                { type: 'text', text: ticket.location || '-', size: 'xs', color: '#1e293b', wrap: true, flex: 1 }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'horizontal',
                            contents: [
                                { type: 'text', text: '🏷️ ประเภท:', size: 'xs', color: '#64748b', width: '75px' },
                                { type: 'text', text: ticket.issue_type || ticket.category || 'ทั่วไป', size: 'xs', color: '#1e293b', wrap: true, flex: 1 }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'horizontal',
                            contents: [
                                { type: 'text', text: '👤 ผู้แจ้ง:', size: 'xs', color: '#64748b', width: '75px' },
                                { type: 'text', text: ticket.requester_name || ticket.reporter_name || '-', size: 'xs', color: '#1e293b', wrap: true, flex: 1 }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'horizontal',
                            contents: [
                                { type: 'text', text: '📊 สถานะ:', size: 'xs', color: '#64748b', width: '75px' },
                                { type: 'text', text: ticket.status || 'Open', size: 'xs', weight: 'bold', color: eventMeta.color, wrap: true, flex: 1 }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'horizontal',
                            contents: [
                                { type: 'text', text: '👷 ช่าง/เจ้าหน้าที่:', size: 'xs', color: '#64748b', width: '75px' },
                                { type: 'text', text: ticket.assigned_to || 'ยังไม่ได้มอบหมาย', size: 'xs', color: '#1e293b', wrap: true, flex: 1 }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'horizontal',
                            contents: [
                                { type: 'text', text: '🕒 วันเวลา:', size: 'xs', color: '#64748b', width: '75px' },
                                { type: 'text', text: dateFormatted, size: 'xs', color: '#64748b', wrap: true, flex: 1 }
                            ]
                        }
                    ]
                }
            ]
        },
        footer: {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            paddingAll: '12px',
            contents: [
                {
                    type: 'button',
                    action: {
                        type: 'uri',
                        label: '🔍 ดูงานซ่อม',
                        uri: ticketUrl
                    },
                    style: 'primary',
                    color: eventMeta.color,
                    height: 'sm'
                },
                {
                    type: 'button',
                    action: {
                        type: 'uri',
                        label: '🛠️ จัดการในระบบ',
                        uri: adminUrl
                    },
                    style: 'secondary',
                    height: 'sm'
                }
            ]
        }
    };

    return {
        type: 'flex',
        altText,
        contents: flexContainer
    };
}

// Generate Text Fallback Message
function buildTicketTextMessage(ticket, eventType, baseUrl) {
    const eventMeta = getEventMeta(eventType);
    const dateFormatted = formatThaiDateTime(ticket.created_at || new Date());
    const ticketNo = ticket.ticket_no || ticket.id || '-';
    const ticketUrl = formatAppUrl(baseUrl, `/tickets/${ticket.id || ticket.ticket_no}`);

    return {
        type: 'text',
        text: `${eventMeta.icon} [KSU Smart Maintain] ${eventMeta.title}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📋 ตั๋วงาน: #${ticketNo}\n` +
            `📌 หัวข้อ: ${ticket.title || '-'}\n` +
            `🏢 สถานที่: ${ticket.location || '-'}\n` +
            `🏷️ หมวดหมู่: ${ticket.issue_type || ticket.category || 'ทั่วไป'}\n` +
            `👤 ผู้แจ้ง: ${ticket.requester_name || ticket.reporter_name || '-'}\n` +
            `⚡ ความเร่งด่วน: ${ticket.priority || 'Medium'}\n` +
            `📊 สถานะปัจจุบัน: ${ticket.status || 'Open'}\n` +
            `👷 ผู้รับผิดชอบ: ${ticket.assigned_to || 'ยังไม่ได้มอบหมาย'}\n` +
            `🕒 วันเวลา: ${dateFormatted}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🔗 เปิดดูรายละเอียด: ${ticketUrl}`
    };
}

// Core: Send LINE Push message to Target ID (User or Group)
async function sendLinePush(targetId, messages, maxRetries = 1) {
    const config = getLineConfig();
    if (!config.token) {
        const err = new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured');
        err.statusCode = 401;
        throw err;
    }
    if (!targetId) {
        const err = new Error('LINE Group ID or Target ID is missing');
        err.statusCode = 400;
        throw err;
    }

    const payload = {
        to: targetId.trim(),
        messages: Array.isArray(messages) ? messages : [messages]
    };

    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch('https://api.line.me/v2/bot/message/push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.token}`
                },
                body: JSON.stringify(payload)
            });

            const resBody = await res.text();
            let parsedBody = {};
            try { parsedBody = JSON.parse(resBody); } catch (e) {}

            if (!res.ok) {
                const errorMsg = parsedBody.message || resBody || `LINE API Error ${res.status}`;
                const err = new Error(errorMsg);
                err.statusCode = res.status;
                err.details = parsedBody.details || [];

                // Specific error messages for clear diagnosis
                if (res.status === 401) {
                    err.message = 'LINE Channel Access Token ไม่ถูกต้องหรือหมดอายุ (401 Unauthorized)';
                    throw err;
                }
                if (res.status === 400 && parsedBody.details?.[0]?.message) {
                    err.message = `LINE API Bad Request: ${parsedBody.details[0].message}`;
                }

                // Retry on server-side 5xx or rate limit 429
                if ((res.status >= 500 || res.status === 429) && attempt < maxRetries) {
                    console.warn(`⚠️ LINE push attempt ${attempt + 1} failed with ${res.status}, retrying in 1s...`);
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }
                throw err;
            }

            return { success: true, statusCode: res.status };
        } catch (fetchErr) {
            lastError = fetchErr;
            if (fetchErr.statusCode && fetchErr.statusCode < 500 && fetchErr.statusCode !== 429) {
                throw fetchErr;
            }
            if (attempt < maxRetries) {
                console.warn(`⚠️ LINE push network issue on attempt ${attempt + 1}, retrying in 1s...`);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }
    throw lastError;
}

// Core: Send LINE Reply message for Webhook responses
async function sendLineReply(replyToken, messages) {
    const config = getLineConfig();
    if (!config.token || !replyToken) return;

    const payload = {
        replyToken,
        messages: Array.isArray(messages) ? messages : [messages]
    };

    try {
        await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.token}`
            },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.warn('⚠️ LINE Reply failed:', e.message);
    }
}

// Main Dispatcher: Send Notification for Maintenance Ticket Event
async function sendLineTicketNotification(ticket, eventType = 'CREATED') {
    const config = getLineConfig();

    if (!config.isEnabled || !config.targetId) {
        // LINE is not configured or disabled
        return { success: false, skipped: true, reason: 'LINE notification is disabled or target ID not set' };
    }

    // Deduplication check: prevent identical events for the same ticket within 60s
    const dedupeKey = `${ticket.ticket_no || ticket.id}-${eventType}`;
    const lastSent = sentEventsCache.get(dedupeKey);
    const now = Date.now();
    if (lastSent && (now - lastSent) < DEDUPE_TIMEOUT_MS) {
        console.log(`⏩ [LINE] Duplicate alert suppressed for ${dedupeKey} (sent ${Math.round((now - lastSent) / 1000)}s ago)`);
        return { success: true, deduplicated: true };
    }

    // Try Flex Message first, fallback to structured text message
    let messageObj;
    try {
        messageObj = buildTicketFlexMessage(ticket, eventType, config.baseUrl);
    } catch (flexErr) {
        console.warn('⚠️ Flex message build failed, falling back to text:', flexErr.message);
        messageObj = buildTicketTextMessage(ticket, eventType, config.baseUrl);
    }

    try {
        await sendLinePush(config.targetId, messageObj);
        sentEventsCache.set(dedupeKey, now);
        logLineDelivery({
            eventType,
            ticketNo: ticket.ticket_no,
            targetId: config.targetId,
            success: true,
            statusCode: 200
        });
        console.log(`✅ [LINE] Notification sent successfully for #${ticket.ticket_no} [${eventType}] to ${config.targetId}`);
        return { success: true };
    } catch (err) {
        // If Flex Message was rejected (400), retry once with simple Text Message
        if (err.statusCode === 400 && messageObj.type === 'flex') {
            try {
                console.warn('⚠️ Flex message rejected by LINE API, retrying with text message...');
                const textFallback = buildTicketTextMessage(ticket, eventType, config.baseUrl);
                await sendLinePush(config.targetId, textFallback);
                sentEventsCache.set(dedupeKey, now);
                logLineDelivery({
                    eventType,
                    ticketNo: ticket.ticket_no,
                    targetId: config.targetId,
                    success: true,
                    statusCode: 200
                });
                return { success: true, fallbackText: true };
            } catch (retryErr) {
                logLineDelivery({
                    eventType,
                    ticketNo: ticket.ticket_no,
                    targetId: config.targetId,
                    success: false,
                    error: retryErr.message,
                    statusCode: retryErr.statusCode || 500
                });
                return { success: false, error: retryErr.message };
            }
        }

        logLineDelivery({
            eventType,
            ticketNo: ticket.ticket_no,
            targetId: config.targetId,
            success: false,
            error: err.message,
            statusCode: err.statusCode || 500
        });
        console.error(`❌ [LINE] Failed to send notification for #${ticket.ticket_no}:`, err.message);
        return { success: false, error: err.message };
    }
}

// Test LINE Connection & Notification
async function testLineNotification(overrideTargetId, customMessage) {
    const config = getLineConfig();
    const targetId = (overrideTargetId || config.targetId || '').trim();

    if (!config.token) {
        throw new Error('ยังไม่ได้กำหนด Channel Access Token ในการตั้งค่า LINE');
    }
    if (!targetId) {
        throw new Error('กรุณาระบุ Target ID (Group ID หรือ User ID) สำหรับรับข้อความ');
    }

    const testTicket = {
        id: 'test-preview',
        ticket_no: 'TKT-TEST',
        title: customMessage || 'ทดสอบการเชื่อมต่อระบบแจ้งเตือน LINE Messaging API',
        description: 'นี่คือข้อความทดสอบจากระบบ KSU Smart Maintain เพื่อยืนยันการเชื่อมต่อ LINE Official Account สำเร็จสมบูรณ์',
        issue_type: 'ทดสอบระบบ',
        priority: 'Urgent',
        location: 'ศูนย์คอมพิวเตอร์และสารสนเทศ ม.กาฬสินธุ์',
        requester_name: 'ผู้ดูแลระบบ (Admin Test)',
        status: 'In Progress',
        assigned_to: 'เจ้าหน้าที่ IT ผู้รับผิดชอบ',
        created_at: new Date()
    };

    const flexMsg = buildTicketFlexMessage(testTicket, 'CREATED', config.baseUrl);
    const testBanner = {
        type: 'text',
        text: `🟢 [KSU Smart Maintain] ข้อความทดสอบระบบส่งแจ้งเตือนผ่าน LINE สำเร็จ!\nเวลา: ${formatThaiDateTime(new Date())}`
    };

    try {
        await sendLinePush(targetId, [testBanner, flexMsg]);
        logLineDelivery({
            eventType: 'TEST_CONNECTION',
            ticketNo: 'TKT-TEST',
            targetId,
            success: true,
            statusCode: 200
        });
        return { success: true, message: 'ส่งข้อความทดสอบไปยัง LINE เรียบร้อยแล้ว' };
    } catch (err) {
        logLineDelivery({
            eventType: 'TEST_CONNECTION',
            ticketNo: 'TKT-TEST',
            targetId,
            success: false,
            error: err.message,
            statusCode: err.statusCode || 500
        });
        throw err;
    }
}

// Webhook Event Verification and Handling
function verifyWebhookSignature(rawBody, signature, secret) {
    if (!signature || !secret || !rawBody) return false;
    try {
        const hash = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('base64');
        return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
    } catch (e) {
        return false;
    }
}

// Cache to prevent duplicate webhook event processing
const processedWebhookEventIds = new Set();

// Webhook Processor for LINE Platform Events
async function processWebhookEvents(events = []) {
    const results = [];

    for (const ev of events) {
        try {
            // Deduplicate webhook events if webhookEventId is present
            if (ev.webhookEventId) {
                if (processedWebhookEventIds.has(ev.webhookEventId)) {
                    continue;
                }
                processedWebhookEventIds.add(ev.webhookEventId);
                if (processedWebhookEventIds.size > 2000) {
                    const first = processedWebhookEventIds.values().next().value;
                    processedWebhookEventIds.delete(first);
                }
            }

            const source = ev.source || {};
            const sourceType = source.type; // 'user' | 'group' | 'room'
            const userId = source.userId;
            const isGroup = sourceType === 'group';
            const groupId = isGroup ? source.groupId : (source.type === 'room' ? source.roomId : null);
            const targetId = groupId || userId;

            // 1. Bot joined group or room
            if (ev.type === 'join') {
                const detectedGroup = groupId || targetId;
                console.log(`🤖 [LINE Bot Joined Group]: ${detectedGroup}`);
                if (detectedGroup) {
                    recordLineContact({
                        id: detectedGroup,
                        type: 'group',
                        name: `กลุ่ม LINE (${detectedGroup.substring(0, 8)}...)`,
                        source: 'join_event'
                    });
                }

                if (ev.replyToken && detectedGroup) {
                    await sendLineReply(ev.replyToken, [
                        {
                            type: 'text',
                            text: `🤖 สวัสดีครับ! บอท KSU Smart Maintain เข้าร่วมกลุ่มเรียบร้อยแล้ว\n\n` +
                                `📋 Group ID สำหรับนำไปตั้งค่าระบบแจ้งเตือน:\n${detectedGroup}\n\n` +
                                `💡 นำ Group ID นี้ไปใส่ในหน้า Admin Settings -> LINE Notification เพื่อรับการแจ้งเตือนงานซ่อมในกลุ่มนี้ได้ทันทีครับ`
                        }
                    ]);
                }
                results.push({ type: 'join', groupId: detectedGroup });
            }

            // 2. User followed bot (friend added)
            else if (ev.type === 'follow') {
                console.log(`👤 [LINE Bot Followed by User]: ${userId}`);
                recordLineContact({
                    id: userId,
                    type: 'user',
                    name: `ผู้ใช้ LINE (${userId.substring(0, 8)}...)`,
                    source: 'follow_event'
                });

                if (ev.replyToken) {
                    await sendLineReply(ev.replyToken, [
                        {
                            type: 'text',
                            text: `🤖 สวัสดีครับ! ยินดีต้อนรับสู่ระบบ KSU Smart Maintain\n\n` +
                                `👤 User ID ของคุณคือ:\n${userId}\n\n` +
                                `💡 หากต้องการรับแจ้งเตือนเฉพาะบุคคล สามารถนำ User ID นี้ไปใส่ในช่อง LINE Target ID ในหน้าตั้งค่าแอดมินได้ครับ`
                        }
                    ]);
                }
                results.push({ type: 'follow', userId });
            }

            // 3. User or group sent a text message
            else if (ev.type === 'message' && ev.message?.type === 'text') {
                const userText = (ev.message.text || '').trim().toLowerCase();

                if (targetId) {
                    recordLineContact({
                        id: targetId,
                        type: sourceType === 'group' || sourceType === 'room' ? 'group' : 'user',
                        name: sourceType === 'group' ? `กลุ่ม LINE (${targetId.substring(0, 8)}...)` : `ผู้ใช้ (${targetId.substring(0, 8)}...)`,
                        source: 'message_event'
                    });
                }

                // Keyword triggers for checking IDs
                if (['id', '/id', 'groupid', '/groupid', 'myid', '/myid'].includes(userText)) {
                    let replyText = `📋 ข้อมูล LINE Identifier:\n`;
                    if (groupId) replyText += `👥 Group ID: ${groupId}\n`;
                    if (userId) replyText += `👤 User ID: ${userId}\n`;
                    replyText += `\n💡 นำ ID นี้ไปกรอกในระบบ Admin Settings ของ KSU Smart Maintain ได้ทันทีครับ`;

                    if (ev.replyToken) {
                        await sendLineReply(ev.replyToken, [{ type: 'text', text: replyText }]);
                    }
                    results.push({ type: 'id_query', targetId });
                }
                // Keyword trigger for status
                else if (['status', '/status', 'สถานะ'].includes(userText)) {
                    if (ev.replyToken) {
                        await sendLineReply(ev.replyToken, [
                            {
                                type: 'text',
                                text: `🟢 KSU Smart Maintain Service Status: Online\n` +
                                    `🕒 วันเวลา: ${formatThaiDateTime(new Date())}\n` +
                                    `⚡ ระบบเชื่อมต่อ LINE Messaging API ปกติพร้อมรับแจ้งเตือนงานซ่อมครับ`
                            }
                        ]);
                    }
                    results.push({ type: 'status_query', targetId });
                }
            }
        } catch (evErr) {
            console.error('⚠️ Error processing LINE webhook event:', evErr.message);
        }
    }

    return results;
}

module.exports = {
    getLineConfig,
    getPublicLineStatus,
    getLineLogs,
    getLineContacts,
    sendLinePush,
    sendLineReply,
    sendLineTicketNotification,
    testLineNotification,
    verifyWebhookSignature,
    processWebhookEvents,
    updateStoredSettings,
    buildTicketFlexMessage,
    buildTicketTextMessage
};
