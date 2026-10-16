-- ====================================================================
-- KSU SMART MAINTAIN - DATABASE SETUP SCRIPT (PostgreSQL / Supabase / Neon)
-- มหาวิทยาลัยกาฬสินธุ์ (Kalasin University Maintenance Ticket System)
-- ====================================================================
-- สคริปต์นี้สร้างตารางทั้งหมดสำหรับระบบแจ้งซ่อม พร้อมข้อมูลเริ่มต้น
-- ใช้งานได้กับ: Supabase, Neon.tech, Railway, PostgreSQL Local, Docker
-- ====================================================================

-- 1. ตารางหมวดหมู่ปัญหาการแจ้งซ่อม (Issue Types)
CREATE TABLE IF NOT EXISTS "IssueType" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL
);

-- 2. ตารางผู้ใช้งานในระบบ (Users & Roles)
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'นักศึกษา',
    "role" TEXT NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. ตารางรายการแจ้งซ่อม (Tickets)
CREATE TABLE IF NOT EXISTS "Ticket" (
    "id" TEXT PRIMARY KEY,
    "ticket_no" TEXT UNIQUE NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "issue_type" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requester_name" TEXT NOT NULL,
    "requester_email" TEXT NOT NULL,
    "assigned_to" TEXT,
    "co_workers" TEXT,
    "start_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "budget_status" TEXT DEFAULT 'ยังไม่เสนอ',
    "approved_budget" DOUBLE PRECISION DEFAULT 0,
    "disbursed_amount" DOUBLE PRECISION DEFAULT 0,
    "completion_summary" TEXT,
    "accepted_by" TEXT,
    "accepted_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3)
);

-- 4. ตารางบันทึกค่าใช้จ่ายและงบประมาณ (Expenses & Budgeting)
CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT PRIMARY KEY,
    "ticket_id" TEXT NOT NULL,
    "ticket_no" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'ชิ้น',
    "unit_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receipt_no" TEXT,
    "vendor_name" TEXT,
    "receipt_date" TIMESTAMP(3),
    "receipt_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reject_reason" TEXT,
    "created_by" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. ตารางประวัติและไทม์ไลน์การดำเนินงาน (Ticket Timelines)
