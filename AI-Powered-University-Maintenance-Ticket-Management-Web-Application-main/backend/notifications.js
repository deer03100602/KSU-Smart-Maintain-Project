// ============================================================
// notifications.js — Email and Webhook Notification Service
// Sends ticket alerts to Admin, Staff, and Requesters
// ============================================================

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const settingsPath = path.join(__dirname, 'data', 'settings.json');
const usersPath = path.join(__dirname, 'data', 'users.json');

function getSettings() {
    let settings = {
        notify_emails: 'ksu.smart.maintain@gmail.com, nightggpp@gmail.com',
        smtp_enabled: true,
        smtp_host: 'smtp.gmail.com',
        smtp_port: 465,
        smtp_secure: true,
        smtp_user: 'nightggpp@gmail.com',
        smtp_pass: 'gklj mjbd xbqy unte',
        sender_name: 'KSU Smart Maintain (แจ้งซ่อม)',
        sender_email: 'ksu.smart.maintain@gmail.com',
        discord_webhook_url: '',
        emailjs_service_id: '',
        emailjs_template_id: '',
        emailjs_public_key: '',
        emailjs_private_key: '',
        technicians: []
    };
    if (fs.existsSync(settingsPath)) {
        try {
            settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
        } catch (e) {
            console.error('Error reading settings for notifications:', e);
        }
    }
    return settings;
}

function getAllAdminEmails() {
    const adminEmails = [];
    if (fs.existsSync(usersPath)) {
        try {
            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            if (Array.isArray(users)) {
                users.forEach(u => {
                    if (u.email && (u.role === 'admin' || u.group === 'ผู้ดูแลระบบ' || (u.group && u.group.includes('IT')))) {
                        adminEmails.push(u.email.trim().toLowerCase());
                    }
                });
            }
        } catch (e) {}
    }
    return [...new Set(adminEmails)];
}

function getPriorityBadgeColor(priority) {
    switch (priority) {
        case 'Urgent':
            return { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5', label: 'Urgent — ด่วนที่สุด' };
        case 'High':
            return { bg: '#ffedd5', text: '#ea580c', border: '#fdba74', label: 'High — สำคัญมาก' };
        case 'Low':
            return { bg: '#dcfce7', text: '#16a34a', border: '#86efac', label: 'Low — ต่ำ/ทั่วไป' };
        case 'Medium':
        default:
            return { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd', label: 'Medium — ทั่วไป' };
    }
}

function getStatusBadge(status) {
    switch (status) {
        case 'Open': return { bg: '#dbeafe', text: '#1e40af', label: 'รอดำเนินการ (Open)' };
        case 'In Progress': return { bg: '#fef3c7', text: '#92400e', label: 'กำลังดำเนินการ (In Progress)' };
        case 'Waiting for Information': return { bg: '#f3e8ff', text: '#6b21a8', label: 'รอข้อมูลเพิ่มเติม (Waiting)' };
        case 'Resolved': return { bg: '#dcfce7', text: '#166534', label: 'แก้ไขเสร็จสิ้น (Resolved)' };
        case 'Closed': return { bg: '#f1f5f9', text: '#475569', label: 'ปิดงานเรียบร้อย (Closed)' };
        case 'Cancelled': return { bg: '#fee2e2', text: '#991b1b', label: 'ยกเลิก (Cancelled)' };
        default: return { bg: '#f1f5f9', text: '#475569', label: status || 'รอดำเนินการ' };
    }
}

function formatThaiDate(dateInput) {
    try {
        const d = dateInput ? new Date(dateInput) : new Date();
        return d.toLocaleString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Bangkok'
        });
    } catch (e) {
        return String(dateInput);
    }
}

