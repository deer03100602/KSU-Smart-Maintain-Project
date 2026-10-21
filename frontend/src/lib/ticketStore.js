// ============================================================
// ticketStore.js — Persistent Client-Side Ticket & Workflow Cache
// Ensures tickets and actions survive serverless lambda cold starts & resets
// ============================================================

const TICKETS_KEY = 'ksu_tickets_store_v1';
const EXPENSES_KEY = 'ksu_expenses_store_v1';
const TIMELINES_KEY = 'ksu_timelines_store_v1';
const EVIDENCES_KEY = 'ksu_evidences_store_v1';
const DELETED_KEY = 'ksu_deleted_tickets_v1';
const DEFAULT_MOCK_DELETED_IDS = [
    'id-mv5j19jv-3b0qtw8', 'id-tkt-sample-002', 'tkt-001', 'tkt-002'
].map(s => s.toLowerCase());

export const INITIAL_DEMO_TICKETS = [
  {
    id: 'ksu-seed-001',
    ticket_no: 'TKT-01',
    title: 'เครื่องปรับอากาศห้องปฏิบัติการคอมพิวเตอร์ 302 มีน้ำหยดและไม่เย็น',
    description: 'เครื่องปรับอากาศ Daikin ขนาด 24,000 BTU มีน้ำแอร์หยดลงบนโต๊ะเครื่องคอมพิวเตอร์เครื่องที่ 12-14 และความเย็นลดลงอย่างมาก เกรงว่าจะเกิดไฟฟ้าลัดวงจร ขอให้เจ้าหน้าที่เข้าตรวจสอบด่วน',
    issue_type: 'ห้องเรียนและห้องปฏิบัติการ (Classroom / Lab)',
    location: 'อาคาร 14 คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม ห้อง Lab 302',
    priority: 'Urgent',
    status: 'In Progress',
    requester_name: 'อาจารย์วิภาดา สังกัดคณะวิทยาศาสตร์ (อาจารย์)',
    requester_email: 'wipada@ksu.ac.th',
    assigned_to: 'นายวรวิทย์ ช่างเทคนิคระบบปรับอากาศ',
    co_workers: 'นายสมชาย ช่างไฟฟ้าและอิเล็กทรอนิกส์',
    start_date: '2026-10-16T08:30:00.000Z',
    due_date: '2026-10-19T16:30:00.000Z',
    budget_status: 'อนุมัติแล้ว',
    approved_budget: 2500,
    disbursed_amount: 1850,
    completion_summary: '',
    accepted_by: 'นายวรวิทย์ ช่างเทคนิคระบบปรับอากาศ',
    accepted_at: '2026-10-16T09:00:00.000Z',
    resolution_note: 'กำลังดำเนินการทำความสะอาดถาดน้ำทิ้งและเตรียมตรวจเช็กรอยรั่วน้ำยาแอร์',
    created_at: '2026-10-16T08:15:00.000Z',
    updated_at: '2026-10-17T14:30:00.000Z'
  },
  {
    id: 'ksu-seed-002',
    ticket_no: 'TKT-02',
    title: 'เครื่องฉายโปรเจคเตอร์ห้องบรรยาย 401 หลอดภาพดับ ไม่สามารถเปิดสอนได้',
    description: 'โปรเจคเตอร์ Epson เปิดเครื่องแล้วมีไฟสีส้มกะพริบที่ Lamp แล้วเครื่องตัดดับ ไม่สามารถฉายสไลด์การเรียนการสอนได้',
    issue_type: 'อุปกรณ์และคอมพิวเตอร์ (Hardware)',
    location: 'อาคารเฉลิมพระเกียรติ ชั้น 4 ห้องบรรยายรวม 401',
    priority: 'High',
    status: 'Resolved',
    requester_name: 'Deer (ผู้ดูแลระบบ)',
    requester_email: 'thunyaratboonrod03@gmail.com',
    assigned_to: 'นายสมชาย ช่างไฟฟ้าและอิเล็กทรอนิกส์',
    co_workers: '',
    start_date: '2026-10-15T09:00:00.000Z',
    due_date: '2026-10-17T12:00:00.000Z',
    budget_status: 'อนุมัติแล้ว',
    approved_budget: 3500,
    disbursed_amount: 3200,
    completion_summary: 'เปลี่ยนหลอดภาพโปรเจคเตอร์และตรวจเช็กระบบระบายความร้อนเรียบร้อย พร้อมใช้งาน',
    accepted_by: 'นายสมชาย ช่างไฟฟ้าและอิเล็กทรอนิกส์',
    accepted_at: '2026-10-15T09:30:00.000Z',
    resolution_note: 'เปลี่ยนหลอดภาพโปรเจคเตอร์ OEM ตรงรุ่น ทำความสะอาดแผ่นกรองฝุ่น และทดสอบฉายภาพต่อเนื่อง 2 ชั่วโมง อุณหภูมิปกติ ส่งมอบห้องบรรยายเรียบร้อย',
    created_at: '2026-10-15T08:45:00.000Z',
    updated_at: '2026-10-17T11:30:00.000Z',
    closed_at: '2026-10-17T12:00:00.000Z'
  },
  {
    id: 'ksu-seed-003',
    ticket_no: 'TKT-03',
    title: 'สัญญาณ Wi-Fi มหาวิทยาลัย (KSU-WiFi) จุดบริการหอพักนักศึกษาหญิง สัญญาณหลุดบ่อย',
    description: 'Access Point จุดชั้น 3 หลุดบ่อยมาก เชื่อมต่อแล้วขึ้น No Internet Access บางช่วงเชื่อมต่อไม่ได้เลย ขอความอนุเคราะห์ตรวจสอบ Router / Access Point ให้ด้วยครับ',
    issue_type: 'ระบบเครือข่ายและอินเทอร์เน็ต (Network / Wi-Fi)',
    location: 'หอพักนักศึกษาหญิง อาคาร 2 ชั้น 3 โถงกลาง',
    priority: 'Medium',
    status: 'Waiting for Information',
    requester_name: 'กิตติศักดิ์ พลสยาม (นักศึกษา)',
    requester_email: 'student@example.com',
    assigned_to: 'เจ้าหน้าที่ IT นครินทร์',
    co_workers: '',
    start_date: '2026-10-16T14:00:00.000Z',
    due_date: '2026-10-20T17:00:00.000Z',
    budget_status: 'ยังไม่เสนอ',
    approved_budget: 0,
    disbursed_amount: 0,
    completion_summary: '',
    accepted_by: 'เจ้าหน้าที่ IT นครินทร์',
    accepted_at: '2026-10-16T14:30:00.000Z',
    resolution_note: 'ได้เข้าทดสอบสแกน Channel สัญญาณ พบสัญญาณรบกวน ขอข้อมูลหมายเลขห้องและ MAC Address เพิ่มเติม',
    created_at: '2026-10-16T13:20:00.000Z',
    updated_at: '2026-10-17T10:15:00.000Z'
  },
  {
    id: 'ksu-seed-004',
    ticket_no: 'TKT-04',
    title: 'โคมไฟส่องสว่าง LED หน้าห้องสมุดกลางและทางเดินเชื่อมอาคารกะพริบและดับ',
    description: 'หลอดไฟ LED T8 ชนิดยาว ทางเดินเชื่อมระหว่างห้องสมุดกลางและอาคารเรียนรวม กะพริบตลอดเวลาและดับไป 3 จุด ทำให้ช่วงค่ำมืดมาก เกรงว่าจะเกิดอันตรายแก่นักศึกษา',
    issue_type: 'งานบริการทั่วไปและอื่นๆ (General / Other)',
    location: 'อาคารบรรณราชนครินทร์ (ห้องสมุดกลาง) ทางเชื่อมอาคาร 10',
    priority: 'Medium',
    status: 'Open',
    requester_name: 'สมชาย รักดี (เจ้าหน้าที่)',
    requester_email: 'staff@ksu.ac.th',
    assigned_to: null,
    co_workers: '',
    start_date: null,
    due_date: null,
    budget_status: 'ยังไม่เสนอ',
    approved_budget: 0,
    disbursed_amount: 0,
    completion_summary: '',
    accepted_by: null,
    accepted_at: null,
    resolution_note: '',
    created_at: '2026-10-17T09:10:00.000Z',
    updated_at: '2026-10-17T09:10:00.000Z'
  },
  {
    id: 'ksu-seed-005',
    ticket_no: 'TKT-05',
    title: 'คอมพิวเตอร์ห้องธุรการภาควิชาเปิดไม่ติด มีเสียง Beep Code สั้น 3 ครั้ง',
    description: 'คอมพิวเตอร์สำนักงาน Dell OptiPlex เปิดไม่ติด พัดลมหมุนแล้วดับ มีเสียงร้องตี๊ด ตรวจสอบหน้าจอไม่แสดงภาพ มีงานเอกสารด่วนต้องพิมพ์ส่งคณะ',
    issue_type: 'อุปกรณ์และคอมพิวเตอร์ (Hardware)',
    location: 'สำนักงานคณบดี คณะวิศวกรรมศาสตร์ ชั้น 2 ห้องธุรการ',
    priority: 'High',
    status: 'Closed',
    requester_name: 'นายพิชัย เจ้าหน้าที่ธุรการ (เจ้าหน้าที่)',
    requester_email: 'pichai@ksu.ac.th',
    assigned_to: 'นายวรวิทย์ ช่างเทคนิคระบบปรับอากาศ',
    co_workers: 'เจ้าหน้าที่ IT นครินทร์',
    start_date: '2026-10-14T10:30:00.000Z',
    due_date: '2026-10-15T16:00:00.000Z',
    budget_status: 'ยังไม่เสนอ',
    approved_budget: 0,
    disbursed_amount: 0,
    completion_summary: 'ซ่อมแซมแผงวงจรและทำความสะอาดหน้าสัมผัสแรม เครื่องกลับมาใช้งานได้ปกติ 100%',
    accepted_by: 'นายวรวิทย์ ช่างเทคนิคระบบปรับอากาศ',
    accepted_at: '2026-10-14T11:00:00.000Z',
    resolution_note: 'ถอดแรมออกมาทำความสะอาดหน้าสัมผัสทองเหลือง และสลับสล็อตแรมใหม่ เครื่องเปิดติด บูตเข้า Windows 11 ได้ปกติ ข้อมูลครบถ้วน ตรวจสอบส่งมอบงานเรียบร้อย',
    created_at: '2026-10-14T10:00:00.000Z',
    updated_at: '2026-10-15T15:00:00.000Z',
    closed_at: '2026-10-15T15:30:00.000Z'
  },
  {
    id: 'ksu-seed-006',
    ticket_no: 'TKT-06',
    title: 'เครื่องพิมพ์มัลติฟังก์ชัน HP LaserJet ในห้องพักอาจารย์พิมพ์แล้วกระดาษติดและมีคราบหมึก',
    description: 'เครื่องปริ้นเตอร์ HP LaserJet Pro MFP พิมพ์เอกสารออกมาแล้วขอบกระดาษด้านขวามีแถบหมึกดำเปื้อนยาว และกระดาษติดบ่อยที่ช่องป้อนกระดาษด้านล่าง',
    issue_type: 'เครื่องพิมพ์และสแกนเนอร์ (Printer / Scanner)',
    location: 'อาคาร 14 ชั้น 4 ห้องพักอาจารย์สาขาวิศวกรรมคอมพิวเตอร์',
    priority: 'Medium',
    status: 'In Progress',
    requester_name: 'อาจารย์วิภาดา สังกัดคณะวิทยาศาสตร์ (อาจารย์)',
    requester_email: 'wipada@ksu.ac.th',
    assigned_to: 'นายสมชาย ช่างไฟฟ้าและอิเล็กทรอนิกส์',
    co_workers: '',
    start_date: '2026-10-17T13:00:00.000Z',
    due_date: '2026-10-21T16:30:00.000Z',
    budget_status: 'รออนุมัติ',
    approved_budget: 0,
    disbursed_amount: 0,
    completion_summary: '',
    accepted_by: 'นายสมชาย ช่างไฟฟ้าและอิเล็กทรอนิกส์',
    accepted_at: '2026-10-17T13:15:00.000Z',
    resolution_note: 'กำลังรอเบิกชุดลูกยางดึงกระดาษ (Pick-up Roller) และชุดดรัมหมึกใหม่',
    created_at: '2026-10-17T11:45:00.000Z',
    updated_at: '2026-10-17T14:20:00.000Z'
  }
];

