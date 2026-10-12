// ============================================================
// Modal.js — Declarative Modal Container Component
// ============================================================

'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function ModalContainer({ modal }) {
    const {
        title,
        message,
        content,
        onConfirm,
        onCancel,
        confirmText,
        cancelText,
        confirmClass,
        showCancel
    } = modal;

    // Esc Key listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && onCancel) {
                onCancel();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onCancel]);

    const handleOverlayClick = (e) => {
        if (e.target.id === 'modal-overlay' && onCancel) {
            onCancel();
        }
    };

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div 
            className="modal-overlay modal-active" 
            id="modal-overlay" 
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 999999,
                padding: '1.25rem',
                boxSizing: 'border-box'
            }}
            onClick={handleOverlayClick}
        >
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button className="modal-close-btn" onClick={onCancel}>
                        <X style={{ width: 18, height: 18 }} />
                    </button>
                </div>
                
                <div className="modal-body">
                    {message && <p>{message}</p>}
                    {content}
                </div>
                
                <div className="modal-footer">
                    {showCancel && (
                        <button className="btn btn-secondary" onClick={onCancel}>
                            {cancelText || 'ยกเลิก'}
                        </button>
                    )}
                    <button className={`btn ${confirmClass || 'btn-primary'}`} onClick={onConfirm}>
                        {confirmText || 'ตกลง'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
