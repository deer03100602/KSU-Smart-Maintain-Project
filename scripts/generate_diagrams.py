# -*- coding: utf-8 -*-
import os
from PIL import Image, ImageDraw, ImageFont

# Ensure target directories exist
os.makedirs("docs/diagrams", exist_ok=True)
os.makedirs("backend/public/diagrams", exist_ok=True)
desktop_path = os.path.expanduser("~/OneDrive/Desktop")
if not os.path.exists(desktop_path):
    desktop_path = os.path.expanduser("~/Desktop")

def get_font(size, bold=False):
    font_name = "tahomabd.ttf" if bold else "tahoma.ttf"
    try:
        return ImageFont.truetype(font_name, size)
    except:
        try:
            return ImageFont.truetype("arial.ttf", size)
        except:
            return ImageFont.load_default()

def draw_rounded_rect(draw, bbox, radius, fill, outline=None, width=1):
    x0, y0, x1, y1 = bbox
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)

def draw_arrow(draw, start, end, color=(99, 102, 241), width=3):
    x0, y0 = start
    x1, y1 = end
    draw.line([x0, y0, x1, y1], fill=color, width=width)
    # Arrow head pointing to end
    import math
    angle = math.atan2(y1 - y0, x1 - x0)
    arrow_len = 12
    p1 = (x1 - arrow_len * math.cos(angle - math.pi / 6), y1 - arrow_len * math.sin(angle - math.pi / 6))
    p2 = (x1 - arrow_len * math.cos(angle + math.pi / 6), y1 - arrow_len * math.sin(angle + math.pi / 6))
    draw.polygon([end, p1, p2], fill=color)

