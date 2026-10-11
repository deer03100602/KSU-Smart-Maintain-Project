// ============================================================
// data.js — Data Models, LocalStorage CRUD, Sample Data
// Mini Helpdesk / Issue Tracking System
// ============================================================

const DB_KEYS = {
    TICKETS: 'helpdesk_tickets',
    ISSUE_TYPES: 'helpdesk_issue_types',
    COUNTER: 'helpdesk_ticket_counter',
    ROLE: 'helpdesk_current_role',
    INITIALIZED: 'helpdesk_initialized',
    CURRENT_USER: 'helpdesk_current_user'
};

// ── Default Issue Types ──────────────────────────────────────
const DEFAULT_ISSUE_TYPES = [
    { id: 'it-hw', name: 'Computer Hardware', description: 'ปัญหาเครื่องคอมพิวเตอร์ เมาส์ คีย์บอร์ด จอภาพ หรืออุปกรณ์ต่อพ่วง', icon: 'monitor' },
    { id: 'it-sw', name: 'Software / Application', description: 'ปัญหาโปรแกรมใช้งานไม่ได้ ติดตั้งไม่ได้ หรือโปรแกรมมี error', icon: 'app-window' },
    { id: 'it-net', name: 'Network / Internet', description: 'ปัญหาอินเทอร์เน็ต Wi-Fi LAN หรือการเชื่อมต่อเครือข่าย', icon: 'wifi' },
    { id: 'it-print', name: 'Printer / Scanner', description: 'ปัญหาเครื่องพิมพ์ เครื่องสแกน หรืออุปกรณ์สำนักงาน', icon: 'printer' },
    { id: 'it-room', name: 'Classroom / Lab Room', description: 'ปัญหาห้องเรียน ห้องปฏิบัติการ แอร์ ไฟ โปรเจคเตอร์ หรืออุปกรณ์ห้อง', icon: 'school' },
    { id: 'it-acc', name: 'Account / Login', description: 'ปัญหาการเข้าสู่ระบบ บัญชีผู้ใช้ หรือรหัสผ่าน', icon: 'key-round' },
    { id: 'it-other', name: 'Other', description: 'ปัญหาอื่น ๆ ที่ไม่อยู่ในหมวดข้างต้น', icon: 'circle-help' }
];

// ── Status & Priority Definitions ────────────────────────────
const STATUSES = {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    WAITING: 'Waiting for Information',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
    CANCELLED: 'Cancelled'
};

const STATUS_COLORS = {
    'Open': { bg: '#3b82f620', text: '#60a5fa', border: '#3b82f640' },
    'In Progress': { bg: '#f59e0b20', text: '#fbbf24', border: '#f59e0b40' },
    'Waiting for Information': { bg: '#a855f720', text: '#c084fc', border: '#a855f740' },
    'Resolved': { bg: '#22c55e20', text: '#4ade80', border: '#22c55e40' },
    'Closed': { bg: '#6b728020', text: '#9ca3af', border: '#6b728040' },
    'Cancelled': { bg: '#ef444420', text: '#f87171', border: '#ef444440' }
};

const PRIORITIES = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    URGENT: 'Urgent'
};

const PRIORITY_COLORS = {
    'Low': { bg: '#22c55e20', text: '#4ade80', border: '#22c55e40' },
    'Medium': { bg: '#3b82f620', text: '#60a5fa', border: '#3b82f640' },
    'High': { bg: '#f59e0b20', text: '#fbbf24', border: '#f59e0b40' },
    'Urgent': { bg: '#ef444420', text: '#f87171', border: '#ef444440' }
};

const STAFF_MEMBERS = [
    'สมชาย ใจดี',
    'สุภาพร แก้วมณี',
    'ธนพล วงศ์สกุล',
    'พิมพ์ใจ รักเรียน',
    'อนุชา เทคโน'
];

// ── UUID Generator ───────────────────────────────────────────
function generateId() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

// ── Ticket Number Generator ──────────────────────────────────
function generateTicketNo() {
    let counter = parseInt(localStorage.getItem(DB_KEYS.COUNTER) || '0');
    counter++;
    localStorage.setItem(DB_KEYS.COUNTER, counter.toString());
    return 'TKT-' + counter.toString().padStart(4, '0');
}

// ── LocalStorage Helpers ─────────────────────────────────────
function getFromStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('Error reading from localStorage:', e);
        return null;
    }
}

function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
}

