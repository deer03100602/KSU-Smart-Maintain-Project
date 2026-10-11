// ============================================================
// page.js — Admin Ticket Management Page
// Route: /admin
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import Link from 'next/link';
import { 
    Shield, Clock, AlertTriangle, UserMinus, Search, X, 
    CheckSquare, Trash2, Eye, Edit, Inbox, MapPin, User,
    Calendar, Save, MessageSquare, ClipboardCheck, Tag, Info, UserCheck, Settings,
    FileText, Printer
} from 'lucide-react';
import { timeAgo } from '@/components/TicketCard';
import { parseDescriptionAndAttachments, isImageFile } from '@/lib/utils';
// DEFAULT_ISSUE_TYPES is loaded dynamically

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

const parseRequester = (fullName) => {
    if (!fullName) return { name: '', group: '' };
    const match = fullName.match(/^(.*?)\s*\((นักศึกษา|อาจารย์|เจ้าหน้าที่|เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์|ผู้ดูแลระบบ)\)$/);
    if (match) {
        return { name: match[1], group: match[2] };
    }
    return { name: fullName, group: 'นักศึกษา' };
};

export default function AdminManagementPage() {
    const router = useRouter();
    const { role, toast, confirm } = useApp();

    const [tickets, setTickets] = useState([]);
    const [issueTypes, setIssueTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);

    // Modal view state
    const [viewingTicket, setViewingTicket] = useState(null);
    const [resolutionNote, setResolutionNote] = useState('');
    const [updatingNote, setUpdatingNote] = useState(false);
    const [selectedImageModal, setSelectedImageModal] = useState(null);

    // Filter states
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('');
    const [priority, setPriority] = useState('');
    const [assigneeFilter, setAssigneeFilter] = useState('');
    const [requesterGroupFilter, setRequesterGroupFilter] = useState('');

    // Check Role Guard
    useEffect(() => {
        if (role !== 'admin') {
            toast.warning('คุณไม่มีสิทธิ์เข้าถึงหน้าสำหรับแอดมิน');
            router.push('/');
        }
    }, [role]);

    const fetchData = async () => {
        try {
            const [ticketsRes, typesRes] = await Promise.all([
                fetch('/api/tickets'),
                fetch('/api/issue-types')
            ]);
            if (ticketsRes.ok) {
                const data = await ticketsRes.json();
                setTickets(data);
                
                // If currently viewing a ticket, sync it
                if (viewingTicket) {
                    const updated = data.find(t => t.id === viewingTicket.id);
                    if (updated) {
                        setViewingTicket(updated);
                        setResolutionNote(updated.resolution_note || '');
                    }
                }
            }
            if (typesRes.ok) {
                const typesData = await typesRes.json();
                setIssueTypes(typesData);
            }
        } catch (e) {
            console.error('Error fetching admin data:', e);
            toast.error('ไม่สามารถโหลดข้อมูลได้');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (role === 'admin') {
            fetchData();
        }
    }, [role]);

    // Open detail modal helper
    const handleOpenDetailModal = (ticket) => {
        setViewingTicket(ticket);
        setResolutionNote(ticket.resolution_note || '');
    };

    // Derived Statistics
    const totalTickets = tickets.length;
    const completedCount = tickets.filter(t => t.status === STATUSES.RESOLVED || t.status === STATUSES.CLOSED).length;
    const completionRate = totalTickets > 0 ? Math.round((completedCount / totalTickets) * 100) : 0;

    // Filtered Tickets list
    const filteredTickets = tickets.filter(t => {
        // Query Match
        if (query.trim()) {
            const q = query.toLowerCase().trim();
            const matchQuery = t.ticket_no.toLowerCase().includes(q) ||
                               t.title.toLowerCase().includes(q) ||
                               t.description.toLowerCase().includes(q) ||
                               t.requester_name.toLowerCase().includes(q) ||
                               (t.location && t.location.toLowerCase().includes(q));
            if (!matchQuery) return false;
        }

        // Status Match
        if (status && t.status !== status) return false;

        // Priority Match
        if (priority && t.priority !== priority) return false;

        // Assignee Match
        if (assigneeFilter) {
            if (assigneeFilter === 'unassigned') {
                if (t.assigned_to) return false;
            } else if (t.assigned_to !== assigneeFilter) {
                return false;
            }
        }

        // Requester Group Match
        if (requesterGroupFilter) {
            const parsed = parseRequester(t.requester_name);
            if (parsed.group !== requesterGroupFilter) return false;
        }

        return true;
    });

    const clearFilters = () => {
        setQuery('');
        setStatus('');
        setPriority('');
        setAssigneeFilter('');
        setRequesterGroupFilter('');
    };

    const handleExportCSV = (ticketsList) => {
        const headers = ['Ticket ID', 'Title', 'Description', 'Category', 'Priority', 'Status', 'Location', 'Requester Name', 'Requester Group', 'Requester Email', 'Assigned To', 'Created At', 'Updated At'];
        const rows = ticketsList.map(t => {
            const parsed = parseRequester(t.requester_name);
            return [
                t.ticket_no,
                t.title,
                t.description ? t.description.replace(/"/g, '""').replace(/\n/g, ' ') : '',
                t.issue_type,
                t.priority,
                t.status,
                t.location || '',
                parsed.name,
                parsed.group || 'นักศึกษา',
                t.requester_email || '',
                t.assigned_to || '',
                t.created_at,
                t.updated_at
            ];
        });

        const csvContent = "\uFEFF" + [
            headers.join(','),
            ...rows.map(e => e.map(val => `"${val}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `admin_tickets_report_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrintPDF = (ticketsList) => {
        const printWindow = window.open('', '_blank');
        const tableRows = ticketsList.map(t => {
            const parsed = parseRequester(t.requester_name);
            return `
                <tr>
                    <td style="font-family: monospace; font-weight: bold;">${t.ticket_no}</td>
                    <td>
                        <div style="font-weight: bold;">${t.title}</div>
                        <div style="font-size: 0.8rem; color: #666;">ผู้แจ้ง: ${parsed.name} (${parsed.group || 'นักศึกษา'}) | สถานที่: ${t.location || '-'}</div>
                    </td>
                    <td>${t.issue_type}</td>
                    <td>${t.priority}</td>
                    <td>${t.status}</td>
                    <td>${t.assigned_to || '-'}</td>
                    <td>${new Date(t.created_at).toLocaleDateString('th-TH')}</td>
                </tr>
            `;
        }).join('');

        const html = `
            <html>
                <head>
                    <title>รายงานรายการตั๋วปัญหาสำหรับเจ้าหน้าที่ - Mini Helpdesk</title>
                    <style>
                        body { font-family: 'Sarabun', 'Helvetica Neue', Arial, sans-serif; padding: 20px; color: #333; }
                        h1 { font-size: 20px; margin-bottom: 5px; }
                        .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                        th { background-color: #f5f5f5; font-weight: bold; }
                        tr:nth-child(even) { background-color: #fafafa; }
                        @media print {
                            .print-btn { display: none; }
                        }
                    </style>
                </head>
                <body>
                     <div style="display: flex; justify-content: space-between; align-items: center;">
                         <h1>รายงานตั๋วปัญหา Mini Helpdesk (เจ้าหน้าที่)</h1>
                         <button class="print-btn" onclick="window.print()" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">พิมพ์ PDF</button>
                     </div>
                     <div class="meta">
                         พิมพ์โดย: เจ้าหน้าที่ระบบ | วันที่: ${new Date().toLocaleString('th-TH')} | จำนวนทั้งหมด: ${ticketsList.length} รายการ
                     </div>
                     <table>
                         <thead>
                             <tr>
                                 <th>Ticket ID</th>
                                 <th>หัวข้อ / สถานที่</th>
                                 <th>ประเภท</th>
                                 <th>ระดับ</th>
                                 <th>สถานะ</th>
                                 <th>ผู้รับผิดชอบ</th>
                                 <th>วันที่แจ้ง</th>
                             </tr>
                         </thead>
                         <tbody>
                             ${tableRows}
                         </tbody>
                     </table>
                     <script>
                         window.onload = function() {
                             setTimeout(() => { window.print(); }, 500);
                         }
                     </script>
                </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    };

    // Inline Update Actions
    const handleStatusUpdate = async (id, newStatus) => {
        try {
            const res = await fetch(`/api/tickets/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                toast.success('อัปเดตสถานะตั๋วสำเร็จ');
                fetchData();
            } else {
                toast.error('ไม่สามารถเปลี่ยนสถานะได้');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleAssigneeUpdate = async (id, assignee) => {
        try {
            const res = await fetch(`/api/tickets/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assigned_to: assignee })
            });
            if (res.ok) {
                toast.success(assignee ? `มอบหมายงานให้ "${assignee}" สำเร็จ` : 'ยกเลิกการมอบหมายสำเร็จ');
                fetchData();
            } else {
                toast.error('ไม่สามารถมอบหมายงานได้');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSaveResolutionNote = async () => {
        if (!viewingTicket) return;
        setUpdatingNote(true);
        try {
            const res = await fetch(`/api/tickets/${viewingTicket.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolution_note: resolutionNote })
            });
            if (res.ok) {
                toast.success('บันทึกรายละเอียดการแก้ไขแล้ว');
                fetchData();
            } else {
                toast.error('ไม่สามารถบันทึกหมายเหตุการแก้ไขได้');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setUpdatingNote(false);
        }
    };

    const handleDeleteTicket = (id) => {
        confirm(
            'ยืนยันลบ Ticket',
            'คุณแน่ใจหรือไม่ว่าต้องการลบ Ticket นี้ออกถาวร?',
            async () => {
                try {
                    const res = await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        toast.success('ลบรายการสำเร็จ');
                        setSelectedIds(prev => prev.filter(item => item !== id));
                        if (viewingTicket?.id === id) {
                            setViewingTicket(null);
                        }
                        fetchData();
                    } else {
                        toast.error('ไม่สามารถลบได้');
                    }
                } catch (e) {
                    console.error(e);
                }
            },
            { confirmClass: 'btn-danger' }
        );
    };

    // Bulk Actions handlers
    const toggleSelectAll = (checked) => {
        if (checked) {
            setSelectedIds(filteredTickets.map(t => t.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleCheckboxChange = (id, checked) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(item => item !== id));
        }
    };

    const applyBulkStatus = (statusVal) => {
        if (!statusVal || selectedIds.length === 0) return;

        confirm(
            'ยืนยันเปลี่ยนสถานะกลุ่ม',
            `ต้องการเปลี่ยนสถานะของ Ticket ที่เลือกทั้งหมด ${selectedIds.length} รายการ เป็น "${statusVal}" ใช่หรือไม่?`,
            async () => {
                try {
                    const promises = selectedIds.map(id => 
                        fetch(`/api/tickets/${id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: statusVal })
                        })
                    );
                    await Promise.all(promises);
                    toast.success(`เปลี่ยนสถานะเป็น "${statusVal}" สำเร็จ ${selectedIds.length} รายการ`);
                    setSelectedIds([]);
                    fetchData();
                } catch (e) {
                    console.error(e);
                    toast.error('เกิดข้อผิดพลาดในการดำเนินการกลุ่ม');
                }
            }
        );
    };

    const applyBulkAssignee = (assigneeVal) => {
        if (!assigneeVal || selectedIds.length === 0) return;

        confirm(
            'ยืนยันมอบหมายงานกลุ่ม',
            `ต้องการมอบหมายงานที่เลือกทั้งหมด ${selectedIds.length} รายการ ให้กับ "${assigneeVal}" ใช่หรือไม่?`,
            async () => {
                try {
                    const promises = selectedIds.map(id => 
                        fetch(`/api/tickets/${id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ assigned_to: assigneeVal })
                        })
                    );
                    await Promise.all(promises);
                    toast.success(`มอบหมายงานให้ "${assigneeVal}" สำเร็จ ${selectedIds.length} รายการ`);
                    setSelectedIds([]);
                    fetchData();
                } catch (e) {
                    console.error(e);
                    toast.error('เกิดข้อผิดพลาดในการมอบหมายงานกลุ่ม');
                }
            }
        );
    };

    const applyBulkDelete = () => {
        if (selectedIds.length === 0) return;

        confirm(
            'ยืนยันลบหลายรายการ',
            `คุณต้องการลบ Ticket ที่เลือกทั้งหมด ${selectedIds.length} รายการ ใช่หรือไม่? การลบนี้ไม่สามารถย้อนกลับได้!`,
            async () => {
                try {
                    const promises = selectedIds.map(id => 
                        fetch(`/api/tickets/${id}`, { method: 'DELETE' })
                    );
                    await Promise.all(promises);
                    toast.success(`ลบสำเร็จ ${selectedIds.length} รายการ`);
                    setSelectedIds([]);
                    fetchData();
                } catch (e) {
                    console.error(e);
                    toast.error('เกิดข้อผิดพลาดในการลบกลุ่ม');
                }
            },
            { confirmClass: 'btn-danger' }
        );
    };

    const showEditModal = (ticketItem) => {
        let titleVal = ticketItem.title;
        let descVal = ticketItem.description;
        let typeVal = ticketItem.issue_type;
        let locationVal = ticketItem.location;
        let priorityVal = ticketItem.priority;

        confirm(
            'แก้ไขรายละเอียด Ticket',
            '',
            async () => {
                try {
                    const res = await fetch(`/api/tickets/${ticketItem.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: titleVal,
                            description: descVal,
                            issue_type: typeVal,
                            location: locationVal,
                            priority: priorityVal
                        })
                    });
                    if (res.ok) {
                        toast.success('แก้ไขข้อมูลสำเร็จ');
                        fetchData();
                    } else {
                        toast.error('ไม่สามารถอัปเดตข้อมูลได้');
                    }
                } catch (e) {
                    console.error(e);
                }
            },
            {
                content: (
                    <div className="edit-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">หัวข้อปัญหา</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                defaultValue={ticketItem.title}
                                onChange={(e) => { titleVal = e.target.value; }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">รายละเอียด</label>
                            <textarea 
                                className="form-input form-textarea" 
                                rows={3}
                                defaultValue={ticketItem.description}
                                onChange={(e) => { descVal = e.target.value; }}
                            ></textarea>
                        </div>
                        <div className="form-group">
                            <label className="form-label">ประเภทปัญหา</label>
                            <select 
                                className="form-input form-select"
                                defaultValue={ticketItem.issue_type}
                                onChange={(e) => { typeVal = e.target.value; }}
                            >
                                {issueTypes.map(t => (
                                    <option key={t.id} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">สถานที่</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                defaultValue={ticketItem.location}
                                onChange={(e) => { locationVal = e.target.value; }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">ระดับความสำคัญ</label>
                            <select 
                                className="form-input form-select"
                                defaultValue={ticketItem.priority}
                                onChange={(e) => { priorityVal = e.target.value; }}
                            >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Urgent">Urgent</option>
                            </select>
                        </div>
                    </div>
                )
            }
        );
    };

    if (role !== 'admin') return null;

    return (
        <div className="page-admin fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1 className="page-title text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Shield style={{ width: 26, height: 26, color: 'var(--primary-color)' }} />
                        จัดการ Ticket (สำหรับเจ้าหน้าที่)
                    </h1>
                    <p className="page-subtitle">ดูรายละเอียด มอบหมายงาน และอัปเดตสถานะปัญหาทั้งหมดในระบบ</p>
                </div>
                <div className="page-header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link href="/admin/settings" className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                        <Settings style={{ width: 16, height: 16 }} />
                        ตั้งค่าแจ้งเตือน
                    </Link>
                </div>
            </div>

            {/* Admin Overview Cards */}
            <div className="admin-stats-grid">
                <div className="admin-stat-card border-primary">
                    <div className="stat-header">
                        <span className="stat-title">งานทั้งหมด</span>
                        <Inbox className="stat-icon text-primary" style={{ width: 20, height: 20 }} />
                    </div>
                    <div className="stat-value text-primary">{totalTickets}</div>
                    <div className="stat-desc">จำนวนรายการทั้งหมด</div>
                </div>
                <div className="admin-stat-card border-success">
                    <div className="stat-header">
                        <span className="stat-title">เสร็จแล้ว</span>
                        <CheckSquare className="stat-icon text-success" style={{ width: 20, height: 20 }} />
                    </div>
                    <div className="stat-value text-success">{completedCount}</div>
                    <div className="stat-desc">Resolved & Closed</div>
                </div>
                <div className="admin-stat-card border-info">
                    <div className="stat-header">
                        <span className="stat-title">อัตราการปิดงาน</span>
                        <ClipboardCheck className="stat-icon text-info" style={{ width: 20, height: 20 }} />
                    </div>
                    <div className="stat-value text-info">{completionRate}%</div>
                    <div className="stat-desc">เปอร์เซนต์การแล้วเสร็จ</div>
                </div>
            </div>

            {/* Filters and Actions Section */}
            <div className="admin-control-bar glass-card">
                <div className="control-search">
                    <Search className="search-icon" style={{ width: 18, height: 18 }} />
                    <input 
                        type="text" 
                        className="form-input" 
                        placeholder="ค้นหาด้วยเลข Ticket, หัวข้อ, ผู้แจ้ง..." 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <div className="control-filters">
                    <select 
                        className="form-input form-select" 
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="">ทุกสถานะ</option>
                        {Object.values(STATUSES).map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <select 
                        className="form-input form-select"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                    >
                        <option value="">ทุกระดับความสำคัญ</option>
                        {Object.values(PRIORITIES).map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                    <select 
                        className="form-input form-select"
                        value={assigneeFilter}
                        onChange={(e) => setAssigneeFilter(e.target.value)}
                    >
                        <option value="">เจ้าหน้าที่ทั้งหมด</option>
                        <option value="unassigned">ยังไม่ได้มอบหมาย</option>
                        {STAFF_MEMBERS.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <select 
                        className="form-input form-select"
                        value={requesterGroupFilter}
                        onChange={(e) => setRequesterGroupFilter(e.target.value)}
                    >
                        <option value="">ทุกกลุ่มผู้ใช้</option>
                        <option value="นักศึกษา">นักศึกษา</option>
                        <option value="อาจารย์">อาจารย์</option>
                        <option value="เจ้าหน้าที่">เจ้าหน้าที่</option>
                        <option value="เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์">เจ้าหน้าที่ IT / ผู้ดูแลอุปกรณ์</option>
                        <option value="ผู้ดูแลระบบ">ผู้ดูแลระบบ</option>
                    </select>
                    <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                        <X style={{ width: 14, height: 14 }} />
                        ล้างตัวกรอง
                    </button>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="bulk-actions-bar glass-card">
                    <div className="bulk-info">
                        <CheckSquare className="text-primary" style={{ width: 18, height: 18 }} />
                        <span>เลือกแล้ว {selectedIds.length} รายการ</span>
                    </div>
                    <div className="bulk-buttons">
                        <div className="bulk-action-group">
                            <label className="form-label compact">เปลี่ยนสถานะกลุ่ม:</label>
                            <select 
                                className="form-input form-select compact-select" 
                                onChange={(e) => { applyBulkStatus(e.target.value); e.target.value = ''; }}
                            >
                                <option value="">-- เลือกสถานะ --</option>
                                {Object.values(STATUSES).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div className="bulk-action-group">
                            <label className="form-label compact">มอบหมายกลุ่ม:</label>
                            <select 
                                className="form-input form-select compact-select" 
                                onChange={(e) => { applyBulkAssignee(e.target.value); e.target.value = ''; }}
                            >
                                <option value="">-- เลือกเจ้าหน้าที่ --</option>
                                {STAFF_MEMBERS.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <button className="btn btn-danger-ghost btn-sm" onClick={applyBulkDelete}>
                            <Trash2 style={{ width: 14, height: 14 }} />
                            ลบที่เลือก
                        </button>
                    </div>
                </div>
            )}

            <div className="results-header" style={{ display: 'flex', justifycontent: 'space-between', alignitems: 'center', marginbottom: '1rem' }}>
                <span className="results-count">
                    {loading ? 'กำลังค้นหา...' : `พบรายการตั๋วปัญหา ${filteredTickets.length} รายการ`}
                </span>
                {!loading && filteredTickets.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleExportCSV(filteredTickets)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                            <FileText style={{ width: 14, height: 14 }} />
                            ส่งออก CSV
                        </button>
                        <button 
                            className="btn btn-ghost btn-sm"
                            onClick={() => handlePrintPDF(filteredTickets)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                            <Printer style={{ width: 14, height: 14 }} />
                            พิมพ์ตาราง PDF
                        </button>
                    </div>
                )}
            </div>

            {/* Main Table Card */}
            <div className="table-card glass-card">
                {loading ? (
                    <p className="text-muted" style={{ textAlign: 'center', padding: '3rem' }}>กำลังโหลดข้อมูล...</p>
                ) : filteredTickets.length === 0 ? (
                    <div className="empty-state">
                        <Inbox className="empty-icon" style={{ width: 64, height: 64 }} />
                        <h3>ไม่พบ Ticket ในระบบ</h3>
                        <p>ไม่มีรายการปัญหาที่ตรงกับเงื่อนไขการค้นหา</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>
                                        <input 
                                            type="checkbox" 
                                            onChange={(e) => toggleSelectAll(e.target.checked)}
                                            checked={selectedIds.length === filteredTickets.length && filteredTickets.length > 0}
                                        />
                                    </th>
                                    <th style={{ width: '90px' }}>Ticket ID</th>
                                    <th style={{ width: '25%' }}>หัวข้อปัญหา</th>
                                    <th style={{ width: '135px' }}>ประเภท</th>
                                    <th style={{ width: '95px' }}>ระดับ</th>
                                    <th style={{ width: '130px' }}>สถานะ</th>
                                    <th style={{ width: '150px' }}>ผู้รับผิดชอบ</th>
                                    <th style={{ width: '140px' }}>ผู้แจ้ง / วันที่แจ้ง</th>
                                    <th style={{ width: '110px', textAlign: 'center' }}>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTickets.map(ticket => {
                                    const statusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS['Open'];
                                    const priorityColor = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS['Medium'];

                                    return (
                                        <tr key={ticket.id} className="admin-table-row">
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedIds.includes(ticket.id)}
                                                    onChange={(e) => handleCheckboxChange(ticket.id, e.target.checked)}
                                                />
                                            </td>
                                            <td 
                                                className="font-mono text-bold" 
                                                onClick={() => handleOpenDetailModal(ticket)}
                                                style={{ cursor: 'pointer', color: 'var(--primary-color)', fontWeight: 'bold' }}
                                            >
                                                {ticket.ticket_no}
                                            </td>
                                            <td onClick={() => handleOpenDetailModal(ticket)} style={{ cursor: 'pointer' }} className="cell-wrap">
                                                <div className="table-ticket-title">{ticket.title}</div>
                                                <div className="table-ticket-desc">{ticket.location || '-'}</div>
                                            </td>
                                            <td onClick={() => handleOpenDetailModal(ticket)} style={{ cursor: 'pointer' }}>
                                                <span className="table-type-badge">{ticket.issue_type}</span>
                                            </td>
                                            <td onClick={() => handleOpenDetailModal(ticket)} style={{ cursor: 'pointer' }}>
                                                <span className="priority-dot-badge">
                                                    <span className="priority-dot" style={{ background: priorityColor.text }}></span>
                                                    {ticket.priority}
                                                </span>
                                            </td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <select 
                                                    className="table-select-status" 
                                                    style={{ color: statusColor.text, background: statusColor.bg, border: `1px solid ${statusColor.border}` }}
                                                    value={ticket.status}
                                                    onChange={(e) => handleStatusUpdate(ticket.id, e.target.value)}
                                                >
                                                    {Object.values(STATUSES).map(s => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <select 
                                                    className="table-select-assignee"
                                                    value={ticket.assigned_to}
                                                    onChange={(e) => handleAssigneeUpdate(ticket.id, e.target.value)}
                                                >
                                                    <option value="">-- ยังไม่ได้มอบหมาย --</option>
                                                    {STAFF_MEMBERS.map(s => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td onClick={() => handleOpenDetailModal(ticket)} style={{ cursor: 'pointer' }}>
                                                <div className="table-user-name" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span>{parseRequester(ticket.requester_name).name}</span>
                                                    <span className="user-role-badge" style={{
                                                        alignSelf: 'flex-start',
                                                        padding: '1px 6px',
                                                        borderRadius: '3px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        background: 'rgba(59, 130, 246, 0.1)',
                                                        color: '#60a5fa',
                                                        border: '1px solid rgba(59, 130, 246, 0.2)'
                                                    }}>
                                                        {parseRequester(ticket.requester_name).group || 'นักศึกษา'}
                                                    </span>
                                                </div>
                                                <div className="table-user-date" style={{ marginTop: 4 }}>{timeAgo(ticket.created_at)}</div>
                                            </td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <div className="table-actions">
                                                    <button 
                                                        className="btn btn-ghost btn-icon-sm" 
                                                        title="ดูรายละเอียดอย่างรวดเร็ว" 
                                                        onClick={() => handleOpenDetailModal(ticket)}
                                                    >
                                                        <Eye style={{ width: 16, height: 16 }} />
                                                    </button>
                                                    <button 
                                                        className="btn btn-ghost btn-icon-sm" 
                                                        title="แก้ไขรายละเอียด" 
                                                        onClick={() => showEditModal(ticket)}
                                                    >
                                                        <Edit style={{ width: 16, height: 16 }} />
                                                    </button>
                                                    <button 
                                                        className="btn btn-danger-ghost btn-icon-sm" 
                                                        title="ลบ" 
                                                        onClick={() => handleDeleteTicket(ticket.id)}
                                                    >
                                                        <Trash2 style={{ width: 16, height: 16 }} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Quick Details Modal */}
            {viewingTicket && (
                <div className="modal-overlay modal-active" onClick={() => setViewingTicket(null)}>
                    <div className="modal-container" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Shield style={{ width: 20, height: 20, color: 'var(--primary-color)' }} />
                                    รายละเอียด Ticket: {viewingTicket.ticket_no}
                                </h3>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    แจ้งเมื่อ {new Date(viewingTicket.created_at).toLocaleString('th-TH')}
                                </span>
                            </div>
                            <button className="modal-close-btn" onClick={() => setViewingTicket(null)}>
                                <X style={{ width: 20, height: 20 }} />
                            </button>
                        </div>
                        
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Problem Title & Description */}
                            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    หัวข้อปัญหา
                                </div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                    {viewingTicket.title}
                                </h2>
                                <div style={{ borderBottom: '1px solid var(--border-card)', margin: '0.5rem 0' }}></div>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    รายละเอียดปัญหา
                                </div>
                                {(() => {
                                    const { cleanDescription, attachments } = parseDescriptionAndAttachments(viewingTicket.description);
                                    
                                    return (
                                        <>
                                            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                                {cleanDescription || 'ไม่มีรายละเอียดเพิ่มเติม'}
                                            </p>
                                            {attachments.length > 0 && (
                                                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-card)' }}>
                                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>
                                                        ไฟล์แนบ / รูปภาพประกอบ ({attachments.length})
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
                                                        {attachments.map((file, i) => {
                                                            const isImg = file.isImage || isImageFile(file.name, file.url);
                                                            const isValidUrl = file.url && file.url !== '#';
                                                            return (
                                                                <div key={i} style={{ borderRadius: '8px', border: '1px solid var(--border-card)', padding: '6px', background: 'rgba(255,255,255,0.02)' }}>
                                                                    {isImg && isValidUrl ? (
                                                                        <div 
                                                                            onClick={() => setSelectedImageModal(file.url)}
                                                                            style={{ display: 'block', height: 100, borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                                                                            title="คลิกเพื่อดูรูปภาพขนาดเต็ม"
                                                                        >
                                                                            <img src={file.url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                        </div>
                                                                    ) : (
                                                                        <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                                                                            <Paperclip style={{ width: 24, height: 24, color: 'var(--text-secondary)' }} />
                                                                        </div>
                                                                    )}
                                                                    <div style={{ fontSize: '0.75rem', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }} title={file.name}>
                                                                        {file.name}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Ticket Details Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                        <Tag style={{ width: 14, height: 14, color: 'var(--primary-color)' }} />
                                        <span className="text-muted">ประเภท:</span>
                                        <span style={{ fontWeight: 600 }}>{viewingTicket.issue_type}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                        <AlertTriangle style={{ width: 14, height: 14, color: PRIORITY_COLORS[viewingTicket.priority]?.text }} />
                                        <span className="text-muted">ความเร่งด่วน:</span>
                                        <span 
                                            className="priority-badge" 
                                            style={{ 
                                                background: PRIORITY_COLORS[viewingTicket.priority]?.bg, 
                                                color: PRIORITY_COLORS[viewingTicket.priority]?.text,
                                                border: `1px solid ${PRIORITY_COLORS[viewingTicket.priority]?.border}`,
                                                padding: '0.1rem 0.5rem',
                                                fontSize: '0.75rem'
                                            }}
                                        >
                                            {viewingTicket.priority}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                        <MapPin style={{ width: 14, height: 14, color: 'var(--primary-color)' }} />
                                        <span className="text-muted">สถานที่:</span>
                                        <span style={{ fontWeight: 600 }}>{viewingTicket.location || '-'}</span>
                                    </div>
                                </div>

                                <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                        <User style={{ width: 14, height: 14, color: 'var(--primary-color)' }} />
                                        <span className="text-muted">ผู้แจ้ง:</span>
                                        <span style={{ fontWeight: 600 }}>{viewingTicket.requester_name}</span>
                                    </div>
                                    {viewingTicket.requester_email && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            <span style={{ width: 14, display: 'inline-block' }}></span>
                                            <span className="text-muted">อีเมล:</span>
                                            <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{viewingTicket.requester_email}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                        <Calendar style={{ width: 14, height: 14, color: 'var(--primary-color)' }} />
                                        <span className="text-muted">อัปเดตล่าสุด:</span>
                                        <span style={{ fontWeight: 600 }}>{timeAgo(viewingTicket.updated_at)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Status & Assignee Controls */}
                            <div className="glass-card" style={{ padding: '1rem', display: 'flex', gap: '1rem' }}>
                                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Info style={{ width: 14, height: 14 }} />
                                        สถานะใบงาน
                                    </label>
                                    <select 
                                        className="form-input form-select" 
                                        style={{ 
                                            color: STATUS_COLORS[viewingTicket.status]?.text, 
                                            background: STATUS_COLORS[viewingTicket.status]?.bg, 
                                            border: `1px solid ${STATUS_COLORS[viewingTicket.status]?.border}`,
                                            fontWeight: 600
                                        }}
                                        value={viewingTicket.status}
                                        onChange={(e) => handleStatusUpdate(viewingTicket.id, e.target.value)}
                                    >
                                        {Object.values(STATUSES).map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <UserCheck style={{ width: 14, height: 14 }} />
                                        ผู้รับผิดชอบงาน
                                    </label>
                                    <select 
                                        className="form-input form-select"
                                        value={viewingTicket.assigned_to || ''}
                                        onChange={(e) => handleAssigneeUpdate(viewingTicket.id, e.target.value)}
                                    >
                                        <option value="">-- ยังไม่ได้มอบหมาย --</option>
                                        {STAFF_MEMBERS.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Resolution Notes section */}
                            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 0, fontWeight: 700 }}>
                                        <MessageSquare style={{ width: 16, height: 16, color: 'var(--primary-color)' }} />
                                        บันทึกผลการปฏิบัติงาน / รายละเอียดการแก้ไข
                                    </label>
                                    {viewingTicket.closed_at && (
                                        <span className="status-badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', fontSize: '0.7rem' }}>
                                            ปิดงานเมื่อ {new Date(viewingTicket.closed_at).toLocaleDateString('th-TH')}
                                        </span>
                                    )}
                                </div>
                                <textarea
                                    className="form-input form-textarea"
                                    rows={3}
                                    placeholder="ใส่ข้อมูลบันทึกความคืบหน้า รายละเอียดอะไหล่ หรือวิธีการแก้ไขปัญหา..."
                                    value={resolutionNote}
                                    onChange={(e) => setResolutionNote(e.target.value)}
                                ></textarea>
                                <button 
                                    className="btn btn-primary" 
                                    style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    onClick={handleSaveResolutionNote}
                                    disabled={updatingNote}
                                >
                                    <Save style={{ width: 16, height: 16 }} />
                                    {updatingNote ? 'กำลังบันทึก...' : 'บันทึกรายละเอียด'}
                                </button>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setViewingTicket(null)}>ปิดหน้าต่าง</button>
                        </div>
                    </div>
                </div>
                )}
                {selectedImageModal && (
                <div 
                    onClick={() => setSelectedImageModal(null)}
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem',
                        cursor: 'zoom-out'
                    }}
                >
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setSelectedImageModal(null)}
                            style={{
                                position: 'absolute',
                                top: -15, right: -15,
                                background: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: 32, height: 32,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                zIndex: 10
                            }}
                        >
                            <X style={{ width: 18, height: 18 }} />
                        </button>
                        <img 
                            src={selectedImageModal} 
                            alt="Attached Image Preview" 
                            style={{
                                maxWidth: '90vw',
                                maxHeight: '85vh',
                                borderRadius: '12px',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                                objectFit: 'contain'
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