export function getDeletedTicketIds() {
    if (typeof window === 'undefined') return DEFAULT_MOCK_DELETED_IDS;
    try {
        const raw = localStorage.getItem(DELETED_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        const merged = new Set([...DEFAULT_MOCK_DELETED_IDS, ...(Array.isArray(parsed) ? parsed.map(s => String(s).toLowerCase()) : [])]);
        return Array.from(merged);
    } catch (e) {
        return DEFAULT_MOCK_DELETED_IDS;
    }
}

export function markTicketAsDeleted(idOrNo) {
    if (typeof window === 'undefined' || !idOrNo) return;
    try {
        const target = String(idOrNo).trim().toLowerCase();
        const deleted = getDeletedTicketIds();
        if (!deleted.includes(target)) {
            deleted.push(target);
            localStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
        }
    } catch (e) {}
}

export function unmarkTicketAsDeleted(idOrNo) {
    if (typeof window === 'undefined' || !idOrNo) return;
    try {
        const target = String(idOrNo).trim().toLowerCase();
        const deleted = getDeletedTicketIds().filter(d => d !== target);
        localStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
    } catch (e) {}
}

export function resetClientStorageToDemo() {
    if (typeof window === 'undefined') return INITIAL_DEMO_TICKETS;
    try {
        localStorage.removeItem(DELETED_KEY);
        localStorage.setItem(TICKETS_KEY, JSON.stringify(INITIAL_DEMO_TICKETS));
        window.dispatchEvent(new CustomEvent('ksu_tickets_resequenced', { detail: { tickets: INITIAL_DEMO_TICKETS } }));
        return INITIAL_DEMO_TICKETS;
    } catch (e) {
        return INITIAL_DEMO_TICKETS;
    }
}

export function getStoredTickets() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(TICKETS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            return [];
        }
        const deleted = new Set(getDeletedTicketIds());
        const filtered = parsed.filter(t => {
            const id = String(t.id || '').trim().toLowerCase();
            const no = String(t.ticket_no || '').trim().toLowerCase();
            return !deleted.has(id) && !deleted.has(no);
        });
        return filtered;
    } catch (e) {
        console.warn('Error reading stored tickets:', e);
        return [];
    }
}