// ── Ticket CRUD ──────────────────────────────────────────────
const TicketService = {
    getAll() {
        return getFromStorage(DB_KEYS.TICKETS) || [];
    },

    getById(id) {
        const tickets = this.getAll();
        return tickets.find(t => t.id === id) || null;
    },

    getByTicketNo(ticketNo) {
        const tickets = this.getAll();
        return tickets.find(t => t.ticket_no === ticketNo) || null;
    },

    create(ticketData) {
        const tickets = this.getAll();
        const now = new Date().toISOString();
        const newTicket = {
            id: generateId(),
            ticket_no: generateTicketNo(),
            title: ticketData.title,
            description: ticketData.description,
            issue_type: ticketData.issue_type,
            location: ticketData.location || '',
            priority: ticketData.priority || PRIORITIES.MEDIUM,
            status: STATUSES.OPEN,
            requester_name: ticketData.requester_name,
            requester_email: ticketData.requester_email || '',
            assigned_to: ticketData.assigned_to || '',
            resolution_note: '',
            created_at: now,
            updated_at: now,
            closed_at: null
        };
        tickets.unshift(newTicket);
        saveToStorage(DB_KEYS.TICKETS, tickets);
        return newTicket;
    },

    update(id, updates) {
        const tickets = this.getAll();
        const index = tickets.findIndex(t => t.id === id);
        if (index === -1) return null;

        const now = new Date().toISOString();
        tickets[index] = { ...tickets[index], ...updates, updated_at: now };

        // Auto-set closed_at
        if (updates.status === STATUSES.CLOSED || updates.status === STATUSES.CANCELLED) {
            tickets[index].closed_at = now;
        }

        saveToStorage(DB_KEYS.TICKETS, tickets);
        return tickets[index];
    },

    delete(id) {
        let tickets = this.getAll();
        tickets = tickets.filter(t => t.id !== id);
        saveToStorage(DB_KEYS.TICKETS, tickets);
    },

    search(query) {
        const tickets = this.getAll();
        const q = query.toLowerCase().trim();
        if (!q) return tickets;
        return tickets.filter(t =>
            t.ticket_no.toLowerCase().includes(q) ||
            t.title.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.requester_name.toLowerCase().includes(q)
        );
    },

    filter(filters) {
        let tickets = this.getAll();
        if (filters.status) {
            tickets = tickets.filter(t => t.status === filters.status);
        }
        if (filters.priority) {
            tickets = tickets.filter(t => t.priority === filters.priority);
        }
        if (filters.issue_type) {
            tickets = tickets.filter(t => t.issue_type === filters.issue_type);
        }
        if (filters.assigned_to) {
            tickets = tickets.filter(t => t.assigned_to === filters.assigned_to);
        }
        if (filters.requester_name) {
            tickets = tickets.filter(t => t.requester_name === filters.requester_name);
        }
        if (filters.query) {
            const q = filters.query.toLowerCase().trim();
            tickets = tickets.filter(t =>
                t.ticket_no.toLowerCase().includes(q) ||
                t.title.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q)
            );
        }
        return tickets;
    },

    getStats() {
        const tickets = this.getAll();
        const stats = {
            total: tickets.length,
            byStatus: {},
            byPriority: {},
            byIssueType: {},
            recentTickets: tickets.slice(0, 5)
        };

        Object.values(STATUSES).forEach(s => { stats.byStatus[s] = 0; });
        Object.values(PRIORITIES).forEach(p => { stats.byPriority[p] = 0; });

        const issueTypes = IssueTypeService.getAll();
        issueTypes.forEach(it => { stats.byIssueType[it.name] = 0; });

        tickets.forEach(t => {
            if (stats.byStatus[t.status] !== undefined) stats.byStatus[t.status]++;
            if (stats.byPriority[t.priority] !== undefined) stats.byPriority[t.priority]++;
            if (stats.byIssueType[t.issue_type] !== undefined) stats.byIssueType[t.issue_type]++;
        });

        return stats;
    }
};

