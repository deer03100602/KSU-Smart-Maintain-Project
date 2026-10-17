-- ============================================================
-- database_setup.sql — PostgreSQL Schema & Demo Data Setup
-- ระบบแจ้งซ่อมและติดตามงานซ่อมบำรุง มหาวิทยาลัยกาฬสินธุ์
-- (KSU Smart Maintain Ticket Management System)
-- ============================================================

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS "IssueType" (
    "id" VARCHAR(64) PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(64) DEFAULT 'circle-help'
);

CREATE TABLE IF NOT EXISTS "User" (
    "id" VARCHAR(64) PRIMARY KEY,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "group" VARCHAR(64) DEFAULT 'นักศึกษา',
    "role" VARCHAR(32) DEFAULT 'user',
    "phone" VARCHAR(32),
    "avatar_url" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Ticket" (
    "id" VARCHAR(64) PRIMARY KEY,
    "ticket_no" VARCHAR(32) UNIQUE NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "issue_type" VARCHAR(255) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "priority" VARCHAR(32) NOT NULL,
    "status" VARCHAR(64) NOT NULL,
    "requester_name" VARCHAR(255) NOT NULL,
    "requester_email" VARCHAR(255) NOT NULL,
    "assigned_to" VARCHAR(255),
    "co_workers" TEXT,
    "start_date" TIMESTAMP WITH TIME ZONE,
    "due_date" TIMESTAMP WITH TIME ZONE,
    "budget_status" VARCHAR(64) DEFAULT 'ยังไม่เสนอ',
    "approved_budget" DOUBLE PRECISION DEFAULT 0,
    "disbursed_amount" DOUBLE PRECISION DEFAULT 0,
    "completion_summary" TEXT,
    "accepted_by" VARCHAR(255),
    "accepted_at" TIMESTAMP WITH TIME ZONE,
    "resolution_note" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "closed_at" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS "Expense" (
    "id" VARCHAR(64) PRIMARY KEY,
    "ticket_id" VARCHAR(64) NOT NULL,
    "ticket_no" VARCHAR(32) NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION DEFAULT 1,
    "unit" VARCHAR(32) DEFAULT 'ชิ้น',
    "unit_price" DOUBLE PRECISION DEFAULT 0,
    "total_price" DOUBLE PRECISION DEFAULT 0,
    "tax_percent" DOUBLE PRECISION DEFAULT 0,
    "tax_amount" DOUBLE PRECISION DEFAULT 0,
    "discount" DOUBLE PRECISION DEFAULT 0,
    "net_amount" DOUBLE PRECISION DEFAULT 0,
    "receipt_no" VARCHAR(100),
    "vendor_name" VARCHAR(255),
    "receipt_date" TIMESTAMP WITH TIME ZONE,
    "receipt_url" TEXT,
    "status" VARCHAR(32) DEFAULT 'PENDING',
    "reject_reason" TEXT,
    "created_by" VARCHAR(64) NOT NULL,
    "created_by_name" VARCHAR(255) NOT NULL,
    "reviewed_by" VARCHAR(255),
    "reviewed_at" TIMESTAMP WITH TIME ZONE,
    "approved_by" VARCHAR(255),
    "approved_at" TIMESTAMP WITH TIME ZONE,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "TicketTimeline" (
    "id" VARCHAR(64) PRIMARY KEY,
    "ticket_id" VARCHAR(64) NOT NULL,
    "ticket_no" VARCHAR(32) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "actor_name" VARCHAR(255) NOT NULL,
    "actor_email" VARCHAR(255),
    "actor_role" VARCHAR(32),
    "data" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Evidence" (
    "id" VARCHAR(64) PRIMARY KEY,
    "ticket_id" VARCHAR(64) NOT NULL,
    "ticket_no" VARCHAR(32) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(64),
    "file_size" INTEGER,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" VARCHAR(64) PRIMARY KEY,
    "action" VARCHAR(64) NOT NULL,
    "actor_id" VARCHAR(64),
    "actor_email" VARCHAR(255),
    "target_type" VARCHAR(64),
    "target_id" VARCHAR(64),
    "detail" TEXT,
    "ip_address" VARCHAR(64),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Insert Issue Types
INSERT INTO "IssueType" ("id", "name", "description", "icon")
VALUES
    ('it-hw', 'อุปกรณ์และคอมพิวเตอร์ (Hardware)', 'ปัญหาเครื่องคอมพิวเตอร์ จอภาพ เมาส์ คีย์บอร์ด หรืออุปกรณ์ต่อพ่วงชำรุด', 'monitor'),
    ('it-sw', 'โปรแกรมและระบบ (Software / System)', 'ปัญหาโปรแกรมใช้งานไม่ได้ ติดตั้งซอฟต์แวร์ หรือระบบมีข้อผิดพลาด', 'app-window'),
    ('it-net', 'ระบบเครือข่ายและอินเทอร์เน็ต (Network / Wi-Fi)', 'ปัญหาอินเทอร์เน็ต Wi-Fi สัญญาณ LAN หรือการเชื่อมต่อเครือข่ายขัดข้อง', 'wifi'),
    ('it-print', 'เครื่องพิมพ์และสแกนเนอร์ (Printer / Scanner)', 'ปัญหาเครื่องพิมพ์ กระดาษติด หมึกหมด หรือเครื่องสแกนเนอร์ไม่ทำงาน', 'printer'),
    ('it-room', 'ห้องเรียนและห้องปฏิบัติการ (Classroom / Lab)', 'ปัญหาอุปกรณ์ในห้องเรียน เครื่องปรับอากาศ เครื่องฉายโปรเจคเตอร์ ระบบไฟส่องสว่าง', 'school'),
    ('it-acc', 'บัญชีผู้ใช้และสิทธิ์การใช้งาน (Account / Login)', 'ปัญหาการเข้าสู่ระบบ ลืมรหัสผ่าน บัญชีผู้ใช้งาน หรือการขอสิทธิ์เข้าถึงระบบ', 'key-round'),
    ('it-other', 'งานบริการทั่วไปและอื่นๆ (General / Other)', 'ปัญหาหรือความต้องการอื่นๆ ที่ไม่อยู่ในหมวดหมู่ข้างต้น', 'circle-help')
ON CONFLICT ("id") DO NOTHING;

-- 3. Insert Master Demo Tickets (TKT-01 to TKT-06)
INSERT INTO "Ticket" (
    "id", "ticket_no", "title", "description", "issue_type", "location", "priority", "status",
    "requester_name", "requester_email", "assigned_to", "co_workers", "start_date", "due_date",
    "budget_status", "approved_budget", "disbursed_amount", "completion_summary", "accepted_by",
    "accepted_at", "resolution_note", "created_at", "updated_at", "closed_at"
) VALUES
(
    'ksu-seed-001', 'TKT-01',
    'เครื่องปรับอากาศห้องปฏิบัติการคอมพิวเตอร์ 302 มีน้ำหยดและไม่เย็น',
    'เครื่องปรับอากาศ Daikin ขนาด 24,000 BTU มีน้ำแอร์หยดลงบนโต๊ะเครื่องคอมพิวเตอร์เครื่องที่ 12-14 และความเย็นลดลงอย่างมาก เกรงว่าจะเกิดไฟฟ้าลัดวงจร ขอให้เจ้าหน้าที่เข้าตรวจสอบด่วน',
    'ห้องเรียนและห้องปฏิบัติการ (Classroom / Lab)',
    'อาคาร 14 คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม ห้อง Lab 302',
    'Urgent', 'In Progress',
    'อาจารย์วิภาดา สังกัดคณะวิทยาศาสตร์ (อาจารย์)', 'wipada@ksu.ac.th',
    'นายวรวิทย์ ช่างเทคนิคระบบปรับอากาศ', 'นายสมชาย ช่างไฟฟ้าและอิเล็กทรอนิกส์',
    '2026-10-16 08:30:00+07', '2026-10-19 16:30:00+07',
    'อนุมัติแล้ว', 2500, 1850, '',
    'นายวรวิทย์ ช่างเทคนิคระบบปรับอากาศ', '2026-10-16 09:00:00+07',
    'กำลังดำเนินการทำความสะอาดถาดน้ำทิ้งและเตรียมตรวจเช็กรอยรั่วน้ำยาแอร์',
    '2026-10-16 08:15:00+07', '2026-10-17 14:30:00+07', NULL
),
(
    'ksu-seed-002', 'TKT-02',
    'เครื่องฉายโปรเจคเตอร์ห้องบรรยาย 401 หลอดภาพดับ ไม่สามารถเปิดสอนได้',
    'โปรเจคเตอร์ Epson เปิดเครื่องแล้วมีไฟสีส้มกะพริบที่ Lamp แล้วเครื่องตัดดับ ไม่สามารถฉายสไลด์การเรียนการสอนได้',
    'อุปกรณ์และคอมพิวเตอร์ (Hardware)',
    'อาคารเฉลิมพระเกียรติ ชั้น 4 ห้องบรรยายรวม 401',
    'High', 'Resolved',
    'Deer (ผู้ดูแลระบบ)', 'thunyaratboonrod03@gmail.com',
    'นายสมชาย ช่างไฟฟ้าและอิเล็กทรอนิกส์', '',
    '2026-10-15 09:00:00+07', '2026-10-17 12:00:00+07',
    'อนุมัติแล้ว', 3500, 3200,
    'เปลี่ยนหลอดภาพโปรเจคเตอร์และตรวจเช็กระบบระบายความร้อนเรียบร้อย พร้อมใช้งาน',
    'นายสมชาย ช่างไฟฟ้าและอิเล็กทรอนิกส์', '2026-10-15 09:30:00+07',
    'เปลี่ยนหลอดภาพโปรเจคเตอร์ OEM ตรงรุ่น ทำความสะอาดแผ่นกรองฝุ่น และทดสอบฉายภาพต่อเนื่อง 2 ชั่วโมง อุณหภูมิปกติ ส่งมอบห้องบรรยายเรียบร้อย',
    '2026-10-15 08:45:00+07', '2026-10-17 11:30:00+07', '2026-10-17 12:00:00+07'
),
(
    'ksu-seed-003', 'TKT-03',
    'สัญญาณ Wi-Fi มหาวิทยาลัย (KSU-WiFi) จุดบริการหอพักนักศึกษาหญิง สัญญาณหลุดบ่อย',
    'Access Point จุดชั้น 3 หลุดบ่อยมาก เชื่อมต่อแล้วขึ้น No Internet Access บางช่วงเชื่อมต่อไม่ได้เลย ขอความอนุเคราะห์ตรวจสอบ Router / Access Point ให้ด้วยครับ',
    'ระบบเครือข่ายและอินเทอร์เน็ต (Network / Wi-Fi)',
    'หอพักนักศึกษาหญิง อาคาร 2 ชั้น 3 โถงกลาง',
    'Medium', 'Waiting for Information',
    'กิตติศักดิ์ พลสยาม (นักศึกษา)', 'student@example.com',
    'เจ้าหน้าที่ IT นครินทร์', '',
    '2026-10-16 14:00:00+07', '2026-10-20 17:00:00+07',
    'ยังไม่เสนอ', 0, 0, '',
    'เจ้าหน้าที่ IT นครินทร์', '2026-10-16 14:30:00+07',
    'ได้เข้าทดสอบสแกน Channel สัญญาณ พบสัญญาณรบกวน ขอข้อมูลหมายเลขห้องและ MAC Address เพิ่มเติม',
    '2026-10-16 13:20:00+07', '2026-10-17 10:15:00+07', NULL
),
(
    'ksu-seed-004', 'TKT-04',
    'โคมไฟส่องสว่าง LED หน้าห้องสมุดกลางและทางเดินเชื่อมอาคารกะพริบและดับ',
    'หลอดไฟ LED T8 ชนิดยาว ทางเดินเชื่อมระหว่างห้องสมุดกลางและอาคารเรียนรวม กะพริบตลอดเวลาและดับไป 3 จุด ทำให้ช่วงค่ำมืดมาก เกรงว่าจะเกิดอันตรายแก่นักศึกษา',
    'งานบริการทั่วไปและอื่นๆ (General / Other)',
    'อาคารบรรณราชนครินทร์ (ห้องสมุดกลาง) ทางเชื่อมอาคาร 10',
    'Medium', 'Open',
    'สมชาย รักดี (เจ้าหน้าที่)', 'staff@ksu.ac.th',
    NULL, '',
    NULL, NULL,
    'ยังไม่เสนอ', 0, 0, '',
    NULL, NULL, '',
    '2026-10-17 09:10:00+07', '2026-10-17 09:10:00+07', NULL
),
(
    'ksu-seed-005', 'TKT-05',
    'คอมพิวเตอร์ห้องธุรการภาควิชาเปิดไม่ติด มีเสียง Beep Code สั้น 3 ครั้ง',
    'คอมพิวเตอร์สำนักงาน Dell OptiPlex เปิดไม่ติด พัดลมหมุนแล้วดับ มีเสียงร้องตี๊ด ตรวจสอบหน้าจอไม่แสดงภาพ มีงานเอกสารด่วนต้องพิมพ์ส่งคณะ',
    'อุปกรณ์และคอมพิวเตอร์ (Hardware)',
    'สำนักงานคณบดี คณะวิศวกรรมศาสตร์ ชั้น 2 ห้องธุรการ',
    'High', 'Closed',
    'นายพิชัย เจ้าหน้าที่ธุรการ (เจ้าหน้าที่)', 'pichai@ksu.ac.th',
    'นายวรวิทย์ ช่างเทคนิคระบบปรับอากาศ', 'เจ้าหน้าที่ IT นครินทร์',
    '2026-10-14 10:30:00+07', '2026-10-15 16:00:00+07',
    'ยังไม่เสนอ', 0, 0,
    'ซ่อมแซมแผงวงจรและทำความสะอาดหน้าสัมผัสแรม เครื่องกลับมาใช้งานได้ปกติ 100%',
    'นายวรวิทย์ ช่างเทคนิคระบบปรับอากาศ', '2026-10-14 11:00:00+07',
    'ถอดแรมออกมาทำความสะอาดหน้าสัมผัสทองเหลือง และสลับสล็อตแรมใหม่ เครื่องเปิดติด บูตเข้า Windows 11 ได้ปกติ ข้อมูลครบถ้วน ตรวจสอบส่งมอบงานเรียบร้อย',
    '2026-10-14 10:00:00+07', '2026-10-15 15:00:00+07', '2026-10-15 15:30:00+07'
),
(
    'ksu-seed-006', 'TKT-06',
    'เครื่องพิมพ์มัลติฟังก์ชัน HP LaserJet ในห้องพักอาจารย์พิมพ์แล้วกระดาษติดและมีคราบหมึก',
    'เครื่องปริ้นเตอร์ HP LaserJet Pro MFP พิมพ์เอกสารออกมาแล้วขอบกระดาษด้านขวามีแถบหมึกดำเปื้อนยาว และกระดาษติดบ่อยที่ช่องป้อนกระดาษด้านล่าง',
    'เครื่องพิมพ์และสแกนเนอร์ (Printer / Scanner)',
    'อาคาร 14 ชั้น 4 ห้องพักอาจารย์สาขาวิศวกรรมคอมพิวเตอร์',
    'Medium', 'In Progress',
    'อาจารย์วิภาดา สังกัดคณะวิทยาศาสตร์ (อาจารย์)', 'wipada@ksu.ac.th',
    'นายสมชาย ช่างไฟฟ้าและอิเล็กทรอนิกส์', '',
    '2026-10-17 13:00:00+07', '2026-10-21 16:30:00+07',
    'รออนุมัติ', 0, 0, '',
    'นายสมชาย ช่างไฟฟ้าและอิเล็กทรอนิกส์', '2026-10-17 13:15:00+07',
    'กำลังรอเบิกชุดลูกยางดึงกระดาษ (Pick-up Roller) และชุดดรัมหมึกใหม่',
    '2026-10-17 11:45:00+07', '2026-10-17 14:20:00+07', NULL
)
ON CONFLICT ("id") DO UPDATE SET
    "ticket_no" = EXCLUDED."ticket_no",
    "title" = EXCLUDED."title",
    "status" = EXCLUDED."status",
    "priority" = EXCLUDED."priority",
    "updated_at" = EXCLUDED."updated_at";

-- 4. Insert Demo Expenses
INSERT INTO "Expense" (
    "id", "ticket_id", "ticket_no", "category", "description", "quantity", "unit",
    "unit_price", "total_price", "tax_percent", "tax_amount", "discount", "net_amount",
    "receipt_no", "vendor_name", "receipt_date", "receipt_url", "status",
    "created_by", "created_by_name", "reviewed_by", "reviewed_at", "approved_by", "approved_at",
    "created_at", "updated_at"
) VALUES
(
    'exp-001-1', 'ksu-seed-001', 'TKT-01', 'ค่าแรง',
    'ค่าบริการล้างเครื่องปรับอากาศขนาด 24,000 BTU และทำความสะอาดถาดระบายน้ำทิ้ง',
    1, 'เครื่อง', 850, 850, 0, 0, 0, 850,
    'INV-6710-041', 'หจก. กาฬสินธุ์แอร์เซอร์วิส', '2026-10-16 14:00:00+07', '', 'APPROVED',
    'tech-001', 'นายวรวิทย์ ช่างเทคนิคระบบปรับอากาศ',
    'Deer (ผู้ดูแลระบบ)', '2026-10-16 15:00:00+07',
    'Deer (ผู้ดูแลระบบ)', '2026-10-16 15:00:00+07',
    '2026-10-16 14:15:00+07', '2026-10-16 15:00:00+07'
),
(
    'exp-001-2', 'ksu-seed-001', 'TKT-01', 'อุปกรณ์',
    'น้ำยาแอร์ R32 พร้อมท่อหุ้มฉนวนระบายน้ำทิ้งเกรดทนทาน 3 เมตร',
    1, 'ชุด', 1000, 1000, 0, 0, 0, 1000,
    'REC-20261017-08', 'ร้านเจริญทรัพย์แอร์คูลลิ่ง', '2026-10-17 10:30:00+07', '', 'APPROVED',
    'tech-001', 'นายวรวิทย์ ช่างเทคนิคระบบปรับอากาศ',
    'Deer (ผู้ดูแลระบบ)', '2026-10-17 11:00:00+07',
    'Deer (ผู้ดูแลระบบ)', '2026-10-17 11:00:00+07',
    '2026-10-17 10:45:00+07', '2026-10-17 11:00:00+07'
),
(
    'exp-002-1', 'ksu-seed-002', 'TKT-02', 'อุปกรณ์',
    'หลอดภาพโปรเจคเตอร์ Epson ELPLP96 ตรงรุ่น สำหรับ Epson EB-X05 / EB-W05',
    1, 'ชุด', 3200, 3200, 0, 0, 0, 3200,
    'INV-6710-092', 'บริษัท สยามไอทีโปรเจคเตอร์ จำกัด', '2026-10-16 11:00:00+07', '', 'APPROVED',
    'tech-002', 'นายสมชาย ช่างไฟฟ้าและอิเล็กทรอนิกส์',
    'Deer (ผู้ดูแลระบบ)', '2026-10-16 11:30:00+07',
    'Deer (ผู้ดูแลระบบ)', '2026-10-16 11:30:00+07',
    '2026-10-16 11:15:00+07', '2026-10-16 11:30:00+07'
),
(
    'exp-006-1', 'ksu-seed-006', 'TKT-06', 'อุปกรณ์',
    'ชุดลูกยางดึงกระดาษ (Pick-up Roller) และชุดลูกกลิ้งแยกรองกระดาษ HP LaserJet',
    1, 'ชุด', 650, 650, 0, 0, 0, 650,
    'QT-20261017-01', 'หจก. กาฬสินธุ์โอเอแอนด์ซัพพลาย', '2026-10-17 13:30:00+07', '', 'PENDING',
    'tech-002', 'นายสมชาย ช่างไฟฟ้าและอิเล็กทรอนิกส์',
    NULL, NULL, NULL, NULL,
    '2026-10-17 13:45:00+07', '2026-10-17 13:45:00+07'
)
ON CONFLICT ("id") DO NOTHING;

-- 5. Insert Demo Timelines
INSERT INTO "TicketTimeline" (
    "id", "ticket_id", "ticket_no", "action", "title", "description",
    "actor_name", "actor_email", "actor_role", "created_at"
) VALUES
('tml-001-1', 'ksu-seed-001', 'TKT-01', 'CREATED', 'แจ้งปัญหาเข้าระบบ', 'อาจารย์วิภาดา สังกัดคณะวิทยาศาสตร์ ส่งเรื่องแจ้งซ่อมเครื่องปรับอากาศ', 'อาจารย์วิภาดา สังกัดคณะวิทยาศาสตร์', 'wipada@ksu.ac.th', 'user', '2026-10-16 08:15:00+07'),
('tml-001-2', 'ksu-seed-001', 'TKT-01', 'ASSIGNED', 'มอบหมายงานให้ช่างผู้รับผิดชอบ', 'มอบหมายงานให้กับ นายวรวิทย์ ช่างเทคนิคระบบปรับอากาศ (กำหนดเสร็จ 19 ต.ค. 2026)', 'Deer (ผู้ดูแลระบบ)', 'thunyaratboonrod03@gmail.com', 'admin', '2026-10-16 08:45:00+07'),
('tml-001-3', 'ksu-seed-001', 'TKT-01', 'EXPENSE_PROPOSED', 'เสนอขออนุมัติงบประมาณซ่อมบำรุง', 'เสนอของบประมาณล้างแอร์และอะไหล่ท่อน้ำทิ้ง รวม 1,850 บาท', 'นายวรวิทย์ ช่างเทคนิคระบบปรับอากาศ', 'tech@ksu.ac.th', 'technician', '2026-10-16 14:15:00+07'),
('tml-001-4', 'ksu-seed-001', 'TKT-01', 'EXPENSE_APPROVED', 'อนุมัติงบประมาณซ่อมบำรุง', 'ผู้ดูแลระบบอนุมัติงบประมาณ 1,850 บาท ให้ดำเนินการซ่อมแซมได้', 'Deer (ผู้ดูแลระบบ)', 'thunyaratboonrod03@gmail.com', 'admin', '2026-10-16 15:00:00+07'),
('tml-002-1', 'ksu-seed-002', 'TKT-02', 'CREATED', 'แจ้งปัญหาโปรเจคเตอร์ดับ', 'แจ้งปัญหาโปรเจคเตอร์ห้อง 401 หลอดภาพดับ', 'Deer (ผู้ดูแลระบบ)', 'thunyaratboonrod03@gmail.com', 'admin', '2026-10-15 08:45:00+07'),
('tml-002-2', 'ksu-seed-002', 'TKT-02', 'COMPLETED', 'ดำเนินงานเสร็จสิ้นและทดสอบระบบ', 'เปลี่ยนหลอดภาพใหม่และทดสอบฉายภาพ 2 ชั่วโมง อุณหภูมิปกติ ส่งมอบงานเรียบร้อย', 'นายสมชาย ช่างไฟฟ้าและอิเล็กทรอนิกส์', 'tech@ksu.ac.th', 'technician', '2026-10-17 11:30:00+07'),
('tml-003-1', 'ksu-seed-003', 'TKT-03', 'CREATED', 'แจ้งปัญหาสัญญาณอินเทอร์เน็ตขัดข้อง', 'กิตติศักดิ์ พลสยาม (นักศึกษา) ส่งเรื่องแจ้งจุดสัญญาณ Wi-Fi หอพักหญิงหลุดบ่อย', 'กิตติศักดิ์ พลสยาม (นักศึกษา)', 'student@example.com', 'user', '2026-10-16 13:20:00+07'),
('tml-003-2', 'ksu-seed-003', 'TKT-03', 'WAITING_INFO', 'ขอข้อมูลตำแหน่งและอุปกรณ์เพิ่มเติม', 'เจ้าหน้าที่ IT ขอข้อมูลหมายเลขห้องพักและรุ่นอุปกรณ์ที่เชื่อมต่อ เพื่อตรวจสอบ Channel สัญญาณ', 'เจ้าหน้าที่ IT นครินทร์', 'staff@ksu.ac.th', 'technician', '2026-10-16 14:30:00+07'),
('tml-004-1', 'ksu-seed-004', 'TKT-04', 'CREATED', 'แจ้งซ่อมไฟทางเดินกะพริบ', 'สมชาย รักดี เจ้าหน้าที่ แจ้งหลอดไฟส่องสว่าง LED หน้าห้องสมุดกลางดับ 3 จุด', 'สมชาย รักดี (เจ้าหน้าที่)', 'staff@ksu.ac.th', 'user', '2026-10-17 09:10:00+07'),
('tml-005-1', 'ksu-seed-005', 'TKT-05', 'CREATED', 'แจ้งคอมพิวเตอร์ธุรการเปิดไม่ติด', 'นายพิชัย เจ้าหน้าที่ธุรการ แจ้งคอมพิวเตอร์สำนักงานมีเสียงเตือน Beep Code', 'นายพิชัย เจ้าหน้าที่ธุรการ (เจ้าหน้าที่)', 'pichai@ksu.ac.th', 'user', '2026-10-14 10:00:00+07'),
('tml-005-2', 'ksu-seed-005', 'TKT-05', 'COMPLETED', 'ซ่อมแซมสำเร็จและส่งมอบเครื่อง', 'ทำความสะอาดหน้าสัมผัสแรมและจัดระเบียบสายไฟภายในเครื่อง บูตระบบทำงานปกติ', 'นายวรวิทย์ ช่างเทคนิคระบบปรับอากาศ', 'tech@ksu.ac.th', 'technician', '2026-10-15 15:00:00+07'),
('tml-006-1', 'ksu-seed-006', 'TKT-06', 'CREATED', 'แจ้งเครื่องพิมพ์กระดาษติด', 'อาจารย์วิภาดา สังกัดคณะวิทยาศาสตร์ แจ้งเครื่องพิมพ์มัลติฟังก์ชันกระดาษติดและมีคราบหมึก', 'อาจารย์วิภาดา สังกัดคณะวิทยาศาสตร์ (อาจารย์)', 'wipada@ksu.ac.th', 'user', '2026-10-17 11:45:00+07'),
('tml-006-2', 'ksu-seed-006', 'TKT-06', 'ASSIGNED', 'มอบหมายงานและตรวจสอบอาการเบื้องต้น', 'ช่างสมชายเข้าตรวจสอบ พบลูกยางดึงกระดาษสึกหรอ เสนอขออนุมัติเบิกอะไหล่ 650 บาท', 'นายสมชาย ช่างไฟฟ้าและอิเล็กทรอนิกส์', 'tech@ksu.ac.th', 'technician', '2026-10-17 13:15:00+07')
ON CONFLICT ("id") DO NOTHING;
