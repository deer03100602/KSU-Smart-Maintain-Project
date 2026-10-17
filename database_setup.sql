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
    "phone" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- เพิ่มคอลัมน์อัตโนมัติหากตารางมีอยู่แล้ว
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

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
INSERT INTO "User" ("id", "email", "password", "name", "phone", "group", "role", "avatar_url")
VALUES
    ('usr-admin-deer-main', 'thunyaratboonrod03@gmail.com', '$2b$10$52NR.7JTFXd5lWxLgK/Rfet/EB8zWV1pmGh88H5yODavy0E8ZZUPa', 'Deer', '0642297536', 'ผู้ดูแลระบบ', 'admin', '/uploads/images.webp'),
    ('usr-admin-deer', 'admin@ksu.ac.th', 'admin1234', 'ผู้ดูแลระบบ ม.กาฬสินธุ์', '0642297536', 'ผู้ดูแลระบบ', 'admin', '/uploads/images.webp'),
    ('usr-admin-ksu', 'ksu.smart.maintain@gmail.com', '$2b$10$52NR.7JTFXd5lWxLgK/Rfet/EB8zWV1pmGh88H5yODavy0E8ZZUPa', 'Deer (ผู้ดูแลระบบ)', '0642297536', 'ผู้ดูแลระบบ', 'admin', '/uploads/images.webp'),
    ('usr-staff-tech', 'tech@ksu.ac.th', 'tech1234', 'เจ้าหน้าที่ IT ช่างเทคนิค', '0812345678', 'ฝ่ายซ่อมบำรุง', 'technician', NULL),
    ('usr-user-wipada', 'wipada@ksu.ac.th', 'user1234', 'อาจารย์วิภาดา สังกัดคณะวิทยาศาสตร์', '0898765432', 'อาจารย์', 'user', NULL)
ON CONFLICT ("email") DO UPDATE SET
    "name" = EXCLUDED."name",
    "phone" = EXCLUDED."phone",
    "group" = EXCLUDED."group",
    "role" = EXCLUDED."role",
    "avatar_url" = EXCLUDED."avatar_url";
-- 3. เสร็จสิ้นการสร้างโครงสร้างฐานข้อมูลและโหลดหมวดหมู่เริ่มต้น

