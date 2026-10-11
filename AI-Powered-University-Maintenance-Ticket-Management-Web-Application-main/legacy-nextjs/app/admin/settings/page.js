// ============================================================
// page.js — Admin Settings Page for Notifications
// Route: /admin/settings
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { 
    Settings, ArrowLeft, Save, Bell, Mail, Send, Loader, AlertCircle, Info 
} from 'lucide-react';
import Link from 'next/link';

export default function AdminSettingsPage() {
    const router = useRouter();
    const { role, toast } = useApp();

    const [discordUrl, setDiscordUrl] = useState('');
    const [serviceId, setServiceId] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [publicKey, setPublicKey] = useState('');
    const [privateKey, setPrivateKey] = useState('');

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
                    setDiscordUrl(data.discord_webhook_url || '');
                    setServiceId(data.emailjs_service_id || '');
                    setTemplateId(data.emailjs_template_id || '');
                    setPublicKey(data.emailjs_public_key || '');
                    setPrivateKey(data.emailjs_private_key || '');
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

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    discord_webhook_url: discordUrl.trim(),
                    emailjs_service_id: serviceId.trim(),
                    emailjs_template_id: templateId.trim(),
                    emailjs_public_key: publicKey.trim(),
                    emailjs_private_key: privateKey.trim()
                })
            });

            if (res.ok) {
                toast.success('บันทึกการตั้งค่าสำเร็จ');
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
        setTesting(true);
        try {
            // Trigger PATCH request to send mock notification
            const res = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    test_name: 'แอดมินระบบ (ทดสอบ)',
                    test_email: 'admin-test@example.com'
                })
            });

            if (res.ok) {
                toast.success('ส่งข้อความทดสอบสำเร็จแล้ว! กรุณาตรวจสอบอีเมลหรือช่องทาง Webhook ของคุณ');
            } else {
                const data = await res.json();
                toast.error(data.error || 'การส่งทดสอบล้มเหลว ตรวจสอบความถูกต้องของข้อมูล');
            }
        } catch (e) {
            console.error(e);
            toast.error('ไม่สามารถส่งคำขอทดสอบได้');
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
        <div className="page-settings fade-in" style={{ maxWidth: 800, margin: '0 auto', paddingBottom: '3rem' }}>
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div className="page-header-left">
                    <button className="btn btn-ghost btn-sm" onClick={() => router.back()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <ArrowLeft style={{ width: 16, height: 16 }} />
                        กลับหน้าแอดมิน
                    </button>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Settings style={{ width: 24, height: 24, color: 'var(--primary-color)' }} />
                        ตั้งค่าระบบแจ้งเตือน (Notifications Settings)
                    </h1>
                    <p className="page-subtitle">กำหนดค่า webhook และ EmailJS เพื่อส่งการแจ้งเตือนเมื่อตั๋วปัญหาได้รับการอัปเดต</p>
                </div>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Discord Webhook section */}
                <div className="glass-card" style={{ padding: '2rem' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: 600 }}>
                        <Bell style={{ width: 20, height: 20, color: 'var(--primary-color)' }} />
                        การแจ้งเตือนผ่าน Discord / Webhook
                    </h3>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Discord Webhook URL</label>
                        <input 
                            type="url" 
                            className="form-input" 
                            placeholder="https://discord.com/api/webhooks/..." 
                            value={discordUrl}
                            onChange={(e) => setDiscordUrl(e.target.value)}
                        />
                        <span className="form-hint">
                            วาง URL ของ Discord Webhook เพื่อให้ส่งการแจ้งเตือนเข้าไปที่ห้องแชตของทีมแอดมินโดยอัตโนมัติ
                        </span>
                    </div>
                </div>

                {/* EmailJS section */}
                <div className="glass-card" style={{ padding: '2rem' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: 600 }}>
                        <Mail style={{ width: 20, height: 20, color: 'var(--primary-color)' }} />
                        การส่งอีเมลผ่าน EmailJS (REST API)
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', marginBottom: '1.25rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">EmailJS Service ID</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="service_xxxxxx" 
                                value={serviceId}
                                onChange={(e) => setServiceId(e.target.value)}
                                style={serviceId.includes('@') ? { borderColor: '#f87171' } : {}}
                            />
                            {serviceId.includes('@') && (
                                <span className="form-hint" style={{ color: '#f87171', marginTop: 4, display: 'block', fontSize: '0.8rem', fontWeight: 500 }}>
                                    ⚠️ รหัส Service ID ไม่ใช่อีเมล (มักจะขึ้นต้นด้วย service_)
                                </span>
                            )}
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">EmailJS Template ID</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="template_xxxxxx" 
                                value={templateId}
                                onChange={(e) => setTemplateId(e.target.value)}
                                style={templateId.includes('@') ? { borderColor: '#f87171' } : {}}
                            />
                            {templateId.includes('@') && (
                                <span className="form-hint" style={{ color: '#f87171', marginTop: 4, display: 'block', fontSize: '0.8rem', fontWeight: 500 }}>
                                    ⚠️ รหัส Template ID ไม่ใช่อีเมล (มักจะขึ้นต้นด้วย template_)
                                </span>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">EmailJS Public Key</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="user_xxxxxxxxxxxxxxxx" 
                                value={publicKey}
                                onChange={(e) => setPublicKey(e.target.value)}
                                style={publicKey.includes('@') ? { borderColor: '#f87171' } : {}}
                            />
                            {publicKey.includes('@') && (
                                <span className="form-hint" style={{ color: '#f87171', marginTop: 4, display: 'block', fontSize: '0.8rem', fontWeight: 500 }}>
                                    ⚠️ ดูเหมือนคุณกรอกอีเมลในช่องนี้ รหัส Public Key ของ EmailJS ควรเป็นรหัสคีย์ (เช่น user_xxx หรือรหัสสุ่มอื่นๆ)
                                </span>
                            )}
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">EmailJS Private Key (สำหรับ Server-Side REST API)</label>
                            <input 
                                type="password" 
                                className="form-input" 
                                placeholder="••••••••••••••••••••••••" 
                                value={privateKey}
                                onChange={(e) => setPrivateKey(e.target.value)}
                                style={privateKey.includes('@') ? { borderColor: '#f87171' } : {}}
                            />
                            {privateKey.includes('@') && (
                                <span className="form-hint" style={{ color: '#f87171', marginTop: 4, display: 'block', fontSize: '0.8rem', fontWeight: 500 }}>
                                    ⚠️ รหัส Private Key ไม่ใช่อีเมล
                                </span>
                            )}
                        </div>
                    </div>

                    <div style={{ 
                        marginTop: '1.5rem', 
                        padding: '1rem', 
                        background: 'rgba(59, 130, 246, 0.05)', 
                        border: '1px solid rgba(59, 130, 246, 0.15)',
                        borderRadius: '6px',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'flex-start'
                    }}>
                        <Info style={{ width: 18, height: 18, color: 'var(--primary-color)', flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                            <strong>คำแนะนำการตั้งค่าอีเมล:</strong> ใน EmailJS template ของคุณ ควรใช้ตัวแปร <code>{"{{subject}}"}</code>, <code>{"{{to_email}}"}</code>, <code>{"{{to_name}}"}</code>, <code>{"{{message}}"}</code> เป็นตัวรับข้อมูลหลักเพื่อรับหัวเรื่อง รายชื่อผู้รับ และข้อความเนื้อหารายละเอียดที่ระบบหลังบ้านส่งเข้าไป
                        </span>
                    </div>
                </div>

                {/* Form Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button 
                        type="button" 
                        className="btn btn-ghost" 
                        onClick={handleTestNotification}
                        disabled={testing || saving}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                        {testing ? (
                            <>
                                <Loader className="animate-spin" style={{ width: 16, height: 16 }} />
                                กำลังส่งทดสอบ...
                            </>
                        ) : (
                            <>
                                <Send style={{ width: 16, height: 16 }} />
                                ส่งแจ้งเตือนทดสอบ (Test Alert)
                            </>
                        )}
                    </button>

                    <button 
                        type="submit" 
                        className="btn btn-primary btn-lg" 
                        disabled={saving || testing}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                        {saving ? (
                            <>
                                <Loader className="animate-spin" style={{ width: 18, height: 18 }} />
                                กำลังบันทึก...
                            </>
                        ) : (
                            <>
                                <Save style={{ width: 18, height: 18 }} />
                                บันทึกการตั้งค่า
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
