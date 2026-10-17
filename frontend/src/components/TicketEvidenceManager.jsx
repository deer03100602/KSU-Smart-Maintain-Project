import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    Camera, Image as ImageIcon, Plus, Upload, X, Maximize2, 
    FileText, Calendar, User, Check, Trash2, AlertTriangle 
} from 'lucide-react';
import { useApp } from '@/context/AppContext';


function isImgUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const clean = url.trim().toLowerCase();
    if (clean.startsWith('data:image/') || clean.startsWith('blob:')) return true;
    if (/\.(png|jpe?g|webp|gif|svg|avif|bmp)(\?.*)?$/i.test(clean)) return true;
    if (clean.includes('/uploads/') && !/\.(pdf|docx?|xlsx?|txt)$/i.test(clean)) return true;
    return false;
}

export function normalizeStage(st) {
    if (!st || typeof st !== 'string') return 'BEFORE';
    const s = st.trim().toUpperCase();
    if (s.includes('BEFORE') || s.includes('ก่อน')) return 'BEFORE';
    if (s.includes('DURING') || s.includes('ระหว่าง')) return 'DURING';
    if (s.includes('PART') || s.includes('MATERIAL') || s.includes('วัสดุ') || s.includes('อะไหล่')) return 'PARTS';
    if (s.includes('RECEIPT') || s.includes('EXPENSE') || s.includes('ใบเสร็จ')) return 'RECEIPT';
    if (s.includes('AFTER') || s.includes('หลัง')) return 'AFTER';
    if (s.includes('TEST') || s.includes('ทดสอบ')) return 'TESTING';
    if (s.includes('HANDOVER') || s.includes('INSPECT') || s.includes('ส่งมอบ') || s.includes('ตรวจรับ')) return 'HANDOVER';
    return s;
}

