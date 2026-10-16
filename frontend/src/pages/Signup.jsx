// ============================================================
// page.js — Sign Up Page
// Route: /signup
// ============================================================



import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApp } from '@/context/AppContext';
import { UserPlus, Mail, Lock, User, Loader, ArrowLeft } from 'lucide-react';
import { Link } from "react-router-dom";

export default function SignupPage() {
    const navigate = useNavigate();
    const router = { push: (url) => navigate(url), replace: (url) => navigate(url, { replace: true }), back: () => navigate(-1), refresh: () => window.location.reload() };
    const { signUpWithEmail, loginWithGoogleCredential, loginWithGoogleRedirect, toast } = useApp();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [userGroup, setUserGroup] = useState('นักศึกษา');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [googleConfig, setGoogleConfig] = useState({ isConfigured: false });

    useEffect(() => {
        fetch('/api/auth/google/config')
            .then(res => res.json())
            .then(data => setGoogleConfig(data))
            .catch(() => {});
    }, []);

    const handleGoogleSignUp = () => {
        setGoogleLoading(true);
        window.location.href = '/api/auth/google';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!fullName.trim() || !email.trim() || !password.trim()) {
            toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }

        if (password.length < 6) {
            toast.error('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
            return;
        }

        setLoading(true);
        try {
            const newUser = await signUpWithEmail(email.trim(), password.trim(), fullName.trim(), userGroup);
            toast.success(`สมัครสมาชิกและเข้าสู่ระบบสำเร็จ ยินดีต้อนรับคุณ ${newUser?.name || fullName.trim()}`);
            router.push('/');
        } catch (error) {
            console.error('Signup error:', error);
            toast.error(error.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-signup fade-in" style={{ maxWidth: 460, margin: '3.5rem auto', padding: '1rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <Link to="/login" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    กลับหน้าเข้าสู่ระบบ
                </Link>
            </div>

            <div className="glass-card" style={{ padding: '2.5rem 2rem' }}>
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
                        <UserPlus style={{ width: 26, height: 26 }} />
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>สมัครสมาชิก</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                        สร้างบัญชีสำหรับติดตามสถานะและรับการแจ้งเตือน
                    </p>
                </div>

                {/* ── Google Single Sign-On Button ── */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <button
                        type="button"
                        onClick={handleGoogleSignUp}
                        disabled={googleLoading || loading}
                        style={{
                            width: '100%',
                            padding: '11px 16px',
                            borderRadius: '10px',
                            background: '#ffffff',
                            color: '#1f2937',
                            border: '1px solid #d1d5db',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f9fafb';
                            e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.14)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#ffffff';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.08)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        {googleLoading ? (
                            <>
                                <Loader className="animate-spin" style={{ width: 20, height: 20, color: '#4285F4' }} />
                                <span>กำลังเชื่อมต่อ Google...</span>
                            </>
                        ) : (
                            <>
                                <svg width="20" height="20" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                                </svg>
                                <span>สมัคร / เข้าสู่ระบบด้วย Google</span>
                            </>
                        )}
                    </button>
                </div>

                {/* ── Divider ── */}
                <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', gap: '0.75rem' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)', opacity: 0.6 }}></div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        หรือลงทะเบียนด้วยอีเมล
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)', opacity: 0.6 }}></div>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <User style={{ width: 14, height: 14 }} />
                            ชื่อ-นามสกุล
                        </label>
                        <input 
                            type="text" 
                            className="form-input" 
                            placeholder="สมชาย รักดี" 
                            required 
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            disabled={loading}
                        />
                    </div>

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
                            กลุ่มผู้ใช้งาน
                        </label>
                        <select 
                            className="form-input form-select"
                            required
                            value={userGroup}
                            onChange={(e) => setUserGroup(e.target.value)}
                            disabled={loading}
                        >
                            <option value="นักศึกษา">นักศึกษา</option>
                            <option value="อาจารย์">อาจารย์</option>
                            <option value="เจ้าหน้าที่">เจ้าหน้าที่</option>
                            <option value="เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์">เจ้าหน้าที่ IT / ผู้ดูแลอุปกรณ์</option>
                            <option value="ผู้ดูแลระบบ">ผู้ดูแลระบบ</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Lock style={{ width: 14, height: 14 }} />
                            รหัสผ่าน
                        </label>
                        <input 
                            type="password" 
                            className="form-input" 
                            placeholder="อย่างน้อย 6 ตัวอักษร" 
                            required 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-primary btn-lg" 
                        style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader className="animate-spin" style={{ width: 18, height: 18, marginRight: 8 }} />
                                กำลังส่งข้อมูล...
                            </>
                        ) : (
                            <>
                                <UserPlus style={{ width: 18, height: 18, marginRight: 8 }} />
                                ลงทะเบียน
                            </>
                        )}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    มีบัญชีผู้ใช้แล้ว?{' '}
                    <Link to="/login" style={{ color: 'var(--primary-color)', fontWeight: 600, textDecoration: 'none' }}>
                        เข้าสู่ระบบที่นี่
                    </Link>
                </div>
            </div>
        </div>
    );
}
