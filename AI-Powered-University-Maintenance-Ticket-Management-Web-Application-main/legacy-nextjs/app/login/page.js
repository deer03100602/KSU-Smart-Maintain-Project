// ============================================================
// page.js — Sign In Page
// Route: /login
// ============================================================

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { LogIn, Mail, Lock, Loader, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const { loginWithEmail, toast } = useApp();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!email.trim() || !password.trim()) {
            toast.error('กรุณากรอกอีเมลและรหัสผ่าน');
            return;
        }

        setLoading(true);
        try {
            await loginWithEmail(email.trim(), password.trim());
            toast.success('เข้าสู่ระบบสำเร็จ');
            router.push('/');
        } catch (error) {
            console.error('Login error:', error);
            if (error.message && error.message.toLowerCase().includes('email not confirmed')) {
                toast.error('กรุณายืนยันอีเมลของคุณในกล่องข้อความก่อนเข้าใช้งาน หรือปิดตัวเลือก "Confirm email" ในแผงควบคุมของ Supabase Auth');
            } else {
                toast.error(error.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-login fade-in" style={{ maxWidth: 450, margin: '4rem auto', padding: '1rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <Link href="/" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    กลับหน้าหลัก
                </Link>
            </div>

            <div className="glass-card" style={{ padding: '2.5rem 2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ 
                        width: 50, 
                        height: 50, 
                        borderRadius: '12px', 
                        background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        margin: '0 auto 1rem auto',
                        color: 'white',
                        boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)'
                    }}>
                        <LogIn style={{ width: 24, height: 24 }} />
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>เข้าสู่ระบบ</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                        ลงชื่อเข้าใช้งานสำหรับเวอร์ชันเสริมเชื่อมต่อ Supabase
                    </p>
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

                    <button 
                        type="submit" 
                        className="btn btn-primary btn-lg" 
                        style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
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
                    <Link href="/signup" style={{ color: 'var(--primary-color)', fontWeight: 600, textDecoration: 'none' }}>
                        สมัครสมาชิกที่นี่
                    </Link>
                </div>
            </div>
        </div>
    );
}
