// ============================================================
// page.js — Sign Up Page
// Route: /signup
// ============================================================

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { UserPlus, Mail, Lock, User, Loader, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SignupPage() {
    const router = useRouter();
    const { signUpWithEmail, toast } = useApp();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [userGroup, setUserGroup] = useState('นักศึกษา');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

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
            await signUpWithEmail(email.trim(), password.trim(), fullName.trim(), userGroup);
            toast.success('สมัครสมาชิกสำเร็จแล้ว! กรุณาตรวจสอบอีเมลยืนยันหรือเข้าสู่ระบบ');
            router.push('/login');
        } catch (error) {
            console.error('Signup error:', error);
            toast.error(error.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-signup fade-in" style={{ maxWidth: 450, margin: '4rem auto', padding: '1rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <Link href="/login" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    กลับหน้าเข้าสู่ระบบ
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
                        <UserPlus style={{ width: 24, height: 24 }} />
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
                    <Link href="/login" style={{ color: 'var(--primary-color)', fontWeight: 600, textDecoration: 'none' }}>
                        เข้าสู่ระบบที่นี่
                    </Link>
                </div>
            </div>
        </div>
    );
}