// Extract uploaded images & files from description and prepare Nodemailer CID attachments
function extractAttachments(description) {
    if (!description) return { cleanDesc: '-', images: [], files: [], emailAttachments: [] };

    const images = [];
    const files = [];
    const emailAttachments = [];
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];

    // Regex to match markdown links: ![name](url) or [name](url) or 📎 [name](url)
    const linkRegex = /!?\[(.*?)\]\((\/uploads\/(.*?))\)/g;
    let match;
    const foundUrls = new Set();
    let imgIndex = 0;

    while ((match = linkRegex.exec(description)) !== null) {
        const rawName = match[1].replace(/^[📎📷\s]+/, '').trim();
        const url = match[2];
        const filename = match[3];
        const ext = path.extname(filename).toLowerCase();

        if (!foundUrls.has(url)) {
            foundUrls.add(url);

            // Locate file on disk across common locations
            let resolvedPath = path.join(__dirname, 'public', 'uploads', filename);
            if (!fs.existsSync(resolvedPath)) {
                const altPath = path.join(__dirname, '..', 'backend', 'public', 'uploads', filename);
                if (fs.existsSync(altPath)) resolvedPath = altPath;
            }
            if (!fs.existsSync(resolvedPath)) {
                const altPath2 = path.join(__dirname, '..', 'frontend', 'public', 'uploads', filename);
                if (fs.existsSync(altPath2)) resolvedPath = altPath2;
            }
            if (!fs.existsSync(resolvedPath)) {
                const altPath3 = path.join(__dirname, '..', '_legacy_nextjs', 'public', 'uploads', filename);
                if (fs.existsSync(altPath3)) resolvedPath = altPath3;
            }

            const fileExists = fs.existsSync(resolvedPath);

            if (imageExtensions.includes(ext)) {
                const cid = `ticket-img-${imgIndex++}@ksu-maintain`;
                images.push({
                    name: rawName || filename,
                    url,
                    filename,
                    cid: fileExists ? cid : null,
                    path: fileExists ? resolvedPath : null
                });

                if (fileExists) {
                    emailAttachments.push({
                        filename: rawName || filename,
                        path: resolvedPath,
                        cid: cid
                    });
                }
            } else {
                files.push({
                    name: rawName || filename,
                    url,
                    filename,
                    path: fileExists ? resolvedPath : null
                });

                if (fileExists) {
                    emailAttachments.push({
                        filename: rawName || filename,
                        path: resolvedPath
                    });
                }
            }
        }
    }

    // Clean description text for readability
    let cleanDesc = description
        .replace(/\*\*ไฟล์แนบ:\*\*[\s\S]*$/i, '')
        .replace(/📎\s*\[.*?\]\(.*?\)/g, '')
        .replace(/!?\[.*?\]\(\/uploads\/.*?\)/g, '')
        .trim();

    return { cleanDesc: cleanDesc || description, images, files, emailAttachments };
}

