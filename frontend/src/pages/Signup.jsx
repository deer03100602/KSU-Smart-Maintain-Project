// ============================================================
// page.js — Sign Up Page
// Route: /signup
// ============================================================



import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useApp } from '@/context/AppContext';
import { UserPlus, Mail, Lock, User, Loader, ArrowLeft, LogIn, CheckCircle2, UserCheck } from 'lucide-react';
import { Link } from "react-router-dom";

export default function SignupPage() {
    const navigate = useNavigate();
    const router = { push: (url) => navigate(url), replace: (url) => navigate(url, { replace: true }), back: () => navigate(-1), refresh: () => window.location.reload() };
    const { signUpWithEmail, user, isGuest, signOutUser, toast } = useApp();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [userGroup, setUserGroup] = useState('นักศึกษา');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [existingAccountEmail, setExistingAccountEmail] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setExistingAccountEmail(null);
        
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
            if (error.alreadyExists || (error.message && error.message.includes('ลงทะเบียน'))) {
                setExistingAccountEmail(email.trim());
                toast.info('อีเมลนี้เคยลงทะเบียนไว้แล้ว ท่านสามารถเข้าสู่ระบบได้ทันที');
            } else {
                const rawMsg = String(error?.message || '');
                const safeMsg = (rawMsg.includes('JSON') || rawMsg.includes('token') || rawMsg.includes('<'))
                    ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง'
                    : (rawMsg || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
                toast.error(safeMsg);
            }
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
                            เข้าสู่ระบบอยู่แล้ว ไม่จำเป็นต้องสมัครใหม่
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
                                ออกจากระบบเพื่อสมัครบัญชีใหม่
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Notice If Email Already Exists in Database ── */}
                {existingAccountEmail && (
                    <div style={{
                        padding: '1.1rem',
                        borderRadius: '10px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                        marginBottom: '1.5rem',
                        textAlign: 'center'
                    }}>
                        <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                            ℹ️ อีเมล "{existingAccountEmail}" เคยสมัครไว้แล้ว!
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 0.85rem 0' }}>
                            คุณมีบัญชีนี้อยู่ในระบบแล้ว ไม่ต้องสมัครใหม่ สามารถเข้าสู่ระบบได้เลย
                        </p>
                        <Link 
                            to={`/login?email=${encodeURIComponent(existingAccountEmail)}`}
                            className="btn btn-primary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '0 auto', textDecoration: 'none' }}
                        >
                            <LogIn style={{ width: 16, height: 16 }} />
                            เข้าสู่ระบบด้วยอีเมลนี้ทันที
                        </Link>
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
                        <UserPlus style={{ width: 26, height: 26 }} />
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>สมัครสมาชิก</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                        สร้างบัญชีสำหรับติดตามสถานะและรับการแจ้งเตือน
                    </p>
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