export function saveStoredTicket(ticket) {
    if (!ticket || (!ticket.id && !ticket.ticket_no)) return;
    if (typeof window === 'undefined') return;
    try {
        // If re-adding or creating new ticket, unmark from deleted
        if (ticket.id) unmarkTicketAsDeleted(ticket.id);
        if (ticket.ticket_no) unmarkTicketAsDeleted(ticket.ticket_no);

        const list = getStoredTickets();
        const existingIdx = list.findIndex(t => 
            (ticket.id && t.id === ticket.id) || 
            (ticket.ticket_no && t.ticket_no === ticket.ticket_no)
        );
        if (existingIdx >= 0) {
            list[existingIdx] = { ...list[existingIdx], ...ticket };
        } else {
            list.unshift(ticket);
        }
        localStorage.setItem(TICKETS_KEY, JSON.stringify(list));

        window.dispatchEvent(new CustomEvent('ksu_ticket_updated', { detail: { ticket } }));
    } catch (e) {
        console.warn('Error saving stored ticket:', e);
    }
}

export function clearAllStoredTickets() {
    if (typeof window === 'undefined') return [];
    try {
        localStorage.setItem(TICKETS_KEY, JSON.stringify([]));
        localStorage.setItem('ksu_client_storage_initialized', 'true');
        window.dispatchEvent(new CustomEvent('ksu_ticket_deleted', { detail: { id: '__ALL__' } }));
        window.dispatchEvent(new CustomEvent('ksu_tickets_resequenced', { detail: { tickets: [] } }));
        return [];
    } catch (e) {
        return [];
    }
}

