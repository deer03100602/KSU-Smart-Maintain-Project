// ============================================================
// modal.js — Modal Dialog Component
// ============================================================

const Modal = {
    show(options = {}) {
        const {
            title = 'ยืนยัน',
            message = '',
            content = '',
            confirmText = 'ยืนยัน',
            cancelText = 'ยกเลิก',
            confirmClass = 'btn-primary',
            onConfirm = null,
            onCancel = null,
            showCancel = true
        } = options;

        // Remove existing modal
        this.close();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-overlay';

        overlay.innerHTML = `
            <div class="modal-container" id="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close-btn" id="modal-close-btn">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                ${message ? `<div class="modal-body"><p>${message}</p></div>` : ''}
                ${content ? `<div class="modal-body">${content}</div>` : ''}
                <div class="modal-footer">
                    ${showCancel ? `<button class="btn btn-ghost" id="modal-cancel-btn">${cancelText}</button>` : ''}
                    <button class="btn ${confirmClass}" id="modal-confirm-btn">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Initialize icons
        if (window.lucide) lucide.createIcons();

        // Animate in
        requestAnimationFrame(() => overlay.classList.add('modal-active'));

        // Event listeners
        document.getElementById('modal-close-btn').addEventListener('click', () => {
            this.close();
            if (onCancel) onCancel();
        });

        if (showCancel) {
            document.getElementById('modal-cancel-btn').addEventListener('click', () => {
                this.close();
                if (onCancel) onCancel();
            });
        }

        document.getElementById('modal-confirm-btn').addEventListener('click', () => {
            if (onConfirm) onConfirm();
            this.close();
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.close();
                if (onCancel) onCancel();
            }
        });

        // Close on Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.close();
                if (onCancel) onCancel();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    },

    close() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.classList.remove('modal-active');
            setTimeout(() => overlay.remove(), 200);
        }
    },

    confirm(title, message, onConfirm) {
        this.show({
            title,
            message,
            confirmText: 'ยืนยัน',
            confirmClass: 'btn-danger',
            onConfirm
        });
    }
};
