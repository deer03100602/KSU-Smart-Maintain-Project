// ============================================================
// Navbar.js — Top Navigation Bar & Responsive Mobile Drawer
// ============================================================

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import {
    Home, PlusCircle, List, User, Shield,
    BarChart3, Settings, X, Menu, ShieldCheck, UserCircle, LogIn, LogOut,
    Sun, Moon
} from 'lucide-react';

export default function Navbar() {
    const pathname = usePathname();
    const { role, setRole, user, signOutUser, isRealAuth, MOCK_PROFILES, switchMockProfile, theme, toggleTheme } = useApp();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const isAdmin = role === 'admin';

    const userMenuItems = [
        { href: '/', icon: <Home style={{ width: 17, height: 17 }} />, label: 'หน้าหลัก', id: 'home' },
        { href: '/create', icon: <PlusCircle style={{ width: 17, height: 17 }} />, label: 'แจ้งปัญหาใหม่', id: 'create' },
        { href: '/tickets', icon: <List style={{ width: 17, height: 17 }} />, label: 'รายการ Ticket', id: 'tickets' },
        { href: '/my-tickets', icon: <User style={{ width: 17, height: 17 }} />, label: 'ปัญหาของฉัน', id: 'my-tickets' },
        { href: '/dashboard', icon: <BarChart3 style={{ width: 17, height: 17 }} />, label: 'Dashboard', id: 'dashboard' }
    ];

    const adminMenuItems = [
        { href: '/', icon: <Home style={{ width: 17, height: 17 }} />, label: 'หน้าหลัก', id: 'home' },
        { href: '/create', icon: <PlusCircle style={{ width: 17, height: 17 }} />, label: 'แจ้งปัญหาใหม่', id: 'create' },
        { href: '/tickets', icon: <List style={{ width: 17, height: 17 }} />, label: 'รายการ Ticket', id: 'tickets' },
        { href: '/admin', icon: <Shield style={{ width: 17, height: 17 }} />, label: 'จัดการ Ticket', id: 'admin' },
        { href: '/dashboard', icon: <BarChart3 style={{ width: 17, height: 17 }} />, label: 'Dashboard', id: 'dashboard' },
        { href: '/issue-types', icon: <Settings style={{ width: 17, height: 17 }} />, label: 'จัดการประเภท', id: 'issue-types' }
    ];

    const menuItems = isAdmin ? adminMenuItems : userMenuItems;

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const isActive = (href) => {
        if (href === '/') {
            return pathname === '/';
        }
        return pathname.startsWith(href);
    };

    return (
        <>
            {/* Top Navigation Bar (Desktop & Mobile Header) */}
            <header className="top-navbar">
                <div className="top-navbar-container">
                    {/* Brand / Logo */}
                    <Link href="/" className="top-navbar-logo" onClick={() => setSidebarOpen(false)}>
                        <div className="logo-icon" style={{ background: 'transparent', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src="/ksu-logo-icon.png" alt="KSU Smart Maintain" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <div className="logo-text">
                            <h1 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, lineHeight: 1.15 }}>KSU SMART MAINTAIN</h1>
                            <span className="logo-subtitle" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>ระบบแจ้งซ่อมสิ่งพาณิชย์และอุปกรณ์อัจฉริยะ ม.กาฬสินธุ์</span>
                        </div>
                    </Link>

                    {/* Desktop Navigation Links */}
                    <nav className="top-nav">
                        {menuItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`top-nav-item ${isActive(item.href) ? 'top-nav-item-active' : ''}`}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </nav>

                    {/* Desktop Actions & User Profile */}
                    <div className="top-navbar-actions">
                        {/* Theme Toggle Button */}
                        <button
                            className="theme-toggle-btn"
                            onClick={toggleTheme}
                            title={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
                            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}
                        >
                            {theme === 'dark' ? <Sun style={{ width: 17, height: 17 }} /> : <Moon style={{ width: 17, height: 17 }} />}
                        </button>


                        {/* User Profile Pill */}
                        <div className="top-user-profile">
                            <div className="user-avatar" style={{ width: 28, height: 28, fontSize: '0.8rem' }}>
                                {isAdmin ? (
                                    <ShieldCheck style={{ width: 16, height: 16, color: 'var(--primary-color)' }} />
                                ) : (
                                    <UserCircle style={{ width: 16, height: 16 }} />
                                )}
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 95, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.name || (isAdmin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน')}
                            </span>
                            <span className={`user-role-badge ${isAdmin ? 'admin-badge' : 'user-badge'}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                                {isAdmin ? 'Admin' : 'User'}
                            </span>
                        </div>

                        {/* Login / Logout Button */}
                        {isRealAuth ? (
                            <button
                                onClick={signOutUser}
                                className="btn btn-ghost btn-sm"
                                title="ออกจากระบบ"
                                style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                            >
                                <LogOut style={{ width: 15, height: 15 }} />
                                <span>ออก</span>
                            </button>
                        ) : (
                            <Link
                                href="/login"
                                className="btn btn-primary btn-sm"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}
                            >
                                <LogIn style={{ width: 15, height: 15 }} />
                                <span>เข้าสู่ระบบ</span>
                            </Link>
                        )}
                    </div>

                    {/* Mobile Controls (< 1024px) */}
                    <div className="mobile-nav-controls">
                        <button
                            className="theme-toggle-btn"
                            onClick={toggleTheme}
                            title={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
                            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        >
                            {theme === 'dark' ? <Sun style={{ width: 17, height: 17 }} /> : <Moon style={{ width: 17, height: 17 }} />}
                        </button>
                        <button className="hamburger-btn" onClick={toggleSidebar} aria-label="เมนู">
                            <Menu style={{ width: 22, height: 22 }} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Drawer Overlay */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'overlay-active' : ''}`}
                onClick={toggleSidebar}
            ></div>

            {/* Mobile Navigation Drawer (< 1024px) */}
            <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <div className="logo-icon" style={{ background: 'transparent', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src="/ksu-logo-icon.png" alt="KSU Smart Maintain" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <div className="logo-text">
                            <h1 style={{ fontSize: '1.05rem' }}>KSU SMART MAINTAIN</h1>
                            <span>ระบบแจ้งซ่อมสิ่งพาณิชย์และอุปกรณ์อัจฉริยะ</span>
                        </div>
                    </div>
                    <button className="sidebar-close-btn" onClick={toggleSidebar}>
                        <X style={{ width: 20, height: 20 }} />
                    </button>
                </div>

                {/* Theme Switcher in Sidebar */}
                <div style={{ padding: '1rem 1.25rem 0.25rem' }}>
                    <button
                        onClick={toggleTheme}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '0.65rem 1rem',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.88rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {theme === 'dark' ? (
                            <>
                                <Sun style={{ width: 18, height: 18, color: '#fbbf24' }} />
                                <span>โหมดสว่าง</span>
                            </>
                        ) : (
                            <>
                                <Moon style={{ width: 18, height: 18, color: '#818cf8' }} />
                                <span>โหมดมืด</span>
                            </>
                        )}
                    </button>
                </div>

                <div className="role-switcher">
                    <div className="role-switcher-label">สลับกลุ่มผู้ใช้งาน</div>
                    {isRealAuth ? (
                        <div style={{
                            padding: '8px 12px',
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            textAlign: 'center'
                        }}>
                            ใช้บัญชีจริง
                        </div>
                    ) : (
                        <select
                            className="form-input form-select"
                            style={{
                                width: '100%',
                                fontSize: '0.85rem',
                                padding: '0.4rem 0.5rem',
                                borderRadius: '6px',
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)'
                            }}
                            value={MOCK_PROFILES?.findIndex(p => p.group === user?.group)}
                            onChange={(e) => {
                                const idx = parseInt(e.target.value, 10);
                                if (idx >= 0 && idx < MOCK_PROFILES.length) {
                                    switchMockProfile(idx);
                                }
                                setSidebarOpen(false);
                            }}
                        >
                            {MOCK_PROFILES?.map((p, idx) => (
                                <option key={idx} value={idx}>
                                    {p.group}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <nav className="sidebar-nav">
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-item ${isActive(item.href) ? 'nav-item-active' : ''}`}
                            onClick={() => setSidebarOpen(false)}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user-info" style={{ flexDirection: 'column', gap: '0.75rem', alignItems: 'stretch', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div className="user-avatar">
                                {isAdmin ? (
                                    <ShieldCheck style={{ width: 20, height: 20, color: 'var(--primary-color)' }} />
                                ) : (
                                    <UserCircle style={{ width: 20, height: 20 }} />
                                )}
                            </div>
                            <div className="user-details" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <span className="user-name" style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', fontWeight: 600 }}>
                                    {user?.name || (isAdmin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน')}
                                </span>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span className={`user-role-badge ${isAdmin ? 'admin-badge' : 'user-badge'}`} style={{ fontSize: '0.65rem', padding: '1px 4px' }}>
                                        {isAdmin ? 'Admin' : 'User'} {isRealAuth ? '(Auth)' : ''}
                                    </span>
                                    <span className="user-role-badge" style={{
                                        fontSize: '0.65rem',
                                        padding: '1px 4px',
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        color: '#60a5fa',
                                        border: '1px solid rgba(59, 130, 246, 0.3)'
                                    }}>
                                        {user?.group || 'นักศึกษา'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {isRealAuth ? (
                            <button
                                onClick={signOutUser}
                                className="btn btn-ghost btn-sm"
                                style={{ width: '100%', justifyContent: 'center', padding: '0.4rem', fontSize: '0.85rem', color: '#f87171', display: 'flex', alignItems: 'center' }}
                            >
                                <LogOut style={{ width: 14, height: 14, marginRight: 6 }} />
                                ออกจากระบบ
                            </button>
                        ) : (
                            <Link
                                href="/login"
                                className="btn btn-primary btn-sm"
                                style={{ width: '100%', justifyContent: 'center', padding: '0.4rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', textDecoration: 'none' }}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <LogIn style={{ width: 14, height: 14, marginRight: 6 }} />
                                เข้าสู่ระบบ
                            </Link>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
}

