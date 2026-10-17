// ============================================================
// Profile.jsx — User Profile Management & Password Change
// Route: /profile
// Responsive 100% Mobile-First Design
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import {
    User, Mail, Phone, Shield, KeyRound, Camera,
    CheckCircle2, AlertCircle, Save, Lock, ArrowLeft,
    Eye, EyeOff, ShieldCheck, UserCircle, Bell, BellOff,
    Check, Sparkles, Loader
} from 'lucide-react';

const USER_GROUPS = [
    { value: 'นักศึกษา', label: 'นักศึกษา (Group A)', type: 'A', desc: 'แจ้งปัญหาและดูปัญหาของตนเอง (ไม่ได้รับอีเมลแจ้งเตือน)' },
    { value: 'อาจารย์', label: 'อาจารย์ (Group A)', type: 'A', desc: 'แจ้งปัญหาและดูปัญหาของตนเอง (ไม่ได้รับอีเมลแจ้งเตือน)' },
    { value: 'เจ้าหน้าที่', label: 'เจ้าหน้าที่ (Group B)', type: 'B', desc: 'จัดการและอัปเดตงานซ่อม (ได้รับอีเมลแจ้งเตือน)' },
    { value: 'เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์', label: 'เจ้าหน้าที่ IT / ผู้ดูแลอุปกรณ์ (Group B)', type: 'B', desc: 'จัดการสถานะ, Timeline, รูปภาพหลักฐาน, และงบประมาณ (ได้รับอีเมลแจ้งเตือน)' },
    { value: 'ผู้ดูแลระบบ', label: 'ผู้ดูแลระบบ (Group B - Admin)', type: 'B', desc: 'สิทธิ์สูงสุดทุกฟังก์ชันในระบบ (ได้รับอีเมลแจ้งเตือน)' }
];

