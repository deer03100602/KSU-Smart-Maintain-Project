# AI-Powered University Maintenance & Ticket Management Web Application
**ระบบแจ้งปัญหาและติดตามสถานะการซ่อมบำรุงภายในมหาวิทยาลัยด้วย AI**

เว็บแอปพลิเคชันเวอร์ชันปรับปรุงใหม่ พัฒนาบนเฟรมเวิร์ก **Next.js** และ **React.js** ด้วย App Router สำหรับงาน Front-end และ **Next.js API Routes** สำหรับงาน Back-end โดยมีระบบบันทึกข้อมูลแบบคงอยู่ถาวร (Persisted Database) ฝั่งเซิร์ฟเวอร์ด้วยไฟล์จำลอง `data/db.json`

---

## 🎨 คุณลักษณะเด่นของระบบ (Features)
- **Frontend (React.js)**: พัฒนาด้วยสถาปัตยกรรมแบบ Component-based ภายใต้ App Router จัดการข้อมูลเชิงประกาศแบบ Declarative ป้องกันข้อผิดพลาดการเรนเดอร์ย่อยได้อย่างสมบูรณ์
- **Backend (Next.js API Routes)**:
  - `/api/tickets`: บริการสืบค้น ค้นหาข้อความ กรองตั๋ว และรับข้อมูลสร้างตั๋วใหม่
  - `/api/tickets/[id]`: อัปเดตรายตั๋ว (inline update status/assignee, admin note) และลบตั๋ว
  - `/api/issue-types`: เพิ่ม/แก้ไข/ลบ ประเภทปัญหาสำหรับใช้งานในระบบซ่อมบำรุง
  - `/api/stats`: คำนวณสถิติตัวเลขและข้อมูลสรุปแบบเรียลไทม์ให้กับหน้าแดชบอร์ด
- **Database (db.json)**: เก็บข้อมูลฝั่งเซิร์ฟเวอร์ มีเสถียรภาพและสามารถบันทึกข้อมูลตั๋วปัญหาและประเภทปัญหาข้าม Session ได้จริง เสมือนระบบเว็บจริง
- **การจัดการความปลอดภัย (Role Guard)**: สิทธิ์การเข้าถึงหน้าแอดมิน (`/admin`, `/issue-types`) ถูกจำกัดเฉพาะสิทธิ์การจำลองแบบ Admin เท่านั้น เพื่อความปลอดภัยของข้อมูล
- **Dashboard วิเคราะห์ข้อมูล**: เชื่อมโยงกราฟสรุปสถานะ ความเร่งด่วน และประเภทปัญหาแบบ Dynamic ผ่าน **Chart.js**

---

## 🚀 วิธีการติดตั้งและรันระบบ (How to Run)

### 1. ติดตั้งไลบรารี Dependencies
เปิด Terminal ในโฟลเดอร์โครงการนี้ แล้วรันคำสั่งติดตั้งแพ็กเกจ:
```bash
npm install
```

### 2. รันเซิร์ฟเวอร์สำหรับโหมดพัฒนา (Development Mode)
ใช้คำสั่งเพื่อรันโปรเจกต์บนเครื่องของคุณ:
```bash
npm run dev
```
หลังจากคำสั่งเริ่มทำงานเรียบร้อยแล้ว ให้เปิดบราวเซอร์แล้วเข้าไปที่ URL:
👉 [http://localhost:3000](http://localhost:3000)

### 3. รันสำหรับสร้างโปรเจกต์จริง (Production Build)
สามารถทดสอบการคอมไพล์และรันเซิร์ฟเวอร์แบบ Production ได้ผ่านคำสั่ง:
```bash
npm run build
npm start
```

---

## 📂 โครงสร้างโฟลเดอร์ของระบบ (Project Structure)
```text
Mini Helpdesk  Issue Tracking System/
├── app/
│   ├── layout.js           # โครงสร้าง Layout และ Sidebar ของ React
│   ├── page.js             # หน้าหลักระบบแจ้งปัญหา (Home)
│   ├── create/
│   │   └── page.js         # หน้าฟอร์มสร้างตั๋วปัญหาใหม่
│   ├── tickets/
│   │   ├── page.js         # หน้ารวมรายการตั๋วและตัวค้นหา/กรอง
│   │   └── [id]/
│   │       └── page.js     # หน้าอ่านรายละเอียดตั๋ว
│   ├── my-tickets/
│   │   └── page.js         # หน้าสำหรับตั๋วของฉันโดยเฉพาะ
│   ├── admin/
│   │   └── page.js         # แผงบริหารงานของแอดมินและ Bulk Actions
│   ├── dashboard/
│   │   └── page.js         # หน้าแสดงผลแผนภูมิวิเคราะห์และสถิติ
│   ├── issue-types/
│   │   └── page.js         # หน้าตั้งค่าหมวดหมู่ประเภทปัญหา
│   ├── globals.css         # ระบบดีไซน์ Glassmorphism
│   └── api/
│       ├── tickets/
│       │   ├── route.js    # API ค้นหา/กรอง [GET] และ สร้างตั๋วใหม่ [POST]
│       │   └── [id]/
│       │       └── route.js # API อ่านตั๋วเดี่ยว [GET], แก้ตั๋ว [PATCH], ลบตั๋ว [DELETE]
│       ├── issue-types/
│       │   ├── route.js    # API อ่านและสร้างประเภทปัญหา [GET, POST]
│       │   └── [id]/
│       │       └── route.js # API แก้และลบประเภทปัญหา [PATCH, DELETE]
│       └── stats/
│           └── route.js    # API ดึงสถิติตัวเลขและรายงาน Dashboard [GET]
├── components/
│   ├── Navbar.js           # แถบเมนูด้านซ้ายและ Switcher สลับ Role
│   ├── TicketCard.js       # การ์ดแสดงผลตั๋ว
│   ├── Modal.js            # กล่องยืนยันการทำงานและแก้ไขข้อมูลแบบ Pop-up
│   └── Toast.js            # ระบบแจ้งเตือนความคืบหน้าการทำงาน (Floating Alert)
├── context/
│   └── AppContext.js       # แหล่งรวบรวม State การสลับ Role/Profile/Toast/Modal แบบ Declarative
├── lib/
│   └── db.js               # ตัวเชื่อมฐานข้อมูลไฟล์ JSON บนฝั่ง Server (db.json)
├── data/
│   └── db.json             # ไฟล์เก็บข้อมูลแบบคงอยู่ถาวร (Persisted Server-side DB)
├── package.json            # ไฟล์ติดตั้ง Next.js, React และ Lucide React
├── jsconfig.json           # ตัวกำหนด Path Alias (@/*)
└── legacy/                 # โฟลเดอร์สำรองไฟล์ระบบ SPA ตัวเก่า
```
