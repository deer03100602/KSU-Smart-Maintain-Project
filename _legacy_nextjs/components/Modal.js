// ============================================================
// Modal.js — Declarative Modal Container Component
// ============================================================

'use client';

import React, { useEffect } from 'react';
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

    return (
        <div 
            className="modal-overlay modal-active" 
            id="modal-overlay" 
            onClick={handleOverlayClick}
        >
            <div className="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title">{title}</h3>
                    <button class="modal-close-btn" onClick={onCancel}>
                        <X style={{ width: 18, height: 18 }} />
                    </button>
                </div>
                
                <div class="modal-body">
                    {message && <p>{message}</p>}
                    {content}
                </div>
                
                <div class="modal-footer">
                    {showCancel && (
                        <button class="btn btn-ghost" onClick={onCancel}>
                            {cancelText}
                        </button>
                    )}
                    <button class={`btn ${confirmClass}`} onClick={onConfirm}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
