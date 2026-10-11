const fs = require('fs');
const path = require('path');

// Load environment variables from .env
const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
            const key = trimmed.substring(0, eqIdx).trim();
            let val = trimmed.substring(eqIdx + 1).trim();
            if (val.startsWith('"')) {
                const secondQuote = val.indexOf('"', 1);
                if (secondQuote !== -1) val = val.substring(1, secondQuote);
            } else if (val.startsWith("'")) {
                const secondQuote = val.indexOf("'", 1);
                if (secondQuote !== -1) val = val.substring(1, secondQuote);
            }
            process.env[key] = val;
        }
    }
});

const { notifyDiscordActivity } = require('./discordService');

async function testActivity() {
    console.log('--- กำลังส่งข้อความทดสอบไปยังห้อง activity-logs ---');
    console.log('Webhook URL:', process.env.DISCORD_WEBHOOK_ACTIVITY ? 'พบ URL เรียบร้อย' : 'ไม่พบ URL');

    const result = await notifyDiscordActivity({
        title: 'ทดสอบระบบบันทึกกิจกรรม (Activity Log Test)',
        description: 'การทดสอบแจ้งเตือนช่อง activity-logs สำเร็จเรียบร้อยแล้ว!',
        actor: { name: 'Thunyaluk (Admin)', role: 'Administrator', group: 'ผู้ดูแลระบบ' },
        ticket: { ticket_no: 'TKT-ACT-001', title: 'ซ่อมแซมระบบปรับอากาศห้อง Lab 501' },
        action: 'TEST_ACTIVITY',
        details: {
            'สถานะ': 'เชื่อมต่อ Webhook สำเร็จ 100%',
            'ช่องแจ้งเตือน': 'activity-logs',
            'เวลา': new Date().toLocaleString('th-TH')
        }
    });

    console.log('ผลลัพธ์การส่ง:', result);
}

testActivity();