export function removeStoredTicket(idOrNo) {
    if (typeof window === 'undefined' || !idOrNo) return;
    try {
        const target = String(idOrNo).trim().toLowerCase();
        markTicketAsDeleted(target);

        // Permanently delete on backend server so other devices/machines stay in sync
        try {
            fetch(`/api/tickets/${encodeURIComponent(idOrNo)}`, { method: 'DELETE' }).catch(() => {});
        } catch (_) {}

        // Remove from stored tickets
        const currentList = [];
        try {
            const raw = localStorage.getItem(TICKETS_KEY);
            if (raw) currentList.push(...JSON.parse(raw));
        } catch (e) {}

        const filtered = currentList.filter(t => {
            const id = String(t.id || '').trim().toLowerCase();
            const no = String(t.ticket_no || '').trim().toLowerCase();
            return id !== target && no !== target;
        });
        localStorage.setItem(TICKETS_KEY, JSON.stringify(filtered));

        // Cleanup sub-stores
        [EXPENSES_KEY, TIMELINES_KEY, EVIDENCES_KEY].forEach(key => {
            try {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const map = JSON.parse(raw);
                    delete map[idOrNo];
                    delete map[target];
                    localStorage.setItem(key, JSON.stringify(map));
                }
            } catch (e) {}
        });

        // Broadcast deletion event to all components and tabs
        window.dispatchEvent(new CustomEvent('ksu_ticket_deleted', { detail: { id: idOrNo } }));

        // Immediately resequence remaining tickets
        resequenceStoredTickets(filtered);
    } catch (e) {
        console.warn('Error removing stored ticket:', e);
    }
}

