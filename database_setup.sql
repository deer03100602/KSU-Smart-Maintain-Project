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
