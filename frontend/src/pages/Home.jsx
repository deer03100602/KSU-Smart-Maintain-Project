// ============================================================
// page.js — Home Landing Page
// Route: / (Root)
// ============================================================



import React, { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import { 
    PlusCircle, List, CheckCircle, Clock, 
    AlertCircle, Ticket, CircleDot, Loader, CheckCircle2, 
    Zap, Edit3, Wrench 
} from 'lucide-react';
import TicketCard from '@/components/TicketCard';
import { getStoredTickets, mergeTicketsWithStorage, syncTicketsWithServer } from '@/lib/ticketStore';
import { useApp } from '@/context/AppContext';

export default function HomePage() {
    const { isGuest } = useApp();
    const buildInitialStats = (stored) => {
        if (!Array.isArray(stored) || stored.length === 0) return null;
        const byStatus = {
            'Open': 0,
            'In Progress': 0,
            'Waiting for Information': 0,
            'Resolved': 0,
            'Closed': 0,
            'Cancelled': 0
        };
        stored.forEach(t => {
            if (byStatus[t.status] !== undefined) byStatus[t.status]++;
        });
        return {
            total: stored.length,
            byStatus,
            recentTickets: stored.slice(0, 5)
        };
    };

    const [stats, setStats] = useState(() => buildInitialStats(getStoredTickets()));
    const [loading, setLoading] = useState(() => !getStoredTickets().length);

    useEffect(() => {
        const refreshFromLocal = () => {
            const stored = getStoredTickets();
            const localStats = buildInitialStats(stored);
            if (localStats) {
                setStats(prev => ({
                    ...(prev || {}),
                    ...localStats,
                    byStatus: { ...((prev && prev.byStatus) || {}), ...localStats.byStatus },
                    recentTickets: localStats.recentTickets
                }));
                setLoading(false);
            }
        };

        window.addEventListener('ksu_ticket_updated', refreshFromLocal);
        window.addEventListener('ksu_ticket_deleted', refreshFromLocal);
        window.addEventListener('ksu_tickets_resequenced', refreshFromLocal);

        async function fetchStats() {
            try {
                const res = await fetch('/api/stats');
                if (res.ok) {
                    const data = await res.json();
                    const mergedRecent = mergeTicketsWithStorage(data.recentTickets || []);
                    const allStored = getStoredTickets();
                    const localStats = buildInitialStats(allStored);

                    if (localStats) {
                        setStats({
                            ...data,
                            total: Math.max(data.total || 0, allStored.length),
                            byStatus: {
                                ...(data.byStatus || {}),
                                ...localStats.byStatus
                            },
                            recentTickets: mergedRecent.slice(0, 5)
                        });
                        syncTicketsWithServer(allStored).catch(() => {});
                    } else {
                        setStats(data);
                    }
                }
            } catch (e) {
                console.error('Error fetching home stats:', e);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();

        return () => {
            window.removeEventListener('ksu_ticket_updated', refreshFromLocal);
            window.removeEventListener('ksu_ticket_deleted', refreshFromLocal);
            window.removeEventListener('ksu_tickets_resequenced', refreshFromLocal);
        };
    }, []);

    const resolvedAndClosed = stats 
        ? ((stats.byStatus && stats.byStatus['Resolved']) || 0) + ((stats.byStatus && stats.byStatus['Closed']) || 0)
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
                        {!isGuest && (
                            <Link to="/create" className="btn btn-primary btn-lg">
                                <PlusCircle style={{ width: 18, height: 18 }} />
                                แจ้งปัญหาใหม่
                            </Link>
                        )}
                        <Link to="/tickets" className={`btn ${isGuest ? 'btn-primary' : 'btn-ghost'} btn-lg`}>
                            <List style={{ width: 18, height: 18 }} />
                            ดูรายการ Ticket ทั้งหมด
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
                    <Link to="/tickets" className="btn btn-ghost btn-sm">ดูทั้งหมด →</Link>
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
