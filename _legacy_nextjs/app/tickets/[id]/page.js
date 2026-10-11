// ============================================================
// page.js — Ticket Detail Page
// Route: /tickets/[id]
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { 
    ArrowLeft, Edit, XCircle, Trash2, ClipboardCheck, Settings, 
    Save, Hash, Tag, MapPin, User, Mail, UserCheck, Calendar, Clock,
    Paperclip, FileText, QrCode, Printer, Eye, X, Maximize2, Image as ImageIcon,
    UploadCloud, Plus, Loader
} from 'lucide-react';
import Link from 'next/link';
import QRCode from 'qrcode';
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

export default function TicketDetailPage({ params }) {
    const router = useRouter();
    const { id } = params;
    const { role, user: currentUser, toast, confirm } = useApp();

    const [ticket, setTicket] = useState(null);
    const [issueTypes, setIssueTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingNote, setUpdatingNote] = useState(false);
    const [noteContent, setNoteContent] = useState('');
    const [selectedImageModal, setSelectedImageModal] = useState(null);
    const [uploadingDirectFile, setUploadingDirectFile] = useState(false);

    const isAdmin = role === 'admin';

    const handleDirectFileUpload = async (files) => {
        if (!files || files.length === 0) return;
        
        const validFiles = Array.from(files).filter(file => {
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`ไฟล์ ${file.name} มีขนาดใหญ่เกินไป (จำกัดไม่เกิน 10MB)`);
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) return;

        setUploadingDirectFile(true);
        try {
            const uploadPromises = validFiles.map(async (file) => {
                const formData = new FormData();
                formData.append('file', file);
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                if (res.ok) {
                    return await res.json();
                }
                throw new Error(`อัปโหลด ${file.name} ล้มเหลว`);
            });

            const results = await Promise.allSettled(uploadPromises);
            const successfulUploads = results.filter(r => r.status === 'fulfilled').map(r => r.value);
            
            if (successfulUploads.length > 0) {
                const attachmentTags = successfulUploads.map(data => `\n\n📎 [${data.name}](${data.url})`).join('');
                const updatedDescription = (ticket.description || '') + attachmentTags;

                const patchRes = await fetch(`/api/tickets/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ description: updatedDescription })
                });

                if (patchRes.ok) {
                    toast.success(`เพิ่มไฟล์แนบ ${successfulUploads.length} ไฟล์เรียบร้อยแล้ว`);
                    fetchTicketData();
                } else {
                    toast.error('ไม่สามารถอัปเดตไฟล์แนบเข้า Ticket ได้');
                }
            } else {
                toast.error('การอัปโหลดไฟล์ล้มเหลวทั้งหมด');
            }
        } catch (e) {
            console.error('Direct upload error:', e);
            toast.error('เกิดข้อผิดพลาดในการอัปโหลด');
        } finally {
            setUploadingDirectFile(false);
        }
    };

    // Fetch ticket details and issue types
    const fetchTicketData = async () => {
        try {
            const [ticketRes, typesRes] = await Promise.all([
                fetch(`/api/tickets/${id}`),
                fetch('/api/issue-types')
            ]);
            if (ticketRes.ok) {
                const data = await ticketRes.json();
                setTicket(data);
                setNoteContent(data.resolution_note || '');
            } else {
                toast.error('ไม่พบข้อมูล Ticket');
            }

            if (typesRes.ok) {
                const typesData = await typesRes.json();
                setIssueTypes(typesData);
            }
        } catch (e) {
            console.error('Error fetching ticket detail:', e);
            toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTicketData();
    }, [id]);

    const [qrCodeUrl, setQrCodeUrl] = useState('');

    useEffect(() => {
        if (ticket && typeof window !== 'undefined') {
            QRCode.toDataURL(window.location.href, { width: 180, margin: 2 })
                .then(url => {
                    setQrCodeUrl(url);
                })
                .catch(err => {
                    console.error('Error generating QR code:', err);
                });
        }
    }, [ticket]);

    const handlePrintSingleTicket = (t) => {
        const printWindow = window.open('', '_blank');
        const html = `
            <html>
                <head>
                    <title>รายงานตั๋วปัญหา - ${t.ticket_no}</title>
                    <style>
                        body { font-family: 'Sarabun', 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 30px; }
                        .title { font-size: 24px; font-weight: bold; }
                        .ticket-no { font-size: 18px; font-weight: bold; color: #3b82f6; font-family: monospace; }
                        .section { margin-bottom: 20px; }
                        .section-title { font-size: 16px; font-weight: bold; background: #f5f5f5; padding: 6px 12px; margin-bottom: 10px; border-left: 4px solid #3b82f6; }
                        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
                        .label { font-weight: bold; color: #666; font-size: 13px; }
                        .value { font-size: 14px; }
                        .description { border: 1px solid #ddd; padding: 15px; border-radius: 6px; background: #fafafa; white-space: pre-wrap; font-size: 14px; }
                        @media print {
                            .print-btn { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <div class="title">ใบรายงานสถานะตั๋วปัญหา (Ticket Report)</div>
                            <div style="font-size: 12px; color: #666;">พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')}</div>
                        </div>
                        <div class="ticket-no">${t.ticket_no}</div>
                    </div>

                    <div class="section">
                        <div class="section-title">ข้อมูลปัญหา</div>
                        <div style="margin-bottom: 10px;">
                            <span class="label">หัวข้อปัญหา: </span>
                            <span class="value" style="font-weight: bold; font-size: 16px;">${t.title}</span>
                        </div>
                        <div class="grid">
                             <div>
                                 <span class="label">ประเภทปัญหา: </span>
                                 <span class="value">${t.issue_type}</span>
                             </div>
                             <div>
                                 <span class="label">ระดับความเร่งด่วน: </span>
                                 <span class="value">${t.priority}</span>
                             </div>
                             <div>
                                 <span class="label">สถานที่เกิดเหตุ: </span>
                                 <span class="value">${t.location || '-'}</span>
                             </div>
                             <div>
                                 <span class="label">สถานะปัจจุบัน: </span>
                                 <span class="value" style="font-weight: bold;">${t.status}</span>
                             </div>
                        </div>
                        <div>
                             <span class="label">รายละเอียดเพิ่มเติม:</span>
                             <div class="description">${t.description.replace(/📎 \[(.*?)\]\((.*?)\)/g, '').trim() || 'ไม่มีรายละเอียดเพิ่มเติม'}</div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">ข้อมูลผู้แจ้งและผู้รับผิดชอบ</div>
                        <div class="grid">
                             <div>
                                 <span class="label">ชื่อผู้แจ้ง: </span>
                                 <span class="value">${parseRequester(t.requester_name).name}</span>
                             </div>
                             <div>
                                 <span class="label">กลุ่มผู้ใช้งาน: </span>
                                 <span class="value">${parseRequester(t.requester_name).group || 'นักศึกษา'}</span>
                             </div>
                             <div>
                                 <span class="label">อีเมลผู้แจ้ง: </span>
                                 <span class="value">${t.requester_email || '-'}</span>
                             </div>
                             <div>
                                 <span class="label">ผู้รับผิดชอบ: </span>
                                 <span class="value">${t.assigned_to || 'ยังไม่ได้มอบหมาย'}</span>
                             </div>
                             <div>
                                 <span class="label">วันที่สร้างรายการ: </span>
                                 <span class="value">${new Date(t.created_at).toLocaleString('th-TH')}</span>
                             </div>
                        </div>
                    </div>

                    ${t.resolution_note ? `
                    <div class="section">
                        <div class="section-title">บันทึกการดำเนินงาน / วิธีแก้ไข</div>
                        <div class="description" style="border-left: 4px solid #22c55e;">${t.resolution_note}</div>
                    </div>
                    ` : ''}

                    <div style="text-align: center; margin-top: 50px;">
                        <button class="print-btn" onclick="window.print()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">พิมพ์รายงาน PDF</button>
                    </div>
                </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    };

    if (loading) {
        return (
            <div className="page-detail fade-in" style={{ textAlign: 'center', padding: '5rem' }}>
                <p className="text-muted">กำลังโหลดข้อมูล Ticket...</p>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="page-detail fade-in">
                <div className="empty-state">
                    <h3>ไม่พบ Ticket</h3>
                    <p>Ticket ที่คุณต้องการดูไม่พบในระบบ</p>
                    <Link href="/tickets" className="btn btn-primary">กลับไปรายการ Ticket</Link>
                </div>
            </div>
        );
    }

    const { cleanDescription, attachments } = parseDescriptionAndAttachments(ticket.description);

    const statusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS['Open'];
    const priorityColor = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS['Medium'];
    const isOwner = ticket.requester_name === currentUser.name;
    const canEdit = isAdmin || (isOwner && ticket.status === STATUSES.OPEN);
    const canCancel = isOwner && (ticket.status === STATUSES.OPEN || ticket.status === STATUSES.IN_PROGRESS);

    // Format Dates
    const formatDate = (isoString) => {
        if (!isoString) return '-';
        const d = new Date(isoString);
        return d.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Actions
    const handleUpdateStatus = async (newStatus) => {
        try {
            const res = await fetch(`/api/tickets/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                toast.success(`เปลี่ยนสถานะเป็น "${newStatus}" เรียบร้อย`);
                fetchTicketData();
            } else {
                toast.error('ไม่สามารถเปลี่ยนสถานะได้');
            }
        } catch (e) {
            console.error(e);
            toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    };

    const handleUpdateAssignee = async (assignee) => {
        try {
            const res = await fetch(`/api/tickets/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assigned_to: assignee })
            });
            if (res.ok) {
                toast.success(assignee ? `มอบหมายให้ "${assignee}" เรียบร้อย` : 'ยกเลิกการมอบหมายแล้ว');
                fetchTicketData();
            } else {
                toast.error('ไม่สามารถมอบหมายงานได้');
            }
        } catch (e) {
            console.error(e);
            toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    };

    const handleSaveNote = async () => {
        setUpdatingNote(true);
        try {
            const res = await fetch(`/api/tickets/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolution_note: noteContent })
            });
            if (res.ok) {
                toast.success('บันทึกหมายเหตุการดำเนินงานเรียบร้อย');
                fetchTicketData();
            } else {
                toast.error('ไม่สามารถบันทึกหมายเหตุได้');
            }
        } catch (e) {
            console.error(e);
            toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setUpdatingNote(false);
        }
    };

    const handleCancelTicket = () => {
        confirm(
            'ยกเลิก Ticket',
            'คุณต้องการยกเลิก Ticket นี้ใช่หรือไม่?',
            async () => {
                try {
                    const res = await fetch(`/api/tickets/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: STATUSES.CANCELLED })
                    });
                    if (res.ok) {
                        toast.success('ยกเลิก Ticket เรียบร้อย');
                        fetchTicketData();
                    } else {
                        toast.error('ไม่สามารถยกเลิกได้');
                    }
                } catch (e) {
                    console.error(e);
                    toast.error('เกิดข้อผิดพลาด');
                }
            },
            { confirmClass: 'btn-danger' }
        );
    };

    const handleDeleteTicket = () => {
        confirm(
            'ลบ Ticket',
            'คุณต้องการลบ Ticket นี้ใช่หรือไม่? การลบจะไม่สามารถกู้คืนได้',
            async () => {
                try {
                    const res = await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        toast.success('ลบ Ticket เรียบร้อย');
                        router.push('/tickets');
                    } else {
                        toast.error('ไม่สามารถลบได้');
                    }
                } catch (e) {
                    console.error(e);
                    toast.error('เกิดข้อผิดพลาด');
                }
            },
            { confirmClass: 'btn-danger' }
        );
    };

    const showEditModal = () => {
        let titleVal = ticket.title;
        let descVal = ticket.description;
        let typeVal = ticket.issue_type;
        let locationVal = ticket.location;
        let priorityVal = ticket.priority;

        confirm(
            'แก้ไข Ticket',
            '',
            async () => {
                try {
                    const res = await fetch(`/api/tickets/${id}`, {
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
                        toast.success('แก้ไข Ticket เรียบร้อย');
                        fetchTicketData();
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
                                defaultValue={ticket.title}
                                onChange={(e) => { titleVal = e.target.value; }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">รายละเอียด</label>
                            <textarea 
                                className="form-input form-textarea" 
                                rows={3}
                                defaultValue={ticket.description}
                                onChange={(e) => { descVal = e.target.value; }}
                            ></textarea>
                        </div>
                        <div className="form-group">
                            <label className="form-label">ประเภทปัญหา</label>
                            <select 
                                className="form-input form-select"
                                defaultValue={ticket.issue_type}
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
                                defaultValue={ticket.location}
                                onChange={(e) => { locationVal = e.target.value; }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">ระดับความสำคัญ</label>
                            <select 
                                className="form-input form-select"
                                defaultValue={ticket.priority}
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

    return (
        <div className="page-detail fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>
                        <ArrowLeft style={{ width: 16, height: 16 }} />
                        กลับ
                    </button>
                    <h1 className="page-title">{ticket.ticket_no}</h1>
                </div>
                <div className="page-header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-ghost" onClick={() => handlePrintSingleTicket(ticket)}>
                        <Printer style={{ width: 16, height: 16 }} />
                        พิมพ์รายงาน
                    </button>
                    {canEdit && (
                        <button className="btn btn-ghost" onClick={showEditModal}>
                            <Edit style={{ width: 16, height: 16 }} />
                            แก้ไข
                        </button>
                    )}
                    {canCancel && (
                        <button className="btn btn-danger-ghost" onClick={handleCancelTicket}>
                            <XCircle style={{ width: 16, height: 16 }} />
                            ยกเลิก
                        </button>
                    )}
                    {isAdmin && (
                        <button className="btn btn-danger-ghost" onClick={handleDeleteTicket}>
                            <Trash2 style={{ width: 16, height: 16 }} />
                            ลบ
                        </button>
                    )}
                </div>
            </div>

            <div className="detail-layout">
                {/* Main Content */}
                <div className="detail-main glass-card">
                    <div className="detail-title-section">
                        <h2 className="detail-title">{ticket.title}</h2>
                        <div className="detail-badges">
                            <span 
                                className="status-badge status-badge-lg" 
                                style={{ background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}` }}
                            >
                                {ticket.status}
                            </span>
                            <span 
                                className="priority-badge priority-badge-lg" 
                                style={{ background: priorityColor.bg, color: priorityColor.text, border: `1px solid ${priorityColor.border}` }}
                            >
                                {ticket.priority}
                            </span>
                        </div>
                    </div>

                    <div className="detail-description">
                        <h3 className="detail-label">รายละเอียดปัญหา</h3>
                        <p style={{ whiteSpace: 'pre-wrap' }}>{cleanDescription || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                    </div>

                    <div className="detail-attachments" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <h3 className="detail-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                                <Paperclip style={{ width: 16, height: 16 }} />
                                ไฟล์แนบ ({attachments.length})
                            </h3>
                            <div>
                                <input 
                                    type="file" 
                                    id="direct-file-input" 
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            handleDirectFileUpload(e.target.files);
                                        }
                                        e.target.value = ''; // Reset input to allow selecting the same files again
                                    }}
                                />
                                <button 
                                    className="btn btn-ghost btn-sm"
                                    disabled={uploadingDirectFile}
                                    onClick={() => document.getElementById('direct-file-input').click()}
                                    style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}
                                >
                                    {uploadingDirectFile ? <Loader className="animate-spin" style={{ width: 14, height: 14 }} /> : <Plus style={{ width: 14, height: 14 }} />}
                                    {uploadingDirectFile ? 'กำลังอัปโหลด...' : 'เพิ่มไฟล์แนบ / รูปภาพ'}
                                </button>
                            </div>
                        </div>

                        {attachments.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center' }}>
                                {attachments.map((file, idx) => {
                                    const isImage = file.isImage || isImageFile(file.name, file.url);
                                    const isValidUrl = file.url && file.url !== '#';

                                    return (
                                        <div key={idx} style={{
                                            position: 'relative',
                                            width: '135px',
                                            height: '135px',
                                            flexShrink: 0
                                        }}>
                                            {isImage ? (
                                                <div 
                                                    onClick={() => isValidUrl && setSelectedImageModal(file.url)}
                                                    title={isValidUrl ? "คลิกเพื่อขยายดูรูปภาพ" : file.name}
                                                    style={{ 
                                                        width: '100%',
                                                        height: '100%', 
                                                        borderRadius: '12px', 
                                                        overflow: 'hidden', 
                                                        background: 'rgba(0,0,0,0.3)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        position: 'relative',
                                                        cursor: isValidUrl ? 'pointer' : 'default',
                                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)'
                                                    }}
                                                >
                                                    {isValidUrl ? (
                                                        <>
                                                            <img 
                                                                src={file.url} 
                                                                alt={file.name} 
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.25s ease' }} 
                                                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                                                            />
                                                            <div style={{
                                                                position: 'absolute',
                                                                bottom: 6, right: 6,
                                                                background: 'rgba(0,0,0,0.6)',
                                                                backdropFilter: 'blur(4px)',
                                                                color: '#fff',
                                                                padding: '4px 8px',
                                                                borderRadius: '4px',
                                                                fontSize: '0.7rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 4
                                                            }}>
                                                                <Maximize2 style={{ width: 10, height: 10 }} />
                                                                ขยาย
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-secondary)' }}>
                                                            <ImageIcon style={{ width: 36, height: 36, margin: '0 auto 4px', color: '#4ade80' }} />
                                                            <div style={{ fontSize: '0.75rem' }}>{file.name}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div style={{ 
                                                    width: '100%',
                                                    height: '100%', 
                                                    borderRadius: '12px', 
                                                    background: 'rgba(255,255,255,0.05)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'var(--text-secondary)',
                                                    padding: '0.5rem',
                                                    textAlign: 'center',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)'
                                                }}>
                                                    <FileText style={{ width: 36, height: 36, color: '#60a5fa', marginBottom: 4 }} />
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                                        {file.name}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                                ไม่มีไฟล์แนบ (คลิกปุ่มด้านบนเพื่ออัปโหลดรูปภาพหรือไฟล์แนบ)
                            </p>
                        )}
                    </div>

                    {ticket.resolution_note && (
                        <div className="detail-resolution">
                            <h3 className="detail-label">
                                <ClipboardCheck style={{ width: 16, height: 16 }} />
                                บันทึกการดำเนินงาน
                            </h3>
                            <p>{ticket.resolution_note}</p>
                        </div>
                    )}

                    {/* Admin management area */}
                    {isAdmin && (
                        <div className="detail-admin-actions">
                            <h3 className="detail-label">
                                <Settings style={{ width: 16, height: 16 }} />
                                การจัดการ (Admin)
                            </h3>
                            
                            <div className="admin-action-grid">
                                <div className="form-group">
                                    <label className="form-label">เปลี่ยนสถานะ</label>
                                    <select 
                                        className="form-input form-select"
                                        value={ticket.status}
                                        onChange={(e) => handleUpdateStatus(e.target.value)}
                                    >
                                        {Object.values(STATUSES).map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="form-group">
                                    <label className="form-label">มอบหมายผู้รับผิดชอบ</label>
                                    <select 
                                        className="form-input form-select"
                                        value={ticket.assigned_to}
                                        onChange={(e) => handleUpdateAssignee(e.target.value)}
                                    >
                                        <option value="">-- ยังไม่ได้มอบหมาย --</option>
                                        {STAFF_MEMBERS.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group form-group-full">
                                    <label className="form-label">เพิ่มหมายเหตุการดำเนินงาน</label>
                                    <textarea 
                                        className="form-input form-textarea" 
                                        rows={3} 
                                        placeholder="บันทึกผลการดำเนินงานหรือวิธีแก้ไข..."
                                        value={noteContent}
                                        onChange={(e) => setNoteContent(e.target.value)}
                                    ></textarea>
                                    <button 
                                        className="btn btn-primary btn-sm" 
                                        style={{ marginTop: 8, alignSelf: 'flex-start' }}
                                        onClick={handleSaveNote}
                                        disabled={updatingNote}
                                    >
                                        <Save style={{ width: 14, height: 14 }} />
                                        บันทึกหมายเหตุ
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar Info */}
                <div className="detail-sidebar">
                    <div className="detail-info-card glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1.25rem' }}>
                        <h3 className="detail-info-title" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 0.75rem 0', alignSelf: 'flex-start' }}>
                            <QrCode style={{ width: 14, height: 14 }} /> QR Code ติดตามสถานะ
                        </h3>
                        {qrCodeUrl ? (
                            <div style={{ background: 'white', padding: '8px', borderRadius: '8px', display: 'inline-block', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                <img src={qrCodeUrl} alt="Ticket QR Code" style={{ width: 130, height: 130, display: 'block' }} />
                            </div>
                        ) : (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>กำลังสร้าง QR Code...</span>
                        )}
                        <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: '1.4' }}>
                            สแกนด้วยสมาร์ทโฟนเพื่อเปิดหน้าตั๋วปัญหานี้และติดตามสถานะได้ทันที
                        </span>
                    </div>

                    <div className="detail-info-card glass-card">
                        <h3 className="detail-info-title">ข้อมูล Ticket</h3>
                        <div className="detail-info-list">
                            <div className="detail-info-item">
                                <span className="info-label"><Hash style={{ width: 14, height: 14 }} /> Ticket No</span>
                                <span className="info-value">{ticket.ticket_no}</span>
                            </div>
                            <div className="detail-info-item">
                                <span className="info-label"><Tag style={{ width: 14, height: 14 }} /> ประเภท</span>
                                <span className="info-value">{ticket.issue_type}</span>
                            </div>
                            <div className="detail-info-item">
                                <span className="info-label"><MapPin style={{ width: 14, height: 14 }} /> สถานที่</span>
                                <span className="info-value">{ticket.location || '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="detail-info-card glass-card">
                        <h3 className="detail-info-title">ข้อมูลผู้แจ้ง</h3>
                        <div className="detail-info-list">
                            <div className="detail-info-item">
                                <span className="info-label"><User style={{ width: 14, height: 14 }} /> ชื่อ</span>
                                <span className="info-value">{parseRequester(ticket.requester_name).name}</span>
                            </div>
                            <div className="detail-info-item">
                                <span className="info-label"><UserCheck style={{ width: 14, height: 14 }} /> กลุ่มผู้ใช้งาน</span>
                                <span className="info-value">
                                    <span className="user-role-badge" style={{
                                        display: 'inline-block',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        background: 'rgba(59, 130, 246, 0.1)',
                                        color: '#60a5fa',
                                        border: '1px solid rgba(59, 130, 246, 0.2)'
                                    }}>
                                        {parseRequester(ticket.requester_name).group || 'นักศึกษา'}
                                    </span>
                                </span>
                            </div>
                            <div className="detail-info-item">
                                <span className="info-label"><Mail style={{ width: 14, height: 14 }} /> อีเมล</span>
                                <span className="info-value">{ticket.requester_email || '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="detail-info-card glass-card">
                        <h3 className="detail-info-title">ผู้รับผิดชอบ</h3>
                        <div className="detail-info-list">
                            <div className="detail-info-item">
                                <span className="info-label"><UserCheck style={{ width: 14, height: 14 }} /> มอบหมายให้</span>
                                <span className="info-value">{ticket.assigned_to || 'ยังไม่ได้มอบหมาย'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="detail-info-card glass-card">
                        <h3 className="detail-info-title">วันที่</h3>
                        <div className="detail-info-list">
                            <div className="detail-info-item">
                                <span className="info-label"><Calendar style={{ width: 14, height: 14 }} /> วันที่สร้าง</span>
                                <span className="info-value">{formatDate(ticket.created_at)}</span>
                            </div>
                            <div className="detail-info-item">
                                <span className="info-label"><Clock style={{ width: 14, height: 14 }} /> แก้ไขล่าสุด</span>
                                <span className="info-value">{formatDate(ticket.updated_at)}</span>
                            </div>
                            {ticket.closed_at && (
                                <div className="detail-info-item">
                                    <span className="info-label"><Settings style={{ width: 14, height: 14 }} /> วันที่ปิด</span>
                                    <span className="info-value">{formatDate(ticket.closed_at)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {selectedImageModal && (
                <div 
                    onClick={() => setSelectedImageModal(null)}
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 9999,
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
