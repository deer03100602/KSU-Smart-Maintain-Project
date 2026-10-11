// ============================================================
// page.js — Admin Settings Page for Notifications & Email Setup
// Route: /admin/settings or /settings
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { useApp } from '@/context/AppContext';
import { 
    Settings, ArrowLeft, Save, Bell, Mail, Send, Loader, AlertCircle, Info,
    UserCheck, UserPlus, Trash2, X, CheckCircle, ShieldCheck, Key
} from 'lucide-react';

export default function AdminSettingsPage() {
    const navigate = useNavigate();
    const router = { push: (url) => navigate(url), replace: (url) => navigate(url, { replace: true }), back: () => navigate(-1), refresh: () => window.location.reload() };
    const { role, toast } = useApp();

    // Notification Email Recipients
    const [notifyEmails, setNotifyEmails] = useState('nightggpp@gmail.com');

    // SMTP / Gmail Settings
    const [smtpEnabled, setSmtpEnabled] = useState(true);
    const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
    const [smtpPort, setSmtpPort] = useState(465);
    const [smtpSecure, setSmtpSecure] = useState(true);
    const [smtpUser, setSmtpUser] = useState('');
    const [smtpPass, setSmtpPass] = useState('');
    const [senderName, setSenderName] = useState('KSU Smart Maintain (แจ้งซ่อม)');

    // Discord & EmailJS (Alternative)
    const [discordUrl, setDiscordUrl] = useState('');
    const [serviceId, setServiceId] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [publicKey, setPublicKey] = useState('');
    const [privateKey, setPrivateKey] = useState('');

    // Technicians
    const [technicians, setTechnicians] = useState([]);
    const [newTechName, setNewTechName] = useState('');

    // Testing & UI States
    const [testEmailTarget, setTestEmailTarget] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    // Role Guard
    useEffect(() => {
        if (role !== 'admin') {
            toast.warning('คุณไม่มีสิทธิ์เข้าถึงหน้าตั้งค่าสำหรับแอดมิน');
            router.push('/');
        }
    }, [role]);

    // Fetch settings
    useEffect(() => {
        async function fetchSettings() {
            try {
                const res = await fetch('/api/settings');
                if (res.ok) {
                    const data = await res.json();
                    setNotifyEmails(data.notify_emails || 'nightggpp@gmail.com');
                    setSmtpEnabled(data.smtp_enabled !== false);
                    setSmtpHost(data.smtp_host || 'smtp.gmail.com');
                    setSmtpPort(data.smtp_port || 465);
                    setSmtpSecure(data.smtp_secure !== false);
                    setSmtpUser(data.smtp_user || '');
                    setSmtpPass(data.smtp_pass || '');
                    setSenderName(data.sender_name || 'KSU Smart Maintain (แจ้งซ่อม)');
                    
                    setDiscordUrl(data.discord_webhook_url || '');
                    setServiceId(data.emailjs_service_id || '');
                    setTemplateId(data.emailjs_template_id || '');
                    setPublicKey(data.emailjs_public_key || '');
                    setPrivateKey(data.emailjs_private_key || '');
                    setTechnicians(Array.isArray(data.technicians) ? data.technicians : []);
                    setTestEmailTarget(data.notify_emails ? data.notify_emails.split(',')[0].trim() : 'nightggpp@gmail.com');
                }
            } catch (e) {
                console.error(e);
                toast.error('ไม่สามารถโหลดการตั้งค่าได้');
            } finally {
                setLoading(false);
            }
        }
        if (role === 'admin') {
            fetchSettings();
        }
    }, [role]);

    const handleAddTechnician = async (e) => {
        if (e) e.preventDefault();
        const clean = newTechName.trim();
        if (!clean) return;
        if (technicians.includes(clean)) {
            toast.warning('มีชื่อเจ้าหน้าที่นี้อยู่ในรายการแล้ว');
            return;
        }

        try {
            const res = await fetch('/api/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: clean })
            });
            if (res.ok) {
                const data = await res.json();
                setTechnicians(data.staff || [...technicians, clean]);
                setNewTechName('');
                toast.success(`เพิ่มเจ้าหน้าที่ "${clean}" เรียบร้อยแล้ว`);
            } else {
                setTechnicians(prev => [...prev, clean]);
                setNewTechName('');
                toast.success(`เพิ่มเจ้าหน้าที่ "${clean}" เรียบร้อยแล้ว`);
            }
        } catch (e) {
            setTechnicians(prev => [...prev, clean]);
            setNewTechName('');
            toast.success(`เพิ่มเจ้าหน้าที่ "${clean}" เรียบร้อยแล้ว`);
        }
    };

    const handleRemoveTechnician = async (nameToRemove) => {
        try {
            const res = await fetch(`/api/staff/${encodeURIComponent(nameToRemove)}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                const data = await res.json();
                setTechnicians(data.staff || technicians.filter(t => t !== nameToRemove));
                toast.success(`ลบเจ้าหน้าที่ "${nameToRemove}" แล้ว`);
            } else {
                setTechnicians(prev => prev.filter(t => t !== nameToRemove));
                toast.success(`ลบเจ้าหน้าที่ "${nameToRemove}" แล้ว`);
            }
        } catch (e) {
            setTechnicians(prev => prev.filter(t => t !== nameToRemove));
            toast.success(`ลบเจ้าหน้าที่ "${nameToRemove}" แล้ว`);
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    notify_emails: notifyEmails.trim(),
                    smtp_enabled: smtpEnabled,
                    smtp_host: smtpHost.trim(),
                    smtp_port: Number(smtpPort) || 465,
                    smtp_secure: smtpSecure,
                    smtp_user: smtpUser.trim(),
                    smtp_pass: smtpPass.trim(),
                    sender_name: senderName.trim(),
                    discord_webhook_url: discordUrl.trim(),
                    emailjs_service_id: serviceId.trim(),
                    emailjs_template_id: templateId.trim(),
                    emailjs_public_key: publicKey.trim(),
                    emailjs_private_key: privateKey.trim(),
                    technicians: technicians
                })
            });

            if (res.ok) {
                toast.success('บันทึกการตั้งค่าระบบและอีเมลสำเร็จเรียบร้อย');
            } else {
                toast.error('บันทึกการตั้งค่าล้มเหลว');
            }
        } catch (err) {
            console.error(err);
            toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setSaving(false);
        }
    };

    const handleTestNotification = async () => {
        const target = testEmailTarget.trim() || notifyEmails.split(',')[0].trim() || 'nightggpp@gmail.com';
        if (!target) {
            toast.error('กรุณาระบุอีเมลเป้าหมายที่จะส่งทดสอบ');
            return;
        }

        setTesting(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test_email: target })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(`ส่งข้อความแจ้งเตือนทดสอบไปยัง "${target}" สำเร็จแล้ว! กรุณาตรวจสอบในกล่องจดหมายของคุณ`);
            } else {
                toast.error(data.error || 'การส่งทดสอบล้มเหลว ตรวจสอบการตั้งค่าอีเมล SMTP/Gmail');
            }
        } catch (e) {
            console.error(e);
            toast.error('ไม่สามารถส่งคำขอทดสอบได้: ' + e.message);
        } finally {
            setTesting(false);
        }
    };

    if (role !== 'admin' || loading) {
        return (
            <div style={{ textAlign: 'center', padding: '5rem' }}>
                <p className="text-muted">กำลังโหลดข้อมูลตั้งค่าระบบ...</p>
            </div>
        );
    }

    return (
        <div className="page-settings fade-in" style={{ maxWidth: 850, margin: '0 auto', paddingBottom: '3rem' }}>
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div className="page-header-left">
                    <button className="btn btn-ghost btn-sm" onClick={() => router.back()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <ArrowLeft style={{ width: 16, height: 16 }} />
                        กลับหน้าแอดมิน
                    </button>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Settings style={{ width: 24, height: 24, color: 'var(--primary-color)' }} />
                        ตั้งค่าระบบแจ้งเตือนทางอีเมล (Email & Alert Settings)
                    </h1>
                    <p className="page-subtitle">กำหนดอีเมลผู้รับการแจ้งเตือนสำหรับเจ้าหน้าที่/แอดมิน และตั้งค่าเซิร์ฟเวอร์ส่งเมลเมื่อมีผู้ใช้งานส่งแจ้งปัญหาใหม่</p>
                </div>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* 1. Notification Recipients Section */}
                <div className="glass-card" style={{ padding: '2rem', borderLeft: '4px solid var(--primary-color)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 600 }}>
                        <Mail style={{ width: 20, height: 20, color: 'var(--primary-color)' }} />
                        อีเมลผู้รับการแจ้งเตือน (Admin & Staff Notification Emails)
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                        ระบุอีเมลของเจ้าหน้าที่และแอดมินที่ต้องการให้ระบบส่งข้อมูลปัญหาที่กรอกเด้งเข้าอีเมลโดยอัตโนมัติ
                    </p>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            รายชื่ออีเมลผู้รับแจ้งเตือน (คั่นด้วยเครื่องหมายจุลภาค , เมื่อมีหลายอีเมล)
                        </label>
                        <input 
                            type="text" 
                            className="form-input" 
                            placeholder="เช่น nightggpp@gmail.com, admin@ksu.ac.th, staff@gmail.com" 
                            value={notifyEmails}
                            onChange={(e) => setNotifyEmails(e.target.value)}
                            style={{ fontSize: '0.95rem' }}
                        />
                        <span className="form-hint" style={{ marginTop: 6, display: 'block' }}>
                            💡 เมื่อมีผู้ใช้งานกด "ส่งแจ้งปัญหา" ข้อมูลปัญหาทั้งหมด (หัวข้อ, รายละเอียด, ประเภท, ความเร่งด่วน, สถานที่, ชื่อและอีเมลผู้แจ้ง) จะถูกจัดรูปแบบและส่งตรงเข้าอีเมลเหล่านี้ทันที
                        </span>
                    </div>
                </div>

                {/* 2. SMTP / Gmail Sending Configuration */}
                <div className="glass-card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                                <Send style={{ width: 20, height: 20, color: '#22c55e' }} />
                                การส่งอีเมลผ่านเซิร์ฟเวอร์ SMTP / Gmail (แนะนำ)
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                                ใช้อีเมลของคุณ (เช่น Gmail บัญชีทางการ) ในการส่งข้อความแจ้งเตือนหาเจ้าหน้าที่และผู้แจ้ง
                            </p>
                        </div>
                        <span style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            background: smtpUser && smtpPass ? '#22c55e20' : '#eab30820',
                            color: smtpUser && smtpPass ? '#22c55e' : '#eab308',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                        }}>
                            {smtpUser && smtpPass ? '✓ พร้อมใช้งาน' : '⚠️ ยังไม่ได้ระบุรหัสผ่าน'}
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">อีเมลผู้ส่ง (SMTP User / Gmail)</label>
                            <input 
                                type="email" 
                                className="form-input" 
                                placeholder="เช่น your_email@gmail.com" 
                                value={smtpUser}
                                onChange={(e) => setSmtpUser(e.target.value)}
                            />
                            <span className="form-hint">อีเมลที่จะใช้เป็นผู้ส่งการแจ้งเตือน</span>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Key style={{ width: 14, height: 14 }} />
                                รหัสผ่านแอป Gmail (App Password 16 หลัก)
                            </label>
                            <input 
                                type="password" 
                                className="form-input" 
                                placeholder="เช่น abcd efgh ijkl mnop" 
                                value={smtpPass}
                                onChange={(e) => setSmtpPass(e.target.value)}
                            />
                            <span className="form-hint">รหัสผ่านสำหรับแอปพลิเคชัน 16 หลักจาก Google</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">ชื่อผู้ส่ง (Sender Name)</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="KSU Smart Maintain (แจ้งซ่อม)" 
                                value={senderName}
                                onChange={(e) => setSenderName(e.target.value)}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">SMTP Host</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="smtp.gmail.com" 
                                value={smtpHost}
                                onChange={(e) => setSmtpHost(e.target.value)}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">SMTP Port</label>
                            <input 
                                type="number" 
                                className="form-input" 
                                placeholder="465" 
                                value={smtpPort}
                                onChange={(e) => setSmtpPort(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* How to get Gmail App Password Guidance Box */}
                    <div style={{ 
                        padding: '1.25rem', 
                        background: 'rgba(37, 99, 235, 0.06)', 
                        border: '1px solid rgba(37, 99, 235, 0.2)',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        lineHeight: '1.5'
                    }}>
                        <div style={{ fontWeight: 700, color: 'var(--primary-color)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Info style={{ width: 16, height: 16 }} />
                            วิธีขอรหัสผ่านแอป Gmail (App Password 16 ตัว) ภายใน 1 นาที:
                        </div>
                        <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#cbd5e1' }}>
                            <li>เข้า Google Account ของคุณ (<a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>myaccount.google.com/security</a>) แล้วเปิด <strong>2-Step Verification (การยืนยันแบบ 2 ขั้นตอน)</strong></li>
                            <li>ค้นหาคำว่า <strong>"App passwords" (รหัสผ่านสำหรับแอป)</strong> ในช่องค้นหาด้านบนของบัญชี Google</li>
                            <li>ตั้งชื่อแอป เช่น <code>KSU Maintain</code> แล้วกดสร้าง จะได้รับรหัส 16 ตัวอักษร เช่น <code>abcd efgh ijkl mnop</code></li>
                            <li>นำรหัส 16 ตัวอักษรนี้มาวางในช่อง <strong>"รหัสผ่านแอป Gmail"</strong> ด้านบน แล้วกดบันทึก</li>
                        </ol>
                    </div>
                </div>

                {/* 3. Technicians Management section */}
                <div className="glass-card" style={{ padding: '2rem' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 600 }}>
                        <UserCheck style={{ width: 20, height: 20, color: 'var(--primary-color)' }} />
                        รายชื่อเจ้าหน้าที่ / ช่างผู้รับผิดชอบงานซ่อม
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                        กำหนดรายชื่อช่างหรือเจ้าหน้าที่ซ่อมบำรุงในระบบด้วยตนเอง โดยรายชื่อเหล่านี้จะปรากฏในตัวเลือกมอบหมายงาน (Assign) และรายงานสถิติภาระงานใน Dashboard
                    </p>

                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="ระบุชื่อ-นามสกุล หรือตำแหน่งช่าง เช่น ช่างสมคิด (ไฟฟ้า)..."
                            value={newTechName}
                            onChange={(e) => setNewTechName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddTechnician();
                                }
                            }}
                            style={{ flex: 1 }}
                        />
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleAddTechnician}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                        >
                            <UserPlus style={{ width: 16, height: 16 }} />
                            เพิ่มรายชื่อ
                        </button>
                    </div>

                    {technicians.length === 0 ? (
                        <div style={{
                            padding: '1.5rem',
                            textAlign: 'center',
                            borderRadius: '8px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px dashed var(--border-color)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.9rem'
                        }}>
                            ยังไม่มีการกำหนดรายชื่อช่างในระบบ สามารถพิมพ์ชื่อด้านบนแล้วกด "เพิ่มรายชื่อ" ได้ทันที
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                            {technicians.map((name) => (
                                <div
                                    key={name}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.4rem 0.85rem',
                                        background: 'rgba(59, 130, 246, 0.1)',
                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                        borderRadius: '20px',
                                        color: '#93c5fd',
                                        fontSize: '0.9rem',
                                        fontWeight: 500
                                    }}
                                >
                                    <span>{name}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTechnician(name)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#f87171',
                                            cursor: 'pointer',
                                            padding: 2,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            borderRadius: '50%'
                                        }}
                                        title={`ลบ ${name}`}
                                    >
                                        <X style={{ width: 14, height: 14 }} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 4. Alternative Options (Discord Webhook & EmailJS) */}
                <details className="glass-card" style={{ padding: '1.5rem 2rem' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
                        ⚙️ ช่องทางการแจ้งเตือนเสริม (Discord Webhook & EmailJS REST API)
                    </summary>

                    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Discord */}
                        <div>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
                                <Bell style={{ width: 16, height: 16, color: '#818cf8' }} />
                                Discord Webhook
                            </h4>
                            <input 
                                type="url" 
                                className="form-input" 
                                placeholder="https://discord.com/api/webhooks/..." 
                                value={discordUrl}
                                onChange={(e) => setDiscordUrl(e.target.value)}
                            />
                            <span className="form-hint">วาง URL Discord Webhook เพื่อแจ้งเตือนเข้าห้องแชต Discord</span>
                        </div>

                        {/* EmailJS */}
                        <div>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
                                <Mail style={{ width: 16, height: 16, color: '#f59e0b' }} />
                                EmailJS REST API (ทางเลือกสำรอง)
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '0.5rem' }}>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="Service ID (service_xxx)" 
                                    value={serviceId}
                                    onChange={(e) => setServiceId(e.target.value)}
                                />
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="Template ID (template_xxx)" 
                                    value={templateId}
                                    onChange={(e) => setTemplateId(e.target.value)}
                                />
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="Public Key" 
                                    value={publicKey}
                                    onChange={(e) => setPublicKey(e.target.value)}
                                />
                                <input 
                                    type="password" 
                                    className="form-input" 
                                    placeholder="Private Key" 
                                    value={privateKey}
                                    onChange={(e) => setPrivateKey(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </details>

                {/* 5. Test Alert & Action Buttons */}
                <div className="glass-card" style={{ padding: '1.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="ระบุอีเมลที่จะส่งทดสอบ..."
                            value={testEmailTarget}
                            onChange={(e) => setTestEmailTarget(e.target.value)}
                            style={{ maxWidth: '280px' }}
                        />
                        <button 
                            type="button" 
                            className="btn btn-ghost" 
                            onClick={handleTestNotification}
                            disabled={testing || saving}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                        >
                            {testing ? (
                                <>
                                    <Loader className="animate-spin" style={{ width: 16, height: 16 }} />
                                    กำลังส่งทดสอบ...
                                </>
                            ) : (
                                <>
                                    <Send style={{ width: 16, height: 16 }} />
                                    ส่งอีเมลทดสอบ (Test Alert)
                                </>
                            )}
                        </button>
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={saving}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.65rem 1.75rem', fontSize: '0.95rem' }}
                    >
                        {saving ? (
                            <>
                                <Loader className="animate-spin" style={{ width: 18, height: 18 }} />
                                กำลังบันทึกข้อมูล...
                            </>
                        ) : (
                            <>
                                <Save style={{ width: 18, height: 18 }} />
                                บันทึกการตั้งค่าทั้งหมด
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