export function getStoredTicket(idOrNo) {
    if (!idOrNo) return null;
    const target = String(idOrNo).trim().toLowerCase();
    const deleted = new Set(getDeletedTicketIds());
    if (deleted.has(target)) return null;

    const list = getStoredTickets();
    return list.find(t => 
        (t.id && String(t.id).trim().toLowerCase() === target) ||
        (t.ticket_no && String(t.ticket_no).trim().toLowerCase() === target)
    ) || null;
}

export function resequenceStoredTickets(providedList = null) {
    if (typeof window === 'undefined') return [];
    try {
        let list = providedList ? [...providedList] : getStoredTickets();
        const deleted = new Set(getDeletedTicketIds());
        list = list.filter(t => {
            const id = String(t.id || '').trim().toLowerCase();
            const no = String(t.ticket_no || '').trim().toLowerCase();
            return !deleted.has(id) && !deleted.has(no);
        });

        if (list.length === 0) {
            localStorage.setItem(TICKETS_KEY, JSON.stringify([]));
            window.dispatchEvent(new CustomEvent('ksu_tickets_resequenced', { detail: { tickets: [] } }));
            return [];
        }

        // Sort chronologically ascending
        list.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

        const updated = [];
        list.forEach((t, idx) => {
            const seq = idx + 1;
            const newNo = `TKT-${String(seq).padStart(2, '0')}`;
            const oldNo = t.ticket_no;

            // Migrate child stores if ticket_no changed
            if (oldNo && oldNo !== newNo) {
                [EXPENSES_KEY, TIMELINES_KEY, EVIDENCES_KEY].forEach(key => {
                    try {
                        const raw = localStorage.getItem(key);
                        if (raw) {
                            const map = JSON.parse(raw);
                            if (map[oldNo]) {
                                map[newNo] = map[oldNo];
                                delete map[oldNo];
                                localStorage.setItem(key, JSON.stringify(map));
                            }
                        }
                    } catch (e) {}
                });
            }

            updated.push({ ...t, ticket_no: newNo });
        });

        // Save back sorted descending for display
        const displayList = [...updated].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        localStorage.setItem(TICKETS_KEY, JSON.stringify(displayList));
        window.dispatchEvent(new CustomEvent('ksu_tickets_resequenced', { detail: { tickets: displayList } }));
        return displayList;
    } catch (e) {
        console.warn('Error resequencing stored tickets:', e);
        return [];
    }
}

