// ============================================================
// AppContext.js — Unified React Context for Role, Profile, Toasts, and Modals
// Mini Helpdesk / Issue Tracking System
// ============================================================

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ToastContainer, ToastElement } from '@/components/Toast';
import { ModalContainer } from '@/components/Modal';
import { supabase } from '@/lib/db';

const AppContext = createContext();

export const MOCK_PROFILES = [
    {
        name: '',
        email: '',
        group: 'นักศึกษา',
        role: 'user'
    },
    {
        name: '',
        email: '',
        group: 'อาจารย์',
        role: 'user'
    },
    {
        name: '',
        email: '',
        group: 'เจ้าหน้าที่',
        role: 'user'
    },
    {
        name: '',
        email: '',
        group: 'เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์',
        role: 'admin'
    },
    {
        name: '',
        email: '',
        group: 'ผู้ดูแลระบบ',
        role: 'admin'
    }
];

export function AppProvider({ children }) {
    // ── Simulated or Real Role ──────────────────────────────────────
    const [role, setRoleState] = useState('user');
    
    // ── Simulated or Real User Profile ──────────────────────────────
    const [user, setUserState] = useState({ name: '', email: '', group: 'นักศึกษา' });
    
    // ── Toast Notifications State ───────────────────────────
    const [toasts, setToasts] = useState([]);
    
    // ── Modal Confirmation Dialog State ──────────────────────
    const [modal, setModal] = useState(null);

    // ── Theme State ─────────────────────────────────────────
    const [theme, setTheme] = useState('dark');

    const loadSimulatedUser = () => {
        const storedRole = localStorage.getItem('helpdesk_current_role') || 'user';
        setRoleState(storedRole);

        const storedUser = localStorage.getItem('helpdesk_current_user');
        if (storedUser) {
            try {
                setUserState(JSON.parse(storedUser));
            } catch (e) {
                console.error(e);
                setUserState({ name: '', email: '', group: 'นักศึกษา' });
            }
        } else {
            setUserState({ name: '', email: '', group: 'นักศึกษา' });
        }
    };

    // Initial auth load from persistent storage
    useEffect(() => {
        loadSimulatedUser();
    }, []);

    // ── Load and apply theme ────────────────────────────────
    useEffect(() => {
        const savedTheme = localStorage.getItem('helpdesk_theme') || 'dark';
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.documentElement.style.colorScheme = savedTheme;
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('helpdesk_theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        document.documentElement.style.colorScheme = newTheme;
    };

    const handleAuthSuccess = (result) => {
        const loggedInUser = result.user;
        setUserState(loggedInUser);
        localStorage.setItem('helpdesk_current_user', JSON.stringify(loggedInUser));

        const userRole = loggedInUser.role || (
            loggedInUser.email.toLowerCase().includes('admin') ||
            loggedInUser.group === 'ผู้ดูแลระบบ' ||
            loggedInUser.group === 'เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์'
                ? 'admin'
                : 'user'
        );
        setRoleState(userRole);
        localStorage.setItem('helpdesk_current_role', userRole);
        if (result.token) {
            localStorage.setItem('helpdesk_token', result.token);
        }
        return loggedInUser;
    };

    // Auth methods
    const loginWithEmail = async (email, password) => {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        }
        return handleAuthSuccess(result);
    };

    const loginWithGoogleCredential = async (credential, mockUser = null) => {
        const response = await fetch('/api/auth/google', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ credential, mockUser }),
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ');
        }
        return handleAuthSuccess(result);
    };

    const loginWithGoogleRedirect = () => {
        window.location.href = '/api/auth/google';
    };

    const signUpWithEmail = async (email, password, fullName, userGroup = 'นักศึกษา') => {
        const response = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password, fullName, userGroup }),
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
        }
        const newUser = result.user;
        if (newUser) {
            setUserState(newUser);
            localStorage.setItem('helpdesk_current_user', JSON.stringify(newUser));
            const userRole = newUser.role || (
                newUser.email.toLowerCase().includes('admin') ||
                newUser.group === 'ผู้ดูแลระบบ' ||
                newUser.group === 'เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์'
                    ? 'admin'
                    : 'user'
            );
            setRoleState(userRole);
            localStorage.setItem('helpdesk_current_role', userRole);
            if (result.token) {
                localStorage.setItem('helpdesk_token', result.token);
            }
        }
        return newUser;
    };

    const signOutUser = async () => {
        localStorage.removeItem('helpdesk_current_user');
        localStorage.removeItem('helpdesk_current_role');
        localStorage.removeItem('helpdesk_token');
        setUserState({ name: '', email: '', group: 'นักศึกษา' });
        setRoleState('user');
        showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
    };

    const setRole = (newRole) => {
        setRoleState(newRole);
        localStorage.setItem('helpdesk_current_role', newRole);
        showToast(`เปลี่ยนเป็นมุมมอง ${newRole === 'admin' ? 'Admin' : 'User'} แล้ว`, 'info');
    };

    const setUser = (name, email, group = 'นักศึกษา') => {
        const updated = { name, email, group };
        setUserState(updated);
        localStorage.setItem('helpdesk_current_user', JSON.stringify(updated));
    };

    const switchMockProfile = (profileIndex) => {
        const profile = MOCK_PROFILES[profileIndex];
        if (profile) {
            setUser(profile.name, profile.email, profile.group);
            setRoleState(profile.role);
            localStorage.setItem('helpdesk_current_role', profile.role);
            showToast(`สลับเป็นโปรไฟล์ ${profile.name} (${profile.group}) แล้ว`, 'success');
        }
    };

    // ── Toast Logic ─────────────────────────────────────────
    const showToast = (message, type = 'info') => {
        const id = Date.now() + Math.random().toString(36).substr(2, 5);
        setToasts((prev) => [...prev, { id, message, type, isClosing: false }]);

        // Start slide-out animation 300ms before duration end
        setTimeout(() => {
            setToasts((prev) =>
                prev.map((t) => (t.id === id ? { ...t, isClosing: true } : t))
            );
        }, 2700);

        // Remove toast completely
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    };

    const toastHelpers = {
        success: (msg) => showToast(msg, 'success'),
        error: (msg) => showToast(msg, 'error'),
        warning: (msg) => showToast(msg, 'warning'),
        info: (msg) => showToast(msg, 'info')
    };

    // ── Modal Logic ─────────────────────────────────────────
    const confirm = (title, message, onConfirm, options = {}) => {
        setModal({
            title,
            message,
            onConfirm: () => {
                if (onConfirm) onConfirm();
                setModal(null);
            },
            onCancel: () => {
                if (options.onCancel) options.onCancel();
                setModal(null);
            },
            confirmText: options.confirmText || 'ยืนยัน',
            cancelText: options.cancelText || 'ยกเลิก',
            confirmClass: options.confirmClass || 'btn-primary',
            showCancel: options.showCancel !== false,
            content: options.content || null
        });
    };

    const isGuest = !user?.email || user.email.trim() === '';
    const isGroupB = !isGuest && (
        role === 'admin' ||
        user?.role === 'admin' ||
        user?.role === 'staff' ||
        user?.role === 'technician' ||
        ['ผู้ดูแลระบบ', 'เจ้าหน้าที่', 'เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์', 'ฝ่ายซ่อมบำรุง'].includes(user?.group)
    );
    const isGroupA = !isGuest && !isGroupB;

    const updateUserProfile = async ({ name, phone, group, avatar_url }) => {
        const token = localStorage.getItem('helpdesk_token');
        const res = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ name, phone, group, avatar_url })
        });
        const result = await res.json();
        if (!res.ok) {
            throw new Error(result.error || 'ไม่สามารถอัปเดตข้อมูลโปรไฟล์ได้');
        }
        setUserState(result.user);
        localStorage.setItem('helpdesk_current_user', JSON.stringify(result.user));
        if (result.token) {
            localStorage.setItem('helpdesk_token', result.token);
        }
        if (result.user.role) {
            setRoleState(result.user.role);
            localStorage.setItem('helpdesk_current_role', result.user.role);
        }
        return result.user;
    };

    const changeUserPassword = async (currentPassword, newPassword) => {
        const token = localStorage.getItem('helpdesk_token');
        const res = await fetch('/api/user/change-password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const result = await res.json();
        if (!res.ok) {
            throw new Error(result.error || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
        }
        return result;
    };

    const uploadUserAvatar = async (fileOrFormData) => {
        const token = localStorage.getItem('helpdesk_token');
        let body;
        let headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        if (fileOrFormData instanceof FormData) {
            body = fileOrFormData;
        } else if (fileOrFormData instanceof File) {
            body = new FormData();
            body.append('avatar', fileOrFormData);
        } else {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify({ avatar_url: fileOrFormData });
        }

        const res = await fetch('/api/user/avatar', {
            method: 'POST',
            headers,
            body
        });
        const result = await res.json();
        if (!res.ok) {
            throw new Error(result.error || 'ไม่สามารถอัปโหลดรูปภาพได้');
        }
        setUserState(prev => {
            const updated = { ...prev, avatar_url: result.avatar_url };
            localStorage.setItem('helpdesk_current_user', JSON.stringify(updated));
            return updated;
        });
        return result.avatar_url;
    };

    const closeModal = () => setModal(null);

    return (
        <AppContext.Provider value={{
            role,
            setRole,
            user,
            setUser,
            toast: toastHelpers,
            confirm,
            closeModal,
            modal,
            loginWithEmail,
            loginWithGoogleCredential,
            loginWithGoogleRedirect,
            handleAuthSuccess,
            signUpWithEmail,
            signOutUser,
            isRealAuth: !isGuest,
            isGuest,
            isGroupA,
            isGroupB,
            updateUserProfile,
            changeUserPassword,
            uploadUserAvatar,
            MOCK_PROFILES,
            switchMockProfile,
            theme,
            toggleTheme
        }}>
            {children}
            
            {/* Declarative Toast rendering */}
            <ToastContainer toasts={toasts} setToasts={setToasts} />

            {/* Declarative Modal rendering */}
            {modal && <ModalContainer modal={modal} />}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}
