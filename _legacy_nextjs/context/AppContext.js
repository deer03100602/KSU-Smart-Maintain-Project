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

    const updateUserFromSession = (session) => {
        if (!session || !session.user) return;
        const userEmail = session.user.email;
        const userName = session.user.user_metadata?.full_name || userEmail.split('@')[0];
        const userGroup = session.user.user_metadata?.user_group || 'นักศึกษา';
        setUserState({
            name: userName,
            email: userEmail,
            id: session.user.id,
            group: userGroup
        });

        // Determine role based on email content or user group
        const isAdmin = userEmail.toLowerCase().includes('admin') || 
                        userEmail.toLowerCase() === 'admin@example.com' ||
                        userGroup === 'ผู้ดูแลระบบ' || 
                        userGroup === 'เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์';
        setRoleState(isAdmin ? 'admin' : 'user');
    };

    // Auth state changes
    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                updateUserFromSession(session);
            } else {
                loadSimulatedUser();
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                updateUserFromSession(session);
            } else {
                loadSimulatedUser();
            }
        });

        return () => {
            subscription.unsubscribe();
        };
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

    // Auth methods
    const loginWithEmail = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
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
        return result.user;
    };

    const signOutUser = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // reset to simulated guest defaults
        localStorage.removeItem('helpdesk_current_user');
        localStorage.removeItem('helpdesk_current_role');
        loadSimulatedUser();
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
            signUpWithEmail,
            signOutUser,
            isRealAuth: !!(user && user.id),
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
