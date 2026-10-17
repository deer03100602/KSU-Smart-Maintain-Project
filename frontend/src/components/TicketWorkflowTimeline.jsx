import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
    Clock, CheckCircle, Play, Pause, RotateCcw, AlertTriangle, 
    CheckCircle2, User, FileText, ArrowRight, CornerDownRight, X 
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { getStoredTimelines, saveStoredTimelines } from '@/lib/ticketStore';

export default function TicketWorkflowTimeline({ 
    ticket, 
    timelines = [], 
    isAdmin = false, 
    currentUser = {},
    onActionCompleted 
}) {
    const appContext = useApp();
    const ctxGroupA = appContext?.isGroupA;
    const ctxGroupB = appContext?.isGroupB;
    const appUser = appContext?.user;
    const isStudentOrTeacher = ['นักศึกษา', 'อาจารย์'].includes(currentUser?.group || appUser?.group);
    const canManageWorkflow = !ctxGroupA && !isStudentOrTeacher && (isAdmin || ctxGroupB);

    const [actionLoading, setActionLoading] = useState(false);
    const [actionNote, setActionNote] = useState('');
    const [activeActionModal, setActiveActionModal] = useState(null); // 'START' | 'WAITING_PARTS' | 'SUBMIT_INSPECTION' | 'RETURN_REVISE' | 'COMPLETE'
    const [inspectionConfirmed, setInspectionConfirmed] = useState(false);

    // Form data for SUBMIT_INSPECTION handover report
    const [submitData, setSubmitData] = useState({
        problem_summary: '',
        root_cause: '',
        solution_method: '',
        materials_used: '',
        testing_results: '',
        recommendations: ''
    });

    // Close modal on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && activeActionModal) {
                setActiveActionModal(null);
                setActionNote('');
                setInspectionConfirmed(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeActionModal]);

    const isAssignedToCurrent = ticket.assigned_to && (
        ticket.assigned_to === currentUser.name ||
        ticket.assigned_to === currentUser.email
    );

    const isRequester = ticket.requester_name && (
        ticket.requester_name.includes(currentUser.name) ||
        ticket.requester_email === currentUser.email
    );

    const handleWorkflowAction = async (action, noteOrData = '') => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('helpdesk_token');
            const reqBody = typeof noteOrData === 'object' && noteOrData !== null 
                ? { action, ...noteOrData }
                : { action, note: noteOrData || actionNote, reason: noteOrData || actionNote };

            // Ensure ticket is passed in request so serverless lambda can self-heal if container restarted
            const clientTicketHeader = ticket ? encodeURIComponent(JSON.stringify({
                id: ticket.id,
                ticket_no: ticket.ticket_no,
                title: ticket.title,
                description: ticket.description,
                issue_type: ticket.issue_type,
                location: ticket.location,
                priority: ticket.priority,
                status: ticket.status,
                requester_name: ticket.requester_name,
                requester_email: ticket.requester_email,
                assigned_to: ticket.assigned_to
            })) : '';

            const currentUserData = localStorage.getItem('helpdesk_current_user');
            const clientUserHeader = currentUserData ? encodeURIComponent(currentUserData) : (
                currentUser?.email ? encodeURIComponent(JSON.stringify(currentUser)) : ''
            );

            const res = await fetch(`/api/tickets/${ticket.id}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                    'x-client-ticket': clientTicketHeader,
                    'x-client-user': clientUserHeader
                },
                body: JSON.stringify(reqBody)
            });

            const data = await res.json();
            if (res.ok) {
                if (data && data.timeline) {
                    const stored = getStoredTimelines(ticket.id) || [];
                    saveStoredTimelines(ticket.id, [...stored, data.timeline]);
                }
                setActiveActionModal(null);
                setActionNote('');
                if (onActionCompleted) onActionCompleted();
            } else {
                alert(data.error || 'เกิดข้อผิดพลาดในการดำเนินการ');
            }
        } catch (err) {
            alert('การเชื่อมต่อเซิร์ฟเวอร์ล้มเหลว');
        } finally {
            setActionLoading(false);
        }
    };

    const getActionBadge = (action) => {
        switch (action) {
            case 'ACCEPTED': return { color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)', border: 'rgba(96, 165, 250, 0.3)', text: 'รับงานซ่อม' };
            case 'ASSIGNED': return { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)', text: 'มอบหมายงาน' };
            case 'STARTED': return { color: '#4ade80', bg: 'rgba(74, 222, 128, 0.12)', border: 'rgba(74, 222, 128, 0.3)', text: 'เริ่มดำเนินงาน' };
            case 'WAITING_PARTS': return { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.3)', text: 'รออุปกรณ์ / งบ' };
            case 'SUBMITTED_INSPECTION': return { color: '#c084fc', bg: 'rgba(192, 132, 252, 0.12)', border: 'rgba(192, 132, 252, 0.3)', text: 'ส่งงานตรวจรับ' };
            case 'RETURNED_FOR_REVISE': return { color: '#f87171', bg: 'rgba(248, 113, 113, 0.12)', border: 'rgba(248, 113, 113, 0.3)', text: 'ส่งกลับแก้ไข' };
            case 'COMPLETED': return { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.3)', text: 'เสร็จสิ้นสมบูรณ์' };
            case 'CREATED': return { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)', text: 'เปิดงานใหม่' };
            case 'STATUS_CHANGED': return { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)', text: 'เปลี่ยนสถานะ' };
            default: return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)', text: 'บันทึกความคืบหน้า' };
        }
    };

    const getActionIcon = (action) => {
        const badge = getActionBadge(action);
        switch (action) {
            case 'ACCEPTED': return <User style={{ width: 14, height: 14, color: badge.color }} />;
            case 'ASSIGNED': return <User style={{ width: 14, height: 14, color: badge.color }} />;
            case 'STARTED': return <Play style={{ width: 14, height: 14, color: badge.color }} />;
            case 'WAITING_PARTS': return <Pause style={{ width: 14, height: 14, color: badge.color }} />;
            case 'SUBMITTED_INSPECTION': return <FileText style={{ width: 14, height: 14, color: badge.color }} />;
            case 'RETURNED_FOR_REVISE': return <RotateCcw style={{ width: 14, height: 14, color: badge.color }} />;
            case 'COMPLETED': return <CheckCircle2 style={{ width: 14, height: 14, color: badge.color }} />;
            case 'CREATED': return <CheckCircle style={{ width: 14, height: 14, color: badge.color }} />;
            default: return <Clock style={{ width: 14, height: 14, color: badge.color }} />;
        }
    };

    // Synthesize display timelines from both backend/props and ticket lifecycle
    const displayTimelines = useMemo(() => {
        let list = Array.isArray(timelines) ? [...timelines] : [];

        // 1. Initial creation
        const hasCreated = list.some(t => t.action === 'CREATED' || (t.title && t.title.includes('สร้างรายการ')));
        if (!hasCreated && ticket?.created_at) {
            list.unshift({
                id: `tml-syn-created-${ticket.id}`,
                ticket_id: ticket.id,
                action: 'CREATED',
                title: 'สร้างรายการแจ้งซ่อมใหม่ในระบบ',
                description: `ผู้แจ้ง: ${ticket.requester_name || 'ผู้ใช้งาน'} | สถานที่: ${ticket.location || '-'} | ความเร่งด่วน: ${ticket.priority || 'Medium'}`,
                actor_name: ticket.requester_name || 'ผู้แจ้งซ่อม',
                actor_role: 'ผู้แจ้งซ่อม',
                created_at: ticket.created_at
            });
        }

        // 2. Assignment
        const hasAssigned = list.some(t => t.action === 'ASSIGNED' || (t.title && t.title.includes('มอบหมาย')));
        if (!hasAssigned && ticket?.assigned_to) {
            list.push({
                id: `tml-syn-assigned-${ticket.id}`,
                ticket_id: ticket.id,
                action: 'ASSIGNED',
                title: `มอบหมายงานให้ ${ticket.assigned_to}`,
                description: `ผู้รับผิดชอบหลัก: ${ticket.assigned_to}${ticket.co_workers ? ` | ผู้ร่วมดำเนินงาน: ${ticket.co_workers}` : ''}`,
                actor_name: 'ผู้ดูแลระบบ',
                actor_role: 'admin',
                created_at: ticket.created_at
            });
        }

        // 3. Resolution note / Start work note (e.g. [เริ่มงาน]: แปอ)
        if (ticket?.resolution_note) {
            const noteText = String(ticket.resolution_note).trim();
            const lines = noteText.split('\n').map(l => l.trim()).filter(Boolean);
            lines.forEach((line, idx) => {
                const exists = list.some(t => 
                    t.description && (t.description === line || t.description.includes(line) || line.includes(t.description))
                );
                if (!exists) {
                    let act = 'NOTE_ADDED';
                    let title = 'บันทึกหมายเหตุการดำเนินงาน';
                    let cleanDesc = line;
                    if (line.includes('[เริ่มงาน]')) {
                        act = 'STARTED';
                        title = 'เริ่มดำเนินงานซ่อมบำรุง';
                        cleanDesc = line.replace(/\[เริ่มงาน\]:?\s*/g, '');
                    } else if (line.includes('[รออุปกรณ์]')) {
                        act = 'WAITING_PARTS';
                        title = 'รออุปกรณ์ / อะไหล่ / งบประมาณ';
                        cleanDesc = line.replace(/\[รออุปกรณ์\]:?\s*/g, '');
                    } else if (line.includes('[ส่งกลับแก้ไข]')) {
                        act = 'RETURNED_FOR_REVISE';
                        title = 'ส่งกลับแก้ไขงาน';
                        cleanDesc = line.replace(/\[ส่งกลับแก้ไข\]:?\s*/g, '');
                    }
                    list.push({
                        id: `tml-syn-note-${ticket.id}-${idx}`,
                        ticket_id: ticket.id,
                        action: act,
                        title: title,
                        description: cleanDesc || line,
                        actor_name: ticket.assigned_to || currentUser?.name || 'เจ้าหน้าที่ผู้รับผิดชอบ',
                        actor_role: 'ช่าง / ผู้รับผิดชอบ',
                        created_at: ticket.updated_at || ticket.created_at
                    });
                }
            });
        }

        // 4. Handover report
        if (ticket?.completion_summary) {
            const hasHandover = list.some(t => t.action === 'SUBMITTED_INSPECTION' || (t.title && t.title.includes('ส่งมอบงาน')));
            if (!hasHandover) {
                list.push({
                    id: `tml-syn-submit-${ticket.id}`,
                    ticket_id: ticket.id,
                    action: 'SUBMITTED_INSPECTION',
                    title: 'ส่งมอบงานเพื่อรอตรวจรับ (Handover Report)',
                    description: 'เจ้าหน้าที่บันทึกรายงานสรุปผลการซ่อมแซมและส่งมอบงานเพื่อรอตรวจรับ',
                    actor_name: ticket.assigned_to || 'เจ้าหน้าที่',
                    actor_role: 'staff',
                    created_at: ticket.updated_at || ticket.created_at
                });
            }
        }

        // 5. Completion
        if (ticket?.status === 'Closed' || ticket?.accepted_by) {
            const hasCompleted = list.some(t => t.action === 'COMPLETED' || (t.title && t.title.includes('เสร็จสิ้น')));
            if (!hasCompleted) {
                list.push({
                    id: `tml-syn-closed-${ticket.id}`,
                    ticket_id: ticket.id,
                    action: 'COMPLETED',
                    title: 'ยืนยันตรวจรับและปิดงานเสร็จสิ้นสมบูรณ์',
                    description: ticket.accepted_by ? `ตรวจรับงานเรียบร้อยโดย ${ticket.accepted_by}` : 'งานซ่อมเสร็จสิ้นสมบูรณ์',
                    actor_name: ticket.accepted_by || 'ผู้ดูแลระบบ',
                    actor_role: 'admin',
                    created_at: ticket.closed_at || ticket.accepted_at || ticket.updated_at
                });
            }
        }

        // Deduplicate: strictly ONE 'CREATED' event and unique IDs
        let seenCreated = false;
        const dedupedList = [];
        for (const item of list) {
            if (item.action === 'CREATED' || (item.title && item.title.includes('สร้างรายการ'))) {
                if (seenCreated) continue;
                seenCreated = true;
            }
            dedupedList.push(item);
        }

        // Sort chronologically ascending
        dedupedList.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        return dedupedList;
    }, [timelines, ticket, currentUser]);

    return (
        <div className="glass-card" style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock style={{ width: 20, height: 20, color: '#3b82f6' }} />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>ขั้นตอนดำเนินงาน & ไทม์ไลน์ (Workflow Timeline)</h3>
                </div>
            </div>

            {/* Workflow Quick Action Buttons (Exclusively visible to Group B / Staff / Admin) */}
            {canManageWorkflow && (
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px'
                }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '4px' }}>
                        ปุ่มสั่งการสถานะ:
                    </span>

                    {/* 1. ปุ่มรับงาน (สำหรับช่างหรือ Admin) */}
                    {ticket.status === 'Open' && (
                        <button 
                            className="btn btn-primary btn-sm"
                            disabled={actionLoading}
                            onClick={() => handleWorkflowAction('ACCEPT', 'เจ้าหน้าที่กดรับมอบหมายงานซ่อม')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}
                        >
                            <User style={{ width: 14, height: 14 }} /> กดรับงานซ่อม
                        </button>
                    )}

                    {/* 2. เริ่มดำเนินงาน */}
                    {ticket.status !== 'Closed' && ticket.status !== 'Cancelled' && (
                        <button 
                            className="btn btn-ghost btn-sm"
                            disabled={actionLoading}
                            onClick={() => setActiveActionModal('START')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80' }}
                        >
                            <Play style={{ width: 14, height: 14 }} /> เริ่มดำเนินงาน
                        </button>
                    )}

                    {/* 3. รออุปกรณ์ / อะไหล่ */}
                    {ticket.status !== 'Closed' && ticket.status !== 'Cancelled' && (
                        <button 
                            className="btn btn-ghost btn-sm"
                            disabled={actionLoading}
                            onClick={() => setActiveActionModal('WAITING_PARTS')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' }}
                        >
                            <Pause style={{ width: 14, height: 14 }} /> รออุปกรณ์ / งบประมาณ
                        </button>
                    )}

                    {/* 4. ส่งงานตรวจรับ */}
                    {ticket.status !== 'Closed' && ticket.status !== 'Cancelled' && (
                        <button 
                            className="btn btn-ghost btn-sm"
                            disabled={actionLoading}
                            onClick={() => setActiveActionModal('SUBMIT_INSPECTION')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', background: 'rgba(168, 85, 247, 0.1)', color: '#c084fc' }}
                        >
                            <FileText style={{ width: 14, height: 14 }} /> ส่งงานตรวจรับ
                        </button>
                    )}

                    {/* 5. ส่งกลับแก้ไขงาน */}
                    {ticket.status !== 'Closed' && (
                        <button 
                            className="btn btn-ghost btn-sm"
                            disabled={actionLoading}
                            onClick={() => setActiveActionModal('RETURN_REVISE')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}
                        >
                            <RotateCcw style={{ width: 14, height: 14 }} /> ส่งกลับแก้ไขงาน
                        </button>
                    )}

                    {/* 6. ยืนยันเสร็จสิ้นงาน */}
                    {ticket.status !== 'Closed' && (
                        <button 
                            className="btn btn-primary btn-sm"
                            disabled={actionLoading}
                            onClick={() => {
                                setActiveActionModal('COMPLETE');
                                setInspectionConfirmed(true);
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', background: '#16a34a', borderColor: '#16a34a' }}
                        >
                            <CheckCircle2 style={{ width: 14, height: 14 }} /> ยืนยันตรวจรับเสร็จสิ้นสมบูรณ์
                        </button>
                    )}
                </div>
            )}

            {/* Timeline Stream */}
            <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid rgba(255, 255, 255, 0.1)', marginLeft: '10px' }}>
                {displayTimelines.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '8px 0' }}>
                        ยังไม่มีประวัติการดำเนินงาน บันทึกจะแสดงเมื่อมีการรับงาน เริ่มงาน หรือเปลี่ยนสถานะ
                    </div>
                ) : (
                    displayTimelines.map((tml, idx) => {
                        const badge = getActionBadge(tml.action);
                        return (
                            <div key={tml.id || idx} style={{ marginBottom: '1.25rem', position: 'relative' }}>
                                {/* Bullet icon */}
                                <div style={{
                                    position: 'absolute',
                                    left: '-33px',
                                    top: '2px',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: 'var(--card-bg, #0f172a)',
                                    border: `2px solid ${badge.color}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: `0 0 8px ${badge.bg}`
                                }}>
                                    {getActionIcon(tml.action)}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                                            {tml.title}
                                        </span>
                                        {badge.text && (
                                            <span style={{
                                                fontSize: '0.72rem',
                                                padding: '2px 8px',
                                                borderRadius: '999px',
                                                background: badge.bg,
                                                color: badge.color,
                                                border: `1px solid ${badge.border}`,
                                                fontWeight: 600
                                            }}>
                                                {badge.text}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {tml.created_at ? new Date(tml.created_at).toLocaleString('th-TH') : '-'}
                                    </div>
                                </div>

                                {tml.description && (
                                    <div style={{ 
                                        fontSize: '0.85rem', 
                                        color: 'var(--text-secondary)', 
                                        marginTop: '5px', 
                                        whiteSpace: 'pre-wrap',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                        borderRadius: '6px',
                                        padding: '6px 10px'
                                    }}>
                                        {tml.description}
                                    </div>
                                )}

                                <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: '4px' }}>
                                    ดำเนินการโดย: {tml.actor_name || 'เจ้าหน้าที่'} {tml.actor_role ? `(${tml.actor_role})` : ''}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Workflow Action Modal Window (Rendered via Portal directly to body) */}
            {activeActionModal && typeof document !== 'undefined' && createPortal(
                <div 
                    className="modal-overlay modal-active"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 999999,
                        padding: '1.25rem',
                        boxSizing: 'border-box'
                    }}
                    onClick={(e) => {
                        if (e.target.classList.contains('modal-overlay')) {
                            setActiveActionModal(null);
                            setActionNote('');
                            setInspectionConfirmed(false);
                        }
                    }}
                >
                    <div 
                        className="modal-container" 
                        style={{ 
                            maxWidth: activeActionModal === 'SUBMIT_INSPECTION' ? '680px' : '520px', 
                            width: '100%', 
                            maxHeight: '90vh', 
                            display: 'flex', 
                            flexDirection: 'column',
                            borderRadius: '16px',
                            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
                            border: '1px solid var(--border-card)',
                            backgroundColor: 'var(--bg-secondary, #1e293b)',
                            color: 'var(--text-primary)',
                            overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <h3 className="modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {activeActionModal === 'START' && '⚙️ เริ่มดำเนินงานซ่อมบำรุง'}
                                {activeActionModal === 'WAITING_PARTS' && '⏳ บันทึกสถานะรออุปกรณ์ / อะไหล่ / งบประมาณ'}
                                {activeActionModal === 'SUBMIT_INSPECTION' && '📋 ส่งมอบงานเพื่อตรวจรับ (Handover Report)'}
                                {activeActionModal === 'RETURN_REVISE' && '⚠️ ส่งกลับเพื่อแก้ไขงานซ่อม'}
                                {activeActionModal === 'COMPLETE' && '🎉 ตรวจรับและยืนยันปิดงานเสร็จสิ้น'}
                            </h3>
                            <button 
                                type="button" 
                                className="modal-close-btn" 
                                onClick={() => {
                                    setActiveActionModal(null);
                                    setActionNote('');
                                    setInspectionConfirmed(false);
                                }}
                                title="ปิดหน้าต่าง"
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X style={{ width: 20, height: 20 }} />
                            </button>
                        </div>

                        <div className="modal-body" style={{ padding: '1.5rem', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
                            {/* Special Rich Form for SUBMIT_INSPECTION */}
                            {activeActionModal === 'SUBMIT_INSPECTION' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                                        กรุณากรอกรายงานสรุปผลการซ่อมบำรุงเพื่อเสนอต่อผู้มีสิทธิ์ตรวจรับและผู้บริหาร
                                    </p>

                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>1. สรุปปัญหาที่ตรวจพบ *</label>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            placeholder="เช่น สายสัญญาณขาดชำรุด, แหล่งจ่ายไฟไหม้"
                                            value={submitData.problem_summary}
                                            onChange={(e) => setSubmitData({ ...submitData, problem_summary: e.target.value })}
                                            style={{ width: '100%', fontSize: '0.85rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>2. สาเหตุของปัญหา *</label>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            placeholder="เช่น การเสื่อมสภาพตามอายุการใช้งาน, ไฟกระชาก"
                                            value={submitData.root_cause}
                                            onChange={(e) => setSubmitData({ ...submitData, root_cause: e.target.value })}
                                            style={{ width: '100%', fontSize: '0.85rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>3. วิธีการและขั้นตอนการแก้ไข *</label>
                                        <textarea 
                                            className="form-input" 
                                            rows={2}
                                            placeholder="เช่น ทำการเปลี่ยนหม้อแปลงไฟฟ้าใหม่ และทดสอบการจ่ายกระแสไฟ"
                                            value={submitData.solution_method}
                                            onChange={(e) => setSubmitData({ ...submitData, solution_method: e.target.value })}
                                            style={{ width: '100%', fontSize: '0.85rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>4. รายการวัสดุ / อุปกรณ์ที่ใช้จริง</label>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            placeholder="เช่น สวิตช์ไฟ 1 ตัว, สายไฟ VAF 2x1.5 5 เมตร"
                                            value={submitData.materials_used}
                                            onChange={(e) => setSubmitData({ ...submitData, materials_used: e.target.value })}
                                            style={{ width: '100%', fontSize: '0.85rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>5. ผลการทดสอบการใช้งานหลังดำเนินงาน *</label>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            placeholder="เช่น อุปกรณ์เปิดใช้งานได้ปกติ สัญญาณเสถียร ไม่พบความร้อนสะสม"
                                            value={submitData.testing_results}
                                            onChange={(e) => setSubmitData({ ...submitData, testing_results: e.target.value })}
                                            style={{ width: '100%', fontSize: '0.85rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>6. ข้อเสนอแนะหรือสิ่งที่ต้องติดตามเพิ่มเติม</label>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            placeholder="เช่น แนะนำให้ตรวจสอบระบบกราวด์ของอาคารทุก 6 เดือน"
                                            value={submitData.recommendations}
                                            onChange={(e) => setSubmitData({ ...submitData, recommendations: e.target.value })}
                                            style={{ width: '100%', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                </div>
                            ) : activeActionModal === 'COMPLETE' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ background: 'var(--success-bg, rgba(34, 197, 94, 0.08))', border: '1px solid var(--success-border, rgba(34, 197, 94, 0.25))', padding: '14px', borderRadius: '10px', fontSize: '0.875rem' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--success-color, #10b981)', marginBottom: '6px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <CheckCircle2 style={{ width: 18, height: 18 }} /> การยืนยันตรวจรับงานซ่อมบำรุง
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                            งาน: <strong style={{ color: 'var(--text-primary)' }}>#{ticket.ticket_no} - {ticket.title}</strong><br/>
                                            ผู้รับผิดชอบ: <span style={{ color: 'var(--text-primary)' }}>{ticket.assigned_to || 'เจ้าหน้าที่'}</span><br/>
                                            ผู้ตรวจรับ: <span style={{ color: 'var(--text-primary)' }}>{currentUser.name || 'ผู้มีสิทธิ์'}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>หมายเหตุการตรวจรับ (ถ้ามี)</label>
                                        <textarea 
                                            className="form-input" 
                                            rows={2}
                                            placeholder="เช่น ทดสอบใช้งานระบบเสียงแล้วทำงานได้ปกติดี เรียบร้อยสมบูรณ์"
                                            value={actionNote}
                                            onChange={(e) => setActionNote(e.target.value)}
                                            style={{ width: '100%', fontSize: '0.875rem' }}
                                        />
                                    </div>

                                    {/* Confirmation Checkbox Box */}
                                    <div 
                                        onClick={() => setInspectionConfirmed(!inspectionConfirmed)}
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '12px', 
                                            cursor: 'pointer', 
                                            fontSize: '0.9rem', 
                                            color: 'var(--text-primary)', 
                                            padding: '12px 14px',
                                            borderRadius: '8px',
                                            border: inspectionConfirmed ? '2px solid #22c55e' : '1px solid var(--border-card)',
                                            background: inspectionConfirmed ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                            transition: 'all 0.2s ease',
                                            userSelect: 'none'
                                        }}
                                    >
                                        <input 
                                            type="checkbox" 
                                            checked={inspectionConfirmed} 
                                            onChange={(e) => setInspectionConfirmed(e.target.checked)} 
                                            onClick={(e) => e.stopPropagation()}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#22c55e' }}
                                        />
                                        <span style={{ fontWeight: 600 }}>ข้าพเจ้าได้ตรวจสอบและทดสอบงานเรียบร้อยแล้ว ยืนยันเสร็จสิ้นสมบูรณ์</span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                        {activeActionModal === 'RETURN_REVISE' 
                                            ? 'ระบุเหตุผลและจุดที่ต้องแก้ไข *' 
                                            : (activeActionModal === 'WAITING_PARTS' ? 'ระบุอุปกรณ์หรือวัสดุที่ต้องรอ *' : 'บันทึกรายละเอียดเพิ่มเติม')}
                                    </label>
                                    <textarea 
                                        className="form-input" 
                                        rows={3}
                                        placeholder={
                                            activeActionModal === 'RETURN_REVISE' 
                                                ? 'ระบุสาเหตุ เช่น งานทาสียังไม่เรียบร้อย, อุปกรณ์ยังเปิดไม่ติด...'
                                                : (activeActionModal === 'WAITING_PARTS' ? 'ระบุสาเหตุ เช่น รออะไหล่บอร์ดวงจรจากตัวแทนจำหน่าย, รอนำเสนอขออนุมัติงบประมาณ...' : 'บันทึกความคืบหน้า...')
                                        }
                                        value={actionNote}
                                        onChange={(e) => setActionNote(e.target.value)}
                                        style={{ width: '100%', fontSize: '0.85rem' }}
                                    ></textarea>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer" style={{ 
                            padding: '1.25rem 1.5rem', 
                            display: 'flex', 
                            justifyContent: 'flex-end', 
                            gap: '0.75rem', 
                            borderTop: '1px solid var(--border-card)',
                            backgroundColor: 'var(--bg-secondary, #1e293b)',
                            flexShrink: 0 
                        }}>
                            <button 
                                type="button"
                                className="btn btn-secondary" 
                                onClick={() => { setActiveActionModal(null); setActionNote(''); setInspectionConfirmed(false); }}
                            >
                                ยกเลิก
                            </button>
                            <button 
                                type="button"
                                className="btn btn-primary"
                                disabled={
                                    actionLoading || 
                                    (activeActionModal === 'RETURN_REVISE' && !actionNote.trim()) ||
                                    (activeActionModal === 'WAITING_PARTS' && !actionNote.trim()) ||
                                    (activeActionModal === 'COMPLETE' && !inspectionConfirmed) ||
                                    (activeActionModal === 'SUBMIT_INSPECTION' && (!submitData.problem_summary.trim() || !submitData.solution_method.trim()))
                                }
                                onClick={() => {
                                    if (activeActionModal === 'SUBMIT_INSPECTION') {
                                        handleWorkflowAction('SUBMIT_INSPECTION', submitData);
                                    } else {
                                        handleWorkflowAction(activeActionModal, actionNote);
                                    }
                                }}
                                style={{
                                    minWidth: '140px',
                                    fontWeight: 600,
                                    backgroundColor: activeActionModal === 'COMPLETE' ? '#16a34a' : undefined,
                                    borderColor: activeActionModal === 'COMPLETE' ? '#16a34a' : undefined,
                                    cursor: (activeActionModal === 'COMPLETE' && !inspectionConfirmed) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {actionLoading ? 'กำลังบันทึก...' : 'ยืนยันการทำรายการ'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
