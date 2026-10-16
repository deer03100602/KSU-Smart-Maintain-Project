// ============================================================
// page.js — Sign In Page
// Route: /login
// ============================================================



import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from '@/context/AppContext';
import { LogIn, Mail, Lock, Loader, ArrowLeft, CheckCircle2, UserCheck, X } from 'lucide-react';
import { Link } from "react-router-dom";

export default function LoginPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const router = { push: (url) => navigate(url), replace: (url) => navigate(url, { replace: true }), back: () => navigate(-1), refresh: () => window.location.reload() };
    const { loginWithEmail, quickLoginUser, user, isGuest, signOutUser, toast } = useApp();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [savedAccounts, setSavedAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [quickLoggingInEmail, setQuickLoggingInEmail] = useState('');

    // Load saved / remembered account on initial mount
    useEffect(() => {
        try {
            const rawAccounts = localStorage.getItem('helpdesk_saved_accounts');
            if (rawAccounts) {
                const parsed = JSON.parse(rawAccounts);
                if (Array.isArray(parsed)) {
                    setSavedAccounts(parsed);
                }
            }

            const queryEmail = searchParams.get('email');
            if (queryEmail) {
                setEmail(queryEmail);
            } else {
                const rememberedEmail = localStorage.getItem('helpdesk_remembered_email');
                const rememberedPassword = localStorage.getItem('helpdesk_remembered_password');
                const isRemembered = localStorage.getItem('helpdesk_remember_login') !== 'false';
                
                setRememberMe(isRemembered);
                if (rememberedEmail && isRemembered) {
                    setEmail(rememberedEmail);
                    if (rememberedPassword) {
                        setPassword(rememberedPassword);
                    }
                }
            }
        } catch (e) {
            console.error('Error loading remembered account:', e);
        }
    }, [searchParams]);

    const handleSelectAccount = async (acc) => {
        if (quickLoggingInEmail || loading) return;
        setQuickLoggingInEmail(acc.email || '');
        setEmail(acc.email || '');
        if (acc.password) {
            setPassword(acc.password);
        }

        try {
            toast.info(`กำลังเข้าสู่ระบบในชื่อ ${acc.name || acc.email}...`);
            const loggedInUser = await quickLoginUser(acc);
            toast.success(`ยินดีต้อนรับคุณ ${loggedInUser?.name || acc.name || 'ผู้ดูแลระบบ'}`);
            router.push('/');
        } catch (err) {
            console.error('Quick login error:', err);
            setQuickLoggingInEmail('');
            toast.warning('กรุณากรอกรหัสผ่านเพื่อเข้าสู่ระบบ');
        }
    };

    const handleRemoveSavedAccount = (e, accEmail) => {
        e.stopPropagation();
        const updated = savedAccounts.filter(a => a.email.toLowerCase() !== accEmail.toLowerCase());
        setSavedAccounts(updated);
        localStorage.setItem('helpdesk_saved_accounts', JSON.stringify(updated));
        if (email.toLowerCase() === accEmail.toLowerCase()) {
            localStorage.removeItem('helpdesk_remembered_email');
            localStorage.removeItem('helpdesk_remembered_password');
        }
        toast.info('ลบบัญชีที่บันทึกไว้ออกจากเครื่องนี้แล้ว');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!email.trim() || !password.trim()) {
            toast.error('กรุณากรอกอีเมลและรหัสผ่าน');
            return;
        }

        setLoading(true);
        try {
            const cleanEmail = email.trim();
            const cleanPassword = password.trim();
            const loggedInUser = await loginWithEmail(cleanEmail, cleanPassword);

            // Handle Remember Me settings
            if (rememberMe) {
                localStorage.setItem('helpdesk_remember_login', 'true');
                localStorage.setItem('helpdesk_remembered_email', cleanEmail);
                localStorage.setItem('helpdesk_remembered_password', cleanPassword);
            } else {
                localStorage.setItem('helpdesk_remember_login', 'false');
                localStorage.removeItem('helpdesk_remembered_email');
                localStorage.removeItem('helpdesk_remembered_password');
            }

            toast.success(`เข้าสู่ระบบสำเร็จ ยินดีต้อนรับคุณ ${loggedInUser?.name || 'ผู้ใช้งาน'}`);
            router.push('/');
        } catch (error) {
            console.error('Login error:', error);
            toast.error(error.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-login fade-in" style={{ maxWidth: 460, margin: '3.5rem auto', padding: '1rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <Link to="/" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    กลับหน้าหลัก
                </Link>
            </div>

            <div className="glass-card" style={{ padding: '2.5rem 2rem' }}>
                {/* ── Status Banner if Already Logged In ── */}
                {!isGuest && user?.email && (
                    <div style={{
                        padding: '1.25rem',
                        borderRadius: '12px',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        marginBottom: '1.75rem',
                        textAlign: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#38bdf8', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.4rem' }}>
                            <UserCheck style={{ width: 20, height: 20 }} />
                            เข้าสู่ระบบอยู่แล้ว
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                            {user.name}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                            {user.email} • กลุ่ม: {user.group || user.role}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button 
                                type="button" 
                                onClick={() => router.push('/')} 
                                className="btn btn-primary btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                                <CheckCircle2 style={{ width: 16, height: 16 }} />
                                เข้าสู่หน้าหลักทันที
                            </button>
                            <button 
                                type="button" 
                                onClick={signOutUser} 
                                className="btn btn-ghost btn-sm"
                            >
                                สลับบัญชี / ออกจากระบบ
                            </button>
                        </div>
                    </div>
                )}

                <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                    <div style={{ 
                        width: 52, 
                        height: 52, 
                        borderRadius: '14px', 
                        background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        margin: '0 auto 1rem auto',
                        color: 'white',
                        boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)'
                    }}>
                        <LogIn style={{ width: 26, height: 26 }} />
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>เข้าสู่ระบบ</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                        ลงชื่อเข้าใช้งานระบบแจ้งซ่อมบำรุง มหาวิทยาลัยกาฬสินธุ์
                    </p>
                </div>

                {/* ── Saved Accounts Quick Switcher ── */}
                {savedAccounts.length > 0 && (
                    <div style={{
                        marginBottom: '1.5rem',
                        padding: '0.85rem',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)'
                    }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.6rem' }}>
                            ⚡ บัญชีที่จำไว้ในเครื่องนี้ (คลิกเพื่อเข้าสู่ระบบ):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {savedAccounts.map((acc, idx) => {
                                const isLoggingInThis = quickLoggingInEmail && quickLoggingInEmail.toLowerCase() === (acc.email || '').toLowerCase();
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => handleSelectAccount(acc)}
                                        title="คลิกเพื่อเข้าสู่ระบบบัญชีนี้ทันที"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            background: isLoggingInThis 
                                                ? 'rgba(59, 130, 246, 0.25)' 
                                                : (email.toLowerCase() === (acc.email || '').toLowerCase() ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.04)'),
                                            border: isLoggingInThis || email.toLowerCase() === (acc.email || '').toLowerCase() 
                                                ? '1px solid var(--primary-color)' 
                                                : '1px solid rgba(255, 255, 255, 0.08)',
                                            cursor: quickLoggingInEmail ? 'wait' : 'pointer',
                                            transition: 'all 0.15s ease',
                                            boxShadow: isLoggingInThis ? '0 0 12px rgba(59, 130, 246, 0.3)' : 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                                                {(acc.name || acc.email || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {acc.name || acc.email}
                                                    {isLoggingInThis && (
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--primary-color)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                            <Loader className="spin" style={{ width: 12, height: 12 }} />
                                                            กำลังเข้าสู่ระบบ...
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                                    {acc.email} • {acc.group || acc.role}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <button
                                                type="button"
                                                title="ลบบัญชีนี้ออกจากเครื่อง"
                                                onClick={(e) => handleRemoveSavedAccount(e, acc.email)}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                                            >
                                                <X style={{ width: 15, height: 15 }} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Mail style={{ width: 14, height: 14 }} />
                            อีเมล
                        </label>
                        <input 
                            type="email" 
                            className="form-input" 
                            placeholder="your-email@example.com" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Lock style={{ width: 14, height: 14 }} />
                            รหัสผ่าน
                        </label>
                        <input 
                            type="password" 
                            className="form-input" 
                            placeholder="••••••••" 
                            required 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    {/* ── Remember Me Checkbox ── */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            <input 
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                style={{ width: 16, height: 16, accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                            />
                            <span>จดจำการเข้าสู่ระบบในเครื่องนี้</span>
                        </label>
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-primary btn-lg" 
                        style={{ marginTop: '0.25rem', width: '100%', justifyContent: 'center' }}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader className="animate-spin" style={{ width: 18, height: 18, marginRight: 8 }} />
                                กำลังเข้าสู่ระบบ...
                            </>
                        ) : (
                            <>
                                <LogIn style={{ width: 18, height: 18, marginRight: 8 }} />
                                เข้าสู่ระบบ
                            </>
                        )}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    ยังไม่มีบัญชีผู้ใช้?{' '}
                    <Link to="/signup" style={{ color: 'var(--primary-color)', fontWeight: 600, textDecoration: 'none' }}>
                        สมัครสมาชิกที่นี่
                    </Link>
                </div>
            </div>
        </div>
    );
}