// Generate the beautiful HTML email matching KSU Smart Maintain standard
function generateTicketHtmlEmail(ticket, eventType = 'CREATED', parsedAttachments = null) {
    const isResolved = ticket.status === 'Resolved' || ticket.status === 'Closed';
    const isNew = eventType === 'CREATED';

    let headerGradient = 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)';
    let titleText = '🔔 มีการแจ้งปัญหาใหม่ในระบบ';
    let subtitleText = 'ได้รับข้อมูลการแจ้งซ่อมใหม่จากผู้ใช้งาน รายละเอียดดังนี้';

    if (isResolved) {
        headerGradient = 'linear-gradient(135deg, #065f46 0%, #10b981 100%)';
        titleText = '🎉 งานซ่อมบำรุงดำเนินการเสร็จสิ้นแล้ว';
        subtitleText = 'ปัญหาของคุณได้รับการแก้ไขและปิดงานเรียบร้อยแล้ว รายละเอียดการดำเนินการดังนี้';
    } else if (!isNew) {
        headerGradient = 'linear-gradient(135deg, #374151 0%, #4b5563 100%)';
        titleText = '📝 มีการอัปเดตตั๋วแจ้งซ่อม';
        subtitleText = 'ตั๋วปัญหาได้รับการอัปเดตสถานะหรือรายละเอียดเพิ่มเติม';
    }

    const pColor = getPriorityBadgeColor(ticket.priority);
    const sBadge = getStatusBadge(ticket.status || 'Open');
    const thaiDate = formatThaiDate(ticket.created_at || new Date());

    const parsed = parsedAttachments || extractAttachments(ticket.description);
    const formattedDesc = (parsed.cleanDesc || '-').replace(/\n/g, '<br/>');

    // Extract requester name & group
    let reqName = ticket.requester_name || '-';
    let reqGroup = ticket.requester_group || '';
    const match = reqName.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
        reqName = match[1];
        if (!reqGroup) reqGroup = match[2];
    }
    if (!reqGroup) reqGroup = 'นักศึกษา / ผู้ใช้งานทั่วไป';

    return `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titleText} (${ticket.ticket_no})</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
    <div style="max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <div style="background: ${headerGradient}; color: #ffffff; padding: 24px 28px; text-align: left;">
            <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #93c5fd; font-weight: 600; margin-bottom: 4px;">
                KSU SMART MAINTAIN
            </div>
            <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">
                ${titleText}
            </h1>
            <div style="font-size: 13px; color: #e0e7ff;">
                หมายเลข Ticket: <strong style="color: #fef08a; font-size: 15px; letter-spacing: 0.5px;">${ticket.ticket_no || 'TKT-NEW'}</strong> | ${thaiDate}
            </div>
        </div>

        <div style="padding: 28px;">
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
                ${subtitleText}
            </p>

            ${isResolved ? `
            <!-- Resolution Result Banner -->
            <div style="margin-bottom: 24px; border: 2px solid #86efac; background: #f0fdf4; border-radius: 10px; padding: 18px; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.08);">
                <div style="font-size: 15px; font-weight: 700; color: #166534; margin-bottom: 10px; display: flex; align-items: center;">
                    <span style="font-size: 18px; margin-right: 8px;">✅</span> ผลการปฏิบัติงาน / บันทึกการแก้ไข
                </div>
                <div style="font-size: 14px; color: #14532d; line-height: 1.6; background: #ffffff; padding: 14px; border-radius: 8px; border: 1px solid #bbf7d0;">
                    ${ticket.resolution_note || 'เจ้าหน้าที่ได้ตรวจสอบและดำเนินการแก้ไขเรียบร้อยแล้ว'}
                </div>
                <table style="width: 100%; margin-top: 12px; font-size: 13px; color: #374151;">
                    <tr>
                        <td style="width: 50%;">🛠️ ผู้รับผิดชอบ: <strong>${ticket.assigned_to || '-'}</strong></td>
                        <td style="width: 50%; text-align: right;">🕒 วันที่ปิดงาน: <strong>${formatThaiDate(ticket.closed_at || ticket.updated_at || new Date())}</strong></td>
                    </tr>
                </table>
            </div>
            ` : ''}

            <!-- Section 1: ข้อมูลปัญหา -->
            <div style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 700; color: #1e3a8a; display: flex; align-items: center;">
                    <span style="font-size: 16px; margin-right: 8px;">ℹ️</span> ข้อมูลปัญหา
                </div>
                <div style="padding: 16px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; width: 140px; vertical-align: top; font-weight: 600;">หัวข้อปัญหา:</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: 700; font-size: 15px;">${ticket.title || '-'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; vertical-align: top; font-weight: 600;">ประเภทปัญหา:</td>
                            <td style="padding: 6px 0; color: #0f172a;">${ticket.issue_type || '-'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; vertical-align: top; font-weight: 600;">ระดับความเร่งด่วน:</td>
                            <td style="padding: 6px 0;">
                                <span style="display: inline-block; padding: 3px 10px; border-radius: 9999px; background: ${pColor.bg}; color: ${pColor.text}; border: 1px solid ${pColor.border}; font-size: 12px; font-weight: 700;">
                                    ${pColor.label}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; vertical-align: top; font-weight: 600;">สถานที่เกิดเหตุ:</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">📍 ${ticket.location || '-'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0 6px 0; color: #64748b; vertical-align: top; font-weight: 600;">รายละเอียดปัญหา:</td>
                            <td style="padding: 10px 0 6px 0; color: #334155; line-height: 1.5; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #f1f5f9;">
                                ${formattedDesc}

                                ${parsed.images && parsed.images.length > 0 ? `
                                <!-- Attached Images Display (Inline) -->
                                <div style="margin-top: 14px; padding-top: 14px; border-top: 1px dashed #cbd5e1;">
                                    <div style="font-size: 13px; font-weight: 700; color: #1e3a8a; margin-bottom: 10px;">
                                        📷 รูปภาพแนบ (${parsed.images.length} รูป):
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 14px;">
                                        ${parsed.images.map(img => `
                                            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center;">
                                                <img 
                                                    src="${img.cid ? `cid:${img.cid}` : img.url}" 
                                                    alt="${img.name}" 
                                                    style="max-width: 100%; max-height: 420px; border-radius: 6px; display: block; margin: 0 auto 8px auto; object-fit: contain; box-shadow: 0 1px 4px rgba(0,0,0,0.06);" 
                                                />
                                                <div style="font-size: 12px; color: #64748b; font-weight: 500;">📎 ${img.name}</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                                ` : ''}

                                ${parsed.files && parsed.files.length > 0 ? `
                                <!-- Attached Non-Image Files Display -->
                                <div style="margin-top: 14px; padding-top: 14px; border-top: 1px dashed #cbd5e1;">
                                    <div style="font-size: 13px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px;">
                                        📄 ไฟล์เอกสารแนบ (${parsed.files.length} ไฟล์):
                                    </div>
                                    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #2563eb;">
                                        ${parsed.files.map(f => `
                                            <li style="margin-bottom: 4px;">
                                                <strong>${f.name}</strong> <em>(แนบไฟล์ในอีเมลแล้ว)</em>
                                            </li>
                                        `).join('')}
                                    </ul>
                                </div>
                                ` : ''}
                            </td>
                        </tr>
                    </table>
                </div>
            </div>

            <!-- Section 2: ข้อมูลผู้แจ้ง -->
            <div style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 700; color: #1e3a8a; display: flex; align-items: center;">
                    <span style="font-size: 16px; margin-right: 8px;">👤</span> ข้อมูลผู้แจ้ง
                </div>
                <div style="padding: 16px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; width: 140px; font-weight: 600;">ชื่อผู้แจ้ง:</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${reqName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">อีเมลติดต่อ:</td>
                            <td style="padding: 6px 0; color: #2563eb; font-weight: 600;">
                                <a href="mailto:${ticket.requester_email || ''}" style="color: #2563eb; text-decoration: none;">
                                    ${ticket.requester_email || '-'}
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">กลุ่มผู้ใช้งาน:</td>
                            <td style="padding: 6px 0; color: #0f172a;">${reqGroup}</td>
                        </tr>
                    </table>
                </div>
            </div>

            <!-- Section 3: สถานะ & ผู้รับผิดชอบงาน -->
            <div style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 700; color: #1e3a8a; display: flex; align-items: center;">
                    <span style="font-size: 16px; margin-right: 8px;">⚙️</span> สถานะและการมอบหมายงาน
                </div>
                <div style="padding: 16px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; width: 140px; font-weight: 600;">สถานะปัจจุบัน:</td>
                            <td style="padding: 6px 0;">
                                <span style="display: inline-block; padding: 3px 10px; border-radius: 4px; background: ${sBadge.bg}; color: ${sBadge.text}; font-size: 12px; font-weight: 700;">
                                    ${sBadge.label}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">เจ้าหน้าที่ผู้รับผิดชอบ:</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">
                                ${ticket.assigned_to ? `🛠️ ${ticket.assigned_to}` : '⚠️ ยังไม่ได้มอบหมาย'}
                            </td>
                        </tr>
                        ${ticket.resolution_note ? `
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; vertical-align: top; font-weight: 600;">บันทึกการแก้ไข:</td>
                            <td style="padding: 6px 0; color: #166534; font-weight: 600;">${ticket.resolution_note}</td>
                        </tr>` : ''}
                    </table>
                </div>
            </div>

            <!-- Footer / System Note -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                ระบบแจ้งซ่อมสิ่งพาณิชย์และอุปกรณ์อัจฉริยะ มหาวิทยาลัยกาฬสินธุ์ (KSU Smart Maintain)<br/>
                ข้อความนี้เป็นการแจ้งเตือนอัตโนมัติจากระบบ กรุณาอย่าตอบกลับอีเมลนี้โดยตรง
            </div>
        </div>
    </div>
</body>
</html>
    `;
}

// Send notification via SMTP (Nodemailer) with image & file attachments
async function sendViaSmtp(settings, toEmails, subject, htmlContent, attachments = []) {
    if (!settings.smtp_user || !settings.smtp_pass) {
        throw new Error('ยังไม่ได้กำหนดชื่อผู้ใช้หรือรหัสผ่าน SMTP (smtp_user / smtp_pass)');
    }

    const host = settings.smtp_host || 'smtp.gmail.com';
    const port = Number(settings.smtp_port) || (host.includes('gmail') ? 465 : 587);
    const secure = settings.smtp_secure !== undefined ? Boolean(settings.smtp_secure) : (port === 465);

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user: settings.smtp_user.trim(),
            pass: settings.smtp_pass.trim()
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    const senderName = settings.sender_name || 'KSU Smart Maintain (แจ้งซ่อม)';
    const senderEmail = settings.sender_email || 'ksu.smart.maintain@gmail.com';
    const mailOptions = {
        from: `"${senderName}" <${senderEmail}>`,
        to: toEmails.join(', '),
        subject,
        html: htmlContent,
        attachments: attachments || []
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Email sent successfully via SMTP! MessageID:', info.messageId, 'with attachments:', attachments.length);
    return { success: true, messageId: info.messageId, provider: 'SMTP' };
}

// Send notification via EmailJS REST API
async function sendViaEmailJs(settings, toEmail, toName, subject, messageText) {
    if (!settings.emailjs_service_id || !settings.emailjs_template_id || !settings.emailjs_public_key) {
        throw new Error('ยังไม่ได้ระบุ Service ID, Template ID หรือ Public Key ของ EmailJS');
    }

    const payload = {
        service_id: settings.emailjs_service_id.trim(),
        template_id: settings.emailjs_template_id.trim(),
        user_id: settings.emailjs_public_key.trim(),
        template_params: {
            to_email: toEmail,
            to_name: toName || 'เจ้าหน้าที่ / แอดมิน',
            subject: subject,
            message: messageText
        }
    };

    if (settings.emailjs_private_key) {
        payload.accessToken = settings.emailjs_private_key.trim();
    }

    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`EmailJS error (${res.status}): ${text}`);
    }

    console.log('📧 Email sent successfully via EmailJS REST API!');
    return { success: true, provider: 'EmailJS' };
}

// Send rich embed notification to Discord Webhook
async function sendViaDiscord(webhookUrl, ticket, eventType = 'CREATED') {
    if (!webhookUrl || !webhookUrl.startsWith('http')) return;

    const isResolved = ticket.status === 'Resolved' || ticket.status === 'Closed';
    const isNew = eventType === 'CREATED';
    const color = isResolved ? 0x10b981 : (ticket.priority === 'Urgent' ? 0xef4444 : (ticket.priority === 'High' ? 0xf59e0b : 0x3b82f6));

    const embed = {
        title: isResolved ? `🎉 งานซ่อมเสร็จสิ้น: ${ticket.title}` : (isNew ? `🔔 แจ้งปัญหาใหม่: ${ticket.title}` : `📝 อัปเดตตั๋วงาน: ${ticket.title}`),
        description: ticket.description ? ticket.description.substring(0, 300) : 'ไม่มีรายละเอียด',
        color,
        fields: [
            { name: 'หมายเลข Ticket', value: ticket.ticket_no || '-', inline: true },
            { name: 'ประเภทปัญหา', value: ticket.issue_type || '-', inline: true },
            { name: 'ความเร่งด่วน', value: ticket.priority || 'Medium', inline: true },
            { name: 'สถานที่เกิดเหตุ', value: ticket.location || '-', inline: true },
            { name: 'ผู้แจ้ง', value: ticket.requester_name || '-', inline: true },
            { name: 'อีเมลผู้แจ้ง', value: ticket.requester_email || '-', inline: true },
            { name: 'สถานะ', value: ticket.status || 'Open', inline: true },
            { name: 'ผู้รับผิดชอบ', value: ticket.assigned_to || 'ยังไม่ได้มอบหมาย', inline: true }
        ],
        footer: {
            text: `KSU Smart Maintain • ${formatThaiDate(ticket.created_at || new Date())}`
        }
    };

    if (ticket.resolution_note) {
        embed.fields.push({ name: 'บันทึกการแก้ไข', value: ticket.resolution_note, inline: false });
    }

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
        console.log('💬 Discord Webhook notification sent successfully');
    } catch (e) {
        console.warn('Discord webhook warning:', e.message);
    }
}

// Master function to notify Admins, Staff, Central Mail, and Requester
async function notifyTicketEvent(ticket, eventType = 'CREATED') {
    const settings = getSettings();
    const results = { email: false, discord: false, errors: [] };

    // 1. Extract attachments and inline images
    const parsedAttachments = extractAttachments(ticket.description);

    // 2. Gather all recipient emails
    const recipients = new Set();

    // Central maintenance email must ALWAYS receive notifications
    recipients.add('ksu.smart.maintain@gmail.com');

    // Also include requester's email so they get a confirmation copy
    if (ticket.requester_email && ticket.requester_email.includes('@')) {
        recipients.add(ticket.requester_email.trim().toLowerCase());
    }

    // From settings notify_emails (comma separated)
    if (settings.notify_emails) {
        settings.notify_emails.split(',').forEach(e => {
            const clean = e.trim().toLowerCase();
            if (clean && clean.includes('@')) recipients.add(clean);
        });
    }

    // From all registered admins in system
    const adminEmails = getAllAdminEmails();
    adminEmails.forEach(e => recipients.add(e));

    const emailList = Array.from(recipients);
    console.log(`📬 Preparing to send notification for ${ticket.ticket_no} [${eventType}] to ${emailList.length} recipient(s):`, emailList);

    // 3. Prepare Subject & Content
    let subject;
    const isResolved = ticket.status === 'Resolved' || ticket.status === 'Closed';

    if (isResolved) {
        subject = `[KSU Maintain] 🎉 ดำเนินการซ่อมเสร็จสิ้น #${ticket.ticket_no}: ${ticket.title}`;
    } else if (eventType === 'CREATED') {
        subject = `[KSU Maintain] แจ้งปัญหาใหม่ #${ticket.ticket_no}: ${ticket.title}`;
    } else {
        subject = `[KSU Maintain] อัปเดตสถานะ #${ticket.ticket_no}: ${ticket.title} (${ticket.status || 'Updated'})`;
    }

    const htmlContent = generateTicketHtmlEmail(ticket, eventType, parsedAttachments);

    // 4. Send via SMTP if configured
    if (settings.smtp_user && settings.smtp_pass && emailList.length > 0) {
        try {
            await sendViaSmtp(settings, emailList, subject, htmlContent, parsedAttachments.emailAttachments);
            results.email = true;
        } catch (smtpErr) {
            console.error('SMTP send error:', smtpErr.message);
            results.errors.push(`SMTP: ${smtpErr.message}`);
        }
    } 
    // Fallback to EmailJS if SMTP not configured or failed
    else if (settings.emailjs_service_id && settings.emailjs_template_id && emailList.length > 0) {
        try {
            for (const email of emailList) {
                await sendViaEmailJs(settings, email, 'ผู้รับการแจ้งเตือน', subject, `มีการแจ้งปัญหาในระบบ:\n\nหัวข้อ: ${ticket.title}\nสถานที่: ${ticket.location}\nสถานะ: ${ticket.status}\nผู้แจ้ง: ${ticket.requester_name}\nรายละเอียด: ${parsedAttachments.cleanDesc}`);
            }
            results.email = true;
        } catch (ejsErr) {
            console.error('EmailJS send error:', ejsErr.message);
            results.errors.push(`EmailJS: ${ejsErr.message}`);
        }
    } else {
        if (emailList.length === 0) {
            console.warn('⚠️ No recipient emails found.');
        } else {
            console.warn('⚠️ Neither SMTP nor EmailJS is configured in Settings. Email not sent.');
        }
    }

    // 5. Send via Discord Webhook if configured
    if (settings.discord_webhook_url) {
        try {
            await sendViaDiscord(settings.discord_webhook_url, ticket, eventType);
            results.discord = true;
        } catch (dcErr) {
            results.errors.push(`Discord: ${dcErr.message}`);
        }
    }

    return results;
}