# ==============================================================================
# DIAGRAM 1: USER FLOW & SCREEN SEQUENCE
# ==============================================================================
def generate_user_flow_diagram():
    W, H = 2500, 1500
    img = Image.new("RGB", (W, H), color=(15, 23, 42)) # Slate 900 dark theme
    draw = ImageDraw.Draw(img)

    # Title & Header
    title_font = get_font(42, bold=True)
    sub_font = get_font(22)
    badge_font = get_font(18, bold=True)
    card_title_font = get_font(24, bold=True)
    text_font = get_font(18)
    small_font = get_font(15)

    # Top Brand Header
    draw_rounded_rect(draw, (80, 50, W - 80, 160), radius=16, fill=(30, 41, 59), outline=(71, 85, 105), width=2)
    draw.text((120, 70), "แผนผังขั้นตอนการทำงานของผู้ใช้ ควบคู่กับลำดับหน้าจอ (User Flow & Screen Sequence)", fill=(248, 250, 252), font=title_font)
    draw.text((120, 120), "ระบบแจ้งซ่อมสิ่งพานิชย์และอุปกรณ์อัจฉริยะภายในมหาวิทยาลัยด้วย AI (KSU Smart Maintain)", fill=(148, 163, 184), font=sub_font)

    # --------------------------------------------------------------------------
    # TRACK 1: GENERAL USER / REQUESTER (นักศึกษา / อาจารย์ / บุคลากร)
    # --------------------------------------------------------------------------
    draw_rounded_rect(draw, (80, 200, W - 80, 260), radius=10, fill=(37, 99, 235))
    draw.text((110, 218), "1. เส้นทางการทำงานของผู้ใช้งานทั่วไป (General User: Student / Teacher / Staff)", fill=(255, 255, 255), font=card_title_font)

    user_screens = [
        {
            "step": "Step 1",
            "title": "หน้าแรก (Home Landing)",
            "route": "Route: /",
            "desc": "• ดูภาพรวมระบบและสถิติเบื้องต้น\n• ปุ่มทางลัด 'แจ้งปัญหาใหม่'\n• เมนูเข้าสู่ระบบ / Guest View",
            "color": (59, 130, 246)
        },
        {
            "step": "Step 2",
            "title": "เข้าสู่ระบบ (Login / Auth)",
            "route": "Route: /login",
            "desc": "• ตรวจสอบสิทธิ์ด้วย Email / รหัสผ่าน\n• ระบบ Auto-login & สลับโปรไฟล์\n• แยกบทบาท นักศึกษา/อาจารย์/เจ้าหน้าที่",
            "color": (99, 102, 241)
        },
        {
            "step": "Step 3",
            "title": "แจ้งปัญหาซ่อมบำรุง (Create Ticket)",
            "route": "Route: /create",
            "desc": "• กรอกสถานที่ อาคาร ห้อง และรายละเอียด\n• AI Triage วิเคราะห์ประเภทและความเร่งด่วน\n• อัปโหลดภาพถ่ายก่อนซ่อม (Before)",
            "color": (234, 88, 12)
        },
        {
            "step": "Step 4",
            "title": "รายการปัญหาของฉัน (My Tickets)",
            "route": "Route: /my-tickets, /tickets",
            "desc": "• แสดงรายการตั๋วที่ตนเองส่งแจ้ง\n• ค้นหา กรองสถานะ และเรียงลำดับเวลา\n• ดูสถานะคิวการซ่อมบำรุง (TKT-xx)",
            "color": (16, 185, 129)
        },
        {
            "step": "Step 5",
            "title": "ติดตามความคืบหน้า (Ticket Detail)",
            "route": "Route: /tickets/:id",
            "desc": "• ไทม์ไลน์สถานะงาน (Workflow Timeline)\n• ดูผู้รับผิดชอบและวันนัดหมาย\n• ดูภาพถ่ายหลักฐานและสถานะปิดงาน",
            "color": (14, 165, 233)
        }
    ]

    card_w = 400
    card_h = 340
    start_x = 90
    spacing = 75
    y_user = 290

    for i, s in enumerate(user_screens):
        x = start_x + i * (card_w + spacing)
        # Card background
        draw_rounded_rect(draw, (x, y_user, x + card_w, y_user + card_h), radius=14, fill=(30, 41, 59), outline=s["color"], width=2)
        # Header Badge
        draw_rounded_rect(draw, (x + 16, y_user + 16, x + 90, y_user + 48), radius=6, fill=s["color"])
        draw.text((x + 28, y_user + 22), s["step"], fill=(255, 255, 255), font=badge_font)
        # Screen Title & Route
        draw.text((x + 105, y_user + 22), s["title"], fill=(241, 245, 249), font=card_title_font)
        draw.text((x + 20, y_user + 65), s["route"], fill=(148, 163, 184), font=small_font)
        # Divider
        draw.line([x + 20, y_user + 95, x + card_w - 20, y_user + 95], fill=(51, 65, 85), width=1)
        # Content bullets
        lines = s["desc"].split("\n")
        line_y = y_user + 115
        for line in lines:
            draw.text((x + 20, line_y), line, fill=(226, 232, 240), font=text_font)
            line_y += 36

        # Flow Arrow to next card
        if i < len(user_screens) - 1:
            arrow_start = (x + card_w + 10, y_user + card_h // 2)
            arrow_end = (x + card_w + spacing - 10, y_user + card_h // 2)
            draw_arrow(draw, arrow_start, arrow_end, color=(148, 163, 184), width=4)

    # --------------------------------------------------------------------------
    # TRACK 2: ADMIN & TECHNICIAN (ผู้ดูแลระบบ / เจ้าหน้าที่ IT / ช่างเทคนิค)
    # --------------------------------------------------------------------------
    y_admin_banner = 710
    draw_rounded_rect(draw, (80, y_admin_banner, W - 80, y_admin_banner + 60), radius=10, fill=(147, 51, 234))
    draw.text((110, y_admin_banner + 18), "2. เส้นทางการทำงานของผู้ดูแลระบบและช่างเทคนิค (Admin & Technician Flow)", fill=(255, 255, 255), font=card_title_font)

    admin_screens = [
        {
            "step": "Step A",
            "title": "ศูนย์จัดการงานซ่อม (Maintenance Hub)",
            "route": "Route: /admin",
            "desc": "• กรองและตรวจสอบตั๋วรอรับเรื่อง (Open)\n• มอบหมายช่าง (Assign Tech) & ช่างร่วม\n• กำหนดวันเริ่มและวันสิ้นสุด (Due Date)",
            "color": (168, 85, 247)
        },
        {
            "step": "Step B",
            "title": "สถิติและแดชบอร์ด (Analytical Dashboard)",
            "route": "Route: /dashboard",
            "desc": "• สัดส่วนสถานะ (Status) & ความเร่งด่วน\n• กราฟประเภทปัญหา (Issue Types)\n• ภาระงานช่าง (Technician Workloads)",
            "color": (236, 72, 153)
        },
        {
            "step": "Step C",
            "title": "คุมงบ & สแกนใบเสร็จ (Expense Manager)",
            "route": "Route: /tickets/:id (Expenses Tab)",
            "desc": "• เสนอเบิกค่าอะไหล่/วัสดุซ่อมบำรุง\n• สแกนบิลด้วย Gemini Vision OCR\n• อนุมัติงบประมาณและบันทึกประวัติการเบิก",
            "color": (245, 158, 11)
        },
        {
            "step": "Step D",
            "title": "หลักฐานงานซ่อม (Evidence Manager)",
            "route": "Route: /tickets/:id (Evidence Tab)",
            "desc": "• อัปโหลดภาพ Before, During, After\n• แนบเอกสารตรวจรับและส่งมอบงาน\n• แสดงหลักฐานแบบแนวนอนเต็มจอ Full-width",
            "color": (16, 185, 129)
        },
        {
            "step": "Step E",
            "title": "ตั้งค่าและส่งมอบ (Settings & Closure)",
            "route": "Route: /settings, /issue-types",
            "desc": "• สรุปผลการซ่อมและเปลี่ยนสถานะ Resolved\n• บันทึกผลส่งมอบและปิดตั๋ว (Closed)\n• จัดการรายชื่อช่างและการแจ้งเตือน Email",
            "color": (59, 130, 246)
        }
    ]

    y_admin = 800
    for i, s in enumerate(admin_screens):
        x = start_x + i * (card_w + spacing)
        # Card background
        draw_rounded_rect(draw, (x, y_admin, x + card_w, y_admin + card_h), radius=14, fill=(30, 41, 59), outline=s["color"], width=2)
        # Header Badge
        draw_rounded_rect(draw, (x + 16, y_admin + 16, x + 90, y_admin + 48), radius=6, fill=s["color"])
        draw.text((x + 22, y_admin + 22), s["step"], fill=(255, 255, 255), font=badge_font)
        # Screen Title & Route
        draw.text((x + 105, y_admin + 22), s["title"], fill=(241, 245, 249), font=card_title_font)
        draw.text((x + 20, y_admin + 65), s["route"], fill=(148, 163, 184), font=small_font)
        # Divider
        draw.line([x + 20, y_admin + 95, x + card_w - 20, y_admin + 95], fill=(51, 65, 85), width=1)
        # Content bullets
        lines = s["desc"].split("\n")
        line_y = y_admin + 115
        for line in lines:
            draw.text((x + 20, line_y), line, fill=(226, 232, 240), font=text_font)
            line_y += 36

        # Flow Arrow to next card
        if i < len(admin_screens) - 1:
            arrow_start = (x + card_w + 10, y_admin + card_h // 2)
            arrow_end = (x + card_w + spacing - 10, y_admin + card_h // 2)
            draw_arrow(draw, arrow_start, arrow_end, color=(148, 163, 184), width=4)

    # Cross interaction arrow from User Create (Step 3) down to Admin Hub (Step A)
    # draw_arrow(draw, (start_x + 2 * (card_w + spacing) + card_w//2, y_user + card_h + 10),
    #            (start_x + card_w//2, y_admin - 10), color=(245, 158, 11), width=3)

    # Footer Notes
    footer_text = "มหาวิทยาลัยกาฬสินธุ์ (Kalasin University) • สถาปัตยกรรมการไหลของหน้าจอและผู้ใช้ (UX/UI Screen Workflow Architecture)"
    draw.text((W // 2 - 420, H - 70), footer_text, fill=(100, 116, 139), font=sub_font)

    # Save outputs
    png_path = "docs/diagrams/01_user_flow_and_screen_sequence.png"
    public_png_path = "backend/public/diagrams/01_user_flow_and_screen_sequence.png"
    desktop_png = os.path.join(desktop_path, "01_KSU_User_Flow_Screen_Sequence.png")

    img.save(png_path, "PNG", quality=95)
    img.save(public_png_path, "PNG", quality=95)
    img.save(desktop_png, "PNG", quality=95)
    print("User flow diagram generated successfully!")

# ==============================================================================
# DIAGRAM 2: ER DIAGRAM & DATABASE SCHEMA
# ==============================================================================
def generate_er_diagram():
    W, H = 2500, 1500
    img = Image.new("RGB", (W, H), color=(15, 23, 42)) # Slate 900
    draw = ImageDraw.Draw(img)

    title_font = get_font(42, bold=True)
    sub_font = get_font(22)
    tbl_title_font = get_font(24, bold=True)
    col_name_font = get_font(18, bold=True)
    col_type_font = get_font(16)
    badge_font = get_font(14, bold=True)
    small_font = get_font(16)

    # Header Box
    draw_rounded_rect(draw, (80, 50, W - 80, 160), radius=16, fill=(30, 41, 59), outline=(71, 85, 105), width=2)
    draw.text((120, 70), "การออกแบบฐานข้อมูลเชิงสัมพันธ์ (Entity-Relationship Diagram & Database Schema)", fill=(248, 250, 252), font=title_font)
    draw.text((120, 120), "ฐานข้อมูล PostgreSQL / Prisma ORM • ระบบบริหารจัดการตั๋วแจ้งซ่อมและงบประมาณ", fill=(148, 163, 184), font=sub_font)

    # Define Entities
    tables = [
        {
            "name": "Ticket (ตารางข้อมูลตั๋วแจ้งซ่อมหลัก)",
            "x": 860, "y": 240, "w": 780, "h": 720,
            "header_color": (37, 99, 235),
            "columns": [
                ("id", "String (UUID / CUID)", "PK", True),
                ("ticket_no", "String (Unique, e.g. TKT-01)", "UK", True),
                ("title", "String (หัวข้อปัญหาแจ้งซ่อม)", "", False),
                ("description", "Text (รายละเอียดอาการ)", "", False),
                ("issue_type", "String (หมวดหมู่อ้างอิง)", "FK", False),
                ("location", "String (อาคาร / ชั้น / ห้อง)", "", False),
                ("priority", "Enum (Low / Medium / High / Urgent)", "", False),
                ("status", "Enum (Open / In Progress / Waiting / Resolved / Closed)", "", False),
                ("requester_name", "String (ชื่อผู้แจ้งซ่อม)", "", False),
                ("requester_email", "String (อีเมลผู้แจ้ง)", "FK", False),
                ("assigned_to", "String (ช่างผู้รับผิดชอบหลัก)", "FK", False),
                ("co_workers", "String (ช่างร่วมปฏิบัติงาน)", "", False),
                ("start_date", "DateTime (วันเริ่มงาน)", "", False),
                ("due_date", "DateTime (กำหนดแล้วเสร็จ)", "", False),
                ("budget_status", "Enum (ยังไม่เสนอ / รออนุมัติ / อนุมัติแล้ว)", "", False),
                ("approved_budget", "Float (งบประมาณที่ได้รับอนุมัติ)", "", False),
                ("disbursed_amount", "Float (จำนวนเงินที่เบิกจ่ายจริง)", "", False),
                ("completion_summary", "Text (สรุปผลการแก้ไขงานซ่อม)", "", False),
                ("created_at", "DateTime (วันเวลาสร้าง)", "", False),
                ("closed_at", "DateTime (วันเวลาปิดงาน)", "", False)
            ]
        },
        {
            "name": "User (ตารางผู้ใช้งาน & ช่าง)",
            "x": 80, "y": 240, "w": 680, "h": 460,
            "header_color": (147, 51, 234),
            "columns": [
                ("id", "String (PK)", "PK", True),
                ("email", "String (Unique, Email มหาวิทยาลัย)", "UK", True),
                ("password", "String (Bcrypt Hashed)", "", False),
                ("name", "String (ชื่อ-นามสกุล)", "", False),
                ("group", "Enum (นักศึกษา / อาจารย์ / บุคลากร / ช่าง / แอดมิน)", "", False),
                ("role", "Enum (user / admin / technician)", "", False),
                ("phone", "String (เบอร์โทรติดต่อ)", "", False),
                ("avatar_url", "Text (URL รูปโปรไฟล์)", "", False),
                ("created_at", "DateTime (วันที่สมัคร)", "", False),
                ("updated_at", "DateTime (อัปเดตล่าสุด)", "", False)
            ]
        },
        {
            "name": "IssueType (ตารางประเภทปัญหา)",
            "x": 80, "y": 760, "w": 680, "h": 280,
            "header_color": (16, 185, 129),
            "columns": [
                ("id", "String (PK)", "PK", True),
                ("name", "String (ชื่อประเภทงานซ่อม)", "", False),
                ("description", "String (คำอธิบายขอบเขต)", "", False),
                ("icon", "String (Lucide Icon Identifier)", "", False)
            ]
        },
        {
            "name": "Expense (ตารางค่าใช้จ่าย & ใบเสร็จ)",
            "x": 1740, "y": 240, "w": 680, "h": 600,
            "header_color": (245, 158, 11),
            "columns": [
                ("id", "String (PK)", "PK", True),
                ("ticket_id", "String (อ้างอิงตั๋ว)", "FK", False),
                ("ticket_no", "String (รหัสตั๋ว)", "FK", False),
                ("category", "Enum (อะไหล่ / ค่าแรง / เดินทาง / อื่นๆ)", "", False),
                ("description", "String (รายการที่เบิก)", "", False),
                ("quantity", "Float (จำนวน)", "", False),
                ("unit_price", "Float (ราคาต่อหน่วย)", "", False),
                ("net_amount", "Float (ยอดสุทธิรวมภาษี/ส่วนลด)", "", False),
                ("receipt_no", "String (เลขที่ใบเสร็จ/บิล)", "", False),
                ("vendor_name", "String (ชื่อร้านค้า/ผู้จัดจำหน่าย)", "", False),
                ("receipt_url", "String (URL ไฟล์รูปใบเสร็จ OCR)", "", False),
                ("status", "Enum (PENDING / APPROVED / REJECTED)", "", False),
                ("created_by", "String (ผู้เสนอขอเบิก)", "FK", False),
                ("approved_by", "String (ผู้อนุมัติ)", "FK", False),
                ("created_at", "DateTime", "", False)
            ]
        },
        {
            "name": "TicketTimeline (ไทม์ไลน์บันทึกขั้นตอน)",
            "x": 1740, "y": 900, "w": 680, "h": 460,
            "header_color": (14, 165, 233),
            "columns": [
                ("id", "String (PK)", "PK", True),
                ("ticket_id", "String (อ้างอิงตั๋ว)", "FK", False),
                ("ticket_no", "String (รหัสตั๋ว)", "FK", False),
                ("action", "Enum (ASSIGNED / ACCEPTED / RESOLVED...)", "", False),
                ("title", "String (หัวข้อกิจกรรม)", "", False),
                ("description", "Text (บันทึกหมายเหตุ/อาการ)", "", False),
                ("actor_name", "String (ชื่อผู้ดำเนินการ)", "", False),
                ("actor_role", "String (บทบาทขณะบันทึก)", "", False),
                ("created_at", "DateTime (วันเวลาบันทึก)", "", False)
            ]
        },
        {
            "name": "Evidence (หลักฐานภาพถ่ายงานซ่อม)",
            "x": 860, "y": 1020, "w": 780, "h": 340,
            "header_color": (236, 72, 153),
            "columns": [
                ("id", "String (PK)", "PK", True),
                ("ticket_id", "String (อ้างอิงตั๋ว)", "FK", False),
                ("ticket_no", "String (รหัสตั๋ว)", "FK", False),
                ("stage", "Enum (BEFORE / DURING / AFTER / DOCUMENT)", "", False),
                ("url", "String (URL รูปภาพหลักฐาน)", "", False),
                ("name", "String (ชื่อรูปภาพ/ไฟล์)", "", False),
                ("created_by", "String (ผู้อัปโหลด)", "FK", False),
                ("created_at", "DateTime (วันเวลาอัปโหลด)", "", False)
            ]
        }
    ]

    for tbl in tables:
        x, y, w, h = tbl["x"], tbl["y"], tbl["w"], tbl["h"]
        # Table Box
        draw_rounded_rect(draw, (x, y, x + w, y + h), radius=12, fill=(30, 41, 59), outline=(71, 85, 105), width=2)
        # Header banner
        draw_rounded_rect(draw, (x, y, x + w, y + 54), radius=12, fill=tbl["header_color"])
        # Cover bottom corners of header to make flat join
        draw.rectangle([x, y + 42, x + w, y + 54], fill=tbl["header_color"])
        draw.text((x + 18, y + 14), tbl["name"], fill=(255, 255, 255), font=tbl_title_font)

        # Draw Columns
        curr_y = y + 68
        for col, col_type, tag, is_pk in tbl["columns"]:
            # Badge PK / FK / UK
            if tag:
                badge_bg = (239, 68, 68) if tag == "PK" else ((245, 158, 11) if tag == "FK" else (16, 185, 129))
                draw_rounded_rect(draw, (x + 14, curr_y - 2, x + 44, curr_y + 20), radius=4, fill=badge_bg)
                draw.text((x + 18, curr_y), tag, fill=(255, 255, 255), font=badge_font)
            
            # Column Name
            col_color = (255, 215, 0) if is_pk else ((147, 197, 253) if tag == "FK" else (241, 245, 249))
            draw.text((x + 55, curr_y), col, fill=col_color, font=col_name_font)
            # Column Type
            draw.text((x + 230, curr_y + 2), col_type, fill=(148, 163, 184), font=col_type_font)
            curr_y += 31

    # --------------------------------------------------------------------------
    # RELATIONSHIP CONNECTORS & CARDINALITY LABELS
    # --------------------------------------------------------------------------
    # 1. User (1) ---> Ticket (N)
    draw.line([760, 420, 860, 420], fill=(168, 85, 247), width=3)
    draw.text((770, 390), "1 : N (Requester / Assignee)", fill=(216, 180, 254), font=small_font)

    # 2. IssueType (1) ---> Ticket (N)
    draw.line([760, 840, 810, 840], fill=(16, 185, 129), width=3)
    draw.line([810, 840, 810, 480], fill=(16, 185, 129), width=3)
    draw.line([810, 480, 860, 480], fill=(16, 185, 129), width=3)
    draw.text((770, 810), "1 : N (Categorization)", fill=(110, 231, 183), font=small_font)

    # 3. Ticket (1) ---> Expense (N)
    draw.line([1640, 420, 1740, 420], fill=(245, 158, 11), width=3)
    draw.text((1655, 390), "1 : N (Expenses)", fill=(253, 230, 138), font=small_font)

    # 4. Ticket (1) ---> TicketTimeline (N)
    draw.line([1640, 680, 1690, 680], fill=(14, 165, 233), width=3)
    draw.line([1690, 680, 1690, 1050], fill=(14, 165, 233), width=3)
    draw.line([1690, 1050, 1740, 1050], fill=(14, 165, 233), width=3)
    draw.text((1650, 650), "1 : N (Audit)", fill=(186, 230, 253), font=small_font)

    # 5. Ticket (1) ---> Evidence (N)
    draw.line([1250, 960, 1250, 1020], fill=(236, 72, 153), width=3)
    draw.text((1260, 980), "1 : N (Before/After)", fill=(244, 114, 182), font=small_font)

    # Footer Notes
    footer_text = "มหาวิทยาลัยกาฬสินธุ์ (Kalasin University) • ผังแสดงความสัมพันธ์ของฐานข้อมูล (Entity Relationship Diagram)"
    draw.text((W // 2 - 400, H - 70), footer_text, fill=(100, 116, 139), font=sub_font)

    # Save outputs
    png_path = "docs/diagrams/02_er_diagram_database_schema.png"
    public_png_path = "backend/public/diagrams/02_er_diagram_database_schema.png"
    desktop_png = os.path.join(desktop_path, "02_KSU_ER_Diagram_Database_Schema.png")

    img.save(png_path, "PNG", quality=95)
    img.save(public_png_path, "PNG", quality=95)
    img.save(desktop_png, "PNG", quality=95)
    print("ER Diagram generated successfully!")

if __name__ == "__main__":
    generate_user_flow_diagram()
    generate_er_diagram()