CREATE TABLE IF NOT EXISTS "TicketTimeline" (
    "id" TEXT PRIMARY KEY,
    "ticket_id" TEXT NOT NULL,
    "ticket_no" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "actor_name" TEXT NOT NULL,
    "actor_email" TEXT,
    "actor_role" TEXT,
    "data" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. ตารางรูปภาพและหลักฐานการซ่อมแซม (Evidences & Gallery)
CREATE TABLE IF NOT EXISTS "Evidence" (
    "id" TEXT PRIMARY KEY,
    "ticket_id" TEXT NOT NULL,
    "ticket_no" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_by" TEXT NOT NULL,
    "created_by_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. ตารางประวัติการตรวจสอบกิจกรรม (Audit Logs)
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "actor_email" TEXT,
    "actor_role" TEXT,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- สร้าง Indexes เพื่อความรวดเร็วในการค้นหา
CREATE INDEX IF NOT EXISTS "idx_ticket_status" ON "Ticket"("status");
CREATE INDEX IF NOT EXISTS "idx_ticket_priority" ON "Ticket"("priority");
CREATE INDEX IF NOT EXISTS "idx_expense_ticket" ON "Expense"("ticket_id", "ticket_no");
CREATE INDEX IF NOT EXISTS "idx_timeline_ticket" ON "TicketTimeline"("ticket_id", "ticket_no");
CREATE INDEX IF NOT EXISTS "idx_evidence_ticket" ON "Evidence"("ticket_id", "ticket_no");
CREATE INDEX IF NOT EXISTS "idx_auditlog_entity" ON "AuditLog"("entity_type", "entity_id");

-- ====================================================================
-- ข้อมูลเริ่มต้น (INITIAL SEED DATA)
-- ====================================================================

-- 1. หมวดหมู่งานซ่อม (Issue Types)
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

-- 2. ผู้ใช้งานเริ่มต้น (Default Users)
INSERT INTO "User" ("id", "email", "password", "name", "group", "role")
VALUES
    ('usr-admin-deer', 'admin@ksu.ac.th', 'admin1234', 'Deer (ผู้ดูแลระบบ)', 'เจ้าหน้าที่ IT', 'admin'),
    ('usr-staff-tech', 'tech@ksu.ac.th', 'tech1234', 'เจ้าหน้าที่ IT ช่างเทคนิค', 'ฝ่ายซ่อมบำรุง', 'technician'),
    ('usr-user-wipada', 'wipada@ksu.ac.th', 'user1234', 'อาจารย์วิภาดา สังกัดคณะวิทยาศาสตร์', 'อาจารย์', 'user')
ON CONFLICT ("id") DO NOTHING;

-- 3. ตั๋วงานซ่อมเริ่มต้น (Sample Tickets)
INSERT INTO "Ticket" (
    "id", "ticket_no", "title", "description", "issue_type", "location", "priority", "status",
    "requester_name", "requester_email", "assigned_to", "co_workers",
    "start_date", "due_date", "budget_status", "approved_budget", "disbursed_amount",
    "completion_summary", "accepted_by", "accepted_at", "resolution_note", "created_at", "updated_at"
)
VALUES
    (
        'id-mv5j19jv-3b0qtw8', 'TKT-001',
        'แจ้งซ่อมเครื่องปรับอากาศและระบบไฟฟ้า ห้องปฏิบัติการคอมพิวเตอร์',
        'เครื่องปรับอากาศมีน้ำหยดและคอมเพรสเซอร์ไม่ทำงาน ระบบไฟส่องสว่างกระพริบ ต้องการให้เจ้าหน้าที่เข้ามาตรวจสอบและซ่อมแซมเร่งด่วน เพื่อให้สามารถใช้งานในการเรียนการสอนได้ตามปกติ',
        'it-room', 'อาคาร 3 ชั้น 2 ห้อง Lab 204', 'Urgent', 'In Progress',
        'Deer (ผู้ดูแลระบบ)', 'admin@ksu.ac.th', 'นายสมชาย ช่างซ่อม (ฝ่ายอาคารสถานที่)', '["นายวิชัย ไฟฟ้า (ฝ่ายซ่อมบำรุง)"]',
        '2026-10-12 08:30:00', '2026-10-15 16:30:00', 'อนุมัติแล้ว', 2182.80, 2182.80,
        NULL, 'นายสมชาย ช่างซ่อม (ฝ่ายอาคารสถานที่)', '2026-10-12 17:31:00',
        'เจ้าหน้าที่เข้าตรวจสอบพื้นที่ พบพัดลมคอยล์เย็นชำรุดและท่อน้ำทิ้งอุดตัน ได้ทำความสะอาดและจัดซื้ออะไหล่เปลี่ยนเรียบร้อยแล้ว',
        '2026-10-12 17:29:25', '2026-10-12 17:35:00'
    ),
    (
        'id-tkt-sample-002', 'TKT-002',
        'เครื่องคอมพิวเตอร์ห้องสืบค้นเปิดไม่ติด จอภาพไม่แสดงผล',
        'เครื่องคอมพิวเตอร์หมายเลข PC-12 ห้องสมุดกลางเปิดเครื่องแล้วมีเสียงเตือน Bios Beep Code จอภาพมืด สนับสนุนการเรียนรู้ของนักศึกษา',
        'it-hw', 'อาคารบรรณราชนครินทร์ ชั้น 1 ห้องสืบค้นข้อมูล', 'Medium', 'In Progress',
        'อาจารย์วิภาดา สังกัดคณะวิทยาศาสตร์ (อาจารย์)', 'wipada@ksu.ac.th', 'เจ้าหน้าที่ IT ช่างเทคนิค', '[]',
        '2026-10-13 09:00:00', '2026-10-16 17:00:00', 'อนุมัติแล้ว', 735.00, 735.00,
        NULL, 'เจ้าหน้าที่ IT ช่างเทคนิค', '2026-10-13 09:15:00',
        'ตรวจเช็คหน้าสัมผัสแรมและเปลี่ยนแบตเตอรี่ไบออส CR2032 เรียบร้อยแล้ว เครื่องเปิดติดปกติ',
        '2026-10-13 01:10:00', '2026-10-13 09:30:00'
    )
ON CONFLICT ("id") DO NOTHING;

-- 4. รายการค่าใช้จ่ายเริ่มต้น (Sample Expenses)
INSERT INTO "Expense" (
    "id", "ticket_id", "ticket_no", "category", "description",
    "quantity", "unit", "unit_price", "total_price", "discount", "tax_percent", "tax_amount", "net_amount",
    "receipt_no", "vendor_name", "receipt_date", "status", "created_by", "created_by_name", "created_at", "updated_at"
)
VALUES
    ('exp-mv5j-01', 'id-mv5j19jv-3b0qtw8', 'TKT-001', 'ค่าอะไหล่', 'มอเตอร์พัดลมคอยล์เย็นเครื่องปรับอากาศ ขนาด 18,000 BTU', 1, 'ชุด', 1850.00, 1850.00, 50.00, 7.00, 126.00, 1926.00, 'REC-2026-10-0982', 'บจก. สยามแอร์ แอนด์ เซอร์วิส กาฬสินธุ์', '2026-10-12 10:00:00', 'APPROVED', 'usr-admin-deer', 'deer (ผู้ดูแลระบบ)', '2026-10-12 17:32:00', '2026-10-12 17:34:00'),
    ('exp-mv5j-02', 'id-mv5j19jv-3b0qtw8', 'TKT-001', 'ค่าวัสดุและอุปกรณ์', 'ท่อระบายน้ำทิ้ง PVC ขนาด 1/2 นิ้ว พร้อมข้อต่อและกาวประสานท่อ', 2, 'เส้น', 120.00, 240.00, 0.00, 7.00, 16.80, 256.80, 'REC-2026-10-0985', 'ร้านกาฬสินธุ์การค้า อุปกรณ์ก่อสร้าง', '2026-10-12 11:30:00', 'APPROVED', 'usr-admin-deer', 'deer (ผู้ดูแลระบบ)', '2026-10-12 17:33:00', '2026-10-12 17:34:00'),
    ('exp-tkt002-01', 'id-tkt-sample-002', 'TKT-002', 'ค่าอะไหล่', 'หน่วยความจำ RAM DDR4 8GB Kingston ValueRAM 2666MHz', 1, 'แผง', 690.00, 690.00, 0.00, 0.00, 0.00, 690.00, 'REC-IT-2026-081', 'Advice IT Infinite สาขากาฬสินธุ์', '2026-10-13 10:00:00', 'APPROVED', 'usr-staff-tech', 'เจ้าหน้าที่ IT ช่างเทคนิค', '2026-10-13 09:20:00', '2026-10-13 09:25:00'),
    ('exp-tkt002-02', 'id-tkt-sample-002', 'TKT-002', 'ค่าวัสดุและอุปกรณ์', 'ถ่านกระดุมไบออส CR2032 Lithium 3V', 1, 'ก้อน', 45.00, 45.00, 0.00, 0.00, 0.00, 45.00, 'REC-IT-2026-082', 'ร้านอิเล็กทรอนิกส์ กาฬสินธุ์', '2026-10-13 10:15:00', 'APPROVED', 'usr-staff-tech', 'เจ้าหน้าที่ IT ช่างเทคนิค', '2026-10-13 09:22:00', '2026-10-13 09:25:00')
ON CONFLICT ("id") DO NOTHING;

-- 5. ไทม์ไลน์การดำเนินงานเริ่มต้น (Sample Timelines)
INSERT INTO "TicketTimeline" ("id", "ticket_id", "ticket_no", "action", "title", "description", "actor_name", "actor_email", "actor_role", "created_at")
VALUES
    ('tml-mv5j-01', 'id-mv5j19jv-3b0qtw8', 'TKT-001', 'CREATED', 'สร้างรายการแจ้งซ่อมใหม่ในระบบ', 'ผู้แจ้ง: Deer (ผู้ดูแลระบบ) | สถานที่: อาคาร 3 ชั้น 2 ห้อง Lab 204 | ความเร่งด่วน: Urgent', 'Deer (ผู้ดูแลระบบ)', 'admin@ksu.ac.th', 'admin', '2026-10-12 17:29:25'),
    ('tml-mv5j-02', 'id-mv5j19jv-3b0qtw8', 'TKT-001', 'ASSIGNED', 'มอบหมายเจ้าหน้าที่รับผิดชอบงาน', 'ผู้รับผิดชอบหลัก: นายสมชาย ช่างซ่อม (ฝ่ายอาคารสถานที่) | ผู้ร่วมดำเนินงาน: นายวิชัย ไฟฟ้า (ฝ่ายซ่อมบำรุง)', 'ผู้ดูแลระบบ', 'admin@ksu.ac.th', 'admin', '2026-10-12 17:30:10'),
    ('tml-mv5j-03', 'id-mv5j19jv-3b0qtw8', 'TKT-001', 'STAFF_ACCEPTED', 'เจ้าหน้าที่กดรับงานซ่อมบำรุง', 'นายสมชาย ช่างซ่อม ได้ทำการกดรับมอบหมายงานซ่อมบำรุงเข้าสู่กระบวนการดำเนินงาน', 'นายสมชาย ช่างซ่อม (ฝ่ายอาคารสถานที่)', 'somchai@ksu.ac.th', 'technician', '2026-10-12 17:31:00'),
    ('tml-mv5j-04', 'id-mv5j19jv-3b0qtw8', 'TKT-001', 'STATUS_CHANGED', 'เปลี่ยนสถานะเป็น: กำลังดำเนินการ (In Progress)', 'เข้าตรวจสอบอุปกรณ์และจัดซื้อวัสดุอะไหล่เพื่อเข้าซ่อมแซม', 'นายสมชาย ช่างซ่อม', 'somchai@ksu.ac.th', 'technician', '2026-10-12 17:31:45'),
    ('tml-tkt002-01', 'id-tkt-sample-002', 'TKT-002', 'CREATED', 'สร้างรายการแจ้งซ่อมใหม่ในระบบ', 'ผู้แจ้ง: อาจารย์วิภาดา สังกัดคณะวิทยาศาสตร์ | สถานที่: อาคารบรรณราชนครินทร์ ชั้น 1 ห้องสืบค้นข้อมูล | ความเร่งด่วน: Medium', 'อาจารย์วิภาดา สังกัดคณะวิทยาศาสตร์ (อาจารย์)', 'wipada@ksu.ac.th', 'user', '2026-10-13 01:10:00'),
    ('tml-tkt002-02', 'id-tkt-sample-002', 'TKT-002', 'ASSIGNED', 'มอบหมายเจ้าหน้าที่รับผิดชอบงาน', 'มอบหมายงานให้ เจ้าหน้าที่ IT ช่างเทคนิค รับผิดชอบตรวจสอบเครื่อง PC-12 ห้องสมุดกลาง', 'ผู้ดูแลระบบ', 'admin@ksu.ac.th', 'admin', '2026-10-13 01:12:00'),
    ('tml-tkt002-03', 'id-tkt-sample-002', 'TKT-002', 'STAFF_ACCEPTED', 'เจ้าหน้าที่กดรับงานซ่อมบำรุง', 'เจ้าหน้าที่ IT ช่างเทคนิค ได้ทำการกดรับมอบหมายงานเข้าสู่กระบวนการตรวจสอบ', 'เจ้าหน้าที่ IT ช่างเทคนิค', 'tech@ksu.ac.th', 'technician', '2026-10-13 09:15:00'),
    ('tml-tkt002-04', 'id-tkt-sample-002', 'TKT-002', 'STATUS_CHANGED', 'เริ่มดำเนินการตรวจสอบเครื่อง (In Progress)', 'ตรวจเช็คสัญญาณเตือน Beep Code ของ BIOS ทำความสะอาดแรม และเปลี่ยนถ่านกระดุมไบออส', 'เจ้าหน้าที่ IT ช่างเทคนิค', 'tech@ksu.ac.th', 'technician', '2026-10-13 09:20:00')
ON CONFLICT ("id") DO NOTHING;

-- 6. หลักฐานและรูปภาพเริ่มต้น (Sample Evidences)
INSERT INTO "Evidence" ("id", "ticket_id", "ticket_no", "stage", "url", "name", "description", "created_by", "created_at")
VALUES
    ('evi-mv5j-01', 'id-mv5j19jv-3b0qtw8', 'TKT-001', 'BEFORE', 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80', 'สภาพเครื่องปรับอากาศก่อนเข้าซ่อมแซม', 'พบหยดน้ำรั่วซึมจากหน้ากากแอร์ และมีเสียงพัดลมทำงานผิดปกติ', 'นายสมชาย ช่างซ่อม', '2026-10-12 17:31:30'),
    ('evi-mv5j-02', 'id-mv5j19jv-3b0qtw8', 'TKT-001', 'DURING', 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop&q=80', 'ขั้นตอนการรื้อถอดและเปลี่ยนชุดมอเตอร์', 'ทำการถอดหน้ากากและเปลี่ยนมอเตอร์พัดลมคอยล์เย็นชุดใหม่', 'นายวิชัย ไฟฟ้า', '2026-10-12 17:33:15'),
    ('evi-tkt002-01', 'id-tkt-sample-002', 'TKT-002', 'BEFORE', 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&auto=format&fit=crop&q=80', 'สภาพเครื่องคอมพิวเตอร์ PC-12 ก่อนตรวจเช็ค', 'เครื่อง PC-12 เปิดไม่ติด มีเสียง Beep Code เตือนจากเมนบอร์ด จอภาพไม่มีสัญญาณ', 'เจ้าหน้าที่ IT ช่างเทคนิค', '2026-10-13 09:16:00'),
    ('evi-tkt002-02', 'id-tkt-sample-002', 'TKT-002', 'DURING', 'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=800&auto=format&fit=crop&q=80', 'ขั้นตอนการถอดตรวจสอบแผงวงจรและแรม', 'ทำความสะอาดสล็อตแรม ตรวจวัดแรงดันไฟแบตเตอรี่ไบออส และเตรียมเปลี่ยนอะไหล่', 'เจ้าหน้าที่ IT ช่างเทคนิค', '2026-10-13 09:25:00'),
    ('evi-tkt002-03', 'id-tkt-sample-002', 'TKT-002', 'AFTER', 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80', 'ทดสอบการทำงานของเครื่องหลังเปลี่ยนอะไหล่', 'เครื่องเปิดติด บูตเข้าสู่ระบบ Windows ได้ราบรื่น จอภาพแสดงผลคมชัดพร้อมให้บริการ', 'เจ้าหน้าที่ IT ช่างเทคนิค', '2026-10-13 09:30:00')
ON CONFLICT ("id") DO NOTHING;

-- เสร็จสิ้นการสร้างโครงสร้างฐานข้อมูลและโหลดข้อมูลเริ่มต้น