export default function ProfilePage() {
    const navigate = useNavigate();
    const { user, isGuest, isGroupA, isGroupB, updateUserProfile, changeUserPassword, uploadUserAvatar, toast } = useApp();

    const fileInputRef = useRef(null);
    const [activeTab, setActiveTab] = useState('info'); // 'info' | 'password'

    // Personal info form states
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [group, setGroup] = useState('นักศึกษา');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Password change form states
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPass, setShowCurrentPass] = useState(false);
    const [showNewPass, setShowNewPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);

    // Redirect guest to login
    useEffect(() => {
        if (isGuest) {
            toast.warning('กรุณาเข้าสู่ระบบก่อนจัดการโปรไฟล์');
            navigate('/login?redirect=/profile');
        }
    }, [isGuest, navigate]);

    // Populate user details and fetch latest from server
    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setEmail(user.email || '');
            setPhone(user.phone || '');
            setGroup(user.group || 'นักศึกษา');
            setAvatarUrl(user.avatar_url || '');
        }

        async function loadLatestProfile() {
            try {
                const token = localStorage.getItem('helpdesk_token');
                if (!token) return;
                const res = await fetch('/api/user/profile', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.name) setName(data.name);
                    if (data.email) setEmail(data.email);
                    if (data.phone) setPhone(data.phone);
                    if (data.group) setGroup(data.group);
                    if (data.avatar_url) {
                        setAvatarUrl(data.avatar_url);
                        try {
                            const cur = JSON.parse(localStorage.getItem('helpdesk_current_user') || '{}');
                            if (!cur.avatar_url || cur.avatar_url !== data.avatar_url) {
                                localStorage.setItem('helpdesk_current_user', JSON.stringify({ ...cur, avatar_url: data.avatar_url }));
                            }
                        } catch (e) {}
                    }
                }
            } catch (e) {
                console.warn('Error loading latest profile:', e);
            }
        }

        if (!isGuest) {
            loadLatestProfile();
        }
    }, [user, isGuest]);

    // Handle avatar file selection
    const handleAvatarSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast.error('ไฟล์มีขนาดเกิน 10MB กรุณาเลือกไฟล์ที่เล็กลง');
            return;
        }

        setUploadingAvatar(true);
        try {
            const uploadedUrl = await uploadUserAvatar(file);
            setAvatarUrl(uploadedUrl);
            toast.success('อัปโหลดรูปโปรไฟล์เรียบร้อยแล้ว');
        } catch (err) {
            toast.error(err.message || 'ไม่สามารถอัปโหลดรูปภาพได้');
        } finally {
            setUploadingAvatar(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Handle profile update
    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('กรุณาระบุชื่อ-นามสกุล');
            return;
        }

        setSavingProfile(true);
        try {
            await updateUserProfile({
                name: name.trim(),
                phone: phone.trim(),
                group: group.trim(),
                avatar_url: avatarUrl
            });
            toast.success('บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว');
        } catch (err) {
            toast.error(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setSavingProfile(false);
        }
    };

    // Handle password change
    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (!currentPassword) {
            toast.error('กรุณากรอกรหัสผ่านปัจจุบัน');
            return;
        }
        if (!newPassword || newPassword.length < 6) {
            toast.error('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
            return;
        }

        setSavingPassword(true);
        try {
            await changeUserPassword(currentPassword, newPassword);
            toast.success('เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            toast.error(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
        } finally {
            setSavingPassword(false);
        }
    };

    if (isGuest) {
        return null;
    }

    return (
        <div className="profile-container" style={{ maxWidth: 960, margin: '0 auto', padding: '1rem', width: '100%' }}>
            {/* Top Navigation Back Link */}
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                    onClick={() => navigate(-1)}
                    className="btn btn-ghost"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.75rem', fontSize: '0.88rem' }}
                >
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    ย้อนกลับ
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>สถานะบัญชี:</span>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: isGroupB ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: isGroupB ? '#60a5fa' : '#34d399',
                        fontWeight: 600,
                        fontSize: '0.75rem'
                    }}>
                        {isGroupB ? <ShieldCheck style={{ width: 13, height: 13 }} /> : <UserCircle style={{ width: 13, height: 13 }} />}
                        {isGroupB ? 'Group B (เจ้าหน้าที่/ผู้ดูแล)' : 'Group A (นักศึกษา/อาจารย์)'}
                    </span>
                </div>
            </div>

            {/* Profile Hero Header Card */}
            <div className="glass-card" style={{
                padding: '1.5rem',
                borderRadius: '16px',
                marginBottom: '1.5rem',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '1.25rem',
                    flexWrap: 'wrap'
                }}>
                    {/* Avatar Upload Area */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{
                            width: 90,
                            height: 90,
                            borderRadius: '50%',
                            background: 'var(--bg-card-secondary, rgba(255,255,255,0.06))',
                            border: '3px solid var(--primary-color)',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                        }}>
                            {avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    alt={name || 'User Avatar'}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                                    {(name || user?.email || 'U').charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>

                        {/* Camera upload button */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingAvatar}
                            title="เปลี่ยนรูปโปรไฟล์"
                            style={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: 'var(--primary-color)',
                                border: '2px solid var(--bg-card, #1e293b)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'transform 0.15s ease',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                            }}
                        >
                            {uploadingAvatar ? <Loader className="spin" style={{ width: 14, height: 14 }} /> : <Camera style={{ width: 15, height: 15 }} />}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleAvatarSelect}
                        />
                    </div>

                    {/* User Summary Info */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {name || 'ผู้ใช้งาน'}
                            </h2>
                            <span style={{
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: isGroupB ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                color: isGroupB ? '#60a5fa' : '#34d399',
                                border: `1px solid ${isGroupB ? 'rgba(59, 130, 246, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`
                            }}>
                                {group}
                            </span>
                        </div>

                        <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Mail style={{ width: 14, height: 14 }} />
                            {email}
                        </p>

                        {/* Notification Status Badge */}
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: '0.78rem',
                            padding: '4px 10px',
                            borderRadius: 8,
                            background: isGroupB ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: isGroupB ? '#93c5fd' : '#fca5a5',
                            border: `1px solid ${isGroupB ? 'rgba(59, 130, 246, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                        }}>
                            {isGroupB ? (
                                <>
                                    <Bell style={{ width: 13, height: 13, color: '#60a5fa' }} />
                                    <span>รับการแจ้งเตือนทางอีเมลเมื่อมี Ticket ใหม่และอัปเดตสถานะ (Group B)</span>
                                </>
                            ) : (
                                <>
                                    <BellOff style={{ width: 13, height: 13, color: '#f87171' }} />
                                    <span>ไม่รับอีเมลแจ้งเตือนใดๆ จากระบบ (Group A ตามนโยบาย)</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs (Mobile-friendly Pill Switcher) */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '0.5rem',
                marginBottom: '1.5rem',
                overflowX: 'auto',
                scrollbarWidth: 'none'
            }}>
                <button
                    onClick={() => setActiveTab('info')}
                    style={{
                        padding: '0.55rem 1.1rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: activeTab === 'info' ? 'var(--primary-color)' : 'rgba(255,255,255,0.04)',
                        color: activeTab === 'info' ? '#fff' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <User style={{ width: 16, height: 16 }} />
                    แก้ไขข้อมูลส่วนตัว
                </button>
                <button
                    onClick={() => setActiveTab('password')}
                    style={{
                        padding: '0.55rem 1.1rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: activeTab === 'password' ? 'var(--primary-color)' : 'rgba(255,255,255,0.04)',
                        color: activeTab === 'password' ? '#fff' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <KeyRound style={{ width: 16, height: 16 }} />
                    เปลี่ยนรหัสผ่าน
                </button>
            </div>

            {/* TAB 1: Edit Profile Form */}
            {activeTab === 'info' && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: '1.5rem',
                    alignItems: 'start'
                }}>
                    <form onSubmit={handleSaveProfile} className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                        <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <User style={{ width: 18, height: 18, color: 'var(--primary-color)' }} />
                            ข้อมูลส่วนบุคคล
                        </h3>

                        {/* Name Input */}
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600 }}>
                                ชื่อ-นามสกุล <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="ระบุชื่อและนามสกุลจริง"
                                required
                                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.9rem' }}
                            />
                        </div>

                        {/* Email Input (Read-only) */}
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600 }}>
                                อีเมล (ใช้ในการเข้าสู่ระบบ)
                            </label>
                            <input
                                type="email"
                                className="form-input"
                                value={email}
                                disabled
                                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.9rem', opacity: 0.7, background: 'rgba(0,0,0,0.15)', cursor: 'not-allowed' }}
                            />
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                                อีเมลบัญชีไม่สามารถแก้ไขได้เพื่อความปลอดภัยในการยืนยันตัวตน
                            </span>
                        </div>

                        {/* Phone Input */}
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600 }}>
                                เบอร์โทรศัพท์สำหรับติดต่อ
                            </label>
                            <input
                                type="tel"
                                className="form-input"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="เช่น 081-234-5678"
                                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.9rem' }}
                            />
                        </div>

                        {/* Group Selection (Locked for Security) */}
                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <label className="form-label" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Shield style={{ width: 14, height: 14, color: 'var(--primary-color)' }} />
                                    กลุ่มผู้ใช้งานและบทบาท
                                </label>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: '0.75rem',
                                    color: '#d97706',
                                    background: 'rgba(245, 158, 11, 0.1)',
                                    padding: '2px 8px',
                                    borderRadius: 9999,
                                    fontWeight: 500
                                }}>
                                    <Lock style={{ width: 11, height: 11 }} />
                                    ล็อกโดยระบบ (ไม่สามารถแก้ไขได้)
                                </span>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <select
                                    disabled
                                    className="form-input form-select"
                                    value={group}
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 2.4rem 0.65rem 0.85rem',
                                        fontSize: '0.9rem',
                                        backgroundColor: 'var(--bg-muted, rgba(0, 0, 0, 0.04))',
                                        color: 'var(--text-primary)',
                                        cursor: 'not-allowed',
                                        opacity: 0.85,
                                        borderColor: 'var(--border-color)',
                                        fontWeight: 500,
                                        userSelect: 'none'
                                    }}
                                >
                                    {USER_GROUPS.map((g) => (
                                        <option key={g.value} value={g.value}>
                                            {g.label}
                                        </option>
                                    ))}
                                </select>
                                <Lock style={{
                                    position: 'absolute',
                                    right: '2.2rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 14,
                                    height: 14,
                                    color: 'var(--text-muted)',
                                    pointerEvents: 'none'
                                }} />
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <ShieldCheck style={{ width: 13, height: 13, color: 'var(--primary-color)', flexShrink: 0 }} />
                                สิทธิ์และบทบาทถูกกำหนดโดยระบบ เพื่อความปลอดภัยป้องกันการเข้าถึงระบบเจ้าหน้าที่/ผู้ดูแลระบบโดยไม่ได้รับอนุญาต
                            </p>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={savingProfile}
                            className="btn btn-primary"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                fontSize: '0.92rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                borderRadius: 8
                            }}
                        >
                            {savingProfile ? (
                                <>
                                    <Loader className="spin" style={{ width: 16, height: 16 }} />
                                    กำลังบันทึกข้อมูล...
                                </>
                            ) : (
                                <>
                                    <Save style={{ width: 16, height: 16 }} />
                                    บันทึกการเปลี่ยนแปลง
                                </>
                            )}
                        </button>
                    </form>

                    {/* Permissions & Security Summary Card */}
                    <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Shield style={{ width: 18, height: 18, color: isGroupB ? '#60a5fa' : '#34d399' }} />
                            สรุปสิทธิ์การใช้งาน (Permissions)
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <CheckCircle2 style={{ width: 16, height: 16, color: '#34d399', flexShrink: 0, marginTop: 2 }} />
                                <div>
                                    <strong>เข้าถึงหน้าหลัก, รายการ Ticket และ Dashboard:</strong>
                                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>สามารถดูสถิติและค้นหารายการแจ้งซ่อมทั้งหมดได้</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <CheckCircle2 style={{ width: 16, height: 16, color: '#34d399', flexShrink: 0, marginTop: 2 }} />
                                <div>
                                    <strong>แจ้งปัญหาใหม่ & ปัญหาของฉัน:</strong>
                                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>สร้างคำร้องซ่อมบำรุงและติดตามสถานะงานของตนเองได้</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                {isGroupB ? (
                                    <CheckCircle2 style={{ width: 16, height: 16, color: '#60a5fa', flexShrink: 0, marginTop: 2 }} />
                                ) : (
                                    <AlertCircle style={{ width: 16, height: 16, color: '#94a3b8', flexShrink: 0, marginTop: 2 }} />
                                )}
                                <div>
                                    <strong>Workflow Timeline, รูปหลักฐาน & งบประมาณ:</strong>
                                    <span style={{ color: isGroupB ? '#93c5fd' : 'var(--text-muted)', display: 'block' }}>
                                        {isGroupB
                                            ? 'คุณมีสิทธิ์เต็มในการอัปเดต Timeline, อัปโหลดหลักฐาน และบริหารงบประมาณ (Group B)'
                                            : 'ดูรายละเอียดงานซ่อมได้ แต่สงวนสิทธิ์การแก้ไขและอนุมัติงบประมาณให้เจ้าหน้าที่ (Group B)'}
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                {isGroupB ? (
                                    <CheckCircle2 style={{ width: 16, height: 16, color: '#60a5fa', flexShrink: 0, marginTop: 2 }} />
                                ) : (
                                    <BellOff style={{ width: 16, height: 16, color: '#f87171', flexShrink: 0, marginTop: 2 }} />
                                )}
                                <div>
                                    <strong>ระบบส่งอีเมลแจ้งเตือนอัตโนมัติ:</strong>
                                    <span style={{ color: isGroupB ? '#93c5fd' : '#fca5a5', display: 'block' }}>
                                        {isGroupB
                                            ? 'ระบบจะส่งอีเมลแจ้งเตือนเมื่อมี Ticket ใหม่และอัปเดตสถานะไปให้คุณโดยตรง'
                                            : 'Group A (นักศึกษา/อาจารย์) จะไม่ได้รับอีเมลรบกวนใดๆ ตามนโยบายของระบบ'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: Change Password Form */}
            {activeTab === 'password' && (
                <div style={{ maxWidth: 520, margin: '0 auto' }}>
                    <form onSubmit={handleChangePassword} className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                        <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Lock style={{ width: 18, height: 18, color: 'var(--primary-color)' }} />
                            เปลี่ยนรหัสผ่านเพื่อความปลอดภัย
                        </h3>

                        {/* Current Password */}
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600 }}>
                                รหัสผ่านปัจจุบัน <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showCurrentPass ? 'text' : 'password'}
                                    className="form-input"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="กรอกรหัสผ่านปัจจุบัน"
                                    required
                                    style={{ width: '100%', padding: '0.65rem 2.5rem 0.65rem 0.85rem', fontSize: '0.9rem' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                                    style={{
                                        position: 'absolute',
                                        right: 10,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        padding: 0
                                    }}
                                >
                                    {showCurrentPass ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                                </button>
                            </div>
                        </div>

                        {/* New Password */}
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600 }}>
                                รหัสผ่านใหม่ <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showNewPass ? 'text' : 'password'}
                                    className="form-input"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="อย่างน้อย 6 ตัวอักษร"
                                    required
                                    minLength={6}
                                    style={{ width: '100%', padding: '0.65rem 2.5rem 0.65rem 0.85rem', fontSize: '0.9rem' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPass(!showNewPass)}
                                    style={{
                                        position: 'absolute',
                                        right: 10,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        padding: 0
                                    }}
                                >
                                    {showNewPass ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm New Password */}
                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600 }}>
                                ยืนยันรหัสผ่านใหม่ <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showConfirmPass ? 'text' : 'password'}
                                    className="form-input"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                                    required
                                    minLength={6}
                                    style={{ width: '100%', padding: '0.65rem 2.5rem 0.65rem 0.85rem', fontSize: '0.9rem' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                                    style={{
                                        position: 'absolute',
                                        right: 10,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        padding: 0
                                    }}
                                >
                                    {showConfirmPass ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={savingPassword}
                            className="btn btn-primary"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                fontSize: '0.92rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                borderRadius: 8
                            }}
                        >
                            {savingPassword ? (
                                <>
                                    <Loader className="spin" style={{ width: 16, height: 16 }} />
                                    กำลังเปลี่ยนรหัสผ่าน...
                                </>
                            ) : (
                                <>
                                    <KeyRound style={{ width: 16, height: 16 }} />
                                    ยืนยันเปลี่ยนรหัสผ่าน
                                </>
                            )}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
