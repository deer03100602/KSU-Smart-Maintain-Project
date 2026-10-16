import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    Clock, CheckCircle, Play, Pause, RotateCcw, AlertTriangle, 
    CheckCircle2, User, FileText, ArrowRight, CornerDownRight, X 
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

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

            const res = await fetch(`/api/tickets/${ticket.id}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(reqBody)
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
