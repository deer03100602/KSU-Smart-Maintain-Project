import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from '@/context/AppContext';
import { LogIn, Mail, Lock, Loader, ArrowLeft, Sparkles } from 'lucide-react';
import { Link } from "react-router-dom";

export default function LoginPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const router = { push: (url) => navigate(url), replace: (url) => navigate(url, { replace: true }), back: () => navigate(-1), refresh: () => window.location.reload() };
    const { loginWithEmail, loginWithGoogleCredential, loginWithGoogleRedirect, handleAuthSuccess, toast } = useApp();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [googleConfig, setGoogleConfig] = useState({ isConfigured: false, clientId: '' });

    // Handle OAuth callback parameters (when Google redirects back to /login?google_token=...&user=...)
    useEffect(() => {
        const token = searchParams.get('google_token') || searchParams.get('token');
        const userParam = searchParams.get('user');
        const errorParam = searchParams.get('error');

        if (errorParam) {
            toast.error(decodeURIComponent(errorParam));
            return;
        }

        if (token && userParam) {
            try {
                const userData = JSON.parse(decodeURIComponent(userParam));
                handleAuthSuccess({ token, user: userData });
                toast.success(`เข้าสู่ระบบด้วย Google สำเร็จ ยินดีต้อนรับคุณ ${userData.name || 'ผู้ใช้งาน'}`);
                navigate('/', { replace: true });
            } catch (err) {
                console.error('Failed to parse Google user payload:', err);
                toast.error('เกิดข้อผิดพลาดในการรับข้อมูลผู้ใช้จาก Google');
            }
        }
    }, [searchParams]);

    // Check Google OAuth backend configuration
    useEffect(() => {
        fetch('/api/auth/google/config')
            .then(res => res.json())
            .then(data => setGoogleConfig(data))
            .catch(() => {});
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!email.trim() || !password.trim()) {
            toast.error('กรุณากรอกอีเมลและรหัสผ่าน');
            return;
        }

        setLoading(true);
        try {
            const loggedInUser = await loginWithEmail(email.trim(), password.trim());
            toast.success(`เข้าสู่ระบบสำเร็จ ยินดีต้อนรับคุณ ${loggedInUser?.name || 'ผู้ใช้งาน'}`);
            router.push('/');
        } catch (error) {
            console.error('Login error:', error);
            toast.error(error.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        } finally {
            setLoading(false);
        }
    };

    // Google Sign-In Handler
    const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        try {
            // If Client ID is configured in backend, redirect to server-side Google OAuth
            if (googleConfig.isConfigured) {
                loginWithGoogleRedirect();
                return;
            }

            // If not yet configured on Google Cloud Console, offer simulated test login for developer
            const mockUser = {
                email: 'user.ksu@gmail.com',
                name: 'ผู้ใช้งาน Google (ทดสอบ SSO)',
                picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
            };

            const user = await loginWithGoogleCredential(null, mockUser);
            toast.success(`เข้าสู่ระบบด้วย Google สำเร็จ (โหมดทดสอบ) ยินดีต้อนรับคุณ ${user?.name}`);
            router.push('/');
        } catch (err) {
            console.error('Google login error:', err);
            toast.error(err.message || 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้');
        } finally {
            setGoogleLoading(false);
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

                {/* ── Google Single Sign-On (SSO) Button ── */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
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
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                            position: 'relative'
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
                                <span>เข้าสู่ระบบด้วย Google</span>
                            </>
                        )}
                    </button>
                    {!googleConfig.isConfigured && (
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.4rem' }}>
                            💡 โหมดพัฒนา: สามารถคลิกเพื่อทดสอบ Single Sign-On ได้ทันที
                        </div>
                    )}
                </div>

                {/* ── Divider ── */}
                <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', gap: '0.75rem' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)', opacity: 0.6 }}></div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        หรือเข้าสู่ระบบด้วยอีเมล
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)', opacity: 0.6 }}></div>
                </div>

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
                            disabled={loading || googleLoading}
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
                            disabled={loading || googleLoading}
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-primary btn-lg" 
                        style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
                        disabled={loading || googleLoading}
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

                <div style={{ marginTop: '1.25rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>🔑 บัญชีทดสอบเริ่มต้น:</div>
                    <div>• <strong>Admin:</strong> admin@ksu.ac.th (รหัส: admin1234)</div>
                    <div>• <strong>User:</strong> student@example.com (รหัส: password1234)</div>
                </div>
            </div>
        </div>
    );
}