export default function TicketEvidenceManager({
    ticket,
    evidences = [],
    currentUser = {},
    isAdmin = false,
    onEvidenceAdded
}) {
    const appContext = useApp();
    const ctxGroupA = appContext?.isGroupA;
    const ctxGroupB = appContext?.isGroupB;
    const appUser = appContext?.user;
    const isStudentOrTeacher = ['นักศึกษา', 'อาจารย์'].includes(currentUser?.group || appUser?.group);
    const canManageEvidence = !ctxGroupA && !isStudentOrTeacher && (isAdmin || ctxGroupB);
    const [selectedTab, setSelectedTab] = useState('ALL'); // 'ALL' | 'BEFORE' | 'DURING' | 'PARTS' | 'RECEIPT' | 'AFTER' | 'TESTING' | 'HANDOVER'
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [stage, setStage] = useState('BEFORE');
    const [description, setDescription] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [selectedPreview, setSelectedPreview] = useState(null);
    const [autoSyncExpense, setAutoSyncExpense] = useState(true);
    const [deletingId, setDeletingId] = useState(null);

    // Compute dynamic category counts
    const counts = {
        ALL: evidences.length,
        BEFORE: 0,
        DURING: 0,
        PARTS: 0,
        RECEIPT: 0,
        AFTER: 0,
        TESTING: 0,
        HANDOVER: 0
    };
    evidences.forEach(e => {
        const norm = normalizeStage(e.stage);
        if (counts[norm] !== undefined) {
            counts[norm]++;
        }
    });

    const filteredEvidences = selectedTab === 'ALL' 
        ? evidences 
        : evidences.filter(e => normalizeStage(e.stage) === selectedTab);

    const handleDeleteEvidence = async (evidenceId) => {
        if (!window.confirm('คุณต้องการลบ / ยกเลิกรูปภาพหลักฐานนี้ใช่หรือไม่?')) return;
        setDeletingId(evidenceId);
        try {
            const token = localStorage.getItem('helpdesk_token');
            const targetId = ticket?.id || ticket?.ticket_no || '';
            const res = await fetch(`/api/tickets/${encodeURIComponent(targetId)}/evidence/${encodeURIComponent(evidenceId)}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            if (res.ok) {
                if (appContext?.toast?.success) appContext.toast.success('ลบรูปภาพหลักฐานเรียบร้อยแล้ว');
                if (stage) setSelectedTab(stage);
                if (onEvidenceAdded) onEvidenceAdded();
            } else {
                alert('ไม่สามารถลบรูปภาพได้ กรุณาลองใหม่อีกครั้ง');
            }
        } catch (err) {
            console.error('Delete evidence error:', err);
            alert('เกิดข้อผิดพลาดในการลบ: ' + err.message);
        } finally {
            setDeletingId(null);
        }
    };

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (showUploadModal) closeModal();
                if (selectedPreview) setSelectedPreview(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showUploadModal, selectedPreview]);

    const closeModal = () => {
        setShowUploadModal(false);
        setSelectedFile(null);
        if (previewUrl) {
            try { URL.revokeObjectURL(previewUrl); } catch (e) {}
        }
        setPreviewUrl(null);
        setDescription('');
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedFile(file);
        if (file.type && file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        } else {
            setPreviewUrl(null);
        }
    };

    const handleUploadSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!selectedFile) {
            alert('กรุณาเลือกไฟล์รูปภาพหรือเอกสาร');
            return;
        }

        setUploading(true);
        try {
            let fileUrl = null;
            let fileName = selectedFile.name;

            try {
                const formData = new FormData();
                formData.append('file', selectedFile);
                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (uploadRes.ok) {
                    const fileData = await uploadRes.json();
                    fileUrl = fileData.url;
                    fileName = fileData.name || fileName;
                }
            } catch (err) {
                console.warn('FormData upload error, falling back:', err.message);
            }

            if (!fileUrl) {
                // Client-side fallback: Read file as data URL
                fileUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(selectedFile);
                });
            }

            if (!fileUrl) {
                alert('ไม่สามารถอัปโหลดไฟล์รูปภาพได้');
                setUploading(false);
                return;
            }

            // Create Evidence Record
            const token = localStorage.getItem('helpdesk_token');
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

            const eviRes = await fetch(`/api/tickets/${ticket.id}/evidence`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                    'x-client-ticket': clientTicketHeader
                },
                body: JSON.stringify({
                    stage,
                    url: fileUrl,
                    name: fileName,
                    description: description.trim(),
                    client_ticket: ticket
                })
            });

            if (eviRes.ok) {
                // If uploading a receipt and autoSyncExpense is enabled, also create expense record
                if (stage === 'RECEIPT' && autoSyncExpense && selectedFile) {
                    try {
                        const ocrForm = new FormData();
                        ocrForm.append('receipt', selectedFile);
                        const ocrRes = await fetch('/api/ocr/scan-receipt', {
                            method: 'POST',
                            body: ocrForm
                        });
                        if (ocrRes.ok) {
                            const ocrData = await ocrRes.json();
                            if (ocrData.success && ocrData.data) {
                                const p = ocrData.data;
                                const itemDesc = p.description || p.primary_item?.name || description.trim() || 'วัสดุและอุปกรณ์ตามใบเสร็จ';
                                const itemQty = p.quantity || p.primary_item?.quantity || 1;
                                const itemPrice = p.unit_price || p.primary_item?.unit_price || (p.net_amount ? (p.net_amount / itemQty) : 0);

                                await fetch(`/api/tickets/${ticket.id}/expenses`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': token ? `Bearer ${token}` : ''
                                    },
                                    body: JSON.stringify({
                                        category: p.category || p.primary_item?.category || 'ค่าวัสดุและอุปกรณ์',
                                        description: itemDesc,
                                        quantity: itemQty,
                                        unit: p.unit || p.primary_item?.unit || 'ชิ้น',
                                        unit_price: itemPrice,
                                        discount: p.discount || 0,
                                        tax_percent: p.tax_amount > 0 ? 7 : 0,
                                        receipt_no: p.receipt_no || null,
                                        vendor_name: p.vendor_name || null,
                                        receipt_date: p.receipt_date || null,
                                        receipt_url: fileUrl
                                    })
                                });
                            }
                        }
                    } catch (eErr) {
                        console.warn('Auto sync expense from evidence receipt warning:', eErr);
                    }
                }

                closeModal();
                setSelectedTab(stage);
                if (appContext?.toast?.success) {
                    appContext.toast.success('✨ บันทึกรูปภาพหลักฐานเข้าสู่ระบบเรียบร้อยแล้ว!');
                }
                if (onEvidenceAdded) onEvidenceAdded();
            } else {
                alert('ไม่สามารถบันทึกข้อมูลหลักฐานได้');
            }
        } catch (err) {
            console.error('Evidence upload error:', err);
            alert('เกิดข้อผิดพลาดในการอัปโหลด: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const getStageBadge = (st) => {
        const norm = normalizeStage(st);
        switch (norm) {
            case 'BEFORE': return <span style={{ background: '#3b82f620', color: '#60a5fa', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>📷 ก่อนซ่อม</span>;
            case 'DURING': return <span style={{ background: '#f59e0b20', color: '#fbbf24', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>⚙️ ระหว่างซ่อม</span>;
            case 'PARTS': return <span style={{ background: '#06b6d420', color: '#22d3ee', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>📦 อุปกรณ์/วัสดุที่ใช้</span>;
            case 'RECEIPT': return <span style={{ background: '#a855f720', color: '#c084fc', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>🧾 ใบเสร็จ/ค่าใช้จ่าย</span>;
            case 'AFTER': return <span style={{ background: '#22c55e20', color: '#4ade80', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>🎉 หลังซ่อมเสร็จ</span>;
            case 'TESTING': return <span style={{ background: '#ec489920', color: '#f472b6', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>🔬 ผลทดสอบการใช้งาน</span>;
            case 'HANDOVER': return <span style={{ background: '#10b98120', color: '#34d399', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>📋 เอกสารส่งมอบ/ตรวจรับ</span>;
            default: return null;
        }
    };

    const STAGE_TABS = [
        { key: 'ALL', label: 'ทั้งหมด' },
        { key: 'BEFORE', label: '📷 ก่อนซ่อม' },
        { key: 'DURING', label: '⚙️ ระหว่างซ่อม' },
        { key: 'PARTS', label: '📦 วัสดุ/อะไหล่' },
        { key: 'RECEIPT', label: '🧾 ใบเสร็จ' },
        { key: 'AFTER', label: '🎉 หลังซ่อม' },
        { key: 'TESTING', label: '🔬 ผลทดสอบ' },
        { key: 'HANDOVER', label: '📋 ส่งมอบงาน' }
    ];

    return (
        <div className="glass-card" style={{ marginTop: 0, padding: '1.25rem', borderRadius: '12px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Camera style={{ width: 20, height: 20, color: '#3b82f6' }} />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>รูปภาพและหลักฐานงานซ่อม (Before / During / After / Evidence Gallery)</h3>
                </div>
                {canManageEvidence && (
                    <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                            if (selectedTab !== 'ALL') {
                                setStage(selectedTab);
                            } else {
                                setStage('BEFORE');
                            }
                            setShowUploadModal(true);
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                        <Plus style={{ width: 15, height: 15 }} /> อัปโหลดรูปภาพหลักฐาน
                    </button>
                )}
            </div>

            {/* Filter Tabs with Dynamic Item Counters */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {STAGE_TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setSelectedTab(tab.key)}
                        className={`btn btn-sm ${selectedTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ 
                            fontSize: '0.8rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <span>{tab.label}</span>
                        <span style={{
                            background: selectedTab === tab.key ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                            padding: '1px 6px',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 700
                        }}>
                            {counts[tab.key] || 0}
                        </span>
                    </button>
                ))}
            </div>

            {/* Gallery Grid */}
            {filteredEvidences.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    ยังไม่มีรูปภาพหลักฐานในหมวดหมู่นี้
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                    {filteredEvidences.map((evi) => {
                        const isImg = isImgUrl(evi.url);
                        return (
                            <div 
                                key={evi.id}
                                style={{
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    background: 'var(--bg-card, rgba(255, 255, 255, 0.03))',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    position: 'relative'
                                }}
                            >
                                <div 
                                    style={{
                                        height: '160px',
                                        background: '#0f172a',
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: isImg ? 'pointer' : 'default',
                                        overflow: 'hidden'
                                    }}
                                    onClick={() => isImg && setSelectedPreview(evi.url)}
                                >
                                    {isImg ? (
                                        <img 
                                            src={evi.url} 
                                            alt={evi.description || evi.name || 'หลักฐานงานซ่อม'} 
                                            loading="lazy"
                                            style={{ 
                                                width: '100%', 
                                                height: '100%', 
                                                objectFit: 'cover',
                                                transition: 'transform 0.25s ease'
                                            }}
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                    ) : null}
                                    <div style={{ display: isImg ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: '#60a5fa' }}>
                                        <FileText style={{ width: 44, height: 44 }} />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>เอกสารแนบ</span>
                                    </div>

                                    {/* Stage Badge on Top Left */}
                                    <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 4 }}>
                                        {getStageBadge(evi.stage)}
                                    </div>

                                    {/* Delete / Cancel button on Top Right */}
                                    {canManageEvidence && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteEvidence(evi.id);
                                            }}
                                            disabled={deletingId === evi.id}
                                            style={{
                                                position: 'absolute',
                                                top: 6,
                                                right: 6,
                                                background: 'rgba(239, 68, 68, 0.9)',
                                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                                borderRadius: '6px',
                                                padding: '3px 7px',
                                                color: '#fff',
                                                fontSize: '0.72rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                zIndex: 5,
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
                                            }}
                                            title="ลบ / ยกเลิกรูปภาพนี้ เผื่อส่งผิด"
                                        >
                                            <Trash2 style={{ width: 12, height: 12 }} />
                                            {deletingId === evi.id ? '...' : 'ยกเลิก/ลบ'}
                                        </button>
                                    )}

                                    {/* View Zoom Badge */}
                                    {isImg && (
                                        <div style={{
                                            position: 'absolute', bottom: 6, right: 6,
                                            background: 'rgba(0,0,0,0.75)', padding: '3px 8px',
                                            borderRadius: 6, color: '#fff', fontSize: '0.7rem',
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            zIndex: 4, backdropFilter: 'blur(4px)'
                                        }}>
                                            <Maximize2 style={{ width: 11, height: 11 }} /> ดูรูปชัดๆ
                                        </div>
                                    )}
                                </div>
                                <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--bg-secondary, rgba(0,0,0,0.2))' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                        {evi.description || evi.name || 'หลักฐานงานซ่อม'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>👤 {evi.created_by || 'เจ้าหน้าที่'}</div>
                                        <div>{new Date(evi.created_at).toLocaleDateString('th-TH')}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Upload Modal Window */}
            {showUploadModal && typeof document !== 'undefined' && createPortal(
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
                            closeModal();
                        }
                    }}
                >
                    <div 
                        className="modal-container" 
                        style={{ 
                            maxWidth: '540px', 
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Camera style={{ width: 22, height: 22, color: 'var(--primary-color, #4f46e5)' }} />
                                <h3 className="modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    อัปโหลดรูปภาพ / หลักฐานงานซ่อม
                                </h3>
                            </div>
                            <button 
                                type="button" 
                                className="modal-close-btn" 
                                onClick={closeModal}
                                title="ปิดหน้าต่าง"
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X style={{ width: 20, height: 20 }} />
                            </button>
                        </div>

                        <form id="evidence-upload-form" onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                            <div className="modal-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
                                <div>
                                    <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>ระยะของหลักฐาน (Stage) *</label>
                                    <select 
                                        className="form-input" 
                                        value={stage} 
                                        onChange={(e) => setStage(e.target.value)}
                                        style={{ width: '100%', fontSize: '0.9rem' }}
                                    >
                                        <option value="BEFORE">📷 ภาพก่อนดำเนินการซ่อม (Before)</option>
                                        <option value="DURING">⚙️ ภาพระหว่างดำเนินงาน (During)</option>
                                        <option value="PARTS">📦 อุปกรณ์และวัสดุที่ใช้ (Parts & Materials)</option>
                                        <option value="RECEIPT">🧾 ใบเสร็จ / เอกสารค่าใช้จ่าย (Receipt & Financials)</option>
                                        <option value="AFTER">🎉 ภาพหลังซ่อมเสร็จสิ้น (After)</option>
                                        <option value="TESTING">🔬 ผลการทดสอบระบบ/การใช้งาน (Testing Results)</option>
                                        <option value="HANDOVER">📋 เอกสารส่งมอบงาน / ตรวจรับ (Handover & Inspection)</option>
                                    </select>
                                </div>

                                {stage === 'RECEIPT' && (
                                    <div style={{
                                        background: 'rgba(59, 130, 246, 0.1)',
                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                        borderRadius: '8px',
                                        padding: '10px 14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}>
                                        <input 
                                            type="checkbox" 
                                            id="auto-create-expense-chk" 
                                            checked={autoSyncExpense} 
                                            onChange={(e) => setAutoSyncExpense(e.target.checked)}
                                            style={{ width: 18, height: 18, cursor: 'pointer' }}
                                        />
                                        <label htmlFor="auto-create-expense-chk" style={{ fontSize: '0.85rem', cursor: 'pointer', margin: 0, color: 'var(--text-primary)' }}>
                                            ✨ <strong>สแกนใบเสร็จและบันทึกขึ้นรายการอุปกรณ์อัตโนมัติ</strong> (ระบบจะอ่านชื่ออุปกรณ์ ยอดเงิน และบันทึกเข้าตารางค่าใช้จ่ายทันที)
                                        </label>
                                    </div>
                                )}

                                <div>
                                    <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>คำอธิบายรูปภาพ / รายละเอียด</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        placeholder="เช่น ภาพถ่ายหน้าจอดับ, ภาพหลังเปลี่ยนอะไหล่ใหม่"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        style={{ width: '100%', fontSize: '0.9rem' }}
                                    />
                                </div>

                                <div>
                                    <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>เลือกไฟล์รูปภาพ / เอกสาร *</label>
                                    <input 
                                        type="file" 
                                        accept="image/*, application/pdf"
                                        className="form-input" 
                                        onChange={handleFileChange}
                                        disabled={uploading}
                                        style={{ width: '100%', fontSize: '0.9rem' }}
                                    />
                                </div>

                                {selectedFile && (
                                    <div style={{
                                        marginTop: '0.25rem',
                                        padding: '0.75rem',
                                        background: 'rgba(0,0,0,0.25)',
                                        border: '1px solid var(--border-card, rgba(255,255,255,0.1))',
                                        borderRadius: '8px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: 600 }}>
                                                📁 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedFile(null);
                                                    if (previewUrl) {
                                                        try { URL.revokeObjectURL(previewUrl); } catch (e) {}
                                                    }
                                                    setPreviewUrl(null);
                                                }}
                                                className="btn btn-secondary btn-xs"
                                                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', fontWeight: 600, padding: '3px 10px', fontSize: '0.75rem' }}
                                                title="ยกเลิกไฟล์นี้ เผื่อเลือกไฟล์ผิด"
                                            >
                                                ❌ ยกเลิกรูปนี้ / เลือกใหม่
                                            </button>
                                        </div>
                                        {previewUrl && (
                                            <img 
                                                src={previewUrl} 
                                                alt="Preview" 
                                                style={{ maxHeight: '200px', maxWidth: '100%', borderRadius: 8, objectFit: 'contain', margin: '0 auto', border: '1px solid rgba(255,255,255,0.1)' }} 
                                            />
                                        )}
                                    </div>
                                )}

                                {uploading && (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--primary-color, #4f46e5)', textAlign: 'center', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                        กำลังอัปโหลดและบันทึกหลักฐาน...
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
                                    onClick={closeModal}
                                    disabled={uploading}
                                >
                                    ยกเลิก
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn btn-primary" 
                                    disabled={uploading || !selectedFile}
                                    style={{ minWidth: '140px', fontWeight: 600 }}
                                >
                                    {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดและบันทึก'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Image Preview Modal (Ultra-sharp fullscreen view) */}
            {selectedPreview && typeof document !== 'undefined' && createPortal(
                <div 
                    onClick={() => setSelectedPreview(null)}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        zIndex: 9999999,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '1.5rem'
                    }}
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            maxWidth: '90vw',
                            marginBottom: '10px',
                            color: '#fff'
                        }}
                    >
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>
                            🔍 ดูรูปภาพหลักฐานความละเอียดสูง
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <a 
                                href={selectedPreview} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="btn btn-secondary btn-sm"
                                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.75rem', textDecoration: 'none' }}
                            >
                                เปิดในแท็บใหม่
                            </a>
                            <button
                                type="button"
                                onClick={() => setSelectedPreview(null)}
                                className="btn btn-secondary btn-sm"
                                style={{ background: 'rgba(239, 68, 68, 0.8)', color: '#fff', fontSize: '0.75rem', border: 'none' }}
                            >
                                <X style={{ width: 14, height: 14 }} /> ปิด
                            </button>
                        </div>
                    </div>
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{ position: 'relative', maxWidth: '90vw', maxHeight: '82vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <img 
                            src={selectedPreview} 
                            alt="preview" 
                            style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 8, objectFit: 'contain', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }}
                        />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
