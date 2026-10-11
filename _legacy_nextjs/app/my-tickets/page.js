// ============================================================
// page.js — My Tickets Page
// Route: /my-tickets
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { User, Plus, UserCircle, Save } from 'lucide-react';
import { TicketGrid } from '@/components/TicketCard';

export default function MyTicketsPage() {
    const { user, setUser, toast, isRealAuth } = useApp();
    
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profileName, setProfileName] = useState(user.name);
    const [profileEmail, setProfileEmail] = useState(user.email);
    const [profileGroup, setProfileGroup] = useState(user.group || 'นักศึกษา');

    // Fetch user-specific tickets
    const fetchMyTickets = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (isRealAuth) {
                params.append('requester_email', user.email);
            } else {
                params.append('requester_name', user.name);
            }
            
            const res = await fetch(`/api/tickets?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setTickets(data);
            }
        } catch (e) {
            console.error('Error fetching my tickets:', e);
            toast.error('ไม่สามารถโหลดรายการปัญหาได้');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setProfileName(user.name);
        setProfileEmail(user.email);
        setProfileGroup(user.group || 'นักศึกษา');
    }, [user]);

    useEffect(() => {
        fetchMyTickets();
    }, [user.name, user.email, isRealAuth]);

    const handleProfileSubmit = (e) => {
        e.preventDefault();
        if (isRealAuth) return;
        if (!profileName.trim()) {
            toast.error('กรุณากรอกชื่อผู้แจ้ง');
            return;
        }

        setUser(profileName.trim(), profileEmail.trim(), profileGroup);
        toast.success('อัปเดตข้อมูลผู้ใช้งานจำลองแล้ว');
    };

    return (
        <div className="page-my-tickets fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1 className="page-title">
                        <User style={{ width: 24, height: 24, marginRight: 8, display: 'inline', verticalAlign: 'middle' }} />
                        ปัญหาของฉัน
                    </h1>
                    <p className="page-subtitle">ติดตามสถานะปัญหาที่คุณแจ้งไว้เข้าระบบทั้งหมด</p>
                </div>
                <Link href="/create" className="btn btn-primary">
                    <Plus style={{ width: 16, height: 16 }} />
                    แจ้งปัญหาใหม่
                </Link>
            </div>

            {/* Profile / Filter settings */}
            <div className="profile-card glass-card">
                <div className="profile-icon">
                    <UserCircle style={{ width: 48, height: 48, color: 'var(--primary-color)' }} />
                </div>
                <div className="profile-details">
                    <h3>{isRealAuth ? 'โปรไฟล์ผู้ใช้งานจริง (Supabase Auth)' : 'โปรไฟล์ผู้แจ้งปัญหา'}</h3>
                    <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                        {isRealAuth 
                            ? 'ระบบยืนยันตัวตนของคุณเรียบร้อยแล้วและคัดกรองข้อมูลปัญหาตามอีเมลจริงของคุณโดยอัตโนมัติเพื่อความปลอดภัย' 
                            : 'ระบบระบุตัวตนของคุณจากชื่อผู้แจ้งด้านล่างนี้เพื่อกรองแสดงเฉพาะรายการของคุณ'}
                    </p>
                    
                    <form className="profile-form" onSubmit={handleProfileSubmit}>
                        <div className="form-row" style={{ alignItems: 'flex-end' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">ชื่อผู้แจ้ง</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    value={profileName} 
                                    onChange={(e) => setProfileName(e.target.value)}
                                    required 
                                    disabled={isRealAuth}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">อีเมล</label>
                                <input 
                                    type="email" 
                                    className="form-input" 
                                    value={profileEmail} 
                                    onChange={(e) => setProfileEmail(e.target.value)}
                                    disabled={isRealAuth}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">กลุ่มผู้ใช้งาน</label>
                                <select 
                                    className="form-input form-select"
                                    value={profileGroup}
                                    onChange={(e) => setProfileGroup(e.target.value)}
                                    disabled={isRealAuth}
                                >
                                    <option value="นักศึกษา">นักศึกษา</option>
                                    <option value="อาจารย์">อาจารย์</option>
                                    <option value="เจ้าหน้าที่">เจ้าหน้าที่</option>
                                    <option value="เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์">เจ้าหน้าที่ IT / ผู้ดูแลอุปกรณ์</option>
                                    <option value="ผู้ดูแลระบบ">ผู้ดูแลระบบ</option>
                                </select>
                            </div>
                            {!isRealAuth && (
                                <div className="form-group btn-group-align" style={{ marginBottom: 0 }}>
                                    <button type="submit" className="btn btn-ghost btn-sm">
                                        <Save style={{ width: 14, height: 14 }} />
                                        อัปเดตและกรอง
                                    </button>
                                </div>
                            )}
                        </div>
                    </form>
                </div>
            </div>

            {/* My Tickets Container */}
            <div className="results-header">
                <span className="results-count">
                    {loading ? 'กำลังโหลด...' : `พบปัญหาของคุณ ${tickets.length} รายการ`}
                </span>
            </div>
            
            <div id="my-tickets-container">
                {loading ? (
                    <p className="text-muted" style={{ textAlign: 'center', padding: '3rem' }}>กำลังโหลดปัญหาของคุณ...</p>
                ) : (
                    <TicketGrid tickets={tickets} />
                )}
            </div>
        </div>
    );
}
