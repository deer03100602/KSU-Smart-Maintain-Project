// ============================================================
// page.js — Home Landing Page
// Route: / (Root)
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
    PlusCircle, List, CheckCircle, Clock, 
    AlertCircle, Ticket, CircleDot, Loader, CheckCircle2, 
    Zap, Edit3, Wrench 
} from 'lucide-react';
import TicketCard from '@/components/TicketCard';

export default function HomePage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch('/api/stats');
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (e) {
                console.error('Error fetching home stats:', e);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, []);

    const resolvedAndClosed = stats 
        ? (stats.byStatus['Resolved'] || 0) + (stats.byStatus['Closed'] || 0)
        : 0;

    return (
        <div className="page-home fade-in">
            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-content">
                    <div className="hero-badge">
                        <img src="/ksu-logo-icon.png" alt="KSU Smart Maintain" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                        KSU SMART MAINTAIN — มหาวิทยาลัยกาฬสินธุ์
                    </div>
                    <h1 className="hero-title">
                        ระบบแจ้งปัญหาซ่อมบำรุง<br />
                        <span className="gradient-text">และติดตามสถานะด้วย AI</span>
                    </h1>
                    <p className="hero-description">
                        แจ้งปัญหาอาคารสถานที่ ห้องเรียน อุปกรณ์ด้านไอที หรือสาธารณูปโภคภายในมหาวิทยาลัย
                        พร้อมระบบติดตามสถานะการแก้ไขแบบ Real-time
                    </p>
                    <div className="hero-actions">
                        <Link href="/create" className="btn btn-primary btn-lg">
                            <PlusCircle style={{ width: 18, height: 18 }} />
                            แจ้งปัญหาใหม่
                        </Link>
                        <Link href="/tickets" className="btn btn-ghost btn-lg">
                            <List style={{ width: 18, height: 18 }} />
                            ดูรายการ Ticket
                        </Link>
                    </div>
                </div>
                <div className="hero-visual">
                    <div className="hero-illustration">
                        <div className="floating-card fc-1">
                            <CheckCircle style={{ width: 24, height: 24, color: '#4ade80' }} />
                            <span>Resolved</span>
                        </div>
                        <div className="floating-card fc-2">
                            <Clock style={{ width: 24, height: 24, color: '#fbbf24' }} />
                            <span>In Progress</span>
                        </div>
                        <div className="floating-card fc-3">
                            <AlertCircle style={{ width: 24, height: 24, color: '#60a5fa' }} />
                            <span>New Ticket</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Cards */}
            <section className="stats-section">
                <div className="stats-grid">
                    <div className="stat-card stat-total">
                        <div className="stat-icon">
                            <Ticket style={{ width: 24, height: 24 }} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-number">
                                {loading ? '...' : (stats?.total || 0)}
                            </span>
                            <span className="stat-label">Ticket ทั้งหมด</span>
                        </div>
                    </div>
                    
                    <div className="stat-card stat-open">
                        <div className="stat-icon">
                            <CircleDot style={{ width: 24, height: 24 }} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-number">
                                {loading ? '...' : (stats?.byStatus['Open'] || 0)}
                            </span>
                            <span className="stat-label">รอรับเรื่อง</span>
                        </div>
                    </div>
                    
                    <div className="stat-card stat-progress">
                        <div className="stat-icon">
                            <Loader style={{ width: 24, height: 24 }} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-number">
                                {loading ? '...' : (stats?.byStatus['In Progress'] || 0)}
                            </span>
                            <span className="stat-label">กำลังดำเนินการ</span>
                        </div>
                    </div>
                    
                    <div className="stat-card stat-resolved">
                        <div className="stat-icon">
                            <CheckCircle2 style={{ width: 24, height: 24 }} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-number">
                                {loading ? '...' : resolvedAndClosed}
                            </span>
                            <span className="stat-label">แก้ไขแล้ว</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Recent Tickets */}
            <section className="recent-section">
                <div className="section-header">
                    <h2 className="section-title">
                        <Clock style={{ width: 20, height: 20 }} />
                        Ticket ล่าสุด
                    </h2>
                    <Link href="/tickets" className="btn btn-ghost btn-sm">ดูทั้งหมด →</Link>
                </div>
                <div className="recent-tickets" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {loading ? (
                        <p className="text-muted">กำลังโหลด...</p>
                    ) : stats?.recentTickets?.length > 0 ? (
                        stats.recentTickets.map(t => (
                            <TicketCard key={t.id} ticket={t} />
                        ))
                    ) : (
                        <p className="text-muted">ยังไม่มี Ticket ในระบบ</p>
                    )}
                </div>
            </section>

            {/* How it works */}
            <section className="how-section">
                <h2 className="section-title center-text">
                    <Zap style={{ width: 20, height: 20 }} />
                    ขั้นตอนการใช้งาน
                </h2>
                <div className="steps-grid">
                    <div className="step-card">
                        <div className="step-number">1</div>
                        <div className="step-icon"><Edit3 style={{ width: 28, height: 28 }} /></div>
                        <h3>แจ้งปัญหา</h3>
                        <p>กรอกแบบฟอร์มแจ้งปัญหาพร้อมรายละเอียด</p>
                    </div>
                    <div className="step-card">
                        <div className="step-number">2</div>
                        <div className="step-icon"><Ticket style={{ width: 28, height: 28 }} /></div>
                        <h3>รับ Ticket ID</h3>
                        <p>ระบบสร้างเลข Ticket สำหรับติดตามสถานะ</p>
                    </div>
                    <div className="step-card">
                        <div className="step-number">3</div>
                        <div className="step-icon"><Wrench style={{ width: 28, height: 28 }} /></div>
                        <h3>ดำเนินการแก้ไข</h3>
                        <p>เจ้าหน้าที่รับเรื่องและดำเนินการแก้ไข</p>
                    </div>
                    <div className="step-card">
                        <div className="step-number">4</div>
                        <div className="step-icon"><CheckCircle style={{ width: 28, height: 28 }} /></div>
                        <h3>ปัญหาได้รับการแก้ไข</h3>
                        <p>ติดตามผลและปิดงานเมื่อเสร็จสิ้น</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
