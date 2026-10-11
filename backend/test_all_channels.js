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

const { 
    notifyDiscordUrgent, 
    notifyDiscordPayment, 
    notifyDiscordNewOrder, 
    notifyDiscordSystemError, 
    notifyDiscordActivity 
} = require('./discordService');

async function testAll() {
    console.log('🚀 เริ่มต้นทดสอบส่งข้อความแจ้งเตือน Discord ครบทั้ง 5 ช่อง...');

    const mockTicket = {
        id: 'tkt-live-01',
        ticket_no: 'TKT-2026-088',
        title: 'ระบบไฟฟ้าอาคารเรียนรวมขัดข้อง (ทดสอบระบบ)',
        description: 'หม้อแปลงไฟฟ้าแรงสูงจ่ายกระแสไฟไม่นิ่ง ต้องการการแก้ไขด่วน',
        issue_type: 'ระบบไฟฟ้า',
        priority: 'Urgent',
        location: 'อาคารเรียนรวม 5 ชั้น 1',
        requester_name: 'อาจารย์ ดร. สมเกียรติ',
        requester_email: 'somkiat@ksu.ac.th',
        status: 'In Progress',
        assigned_to: 'นายช่าง สมชาย ช่างไฟฟ้า'
    };

    const mockExpense = {
        id: 'exp-live-01',
        ticket_id: mockTicket.id,
        ticket_no: mockTicket.ticket_no,
        category: 'อุปกรณ์',
        description: 'เปลี่ยน Breaker ขนาด 100A และสายไฟทนความร้อนสูง',
        net_amount: 8500,
        status: 'APPROVED',
        receipt_no: 'REC-2026-7788',
        vendor_name: 'บริษัท สยามการไฟฟ้า จำกัด'
    };

    // 1. แจ้งเตือนเร่งด่วน
    console.log('\n[1/5] กำลังทดสอบ: แจ้งเตือนเร่งด่วน (URGENT)...');
    const r1 = await notifyDiscordUrgent(mockTicket, 'งานด่วนพิเศษ! ไฟฟ้าดับทั้งชั้น');
    console.log('สถานะ:', r1.success ? '✅ สำเร็จ' : '❌ ล้มเหลว', r1.error || '');

    // 2. ยอดเงินและการชำระเงิน (ต้องผ่านการยืนยันหลังบ้าน)
    console.log('\n[2/5] กำลังทดสอบ: ยอดเงินและการชำระเงิน (PAYMENT)...');
    const r2 = await notifyDiscordPayment(mockExpense, mockTicket, {
        verified: true,
        verified_by: 'หัวหน้างานพัสดุและงบประมาณ',
        transaction_id: 'TXN-KSU-998822',
        provider: 'ธนาคารกรุงไทย / ระบบเบิกจ่ายมหาวิทยาลัย'
    });
    console.log('สถานะ:', r2.success ? '✅ สำเร็จ' : '❌ ล้มเหลว', r2.error || '');

    // 3. ออเดอร์ใหม่ / งานแจ้งซ่อมใหม่
    console.log('\n[3/5] กำลังทดสอบ: ออเดอร์ใหม่ (NEW_ORDER)...');
    const r3 = await notifyDiscordNewOrder(mockTicket);
    console.log('สถานะ:', r3.success ? '✅ สำเร็จ' : '❌ ล้มเหลว', r3.error || '');

    // 4. ข้อผิดพลาดของระบบ
    console.log('\n[4/5] กำลังทดสอบ: ข้อผิดพลาดของระบบ (SYSTEM_ERROR)...');
    const r4 = await notifyDiscordSystemError({
        message: 'ทดสอบการตรวจจับข้อผิดพลาดในระบบ (System Alert)',
        stack: 'Error: Database connection pool warning\n    at HealthCheck (backend/index.js:55:12)',
        route: 'GET /api/health',
        user: { name: 'Thunyaluk', role: 'admin' }
    });
    console.log('สถานะ:', r4.success ? '✅ สำเร็จ' : '❌ ล้มเหลว', r4.error || '');

    // 5. บันทึกกิจกรรม (Activity Log)
    console.log('\n[5/5] กำลังทดสอบ: activity-logs (ACTIVITY)...');
    const r5 = await notifyDiscordActivity({
        title: 'เจ้าหน้าที่กดรับงานและเริ่มดำเนินการ',
        description: 'นายช่าง สมชาย ได้กดรับงานซ่อมระบบไฟฟ้าเรียบร้อยแล้ว และกำลังเข้าตรวจสอบหน้างาน',
        actor: { name: 'นายช่าง สมชาย', role: 'technician', group: 'ฝ่ายอาคารสถานที่' },
        ticket: mockTicket,
        action: 'ACCEPTED',
        details: {
            'สถานะงาน': 'In Progress',
            'เวลาที่รับงาน': new Date().toLocaleString('th-TH')
        }
    });
    console.log('สถานะ:', r5.success ? '✅ สำเร็จ' : '❌ ล้มเหลว', r5.error || '');

    console.log('\n🎉 ทดสอบส่งครบทั้ง 5 ช่องเรียบร้อยแล้ว!');
}

testAll();