// ── Issue Type CRUD ──────────────────────────────────────────
const IssueTypeService = {
    getAll() {
        return getFromStorage(DB_KEYS.ISSUE_TYPES) || DEFAULT_ISSUE_TYPES;
    },

    getById(id) {
        const types = this.getAll();
        return types.find(t => t.id === id) || null;
    },

    create(typeData) {
        const types = this.getAll();
        const newType = {
            id: 'it-' + Date.now().toString(36),
            name: typeData.name,
            description: typeData.description || '',
            icon: typeData.icon || 'circle-help'
        };
        types.push(newType);
        saveToStorage(DB_KEYS.ISSUE_TYPES, types);
        return newType;
    },

    update(id, updates) {
        const types = this.getAll();
        const index = types.findIndex(t => t.id === id);
        if (index === -1) return null;
        types[index] = { ...types[index], ...updates };
        saveToStorage(DB_KEYS.ISSUE_TYPES, types);
        return types[index];
    },

    delete(id) {
        let types = this.getAll();
        types = types.filter(t => t.id !== id);
        saveToStorage(DB_KEYS.ISSUE_TYPES, types);
    }
};

// ── Role Management ──────────────────────────────────────────
const RoleService = {
    getCurrentRole() {
        return localStorage.getItem(DB_KEYS.ROLE) || 'user';
    },
    setRole(role) {
        localStorage.setItem(DB_KEYS.ROLE, role);
    },
    isAdmin() {
        return this.getCurrentRole() === 'admin';
    }
};