// Send test notification for settings verification
async function sendTestNotification(targetEmail) {
    const settings = getSettings();
    const testTicket = {
        id: 'test-preview',
        ticket_no: 'TKT-TEST',
        title: 'คอมพิวเตอร์ห้อง Lab 301 เปิดไม่ติด (ทดสอบระบบแจ้งเตือน)',
        description: 'เครื่องเปิดไม่ติด พัดลมหมุนแต่ไม่มีภาพขึ้นจอ ได้ทำการตรวจสอบสายไฟเบื้องต้นแล้ว (นี่คือข้อความทดสอบการส่งอีเมลแจ้งเตือน)',
        issue_type: 'ฮาร์ดแวร์ / คอมพิวเตอร์',
        priority: 'Urgent',
        location: 'ห้อง Lab 301 ชั้น 3 อาคาร IT',
        requester_name: 'deer',
        requester_email: targetEmail || 'ksu.smart.maintain@gmail.com',
        requester_group: 'ผู้ดูแลระบบ',
        status: 'Open',
        assigned_to: 'ช่างเทคนิคคอมพิวเตอร์และเครือข่าย',
        resolution_note: null,
        created_at: new Date()
    };

    const recipient = (targetEmail || settings.notify_emails || 'ksu.smart.maintain@gmail.com').trim();
    const subject = `[KSU Maintain] ข้อความทดสอบระบบส่งแจ้งเตือนอีเมล (Test Notification)`;
    const parsedAttachments = extractAttachments(testTicket.description);
    const htmlContent = generateTicketHtmlEmail(testTicket, 'CREATED', parsedAttachments);

    // Try SMTP first
    if (settings.smtp_user && settings.smtp_pass) {
        return await sendViaSmtp(settings, [recipient], subject, htmlContent, parsedAttachments.emailAttachments);
    }

    // Try EmailJS
    if (settings.emailjs_service_id && settings.emailjs_template_id) {
        return await sendViaEmailJs(settings, recipient, 'ผู้ดูแลระบบ', subject, 'นี่คือการทดสอบส่งแจ้งเตือนจากระบบ KSU Smart Maintain');
    }

    throw new Error('กรุณากำหนดค่า SMTP (User/Pass) หรือ EmailJS ในหน้าตั้งค่าก่อนทำการทดสอบ');
}

module.exports = {
    getSettings,
    notifyTicketEvent,
    sendTestNotification,
    generateTicketHtmlEmail,
    extractAttachments
};
