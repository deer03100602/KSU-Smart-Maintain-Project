// ============================================================
// app.js — SPA Router, Navigation, Initialization
// ============================================================

// ── Global Navigation Function ──────────────────────────────
function navigateTo(hash) {
    window.location.hash = hash;
}

// ── Role Management Redirect Guard ──────────────────────────
function checkRoutePermission(page) {
    const isAdmin = RoleService.isAdmin();
    const adminOnlyPages = ['admin', 'issue-types'];

    if (adminOnlyPages.includes(page) && !isAdmin) {
        Toast.warning('คุณไม่มีสิทธิ์เข้าถึงหน้าดังกล่าว มุมมองของคุณจำกัดเฉพาะผู้ใช้ทั่วไป');
        navigateTo('home');
        return false;
    }
    return true;
}

// ── Router ──────────────────────────────────────────────────
function renderApp() {
    const mainContent = document.getElementById('main-content');
    const sidebarContainer = document.getElementById('sidebar-container');
    const mobileHeaderContainer = document.getElementById('mobile-header-container');

    if (!mainContent) return;

    // Load sample data if it's the first time
    loadSampleData();

    // Get current hash
    let hash = window.location.hash.slice(1) || 'home';
    let page = hash;
    let param = null;

    // Handle parameterized routes, e.g. #ticket/id-xxxx
    if (hash.startsWith('ticket/')) {
        const parts = hash.split('/');
        page = parts[0];
        param = parts[1];
    }

    // Role Permission Guard
    if (!checkRoutePermission(page)) {
        return;
    }

    // Render navigation bars & sidebars
    if (sidebarContainer) {
        sidebarContainer.innerHTML = renderNavbar();
    }
    if (mobileHeaderContainer) {
        mobileHeaderContainer.innerHTML = renderMobileHeader();
    }

    // Dispatch rendering for specific pages
    let pageHtml = '';
    let initFunc = null;

    switch (page) {
        case 'home':
            pageHtml = renderHomePage();
            break;
        case 'create':
            pageHtml = renderCreateTicketPage();
            break;
        case 'tickets':
            pageHtml = renderTicketListPage();
            initFunc = initTicketListPage;
            break;
        case 'ticket':
            pageHtml = renderTicketDetailPage(param);
            break;
        case 'my-tickets':
            pageHtml = renderMyTicketsPage();
            initFunc = initMyTicketsPage;
            break;
        case 'admin':
            pageHtml = renderAdminManagementPage();
            initFunc = initAdminManagementPage;
            break;
        case 'dashboard':
            pageHtml = renderDashboardPage();
            initFunc = initDashboardPage;
            break;
        case 'issue-types':
            pageHtml = renderIssueTypesPage();
            initFunc = initIssueTypesPage;
            break;
        default:
            pageHtml = renderHomePage();
            break;
    }

    // Update main container
    mainContent.innerHTML = pageHtml;

    // Trigger page-specific initializations
    if (initFunc) {
        try {
            initFunc();
        } catch (e) {
            console.error('Error running page init function:', e);
        }
    }

    // Close mobile sidebar overlay if opened
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && sidebar.classList.contains('sidebar-open')) {
        sidebar.classList.remove('sidebar-open');
        if (overlay) overlay.classList.remove('overlay-active');
    }

    // Refresh Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
}

// ── Application Core Bootstrapping ──────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup SPA Base Shell Layout
    const appShell = `
        <div class="app-container">
            <!-- Sidebar Overlay for mobile -->
            <div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleSidebar()"></div>
            
            <!-- Dynamic Sidebar Container -->
            <div id="sidebar-container"></div>
            
            <!-- Mobile Header -->
            <div id="mobile-header-container"></div>
            
            <!-- Main Content Area -->
            <main class="main-content" id="main-content"></main>
        </div>
        <!-- Global Toast Container -->
        <div id="toast-container"></div>
    `;

    document.body.innerHTML = appShell;

    // 2. Initialize Toast & Theme components
    Toast.init();
    if (typeof ThemeService !== 'undefined') ThemeService.init();

    // 3. Listen to hash shifts
    window.addEventListener('hashchange', renderApp);

    // 4. Initial rendering
    renderApp();
});