// ── Theme Management ──────────────────────────────────────────
const ThemeService = {
    getCurrentTheme() {
        return localStorage.getItem('helpdesk_theme') || 'dark';
    },
    setTheme(theme) {
        localStorage.setItem('helpdesk_theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
    },
    toggleTheme() {
        const current = this.getCurrentTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
        return next;
    },
    init() {
        const theme = this.getCurrentTheme();
        this.setTheme(theme);
    }
};

// ── Current User (simulated) ─────────────────────────────────
const UserService = {
    getCurrentUser() {
        return getFromStorage(DB_KEYS.CURRENT_USER) || { name: 'นักศึกษา ทดสอบ', email: 'student@example.com', group: 'นักศึกษา' };
    },
    setCurrentUser(name, email, group = 'นักศึกษา') {
        saveToStorage(DB_KEYS.CURRENT_USER, { name, email, group });
    }
};

// ── Sample Data ──────────────────────────────────────────────
function loadSampleData() {
    if (localStorage.getItem(DB_KEYS.INITIALIZED)) return;

    // Save default issue types
    saveToStorage(DB_KEYS.ISSUE_TYPES, DEFAULT_ISSUE_TYPES);

    // Create sample tickets
    const sampleTickets = [
        {
            title: 'คอมพิวเตอร์ห้อง Lab 301 เครื่องที่ 5 เปิดไม่ติด',
            description: 'กดปุ่ม Power แล้วไม่มีไฟขึ้น ลองเปลี่ยนปลั๊กแล้วก็ยังไม่ได้ น่าจะเป็นปัญหาที่ Power Supply',
            issue_type: 'Computer Hardware',
            location: 'ห้อง Lab 301 ชั้น 3 อาคาร IT',
            priority: 'High',
            requester_name: 'สมศักดิ์ เรียนดี',
            requester_email: 'somsak@student.ac.th',
            assigned_to: 'สมชาย ใจดี',
            status: 'In Progress',
            resolution_note: 'กำลังตรวจสอบ Power Supply ของเครื่อง'
        },
        {
            title: 'Wi-Fi ห้องเรียน 205 ใช้งานไม่ได้ทั้งห้อง',
            description: 'นักศึกษาทั้งห้องไม่สามารถเชื่อมต่อ Wi-Fi ได้ ลอง restart อุปกรณ์แล้วก็ยังไม่ได้ ต้องการใช้งานด่วนเพราะมีสอบออนไลน์',
            issue_type: 'Network / Internet',
            location: 'ห้องเรียน 205 ชั้น 2 อาคารเรียนรวม',
            priority: 'Urgent',
            requester_name: 'อ.วิชัย สอนดี',
            requester_email: 'wichai@staff.ac.th',
            assigned_to: '',
            status: 'Open',
            resolution_note: ''
        },
        {
            title: 'เครื่องพิมพ์ชั้น 2 กระดาษติดบ่อย',
            description: 'เครื่องพิมพ์ HP LaserJet ชั้น 2 มีปัญหากระดาษติดบ่อยมาก ประมาณ 3-4 ครั้งต่อวัน ทำให้งานพิมพ์ล่าช้า',
            issue_type: 'Printer / Scanner',
            location: 'ห้องพิมพ์งาน ชั้น 2 อาคารสำนักงาน',
            priority: 'Medium',
            requester_name: 'พิมพ์ลดา จันทร์สวย',
            requester_email: 'pimlada@staff.ac.th',
            assigned_to: 'สุภาพร แก้วมณี',
            status: 'Resolved',
            resolution_note: 'เปลี่ยน Roller ดึงกระดาษใหม่แล้ว และทำความสะอาดภายในเครื่อง ทดสอบพิมพ์ 50 แผ่นไม่มีปัญหา'
        },
        {
            title: 'โปรแกรม Microsoft Office เปิดไม่ได้',
            description: 'เครื่องคอมพิวเตอร์ห้อง Lab 102 ทุกเครื่อง เปิด Word, Excel, PowerPoint ไม่ได้ แสดง error "License not found"',
            issue_type: 'Software / Application',
            location: 'ห้อง Lab 102 ชั้น 1 อาคาร IT',
            priority: 'High',
            requester_name: 'นายธนา พัฒนกิจ',
            requester_email: 'thana@student.ac.th',
            assigned_to: 'ธนพล วงศ์สกุล',
            status: 'In Progress',
            resolution_note: 'กำลัง activate license ใหม่ทุกเครื่อง'
        },
        {
            title: 'แอร์ห้องเรียน 401 ไม่เย็น',
            description: 'แอร์ห้องเรียน 401 เปิดแล้วลมออกแต่ไม่เย็น อุณหภูมิในห้องสูงมาก นักศึกษาไม่สามารถเรียนได้อย่างสะดวก',
            issue_type: 'Classroom / Lab Room',
            location: 'ห้องเรียน 401 ชั้น 4 อาคารเรียนรวม',
            priority: 'High',
            requester_name: 'อ.สุนีย์ รักสอน',
            requester_email: 'sunee@staff.ac.th',
            assigned_to: 'อนุชา เทคโน',
            status: 'Waiting for Information',
            resolution_note: 'รอช่างแอร์มาตรวจสอบ นัดวันพรุ่งนี้ 09:00'
        },
        {
            title: 'ลืมรหัสผ่านเข้าระบบ e-Learning',
            description: 'ไม่สามารถเข้าระบบ LMS ได้ ลอง reset password ผ่านอีเมลแล้วแต่ไม่ได้รับอีเมล',
            issue_type: 'Account / Login',
            location: '-',
            priority: 'Low',
            requester_name: 'สิริกัญญา ใจสุข',
            requester_email: 'sirikanya@student.ac.th',
            assigned_to: 'พิมพ์ใจ รักเรียน',
            status: 'Closed',
            resolution_note: 'Reset รหัสผ่านให้แล้ว และแจ้งรหัสผ่านใหม่ทางอีเมลส่วนตัว'
        },
        {
            title: 'จอ Projector ห้อง Lab 201 ภาพไม่ชัด',
            description: 'จอ Projector แสดงภาพเบลอ ปรับ Focus แล้วก็ยังไม่ชัด น่าจะต้องเปลี่ยนหลอด',
            issue_type: 'Classroom / Lab Room',
            location: 'ห้อง Lab 201 ชั้น 2 อาคาร IT',
            priority: 'Medium',
            requester_name: 'อ.ประสิทธิ์ เก่งมาก',
            requester_email: 'prasit@staff.ac.th',
            assigned_to: '',
            status: 'Open',
            resolution_note: ''
        },
        {
            title: 'เมาส์เครื่องที่ 12 ห้อง Lab 301 ไม่ทำงาน',
            description: 'เมาส์ USB ไม่ตอบสนอง ลองเสียบ USB port อื่นแล้วก็ยังไม่ได้',
            issue_type: 'Computer Hardware',
            location: 'ห้อง Lab 301 ชั้น 3 อาคาร IT',
            priority: 'Low',
            requester_name: 'กิตติพงษ์ สร้างสรรค์',
            requester_email: 'kittipong@student.ac.th',
            assigned_to: 'สมชาย ใจดี',
            status: 'Resolved',
            resolution_note: 'เปลี่ยนเมาส์ใหม่เรียบร้อยแล้ว'
        },
        {
            title: 'อินเทอร์เน็ต LAN ห้องสำนักงาน ช้ามาก',
            description: 'ความเร็วอินเทอร์เน็ตต่ำกว่าปกติมาก จากปกติ 100 Mbps เหลือไม่ถึง 5 Mbps ส่งผลกระทบต่อการทำงาน',
            issue_type: 'Network / Internet',
            location: 'สำนักงานสาขาวิชา ชั้น 1',
            priority: 'High',
            requester_name: 'นางสาวรัตนา บริหารดี',
            requester_email: 'rattana@staff.ac.th',
            assigned_to: 'ธนพล วงศ์สกุล',
            status: 'Resolved',
            resolution_note: 'ตรวจสอบพบว่า Switch ชั้น 1 มีปัญหา ได้ทำการ restart และ update firmware แล้ว ความเร็วกลับสู่ปกติ'
        },
        {
            title: 'ติดตั้งโปรแกรม AutoCAD ไม่ได้',
            description: 'ต้องการติดตั้ง AutoCAD 2024 ในห้อง Lab 501 สำหรับวิชาเขียนแบบ แต่สิทธิ์ Admin ไม่เพียงพอ',
            issue_type: 'Software / Application',
            location: 'ห้อง Lab 501 ชั้น 5 อาคาร IT',
            priority: 'Medium',
            requester_name: 'อ.สมพร ออกแบบ',
            requester_email: 'somporn@staff.ac.th',
            assigned_to: '',
            status: 'Open',
            resolution_note: ''
        },
        {
            title: 'เครื่องสแกนเอกสาร สแกนไม่ได้',
            description: 'เครื่อง Scanner Epson ห้องธุรการ กด Scan แล้วขึ้น error "Scanner not found" ลอง reinstall driver แล้วก็ยังไม่ได้',
            issue_type: 'Printer / Scanner',
            location: 'ห้องธุรการ ชั้น 1 อาคารสำนักงาน',
            priority: 'Medium',
            requester_name: 'วิภา ธุรการดี',
            requester_email: 'wipa@staff.ac.th',
            assigned_to: 'สุภาพร แก้วมณี',
            status: 'Cancelled',
            resolution_note: 'ผู้แจ้งแจ้งว่าแก้ไขได้เองแล้ว โดยการเปลี่ยนสาย USB'
        },
        {
            title: 'ระบบ e-Learning ล่มไม่สามารถเข้าใช้งานได้',
            description: 'ระบบ LMS ของมหาวิทยาลัยเข้าใช้งานไม่ได้ตั้งแต่เช้า หน้าเว็บแสดง 503 Service Unavailable มีนักศึกษาจำนวนมากได้รับผลกระทบ',
            issue_type: 'Software / Application',
            location: 'ออนไลน์ - ระบบ e-Learning',
            priority: 'Urgent',
            requester_name: 'อ.วิชัย สอนดี',
            requester_email: 'wichai@staff.ac.th',
            assigned_to: 'ธนพล วงศ์สกุล',
            status: 'Closed',
            resolution_note: 'ประสานงานกับทีม Server แล้ว สาเหตุคือ Database Server เต็ม ได้ทำการ cleanup และ restart service แล้ว'
        }
    ];

    // Reset counter
    localStorage.setItem(DB_KEYS.COUNTER, '0');

    // Create tickets with staggered dates
    const now = new Date();
    sampleTickets.forEach((data, index) => {
        const tickets = TicketService.getAll();
        const daysAgo = sampleTickets.length - index;
        const createdDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - Math.random() * 8 * 60 * 60 * 1000);
        const updatedDate = new Date(createdDate.getTime() + Math.random() * 2 * 24 * 60 * 60 * 1000);
        
        const newTicket = {
            id: generateId(),
            ticket_no: generateTicketNo(),
            title: data.title,
            description: data.description,
            issue_type: data.issue_type,
            location: data.location,
            priority: data.priority,
            status: data.status,
            requester_name: data.requester_name,
            requester_email: data.requester_email,
            assigned_to: data.assigned_to,
            resolution_note: data.resolution_note,
            created_at: createdDate.toISOString(),
            updated_at: updatedDate.toISOString(),
            closed_at: (data.status === 'Closed' || data.status === 'Cancelled') ? updatedDate.toISOString() : null
        };
        tickets.push(newTicket);
        saveToStorage(DB_KEYS.TICKETS, tickets);
    });

    localStorage.setItem(DB_KEYS.INITIALIZED, 'true');
    console.log('✅ Sample data loaded successfully!');
}

// ── Date Formatting ──────────────────────────────────────────
function formatDate(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateShort(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: '2-digit'
    });
}

function timeAgo(isoString) {
    if (!isoString) return '-';
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
    return formatDateShort(isoString);
}
