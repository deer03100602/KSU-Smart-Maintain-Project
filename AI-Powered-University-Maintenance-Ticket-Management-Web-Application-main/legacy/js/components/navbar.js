// ============================================================
// navbar.js — Sidebar Navigation + Role Switcher + Theme Toggle
// ============================================================

function renderNavbar() {
    const currentRole = RoleService.getCurrentRole();
    const isAdmin = currentRole === 'admin';
    const currentHash = window.location.hash.slice(1) || 'home';
    const currentTheme = typeof ThemeService !== 'undefined' ? ThemeService.getCurrentTheme() : 'dark';

    const userMenuItems = [
        { id: 'home', icon: 'home', label: 'หน้าหลัก' },
        { id: 'create', icon: 'plus-circle', label: 'แจ้งปัญหาใหม่' },
        { id: 'tickets', icon: 'list', label: 'รายการ Ticket' },
        { id: 'my-tickets', icon: 'user', label: 'ปัญหาของฉัน' },
        { id: 'dashboard', icon: 'bar-chart-3', label: 'Dashboard' }
    ];

    const adminMenuItems = [
        { id: 'home', icon: 'home', label: 'หน้าหลัก' },
        { id: 'create', icon: 'plus-circle', label: 'แจ้งปัญหาใหม่' },
        { id: 'tickets', icon: 'list', label: 'รายการ Ticket' },
        { id: 'admin', icon: 'shield', label: 'จัดการ Ticket' },
        { id: 'dashboard', icon: 'bar-chart-3', label: 'Dashboard' },
        { id: 'issue-types', icon: 'settings', label: 'จัดการประเภท' }
    ];

    const menuItems = isAdmin ? adminMenuItems : userMenuItems;

    return `
        <!-- Top Navigation Bar (Header) -->
        <header class="top-navbar">
            <div class="top-navbar-container">
                <!-- Brand / Logo -->
                <a href="#home" class="top-navbar-logo" onclick="closeSidebar()">
                    <div class="logo-icon">
                        <i data-lucide="wrench" style="width:24px;height:24px"></i>
                    </div>
                    <div class="logo-text">
                        <h1 style="font-size: 1.05rem; font-weight: 700; margin: 0; line-height: 1.15; color: var(--text-primary);">University Maintenance</h1>
                        <span class="logo-subtitle" style="font-size: 0.72rem; color: var(--text-muted); display: block;">AI-Powered Ticket Management App</span>
                    </div>
                </a>

                <!-- Desktop Navigation Links -->
                <nav class="top-nav">
                    ${menuItems.map(item => `
                        <a href="#${item.id}" class="top-nav-item ${currentHash.startsWith(item.id) ? 'top-nav-item-active' : ''}" data-page="${item.id}">
                            <i data-lucide="${item.icon}" style="width:17px;height:17px"></i>
                            <span>${item.label}</span>
                        </a>
                    `).join('')}
                </nav>

                <!-- Desktop Actions & User Profile -->
                <div class="top-navbar-actions">
                    <!-- Theme Toggle Button (Desktop) -->
                    <button 
                        class="theme-toggle-btn" 
                        onclick="toggleLegacyTheme()" 
                        title="${currentTheme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}"
                        style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; padding: 0; background: rgba(255,255,255,0.05); border: 1px solid var(--border-card); border-radius: 50%; color: var(--text-primary); cursor: pointer; transition: var(--transition-fast);"
                        onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                        onmouseout="this.style.background='rgba(255,255,255,0.05)'"
                    >
                        ${currentTheme === 'dark' ? `<i data-lucide="sun" style="width:17px;height:17px;color:#fbbf24;"></i>` : `<i data-lucide="moon" style="width:17px;height:17px;color:#818cf8;"></i>`}
                    </button>

                    <!-- Role Switcher -->
                    <div style="display: flex; align-items: center; gap: 0.4rem; background: rgba(0,0,0,0.25); padding: 3px 6px; border-radius: 9999px; border: 1px solid var(--border-card);">
                        <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 6px;">มุมมอง:</span>
                        <button class="role-btn ${!isAdmin ? 'role-btn-active' : ''}" style="padding: 4px 10px; border-radius: 9999px; font-size: 0.8rem;" onclick="switchRole('user')">
                            <i data-lucide="user" style="width:13px;height:13px"></i> User
                        </button>
                        <button class="role-btn ${isAdmin ? 'role-btn-active' : ''}" style="padding: 4px 10px; border-radius: 9999px; font-size: 0.8rem;" onclick="switchRole('admin')">
                            <i data-lucide="shield" style="width:13px;height:13px"></i> Admin
                        </button>
                    </div>

                    <!-- User Profile Pill -->
                    <div class="top-user-profile">
                        <div class="user-avatar" style="width: 28px; height: 28px;">
                            <i data-lucide="${isAdmin ? 'shield-check' : 'user-circle'}" style="width:16px;height:16px; color: ${isAdmin ? 'var(--primary-color)' : 'var(--text-secondary)'}"></i>
                        </div>
                        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${isAdmin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}</span>
                        <span class="user-role-badge ${isAdmin ? 'admin-badge' : 'user-badge'}" style="font-size: 0.68rem; padding: 1px 6px;">${isAdmin ? 'Admin' : 'User'}</span>
                    </div>
                </div>

                <!-- Mobile Controls (< 1024px) -->
                <div class="mobile-nav-controls">
                    <button class="hamburger-btn" onclick="toggleSidebar()" aria-label="เมนู">
                        <i data-lucide="menu"></i>
                    </button>
                </div>
            </div>
        </header>

        <!-- Mobile Drawer (< 1024px) -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-logo">
                    <div class="logo-icon">
                        <i data-lucide="wrench" style="width:24px;height:24px"></i>
                    </div>
                    <div class="logo-text">
                        <h1 style="font-size: 1.05rem;">University Maintenance</h1>
                        <span>AI-Powered Ticket Management App</span>
                    </div>
                </div>
                <button class="sidebar-close-btn" id="sidebar-close-btn" onclick="closeSidebar()">
                    <i data-lucide="x"></i>
                </button>
            </div>

            <!-- Theme Switcher in Sidebar (placed before Role Switcher / มุมมอง) -->
            <div style="padding: 1rem 1.25rem 0.25rem;">
                <button 
                    type="button" 
                    onclick="toggleLegacyTheme()" 
                    style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.65rem 1rem; border-radius: var(--border-radius-sm); background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-card); color: var(--text-primary); font-size: 0.88rem; font-weight: 500; cursor: pointer; transition: var(--transition-fast);"
                    onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'"
                    onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'"
                >
                    ${currentTheme === 'dark' ? 
                        `<i data-lucide="sun" style="width:17px;height:17px;color:#fbbf24;"></i> <span>โหมดสว่าง</span>` : 
                        `<i data-lucide="moon" style="width:17px;height:17px;color:#818cf8;"></i> <span>โหมดมืด</span>`
                    }
                </button>
            </div>

            <div class="role-switcher">
                <div class="role-switcher-label">มุมมอง</div>
                <div class="role-toggle" id="role-toggle">
                    <button class="role-btn ${!isAdmin ? 'role-btn-active' : ''}" onclick="switchRole('user'); closeSidebar();">
                        <i data-lucide="user" style="width:14px;height:14px"></i>
                        User
                    </button>
                    <button class="role-btn ${isAdmin ? 'role-btn-active' : ''}" onclick="switchRole('admin'); closeSidebar();">
                        <i data-lucide="shield" style="width:14px;height:14px"></i>
                        Admin
                    </button>
                </div>
            </div>

            <nav class="sidebar-nav">
                ${menuItems.map(item => `
                    <a href="#${item.id}" class="nav-item ${currentHash.startsWith(item.id) ? 'nav-item-active' : ''}" data-page="${item.id}" onclick="closeSidebar()">
                        <i data-lucide="${item.icon}" style="width:18px;height:18px"></i>
                        <span>${item.label}</span>
                    </a>
                `).join('')}
            </nav>

            <div class="sidebar-footer">
                <div class="sidebar-user-info">
                    <div class="user-avatar">
                        <i data-lucide="${isAdmin ? 'shield-check' : 'user-circle'}" style="width:20px;height:20px"></i>
                    </div>
                    <div class="user-details">
                        <span class="user-name">${isAdmin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}</span>
                        <span class="user-role-badge ${isAdmin ? 'admin-badge' : 'user-badge'}">${isAdmin ? 'Admin' : 'User'}</span>
                    </div>
                </div>
            </div>
        </aside>
    `;
}

function renderMobileHeader() {
    return '';
}

function switchRole(role) {
    RoleService.setRole(role);
    Toast.info(`เปลี่ยนเป็นมุมมอง ${role === 'admin' ? 'Admin' : 'User'} แล้ว`);
    renderApp();
}

function toggleLegacyTheme() {
    if (typeof ThemeService !== 'undefined') {
        const next = ThemeService.toggleTheme();
        Toast.info(`เปลี่ยนเป็น${next === 'light' ? 'โหมดสว่าง' : 'โหมดมืด'} แล้ว`);
        renderApp();
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) {
        sidebar.classList.toggle('sidebar-open');
        if (overlay) overlay.classList.toggle('overlay-active');
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('sidebar-open');
    if (overlay) overlay.classList.remove('overlay-active');
}

