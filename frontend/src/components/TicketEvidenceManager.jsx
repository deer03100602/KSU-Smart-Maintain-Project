import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    Camera, Image as ImageIcon, Plus, Upload, X, Maximize2, 
    FileText, Calendar, User, Check 
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

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
    const [selectedTab, setSelectedTab] = useState('ALL'); // 'ALL' | 'BEFORE' | 'DURING' | 'AFTER' | 'RECEIPT'
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [stage, setStage] = useState('BEFORE');
    const [description, setDescription] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [selectedPreview, setSelectedPreview] = useState(null);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && showUploadModal) {
                closeModal();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showUploadModal]);

    const closeModal = () => {
        setShowUploadModal(false);
        setSelectedFile(null);
        if (previewUrl) {
            try { URL.revokeObjectURL(previewUrl); } catch (e) {}
        }
        setPreviewUrl(null);
        setDescription('');
    };

    const filteredEvidences = selectedTab === 'ALL' 
        ? evidences 
        : evidences.filter(e => e.stage === selectedTab);

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
            const eviRes = await fetch(`/api/tickets/${ticket.id}/evidence`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    stage,
                    url: fileUrl,
                    name: fileName,
                    description: description.trim()
                })
            });

            if (eviRes.ok) {
                closeModal();
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
        switch (st) {
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
                        onClick={() => setShowUploadModal(true)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                        <Plus style={{ width: 15, height: 15 }} /> อัปโหลดรูปภาพหลักฐาน
                    </button>
                )}
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {[
                    { key: 'ALL', label: 'ทั้งหมด' },
                    { key: 'BEFORE', label: '📷 ก่อนซ่อม' },
                    { key: 'DURING', label: '⚙️ ระหว่างซ่อม' },
                    { key: 'PARTS', label: '📦 วัสดุ/อะไหล่' },
                    { key: 'RECEIPT', label: '🧾 ใบเสร็จ' },
                    { key: 'AFTER', label: '🎉 หลังซ่อม' },
                    { key: 'TESTING', label: '🔬 ผลทดสอบ' },
                    { key: 'HANDOVER', label: '📋 ส่งมอบงาน' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setSelectedTab(tab.key)}
                        className={`btn btn-sm ${selectedTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ fontSize: '0.8rem' }}
                    >
                        {tab.label}
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
                        const isImg = evi.url && (evi.url.endsWith('.png') || evi.url.endsWith('.jpg') || evi.url.endsWith('.jpeg') || evi.url.endsWith('.webp'));
                        return (
                            <div 
                                key={evi.id}
                                style={{
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '10px',
                                    overflow: 'hidden',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                <div 
                                    style={{
                                        height: '140px',
                                        background: 'rgba(0,0,0,0.4)',
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: isImg ? 'pointer' : 'default'
                                    }}
                                    onClick={() => isImg && setSelectedPreview(evi.url)}
                                >
                                    {isImg ? (
                                        <img 
                                            src={evi.url} 
                                            alt={evi.description || 'evidence'} 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <FileText style={{ width: 42, height: 42, color: '#60a5fa' }} />
                                    )}
                                    <div style={{ position: 'absolute', top: 6, left: 6 }}>
                                        {getStageBadge(evi.stage)}
                                    </div>
                                    {isImg && (
                                        <div style={{
                                            position: 'absolute', bottom: 6, right: 6,
                                            background: 'rgba(0,0,0,0.65)', padding: '3px 6px',
                                            borderRadius: 4, color: '#fff', fontSize: '0.65rem',
                                            display: 'flex', alignItems: 'center', gap: 4
                                        }}>
                                            <Maximize2 style={{ width: 10, height: 10 }} /> ดูรูป
                                        </div>
                                    )}
                                </div>
                                <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div style={{ fontSize: '0.825rem', fontWeight: 500, marginBottom: '6px' }}>
                                        {evi.description || evi.name || 'หลักฐานงานซ่อม'}
                                    </div>
                                    <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                                        <div>บันทึกโดย: {evi.created_by}</div>
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

                                {previewUrl && (
                                    <div style={{
                                        marginTop: '0.25rem',
                                        padding: '0.75rem',
                                        background: 'var(--bg-card, rgba(0,0,0,0.04))',
                                        border: '1px solid var(--border-card, rgba(0,0,0,0.08))',
                                        borderRadius: '8px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                            ตัวอย่างรูปภาพที่เลือก:
                                        </div>
                                        <img 
                                            src={previewUrl} 
                                            alt="Preview" 
                                            style={{ maxHeight: '180px', maxWidth: '100%', borderRadius: 6, objectFit: 'contain', margin: '0 auto' }} 
                                        />
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

            {/* Image Preview Modal */}
            {selectedPreview && typeof document !== 'undefined' && createPortal(
                <div 
                    onClick={() => setSelectedPreview(null)}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 999999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '2rem'
                    }}
                >
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                        <img 
                            src={selectedPreview} 
                            alt="preview" 
                            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8, objectFit: 'contain' }}
                        />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
