// ============================================================
// notifications.js — Server-Side Notification Service
// Mini Helpdesk / Issue Tracking System
// ============================================================

import fs from 'fs';
import path from 'path';

const settingsPath = path.join(process.cwd(), 'data/settings.json');

// Helper to get active settings
function getSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Error reading settings.json:', e);
    }
    
    // Fallback to env variables
    return {
        discord_webhook_url: process.env.DISCORD_WEBHOOK_URL || process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL || '',
        emailjs_service_id: process.env.EMAILJS_SERVICE_ID || process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || '',
        emailjs_template_id: process.env.EMAILJS_TEMPLATE_ID || process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || '',
        emailjs_public_key: process.env.EMAILJS_PUBLIC_KEY || process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || '',
        emailjs_private_key: process.env.EMAILJS_PRIVATE_KEY || ''
    };
}

export const NotificationService = {
    // 1. Send Webhook Notification (Discord embed or simple text)
    async sendWebhook(ticket, eventType) {
        const settings = getSettings();
        const webhookUrl = settings.discord_webhook_url;

        if (!webhookUrl) {
            console.log('Webhook notification skipped: URL not configured.');
            return false;
        }

        let title = '';
        let color = 3447003; // Default Blue

        if (eventType === 'create') {
            title = `🆕 มีการแจ้งปัญหาใหม่! (${ticket.ticket_no})`;
            color = 3066993; // Green
        } else if (eventType === 'update') {
            title = `🔄 อัปเดตตั๋วปัญหา (${ticket.ticket_no})`;
            
            if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
                color = 3066993; // Green
            } else if (ticket.status === 'In Progress') {
                color = 15105570; // Orange/Yellow
            } else if (ticket.status === 'Cancelled') {
                color = 15158332; // Red
            }
        }

        // Clean attachments from description before sending to Webhook
        const cleanDesc = ticket.description ? ticket.description.replace(/📎 \[(.*?)\]\((.*?)\)/g, '').trim() : '';

        const payload = {
            embeds: [
                {
                    title: title,
                    color: color,
                    fields: [
                        { name: 'หัวข้อปัญหา', value: ticket.title || '-', inline: false },
                        { name: 'ประเภท', value: ticket.issue_type || '-', inline: true },
                        { name: 'สถานที่', value: ticket.location || '-', inline: true },
                        { name: 'ระดับความเร่งด่วน', value: ticket.priority || '-', inline: true },
                        { name: 'สถานะ', value: ticket.status || '-', inline: true },
                        { name: 'ผู้แจ้ง', value: `${ticket.requester_name} (${ticket.requester_email || 'ไม่ระบุ'})`, inline: false },
                        { name: 'ผู้รับผิดชอบ', value: ticket.assigned_to || 'ยังไม่ได้มอบหมาย', inline: true }
                    ],
                    description: cleanDesc ? `**รายละเอียด:**\n${cleanDesc.substring(0, 500)}` : '',
                    timestamp: new Date().toISOString(),
                    footer: { text: 'AI-Powered University Maintenance & Ticket Management System' }
                }
            ]
        };

        try {
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                console.error(`Webhook sending failed: ${res.statusText}`);
                return false;
            }
            return true;
        } catch (e) {
            console.error('Error sending Webhook:', e);
            return false;
        }
    },

    // 2. Send Email Notification via EmailJS REST API
    async sendEmail(ticket, eventType) {
        const settings = getSettings();
        
        const serviceId = settings.emailjs_service_id;
        const templateId = settings.emailjs_template_id;
        const publicKey = settings.emailjs_public_key;
        const privateKey = settings.emailjs_private_key;

        if (!serviceId || !templateId || !publicKey) {
            console.log('EmailJS notification skipped: credentials not fully configured.');
            return false;
        }

        let subject = '';
        let messageText = '';
        
        if (eventType === 'create') {
            subject = `ระบบรับเรื่องแจ้งปัญหาสำเร็จ - Ticket No: ${ticket.ticket_no}`;
            messageText = `สวัสดีครับ/ค่ะ คุณ ${ticket.requester_name},\n\nระบบได้รับเรื่องแจ้งปัญหาของคุณเรียบร้อยแล้ว:\n\n` +
                          `Ticket No: ${ticket.ticket_no}\n` +
                          `หัวข้อ: ${ticket.title}\n` +
                          `ประเภท: ${ticket.issue_type}\n` +
                          `สถานที่: ${ticket.location}\n` +
                          `ความเร่งด่วน: ${ticket.priority}\n\n` +
                          `คุณสามารถติดตามสถานะการดำเนินงานของตั๋วปัญหานี้ผ่านระบบ AI-Powered University Maintenance & Ticket Management ได้ตลอดเวลาครับ/ค่ะ`;
        } else {
            subject = `อัปเดตสถานะปัญหา Ticket No: ${ticket.ticket_no}`;
            messageText = `สวัสดีครับ/ค่ะ คุณ ${ticket.requester_name},\n\nตั๋วปัญหาของคุณได้รับการอัปเดตสถานะแล้ว:\n\n` +
                          `Ticket No: ${ticket.ticket_no}\n` +
                          `หัวข้อ: ${ticket.title}\n` +
                          `สถานะใหม่: ${ticket.status}\n` +
                          `ผู้รับผิดชอบ: ${ticket.assigned_to || 'ยังไม่ได้มอบหมาย'}\n` +
                          `หมายเหตุการแก้ไข: ${ticket.resolution_note || '-'}\n\n` +
                          `ขอบคุณที่ใช้บริการครับ/ค่ะ`;
        }

        const payload = {
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            accessToken: privateKey || undefined, // Server-side private token
            template_params: {
                subject: subject,
                to_email: ticket.requester_email,
                to_name: ticket.requester_name,
                ticket_no: ticket.ticket_no,
                title: ticket.title,
                status: ticket.status,
                priority: ticket.priority,
                assigned_to: ticket.assigned_to || 'ยังไม่ได้มอบหมาย',
                resolution_note: ticket.resolution_note || '-',
                message: messageText
            }
        };

        // If requester has no email, skip
        if (!ticket.requester_email) {
            console.log('EmailJS notification skipped: requester email is empty.');
            return false;
        }

        try {
            const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error(`EmailJS sending failed: ${res.status} ${errText}`);
                return false;
            }
            return true;
        } catch (e) {
            console.error('Error sending EmailJS email:', e);
            return false;
        }
    },

    // Unified dispatch helper
    async dispatch(ticket, eventType) {
        // Dispatch both asynchronously
        Promise.allSettled([
            this.sendWebhook(ticket, eventType),
            this.sendEmail(ticket, eventType)
        ]).then(results => {
            console.log(`Notification dispatch completed for event '${eventType}':`, results);
        });
    }
};
