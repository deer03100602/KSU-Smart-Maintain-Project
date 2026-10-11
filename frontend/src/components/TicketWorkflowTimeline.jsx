import React, { useState } from 'react';
import { 
    Clock, CheckCircle, Play, Pause, RotateCcw, AlertTriangle, 
    CheckCircle2, User, FileText, ArrowRight, CornerDownRight 
} from 'lucide-react';

export default function TicketWorkflowTimeline({ 
    ticket, 
    timelines = [], 
    isAdmin = false, 
    currentUser = {},
    onActionCompleted 
}) {
    const [actionLoading, setActionLoading] = useState(false);
    const [actionNote, setActionNote] = useState('');
    const [activeActionModal, setActiveActionModal] = useState(null); // 'START' | 'WAITING_PARTS' | 'SUBMIT_INSPECTION' | 'RETURN_REVISE' | 'COMPLETE'

    const isAssignedToCurrent = ticket.assigned_to && (
        ticket.assigned_to === currentUser.name ||
        ticket.assigned_to === currentUser.email
    );

    const isRequester = ticket.requester_name && (
        ticket.requester_name.includes(currentUser.name) ||
        ticket.requester_email === currentUser.email
    );

    const handleWorkflowAction = async (action, note = '') => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('helpdesk_token');
            const res = await fetch(`/api/tickets/${ticket.id}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    action,
                    note: note || actionNote,
                    reason: note || actionNote
                })
            });

            const data = await res.json();
            if (res.ok) {
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

    const getActionIcon = (action) => {
        switch (action) {
            case 'ACCEPTED': return <User style={{ width: 14, height: 14, color: '#60a5fa' }} />;
            case 'STARTED': return <Play style={{ width: 14, height: 14, color: '#4ade80' }} />;
            case 'WAITING_PARTS': return <Pause style={{ width: 14, height: 14, color: '#fbbf24' }} />;
            case 'SUBMITTED_INSPECTION': return <FileText style={{ width: 14, height: 14, color: '#c084fc' }} />;
            case 'RETURNED_FOR_REVISE': return <RotateCcw style={{ width: 14, height: 14, color: '#f87171' }} />;
            case 'COMPLETED': return <CheckCircle2 style={{ width: 14, height: 14, color: '#22c55e' }} />;
            default: return <Clock style={{ width: 14, height: 14, color: '#94a3b8' }} />;
        }
    };

    return (
        <div className="glass-card" style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock style={{ width: 20, height: 20, color: '#3b82f6' }} />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>ขั้นตอนดำเนินงาน & ไทม์ไลน์ (Workflow Timeline)</h3>
                </div>
            </div>

            {/* Workflow Quick Action Buttons */}
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
                {ticket.status === 'Open' && (isAdmin || !ticket.assigned_to || isAssignedToCurrent) && (
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

                {/* 5. ส่งกลับแก้ไขงาน (สำหรับผู้แจ้งซ่อม หรือ Admin) */}
                {ticket.status !== 'Closed' && (isAdmin || isRequester) && (
                    <button 
                        className="btn btn-ghost btn-sm"
                        disabled={actionLoading}
                        onClick={() => setActiveActionModal('RETURN_REVISE')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}
                    >
                        <RotateCcw style={{ width: 14, height: 14 }} /> ส่งกลับแก้ไขงาน
                    </button>
                )}

                {/* 6. ยืนยันเสร็จสิ้นงาน (เฉพาะ Admin หรือ ผู้แจ้ง) */}
                {ticket.status !== 'Closed' && (isAdmin || isRequester) && (
                    <button 
                        className="btn btn-primary btn-sm"
                        disabled={actionLoading}
                        onClick={() => setActiveActionModal('COMPLETE')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', background: '#16a34a', borderColor: '#16a34a' }}
                    >
                        <CheckCircle2 style={{ width: 14, height: 14 }} /> ยืนยันตรวจรับเสร็จสิ้นสมบูรณ์
                    </button>
                )}
            </div>

            {/* Timeline Stream */}
            <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid rgba(255, 255, 255, 0.1)', marginLeft: '10px' }}>
                {timelines.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '8px 0' }}>
                        ยังไม่มีประวัติการดำเนินงาน บันทึกจะแสดงเมื่อมีการรับงาน เริ่มงาน หรือเปลี่ยนสถานะ
                    </div>
                ) : (
                    timelines.map((tml, idx) => (
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
                                border: '2px solid #3b82f6',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {getActionIcon(tml.action)}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                    {tml.title}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    {new Date(tml.created_at).toLocaleString('th-TH')}
                                </div>
                            </div>

                            {tml.description && (
                                <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '3px', whiteSpace: 'pre-wrap' }}>
                                    {tml.description}
                                </div>
                            )}

                            <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: '3px' }}>
                                ดำเนินการโดย: {tml.actor_name} {tml.actor_role ? `(${tml.actor_role})` : ''}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Workflow Action Modal */}
            {activeActionModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '1.5rem'
                }}>
                    <div style={{
                        background: 'var(--card-bg, #1e293b)',
                        border: '1px solid var(--border-color, #334155)',
                        borderRadius: '12px',
                        width: '100%', maxWidth: '480px',
                        padding: '1.5rem', color: 'var(--text-primary, #f8fafc)'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', fontWeight: 600 }}>
                            {activeActionModal === 'START' && '⚙️ เริ่มดำเนินงานซ่อม'}
                            {activeActionModal === 'WAITING_PARTS' && '⏳ บันทึกสถานะรออุปกรณ์ / งบประมาณ'}
                            {activeActionModal === 'SUBMIT_INSPECTION' && '📋 ส่งมอบงานเพื่อรอตรวจรับ'}
                            {activeActionModal === 'RETURN_REVISE' && '⚠️ ส่งกลับแก้ไขงานซ่อม'}
                            {activeActionModal === 'COMPLETE' && '🎉 ยืนยันตรวจรับและปิดงานเสร็จสิ้น'}
                        </h3>

                        <div style={{ marginBottom: '1rem' }}>
                            <label className="form-label" style={{ fontSize: '0.85rem' }}>
                                {activeActionModal === 'RETURN_REVISE' ? 'ระบุเหตุผลและจุดที่ต้องแก้ไข *' : 'บันทึกรายละเอียดเพิ่มเติม (ถ้ามี)'}
                            </label>
                            <textarea 
                                className="form-input" 
                                rows={3}
                                placeholder={
                                    activeActionModal === 'RETURN_REVISE' 
                                        ? 'ระบุสาเหตุ เช่น งานทาสียังไม่เรียบร้อย, อุปกรณ์ยังเปิดไม่ติด'
                                        : 'บันทึกผลการดำเนินงาน หรือข้อความแจ้งเตือน...'
                                }
                                value={actionNote}
                                onChange={(e) => setActionNote(e.target.value)}
                                style={{ width: '100%', fontSize: '0.85rem' }}
                            ></textarea>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button 
                                className="btn btn-ghost" 
                                onClick={() => { setActiveActionModal(null); setActionNote(''); }}
                            >
                                ยกเลิก
                            </button>
                            <button 
                                className="btn btn-primary"
                                disabled={actionLoading || (activeActionModal === 'RETURN_REVISE' && !actionNote.trim())}
                                onClick={() => handleWorkflowAction(activeActionModal, actionNote)}
                            >
                                {actionLoading ? 'กำลังบันทึก...' : 'ยืนยันการทำรายการ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
