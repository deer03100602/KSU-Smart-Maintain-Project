// ============================================================
// Toast.js — Declarative Toast Component
// ============================================================

'use client';

import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export function ToastContainer({ toasts, setToasts }) {
    return (
        <div id="toast-container">
            {toasts.map((t) => (
                <ToastElement 
                    key={t.id} 
                    toast={t} 
                    onClose={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))} 
                />
            ))}
        </div>
    );
}

export function ToastElement({ toast, onClose }) {
    const icons = {
        success: <CheckCircle className="toast-icon" />,
        error: <XCircle className="toast-icon" />,
        warning: <AlertTriangle className="toast-icon" />,
        info: <Info className="toast-icon" />
    };

    return (
        <div className={`toast toast-${toast.type} ${toast.isClosing ? 'toast-hide' : 'toast-show'}`}>
            {icons[toast.type] || <Info className="toast-icon" />}
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={onClose}>
                <X style={{ width: 14, height: 14 }} />
            </button>
        </div>
    );
}