export function mergeTicketsWithStorage(serverTickets = []) {
    const deleted = new Set(getDeletedTicketIds());
    const map = new Map();

    // 1. First populate all valid local tickets (guaranteed persistence across Ctrl+R & serverless cold boots)
    const localList = getStoredTickets();
    localList.forEach(t => {
        if (!t) return;
        const id = String(t.id || '').trim().toLowerCase();
        const no = String(t.ticket_no || '').trim().toLowerCase();
        if (!deleted.has(id) && !deleted.has(no)) {
            const key = t.id || t.ticket_no;
            if (key) map.set(key, t);
        }
    });

    // 2. Merge server tickets (preserving local tickets and applying newer updates from server)
    (serverTickets || []).forEach(t => {
        if (!t) return;
        const id = String(t.id || '').trim().toLowerCase();
        const no = String(t.ticket_no || '').trim().toLowerCase();
        if (!deleted.has(id) && !deleted.has(no)) {
            const key = t.id || t.ticket_no;
            if (!key) return;
            if (!map.has(key)) {
                map.set(key, t);
            } else {
                const localT = map.get(key);
                if (new Date(t.updated_at || 0) >= new Date(localT.updated_at || 0)) {
                    map.set(key, { ...localT, ...t });
                }
            }
        }
    });

    const merged = Array.from(map.values());
    merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    try {
        if (typeof window !== 'undefined') {
            localStorage.setItem(TICKETS_KEY, JSON.stringify(merged));
        }
    } catch (e) {}

    return merged;
}

export async function syncTicketsWithServer(ticketsToSync) {
    if (!Array.isArray(ticketsToSync) || ticketsToSync.length === 0) return;
    const deleted = new Set(getDeletedTicketIds());
    const valid = ticketsToSync.filter(t => {
        if (!t) return false;
        const id = String(t.id || '').trim().toLowerCase();
        const no = String(t.ticket_no || '').trim().toLowerCase();
        return !deleted.has(id) && !deleted.has(no);
    });
    if (valid.length === 0) return;

    try {
        await fetch('/api/tickets/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickets: valid })
        });
    } catch (e) {
        console.warn('Background ticket sync skipped:', e.message);
    }
}

// ─────────────────────────────────────────────────────────────
// Expenses Store
// ─────────────────────────────────────────────────────────────
export function getStoredExpenses(ticketId) {
    if (typeof window === 'undefined' || !ticketId) return null;
    try {
        const raw = localStorage.getItem(EXPENSES_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed[ticketId] || null;
    } catch (e) {
        return null;
    }
}

export function saveStoredExpenses(ticketId, expenses, summary, ticketNo = null) {
    if (typeof window === 'undefined' || !ticketId) return;
    try {
        const raw = localStorage.getItem(EXPENSES_KEY);
        const map = raw ? JSON.parse(raw) : {};
        const payload = { expenses, summary, updated_at: new Date().toISOString() };
        map[ticketId] = payload;
        if (ticketNo) map[ticketNo] = payload;
        localStorage.setItem(EXPENSES_KEY, JSON.stringify(map));
    } catch (e) {}
}

// ─────────────────────────────────────────────────────────────
// Timelines Store
// ─────────────────────────────────────────────────────────────
export function getStoredTimelines(ticketId) {
    if (typeof window === 'undefined' || !ticketId) return null;
    try {
        const raw = localStorage.getItem(TIMELINES_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed[ticketId] || null;
    } catch (e) {
        return null;
    }
}

export function saveStoredTimelines(ticketId, timelines, ticketNo = null) {
    if (typeof window === 'undefined' || !ticketId) return;
    try {
        const raw = localStorage.getItem(TIMELINES_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[ticketId] = timelines;
        if (ticketNo) map[ticketNo] = timelines;
        localStorage.setItem(TIMELINES_KEY, JSON.stringify(map));
    } catch (e) {}
}

// ─────────────────────────────────────────────────────────────
// Evidences Store
// ─────────────────────────────────────────────────────────────
export function getStoredEvidences(ticketId) {
    if (typeof window === 'undefined' || !ticketId) return null;
    try {
        const raw = localStorage.getItem(EVIDENCES_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed[ticketId] || null;
    } catch (e) {
        return null;
    }
}

export function saveStoredEvidences(ticketId, evidences, ticketNo = null) {
    if (typeof window === 'undefined' || !ticketId) return;
    try {
        const raw = localStorage.getItem(EVIDENCES_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[ticketId] = evidences;
        if (ticketNo) map[ticketNo] = evidences;
        localStorage.setItem(EVIDENCES_KEY, JSON.stringify(map));
    } catch (e) {}
}
