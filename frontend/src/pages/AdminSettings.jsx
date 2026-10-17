// ============================================================
// page.js — Admin Settings Page for Notifications & Email Setup
// Route: /admin/settings or /settings
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { useApp } from '@/context/AppContext';
import { 
    Settings, ArrowLeft, Save, Bell, Mail, Send, Loader, AlertCircle, Info,
    UserCheck, UserPlus, Trash2, X, CheckCircle, ShieldCheck, Key,
    MessageSquare, Smartphone, Copy, ExternalLink, Eye, EyeOff, RefreshCw, Check, CheckCircle2
} from 'lucide-react';

export default function AdminSettingsPage() {
    const navigate = useNavigate();
    const router = { push: (url) => navigate(url), replace: (url) => navigate(url, { replace: true }), back: () => navigate(-1), refresh: () => window.location.reload() };
    const { role, toast } = useApp();

    // Notification Email Recipients
    const [notifyEmails, setNotifyEmails] = useState('ksu.smart.maintain@gmail.com');

    // SMTP / Gmail Settings
    const [smtpEnabled, setSmtpEnabled] = useState(true);
    const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
    const [smtpPort, setSmtpPort] = useState(465);
    const [smtpSecure, setSmtpSecure] = useState(true);
    const [smtpUser, setSmtpUser] = useState('');
    const [smtpPass, setSmtpPass] = useState('');
    const [senderName, setSenderName] = useState('KSU Smart Maintain (แจ้งซ่อม)');

    // LINE Messaging API Settings
    const [lineNotifyEnabled, setLineNotifyEnabled] = useState(true);
    const [lineChannelAccessToken, setLineChannelAccessToken] = useState('');
    const [lineChannelSecret, setLineChannelSecret] = useState('');
    const [lineTargetId, setLineTargetId] = useState('');
    const [appBaseUrl, setAppBaseUrl] = useState(typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');
    const [showToken, setShowToken] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [lineStatus, setLineStatus] = useState(null);
    const [lineContacts, setLineContacts] = useState([]);
    const [lineLogs, setLineLogs] = useState([]);
    const [testLineTarget, setTestLineTarget] = useState('');
    const [testLineMessage, setTestLineMessage] = useState('ทดสอบการเชื่อมต่อระบบแจ้งเตือน LINE Messaging API มหาวิทยาลัยกาฬสินธุ์');
    const [testingLine, setTestingLine] = useState(false);
    const [loadingLineLogs, setLoadingLineLogs] = useState(false);
    const [copiedWebhook, setCopiedWebhook] = useState(false);

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

    const fetchLineData = async (showToast = false) => {
        setLoadingLineLogs(true);
        try {
            const [statusRes, contactsRes, logsRes] = await Promise.all([
                fetch('/api/line/status'),
                fetch('/api/line/contacts'),
                fetch('/api/line/logs?limit=25')
            ]);
            if (statusRes.ok) {
                const s = await statusRes.json();
                setLineStatus(s);
                if (s.targetId && !lineTargetId) setLineTargetId(s.targetId);
                if (!testLineTarget) setTestLineTarget(s.targetId || '');
            }
            if (contactsRes.ok) {
                const c = await contactsRes.json();
                setLineContacts(Array.isArray(c) ? c : []);
            }
            if (logsRes.ok) {
                const l = await logsRes.json();
                setLineLogs(Array.isArray(l) ? l : []);
            }
            if (showToast) {
                toast.success('รีเฟรชข้อมูลสถานะ LINE และประวัติสำเร็จแล้ว');
            }
        } catch (e) {
            console.warn('LINE status fetch error:', e);
            if (showToast) {
                toast.error('ไม่สามารถรีเฟรชข้อมูลได้: ' + (e.message || 'เกิดข้อผิดพลาด'));
            }
        } finally {
            setTimeout(() => setLoadingLineLogs(false), 500);
        }
    };

    const handleRefreshLine = async (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        await fetchLineData(true);
    };

    // Fetch settings
    useEffect(() => {
        async function fetchSettings() {
            try {
                const res = await fetch('/api/settings');
                if (res.ok) {
                    const data = await res.json();
                    setNotifyEmails(data.notify_emails || 'ksu.smart.maintain@gmail.com');
                    setSmtpEnabled(data.smtp_enabled !== false);
                    setSmtpHost(data.smtp_host || 'smtp.gmail.com');
                    setSmtpPort(data.smtp_port || 465);
                    setSmtpSecure(data.smtp_secure !== false);
                    setSmtpUser(data.smtp_user || 'ksu.smart.maintain@gmail.com');
                    setSmtpPass(data.smtp_pass || '');
                    setSenderName(data.sender_name || 'KSU Smart Maintain (แจ้งซ่อม)');
                    
                    // LINE Settings
                    setLineChannelAccessToken(data.line_channel_access_token || '');
                    setLineChannelSecret(data.line_channel_secret || '');
                    setLineTargetId(data.line_target_id || '');
                    setLineNotifyEnabled(data.line_notify_enabled !== false);
                    if (data.app_base_url) setAppBaseUrl(data.app_base_url);

                    setDiscordUrl(data.discord_webhook_url || '');
                    setServiceId(data.emailjs_service_id || '');
                    setTemplateId(data.emailjs_template_id || '');
                    setPublicKey(data.emailjs_public_key || '');
                    setPrivateKey(data.emailjs_private_key || '');
                    setTechnicians(Array.isArray(data.technicians) ? data.technicians : []);
                    setTestEmailTarget(data.notify_emails ? data.notify_emails.split(',')[0].trim() : 'ksu.smart.maintain@gmail.com');

                    await fetchLineData();
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
                    technicians: technicians,
                    line_channel_access_token: lineChannelAccessToken.trim(),
                    line_channel_secret: lineChannelSecret.trim(),
                    line_group_id: lineTargetId.trim(),
                    line_target_id: lineTargetId.trim(),
                    line_notify_enabled: lineNotifyEnabled,
                    app_base_url: appBaseUrl.trim()
                })
            });

            if (res.ok) {
                toast.success('บันทึกการตั้งค่าระบบ, อีเมล และ LINE เรียบร้อยแล้ว');
                fetchLineData();
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

    const handleTestLine = async () => {
        const target = (testLineTarget || lineTargetId || '').trim();
        if (!target) {
            toast.error('กรุณาระบุ Target ID (Group ID หรือ User ID) ก่อนส่งทดสอบ');
            return;
        }
        setTestingLine(true);
        try {
            const res = await fetch('/api/line/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetId: target,
                    groupId: target,
                    message: testLineMessage.trim()
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('ส่งข้อความแจ้งเตือนทดสอบไปยัง LINE สำเร็จแล้ว! กรุณาตรวจสอบในห้องแชต LINE');
                fetchLineData();
            } else {
                toast.error(data.error || 'การส่งทดสอบไปยัง LINE ไม่สำเร็จ กรุณาตรวจสอบ Token และสิทธิ์ของบอทในกลุ่ม');
            }
        } catch (e) {
            toast.error('การเชื่อมต่อเซิร์ฟเวอร์ล้มเหลว: ' + e.message);
        } finally {
            setTestingLine(false);
        }
    };

    const handleCopyWebhook = () => {
        const url = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'}/api/line/webhook`;
        navigator.clipboard.writeText(url);
        setCopiedWebhook(true);
        toast.success('คัดลอก LINE Webhook URL เรียบร้อยแล้ว');
        setTimeout(() => setCopiedWebhook(false), 2500);
    };

    const handleTestNotification = async () => {
        const target = testEmailTarget.trim() || notifyEmails.split(',')[0].trim() || 'ksu.smart.maintain@gmail.com';
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
                            placeholder="เช่น ksu.smart.maintain@gmail.com, admin@ksu.ac.th, staff@gmail.com" 
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

                {/* 4. LINE Official Account / Messaging API Notification */}
                <div className="glass-card" style={{ padding: '1.5rem 2rem', border: '1px solid rgba(6, 199, 85, 0.25)', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(6, 199, 85, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06C755' }}>
                                <Smartphone style={{ width: 22, height: 22 }} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    ระบบแจ้งเตือนผ่าน LINE
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: 'rgba(6, 199, 85, 0.15)', color: '#06C755', border: '1px solid rgba(6, 199, 85, 0.3)' }}>
                                        LINE Official Account
                                    </span>
                                </h3>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    LINE Messaging API (Flex Message & Direct Push)
                                </span>
                            </div>
                        </div>
                        <div>
                            {lineStatus?.configured && lineNotifyEnabled ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '4px 10px', borderRadius: 20, background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                    <CheckCircle style={{ width: 14, height: 14 }} /> เชื่อมต่อแล้ว (Active)
                                </span>
                            ) : !lineStatus?.configured ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '4px 10px', borderRadius: 20, background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                    <AlertCircle style={{ width: 14, height: 14 }} /> ยังไม่ได้ระบุ Token / Secret
                                </span>
                            ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '4px 10px', borderRadius: 20, background: 'rgba(148, 163, 184, 0.12)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.3)' }}>
                                    ⚪ ปิดใช้งานชั่วคราว
                                </span>
                            )}
                        </div>
                    </div>

                    <div style={{ background: 'rgba(6, 199, 85, 0.05)', border: '1px solid rgba(6, 199, 85, 0.15)', borderRadius: 8, padding: '0.85rem 1rem', marginBottom: '1.5rem', fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                        <strong style={{ color: '#06C755' }}>📢 ข้อควรทราบ:</strong> บริการ <code>LINE Notify</code> ได้ยุติการให้บริการทั่วโลกแล้ว ระบบ KSU Smart Maintain จึงปรับมาใช้ <strong>LINE Messaging API ผ่าน LINE Official Account</strong> อย่างเต็มรูปแบบ โดยแจ้งเตือนผ่าน Flex Message สวยงาม พร้อมปุ่มกดดูงานซ่อมและรับงานได้ทันที
                    </div>

                    {/* Enable Toggle & Base URL */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input 
                                type="checkbox" 
                                id="lineNotifyEnabled"
                                checked={lineNotifyEnabled}
                                onChange={(e) => setLineNotifyEnabled(e.target.checked)}
                                style={{ width: 18, height: 18, accentColor: '#06C755', cursor: 'pointer' }}
                            />
                            <label htmlFor="lineNotifyEnabled" style={{ cursor: 'pointer', fontWeight: 500, userSelect: 'none' }}>
                                เปิดใช้งานการส่งข้อความแจ้งเตือนผ่าน LINE ทันทีเมื่อมีรายการแจ้งซ่อมหรืออัปเดตสถานะ
                            </label>
                        </div>

                        {/* Webhook Box */}
                        <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.9rem 1.1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    🔗 LINE Webhook URL (สำหรับรับ Group ID อัตโนมัติ & คำสั่งบอท)
                                </span>
                                <button
                                    type="button"
                                    onClick={handleCopyWebhook}
                                    className="btn btn-secondary"
                                    style={{ padding: '3px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                                >
                                    {copiedWebhook ? <Check style={{ width: 13, height: 13, color: '#34d399' }} /> : <Copy style={{ width: 13, height: 13 }} />}
                                    {copiedWebhook ? 'คัดลอกแล้ว!' : 'คัดลอก URL'}
                                </button>
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#93c5fd', wordBreak: 'break-all', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: 4 }}>
                                {typeof window !== 'undefined' ? `${window.location.origin}/api/line/webhook` : '/api/line/webhook'}
                            </div>
                            <span className="form-hint" style={{ marginTop: 4, display: 'block', fontSize: '0.78rem' }}>
                                นำ URL นี้ไปใส่ใน LINE Developers Console &rarr; Messaging API &rarr; <strong>Webhook settings</strong> แล้วกด Verify / Use webhook
                            </span>
                        </div>

                        {/* Channel Access Token */}
                        <div className="form-group" style={{ margin: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <label className="form-label" style={{ margin: 0 }}>
                                    LINE Channel Access Token (Long-lived) <span style={{ color: '#f87171' }}>*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowToken(!showToken)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                >
                                    {showToken ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                                    {showToken ? 'ซ่อน Token' : 'แสดง Token'}
                                </button>
                            </div>
                            <input 
                                type={showToken ? "text" : "password"} 
                                className="form-input" 
                                placeholder={lineStatus?.hasToken ? "●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●● (กำหนดไว้แล้ว พิมพ์ใหม่เพื่อเปลี่ยน)" : "eyJhbGciOi... (Channel access token จาก LINE Developers Console)"}
                                value={lineChannelAccessToken}
                                onChange={(e) => setLineChannelAccessToken(e.target.value)}
                                style={{ fontFamily: showToken ? 'monospace' : 'inherit' }}
                            />
                            <span className="form-hint">
                                รับได้จาก <a href="https://developers.line.biz/console/" target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>LINE Developers Console</a> &rarr; เลือก Channel &rarr; แท็บ <strong>Messaging API</strong> &rarr; ช่อง Channel access token (กด Issue)
                            </span>
                        </div>

                        {/* Channel Secret */}
                        <div className="form-group" style={{ margin: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <label className="form-label" style={{ margin: 0 }}>
                                    LINE Channel Secret <span style={{ color: '#f87171' }}>*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowSecret(!showSecret)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                >
                                    {showSecret ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                                    {showSecret ? 'ซ่อน Secret' : 'แสดง Secret'}
                                </button>
                            </div>
                            <input 
                                type={showSecret ? "text" : "password"} 
                                className="form-input" 
                                placeholder={lineStatus?.hasSecret ? "●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●● (กำหนดไว้แล้ว)" : "32-character Channel Secret จากหน้า Basic settings"}
                                value={lineChannelSecret}
                                onChange={(e) => setLineChannelSecret(e.target.value)}
                                style={{ fontFamily: showSecret ? 'monospace' : 'inherit' }}
                            />
                            <span className="form-hint">
                                รับได้จากแท็บ <strong>Basic settings</strong> ใน LINE Developers Console ใช้สำหรับตรวจสอบความถูกต้องของ Webhook ป้องกันการปลอมแปลง
                            </span>
                        </div>

                        {/* Target ID (Group ID or User ID) */}
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">
                                Target ID (Group ID หรือ User ID ที่ต้องการให้ส่งแจ้งเตือน) <span style={{ color: '#f87171' }}>*</span>
                            </label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="เช่น C0123456789abcdef... (Group ID) หรือ U0123456789... (User ID)"
                                value={lineTargetId}
                                onChange={(e) => setLineTargetId(e.target.value)}
                                style={{ fontFamily: 'monospace' }}
                            />
                            <div style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                💡 <strong>วิธีหา Group ID แบบง่าย:</strong> เพิ่ม LINE Bot เข้ากลุ่มช่าง/แอดมิน แล้วพิมพ์ในกลุ่มว่า <code>/id</code> หรือ <code>/groupid</code> ระบบจะตรวจจับและบันทึก Group ID ให้โดยอัตโนมัติ
                            </div>

                            {/* Detected Contacts & Groups */}
                            {lineContacts.length > 0 && (
                                <div style={{ marginTop: '0.6rem', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(6, 199, 85, 0.3)', borderRadius: 6 }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#34d399', display: 'block', marginBottom: 4 }}>
                                        🎯 พบกลุ่ม/ผู้ใช้ที่เพิ่งติดต่อเข้ามา (คลิกเพื่อเลือกทันที):
                                    </span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {lineContacts.map((c, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    setLineTargetId(c.id);
                                                    setTestLineTarget(c.id);
                                                    toast.info(`เลือก Target ID: ${c.id}`);
                                                }}
                                                style={{
                                                    background: lineTargetId === c.id ? 'rgba(6, 199, 85, 0.25)' : 'rgba(255,255,255,0.05)',
                                                    border: lineTargetId === c.id ? '1px solid #06C755' : '1px solid var(--border-color)',
                                                    color: lineTargetId === c.id ? '#34d399' : 'var(--text-primary)',
                                                    padding: '3px 8px',
                                                    borderRadius: 14,
                                                    fontSize: '0.78rem',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 4
                                                }}
                                            >
                                                <span>{c.type === 'group' ? '👥 กลุ่ม:' : '👤 ผู้ใช้:'} <strong>{c.id.substring(0, 10)}...</strong></span>
                                                {lineTargetId === c.id && <Check style={{ width: 12, height: 12 }} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* App Base URL */}
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">
                                App Base URL (URL ของระบบสำหรับปุ่มเปิดดูงานใน LINE)
                            </label>
                            <input 
                                type="url" 
                                className="form-input" 
                                placeholder="https://your-domain.com หรือ http://localhost:5173"
                                value={appBaseUrl}
                                onChange={(e) => setAppBaseUrl(e.target.value)}
                            />
                            <span className="form-hint">
                                เมื่อระบบส่งแจ้งเตือน Flex Message ไปยัง LINE ปุ่ม "ดูงานซ่อม" จะนำผู้ใช้มายังลิงก์นี้
                            </span>
                        </div>
                    </div>

                    {/* LINE Testing Box */}
                    <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                        <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
                            <Send style={{ width: 15, height: 15, color: '#06C755' }} />
                            ส่งข้อความทดสอบ LINE (Direct Test)
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.8rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 2fr', gap: '0.8rem' }}>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="Target ID (ปล่อยว่างเพื่อใช้ค่าด้านบน)"
                                    value={testLineTarget}
                                    onChange={(e) => setTestLineTarget(e.target.value)}
                                    style={{ fontSize: '0.85rem' }}
                                />
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="ข้อความทดสอบ"
                                    value={testLineMessage}
                                    onChange={(e) => setTestLineMessage(e.target.value)}
                                    style={{ fontSize: '0.85rem' }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleRefreshLine}
                                    disabled={loadingLineLogs}
                                    style={{
                                        padding: '0.45rem 1rem',
                                        fontSize: '0.85rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        cursor: loadingLineLogs ? 'wait' : 'pointer',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        userSelect: 'none',
                                        transition: 'all 0.2s ease'
                                    }}
                                    title="คลิกเพื่อรีเฟรชข้อมูลสถานะและประวัติ LINE"
                                >
                                    <RefreshCw
                                        style={{ width: 14, height: 14 }}
                                        className={loadingLineLogs ? 'animate-spin' : ''}
                                    />
                                    <span>{loadingLineLogs ? 'กำลังรีเฟรช...' : 'รีเฟรช'}</span>
                                </button>
                                <button
                                    type="button"
                                    className="btn"
                                    onClick={handleTestLine}
                                    disabled={testingLine}
                                    style={{
                                        background: '#06C755',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '0.45rem 1.1rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        cursor: testingLine ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {testingLine ? <Loader style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: 15, height: 15 }} />}
                                    {testingLine ? 'กำลังส่งทดสอบ...' : 'ส่งทดสอบไปยัง LINE'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* LINE Delivery Logs */}
                    {lineLogs.length > 0 && (
                        <div style={{ marginTop: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    📜 ประวัติการส่งข้อความ LINE ล่าสุด ({lineLogs.length} รายการ):
                                </span>
                                <button
                                    type="button"
                                    onClick={handleRefreshLine}
                                    disabled={loadingLineLogs}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#60a5fa',
                                        cursor: loadingLineLogs ? 'wait' : 'pointer',
                                        fontSize: '0.78rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4
                                    }}
                                    title="คลิกเพื่อโหลดประวัติล่าสุดใหม่"
                                >
                                    <RefreshCw
                                        style={{ width: 12, height: 12 }}
                                        className={loadingLineLogs ? 'animate-spin' : ''}
                                    />
                                    <span>{loadingLineLogs ? 'กำลังโหลด...' : 'โหลดใหม่'}</span>
                                </button>
                            </div>
                            <div style={{ maxHeight: 220, overflowY: 'auto', borderRadius: 6, border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
                                <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-color)' }}>
                                            <th style={{ padding: '6px 10px' }}>เวลา</th>
                                            <th style={{ padding: '6px 10px' }}>เหตุการณ์</th>
                                            <th style={{ padding: '6px 10px' }}>เป้าหมาย</th>
                                            <th style={{ padding: '6px 10px' }}>สถานะ</th>
                                            <th style={{ padding: '6px 10px' }}>ผลลัพธ์ / ข้อผิดพลาด</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lineLogs.map((log) => (
                                            <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                                    {new Date(log.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </td>
                                                <td style={{ padding: '6px 10px', fontWeight: 500 }}>
                                                    <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
                                                        {log.event}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>
                                                    {log.targetId ? `${log.targetId.substring(0, 8)}...` : '-'}
                                                </td>
                                                <td style={{ padding: '6px 10px' }}>
                                                    {log.success ? (
                                                        <span style={{ color: '#34d399', fontWeight: 600 }}>✓ สำเร็จ</span>
                                                    ) : (
                                                        <span style={{ color: '#f87171', fontWeight: 600 }}>✗ ล้มเหลว</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '6px 10px', color: log.success ? 'var(--text-secondary)' : '#fca5a5' }}>
                                                    {log.error ? (typeof log.error === 'object' ? JSON.stringify(log.error) : log.error) : 'ส่งสำเร็จ (HTTP 200)'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* 5. Alternative Options (Discord Webhook & EmailJS) */}
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
