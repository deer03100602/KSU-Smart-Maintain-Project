// ============================================================
// page.js — Create Ticket Page
// Route: /create
// ============================================================

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { PlusCircle, Info, User, Send, Loader, UploadCloud, FileText, X, Image as ImageIcon, Eye, ExternalLink, Download } from 'lucide-react';

const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const checkIsImage = (file) => {
    if (!file) return false;
    if (file.type && file.type.startsWith('image/')) return true;
    const name = file.name || file.url || '';
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(name);
};

export default function CreateTicketPage() {
    const router = useRouter();
    const { user, setUser, toast, confirm } = useApp();
    const [issueTypes, setIssueTypes] = useState([]);

    // File upload ref and state
    const fileInputRef = useRef(null);
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [previewFile, setPreviewFile] = useState(null);

    useEffect(() => {
        async function fetchIssueTypes() {
            try {
                const res = await fetch('/api/issue-types');
                if (res.ok) {
                    const data = await res.json();
                    setIssueTypes(data);
                }
            } catch (e) {
                console.error('Error fetching issue types:', e);
            }
        }
        fetchIssueTypes();
    }, []);
    
    // Form States with Image 2 defaults
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [issueType, setIssueType] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [location, setLocation] = useState('');
    const [requesterName, setRequesterName] = useState(user.name || 'นักศึกษา ทดสอบ');
    const [requesterEmail, setRequesterEmail] = useState(user.email || 'student@example.com');
    const [requesterGroup, setRequesterGroup] = useState(user.group || 'นักศึกษา');
    const [submitting, setSubmitting] = useState(false);

    // Sync state if simulated user profile loads later
    useEffect(() => {
        if (user.name) setRequesterName(user.name);
        if (user.email) setRequesterEmail(user.email);
        if (user.group) setRequesterGroup(user.group);
    }, [user]);

    // Handle File Dropzone & Selection
    const handleFiles = async (files) => {
        if (!files || files.length === 0) return;

        setUploading(true);
        const newAttachments = [...attachments];

        for (const file of Array.from(files)) {
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`ไฟล์ ${file.name} มีขนาดเกิน 10MB`);
                continue;
            }

            // Create local object URL for immediate client-side preview
            const localPreviewUrl = file.type?.startsWith('image/') ? URL.createObjectURL(file) : null;

            try {
                const formData = new FormData();
                formData.append('file', file);

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (res.ok) {
                    const data = await res.json();
                    newAttachments.push({
                        name: file.name,
                        size: file.size,
                        url: data.url,
                        localUrl: localPreviewUrl,
                        type: file.type
                    });
                } else {
                    toast.error(`อัปโหลด ${file.name} ไม่สำเร็จ`);
                }
            } catch (err) {
                console.error('Upload error:', err);
                toast.error(`เกิดข้อผิดพลาดในการอัปโหลด ${file.name}`);
            }
        }

        setAttachments(newAttachments);
        setUploading(false);
    };

    const handleFileChange = (e) => {
        handleFiles(e.target.files);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const removeAttachment = (index) => {
        const removed = attachments[index];
        if (removed?.localUrl) {
            try { URL.revokeObjectURL(removed.localUrl); } catch (e) {}
        }
        if (previewFile && (previewFile.name === removed?.name || previewFile.url === removed?.url)) {
            setPreviewFile(null);
        }
        setAttachments(attachments.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!title.trim() || !description.trim() || !issueType || !location.trim() || !requesterName.trim()) {
            toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
            return;
        }

        setSubmitting(true);

        try {
            let finalDescription = description.trim();
            if (attachments.length > 0) {
                finalDescription += '\n\n**ไฟล์แนบ:**\n' + attachments.map(a => `- [${a.name}](${a.url})`).join('\n');
            }

            const res = await fetch('/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    description: finalDescription,
                    issue_type: issueType,
                    priority,
                    location: location.trim(),
                    requester_name: requesterName.trim(),
                    requester_email: requesterEmail.trim(),
                    requester_group: requesterGroup
                })
            });

            if (res.ok) {
                const ticket = await res.json();
                
                // Save user profile state for next time
                setUser(requesterName.trim(), requesterEmail.trim(), requesterGroup);

                // Reset form
                setTitle('');
                setDescription('');
                setIssueType('');
                setPriority('Medium');
                setLocation('');
                setAttachments([]);

                // Display beautiful custom declarative Modal
                confirm(
                    '✅ แจ้งปัญหาสำเร็จ!',
                    '',
                    () => router.push(`/tickets/${ticket.id}`),
                    {
                        confirmText: 'ดูรายละเอียด Ticket',
                        cancelText: 'แจ้งปัญหาเพิ่มเติม',
                        onCancel: () => {},
                        content: (
                            <div className="success-ticket-info">
                                <div className="ticket-id-display">
                                    <span className="label">Ticket ID</span>
                                    <span className="value">{ticket.ticket_no}</span>
                                </div>
                                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                                    ปัญหาของคุณถูกบันทึกเข้าระบบเรียบร้อยแล้ว<br />
                                    คุณสามารถใช้เลข Ticket ID นี้ในการติดตามสถานะการดำเนินงานได้
                                </p>
                            </div>
                        )
                    }
                );
            } else {
                const err = await res.json();
                toast.error(`เกิดข้อผิดพลาด: ${err.error || 'ไม่สามารถสร้างตั๋วได้'}`);
            }
        } catch (err) {
            console.error('Error submitting ticket:', err);
            toast.error('ไม่สามารถส่งคำขอได้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ maxWidth: 740, margin: '0 auto', padding: '1.5rem 1rem 3rem 1rem' }} className="fade-in">
            {/* Page Header */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0 0 0.4rem 0' }}>
                    <PlusCircle style={{ width: 26, height: 26, color: 'var(--text-primary)' }} />
                    แจ้งปัญหาใหม่
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                    กรอกรายละเอียดปัญหาเพื่อสร้าง Ticket ใหม่ในระบบ
                </p>
            </div>

            {/* Form Card */}
            <form 
                onSubmit={handleSubmit}
                className="ticket-form-card"
            >
                {/* Section 1: ข้อมูลปัญหา */}
                <div style={{ marginBottom: '1.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 600 }}>
                        <Info style={{ width: 18, height: 18, color: '#818cf8' }} />
                        <span>ข้อมูลปัญหา</span>
                    </div>

                    {/* หัวข้อปัญหา */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                            หัวข้อปัญหา <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input 
                            type="text" 
                            className="form-input" 
                            placeholder="เช่น คอมพิวเตอร์ห้อง Lab 301 เปิดไม่ติด" 
                            required 
                            maxLength={200}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            style={{
                                width: '100%',
                                borderRadius: 8,
                                padding: '0.75rem 1rem',
                                fontSize: '0.95rem',
                                outline: 'none'
                            }}
                        />
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                            อธิบายย่อสรุปสั้นๆ ชัดเจน
                        </span>
                    </div>

                    {/* รายละเอียดปัญหา */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                            รายละเอียดปัญหา <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea 
                            className="form-input form-textarea" 
                            placeholder="อธิบายรายละเอียดปัญหา อาคาร หรือข้อความแสดงข้อผิดพลาด..." 
                            required 
                            rows={4}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            style={{
                                width: '100%',
                                borderRadius: 8,
                                padding: '0.75rem 1rem',
                                fontSize: '0.95rem',
                                outline: 'none',
                                resize: 'vertical',
                                minHeight: 100
                            }}
                        />
                    </div>

                    {/* ไฟล์แนบ (ตัวเลือกเสริม) */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                            ไฟล์แนบ (ตัวเลือกเสริม)
                        </label>
                        
                        <div 
                            className="ticket-dropzone"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {/* Upload icon box */}
                            <div className="ticket-dropzone-icon" style={{
                                width: 46,
                                height: 46,
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <UploadCloud style={{ width: 22, height: 22, color: '#818cf8' }} />
                            </div>

                            {/* Dropzone text and badge chips */}
                            <div style={{ flex: 1 }}>
                                <div className="ticket-dropzone-text" style={{ fontSize: '0.9rem', marginBottom: '0.45rem' }}>
                                    ลากและวางไฟล์ที่นี่ หรือ <span style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'underline' }}>คลิกเพื่อเลือก</span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                                    <span className="ticket-badge-pill" style={{ fontSize: '0.72rem', borderRadius: 9999, padding: '2px 9px' }}>รูปภาพ</span>
                                    <span className="ticket-badge-pill" style={{ fontSize: '0.72rem', borderRadius: 9999, padding: '2px 9px' }}>PDF</span>
                                    <span className="ticket-badge-pill" style={{ fontSize: '0.72rem', borderRadius: 9999, padding: '2px 9px' }}>เอกสาร</span>
                                    <span style={{ fontSize: '0.72rem', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 9999, padding: '2px 9px', fontWeight: 600 }}>สูงสุด 10MB</span>
                                </div>
                            </div>

                            <input 
                                ref={fileInputRef}
                                type="file" 
                                multiple 
                                style={{ display: 'none' }} 
                                onChange={handleFileChange}
                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                            />
                        </div>

                        {/* Uploading indicator */}
                        {uploading && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.6rem', color: '#818cf8', fontSize: '0.85rem' }}>
                                <Loader style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                                <span>กำลังอัปโหลดไฟล์...</span>
                            </div>
                        )}

                        {/* Attachments List */}
                        {attachments.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginTop: '0.85rem' }}>
                                {attachments.map((att, idx) => {
                                    const isImg = checkIsImage(att);
                                    const viewUrl = att.url || att.localUrl;
                                    return (
                                        <div 
                                            key={idx} 
                                            className="ticket-attachment-chip"
                                            onClick={() => setPreviewFile({ ...att, isImage: isImg, viewUrl })}
                                            title="คลิกเพื่อเปิดดูรูป/ไฟล์นี้"
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                borderRadius: 10,
                                                padding: '6px 12px',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                transition: 'all 0.2s ease',
                                                boxShadow: '0 2px 5px rgba(0,0,0,0.06)'
                                            }}
                                        >
                                            {isImg ? (
                                                <div style={{ width: 26, height: 26, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {viewUrl ? (
                                                        <img 
                                                            src={viewUrl} 
                                                            alt={att.name}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <ImageIcon style={{ width: 15, height: 15, color: '#818cf8' }} />
                                                    )}
                                                </div>
                                            ) : (
                                                <FileText style={{ width: 16, height: 16, color: '#818cf8', flexShrink: 0 }} />
                                            )}

                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                <span style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                                    {att.name}
                                                </span>
                                                {att.size ? (
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                        {formatFileSize(att.size)}
                                                    </span>
                                                ) : null}
                                            </div>

                                            <div 
                                                title="ดูตัวอย่าง"
                                                style={{ display: 'flex', alignItems: 'center', color: '#818cf8', padding: '2px 4px', borderRadius: 4, marginLeft: 2 }}
                                            >
                                                <Eye style={{ width: 14, height: 14 }} />
                                            </div>

                                            <button 
                                                type="button" 
                                                title="ลบไฟล์นี้"
                                                onClick={(e) => { e.stopPropagation(); removeAttachment(idx); }}
                                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', borderRadius: 4, transition: 'color 0.15s, background 0.15s' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'none'; }}
                                            >
                                                <X style={{ width: 14, height: 14 }} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Two Column: ประเภทปัญหา & ระดับความเร่งด่วน */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                                ประเภทปัญหา <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <select 
                                className="form-input form-select" 
                                required
                                value={issueType}
                                onChange={(e) => setIssueType(e.target.value)}
                                style={{
                                    width: '100%',
                                    borderRadius: 8,
                                    padding: '0.75rem 1rem',
                                    fontSize: '0.95rem',
                                    outline: 'none'
                                }}
                            >
                                <option value="">-- เลือกประเภท --</option>
                                {issueTypes.map(t => (
                                    <option key={t.id} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                                ระดับความเร่งด่วน <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <select 
                                className="form-input form-select" 
                                required
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                style={{
                                    width: '100%',
                                    borderRadius: 8,
                                    padding: '0.75rem 1rem',
                                    fontSize: '0.95rem',
                                    outline: 'none'
                                }}
                            >
                                <option value="Low">Low — ไม่เร่งด่วน</option>
                                <option value="Medium">Medium — ทั่วไป</option>
                                <option value="High">High — ส่งผลต่อการทำงาน</option>
                                <option value="Urgent">Urgent — ต้องแก้ไขโดยด่วนที่สุด</option>
                            </select>
                        </div>
                    </div>

                    {/* สถานที่เกิดเหตุ */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                            สถานที่เกิดเหตุ <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input 
                            type="text" 
                            className="form-input" 
                            placeholder="เช่น ห้อง Lab 301 ชั้น 3 อาคาร IT" 
                            required
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            style={{
                                width: '100%',
                                borderRadius: 8,
                                padding: '0.75rem 1rem',
                                fontSize: '0.95rem',
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>

                {/* Section 2: ข้อมูลผู้แจ้ง */}
                <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 600 }}>
                        <User style={{ width: 18, height: 18, color: '#818cf8' }} />
                        <span>ข้อมูลผู้แจ้ง</span>
                    </div>

                    {/* Two Column: ชื่อผู้แจ้ง & อีเมลติดต่อ */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                                ชื่อผู้แจ้ง <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="ชื่อ-นามสกุล" 
                                required 
                                value={requesterName}
                                onChange={(e) => setRequesterName(e.target.value)}
                                style={{
                                    width: '100%',
                                    borderRadius: 8,
                                    padding: '0.75rem 1rem',
                                    fontSize: '0.95rem',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                                อีเมลติดต่อ
                            </label>
                            <input 
                                type="email" 
                                className="form-input" 
                                placeholder="email@example.com"
                                value={requesterEmail}
                                onChange={(e) => setRequesterEmail(e.target.value)}
                                style={{
                                    width: '100%',
                                    borderRadius: 8,
                                    padding: '0.75rem 1rem',
                                    fontSize: '0.95rem',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    {/* กลุ่มผู้ใช้งาน */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                            กลุ่มผู้ใช้งาน <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select 
                            className="form-input form-select" 
                            required
                            value={requesterGroup}
                            onChange={(e) => setRequesterGroup(e.target.value)}
                            style={{
                                width: '100%',
                                borderRadius: 8,
                                padding: '0.75rem 1rem',
                                fontSize: '0.95rem',
                                outline: 'none'
                            }}
                        >
                            <option value="นักศึกษา">นักศึกษา</option>
                            <option value="อาจารย์">อาจารย์</option>
                            <option value="เจ้าหน้าที่">เจ้าหน้าที่</option>
                            <option value="ผู้ดูแลระบบ">ผู้ดูแลระบบ</option>
                            <option value="เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์">เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์</option>
                        </select>
                    </div>
                </div>

                {/* Bottom Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                    <button 
                        type="button" 
                        onClick={() => router.push('/')}
                        disabled={submitting}
                        className="ticket-btn-cancel"
                        style={{
                            borderRadius: 8,
                            padding: '0.65rem 1.5rem',
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        ยกเลิก
                    </button>
                    <button 
                        type="submit" 
                        disabled={submitting}
                        style={{
                            backgroundColor: '#5b68f5',
                            border: 'none',
                            color: '#ffffff',
                            borderRadius: 8,
                            padding: '0.65rem 1.6rem',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            opacity: submitting ? 0.7 : 1,
                            boxShadow: '0 4px 14px rgba(91, 104, 245, 0.35)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = '#4c58e0'; }}
                        onMouseLeave={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = '#5b68f5'; }}
                    >
                        <Send style={{ width: 16, height: 16 }} />
                        {submitting ? 'กำลังส่งข้อมูล...' : 'ส่งแจ้งปัญหา'}
                    </button>
                </div>

            </form>

            {/* File & Image Preview Lightbox Modal */}
            {previewFile && (
                <div 
                    onClick={() => setPreviewFile(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.82)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1.5rem'
                    }}
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'relative',
                            maxWidth: '92vw',
                            maxHeight: '90vh',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-card)',
                            borderRadius: 16,
                            overflow: 'hidden',
                            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.85rem 1.25rem',
                            borderBottom: '1px solid var(--border-card)',
                            background: 'rgba(0, 0, 0, 0.15)',
                            gap: '1rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                                {previewFile.isImage ? (
                                    <ImageIcon style={{ width: 18, height: 18, color: '#818cf8', flexShrink: 0 }} />
                                ) : (
                                    <FileText style={{ width: 18, height: 18, color: '#818cf8', flexShrink: 0 }} />
                                )}
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', maxWidth: '50vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {previewFile.name}
                                    </div>
                                    {previewFile.size ? (
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            {formatFileSize(previewFile.size)}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                {previewFile.viewUrl && (
                                    <a
                                        href={previewFile.viewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-ghost btn-sm"
                                        title="เปิดดูในแท็บใหม่"
                                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                                    >
                                        <ExternalLink style={{ width: 14, height: 14 }} />
                                        <span>เปิดเต็มจอ</span>
                                    </a>
                                )}
                                {previewFile.viewUrl && (
                                    <a
                                        href={previewFile.viewUrl}
                                        download={previewFile.name}
                                        className="btn btn-ghost btn-sm"
                                        title="ดาวน์โหลดไฟล์"
                                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                                    >
                                        <Download style={{ width: 14, height: 14 }} />
                                        <span>ดาวน์โหลด</span>
                                    </a>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setPreviewFile(null)}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        color: '#ef4444',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: 8,
                                        width: 32,
                                        height: 32,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    title="ปิด"
                                >
                                    <X style={{ width: 16, height: 16 }} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div style={{
                            padding: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'auto',
                            maxHeight: 'calc(85vh - 70px)',
                            background: previewFile.isImage ? 'rgba(0, 0, 0, 0.3)' : 'transparent'
                        }}>
                            {previewFile.isImage ? (
                                <img 
                                    src={previewFile.viewUrl} 
                                    alt={previewFile.name}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: 'calc(80vh - 80px)',
                                        objectFit: 'contain',
                                        borderRadius: 8,
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.35)'
                                    }}
                                />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
                                    <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                                        <FileText style={{ width: 32, height: 32 }} />
                                    </div>
                                    <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                                        {previewFile.name}
                                    </h4>
                                    <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: 360, margin: '0 auto 1.5rem' }}>
                                        {previewFile.name.endsWith('.pdf') ? 'เอกสาร PDF' : 'ไฟล์เอกสารแนบ'} พร้อมเปิดดูหรือดาวน์โหลด
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                        {previewFile.viewUrl && (
                                            <a 
                                                href={previewFile.viewUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="btn btn-primary"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                                            >
                                                <ExternalLink style={{ width: 16, height: 16 }} />
                                                เปิดดูไฟล์ในแท็บใหม่
                                            </a>
                                        )}
                                        {previewFile.viewUrl && (
                                            <a 
                                                href={previewFile.viewUrl} 
                                                download={previewFile.name}
                                                className="btn btn-ghost"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                                            >
                                                <Download style={{ width: 16, height: 16 }} />
                                                ดาวน์โหลดไฟล์
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
