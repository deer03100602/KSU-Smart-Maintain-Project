// ============================================================
// ticketList.js — Ticket List Page with Search & Filter
// ============================================================

function renderTicketListPage() {
    const issueTypes = IssueTypeService.getAll();

    return `
        <div class="page-ticket-list fade-in">
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">
                        <i data-lucide="list" style="width:24px;height:24px"></i>
                        รายการ Ticket ทั้งหมด
                    </h1>
                    <p class="page-subtitle">ค้นหาและกรองรายการปัญหาที่แจ้งไว้</p>
                </div>
                <a href="#create" class="btn btn-primary">
                    <i data-lucide="plus" style="width:16px;height:16px"></i>
                    แจ้งปัญหาใหม่
                </a>
            </div>

            <!-- Search & Filter Bar -->
            <div class="filter-bar glass-card">
                <div class="search-box">
                    <i data-lucide="search" class="search-icon" style="width:18px;height:18px"></i>
                    <input type="text" id="search-input" class="form-input search-input" 
                        placeholder="ค้นหาด้วย Ticket ID, หัวข้อ หรือรายละเอียด..." 
                        oninput="filterTickets()">
                </div>
                <div class="filter-row">
                    <select id="filter-status" class="form-input form-select filter-select" onchange="filterTickets()">
                        <option value="">ทุกสถานะ</option>
                        ${Object.values(STATUSES).map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                    <select id="filter-priority" class="form-input form-select filter-select" onchange="filterTickets()">
                        <option value="">ทุกระดับ</option>
                        ${Object.values(PRIORITIES).map(p => `<option value="${p}">${p}</option>`).join('')}
                    </select>
                    <select id="filter-type" class="form-input form-select filter-select" onchange="filterTickets()">
                        <option value="">ทุกประเภท</option>
                        ${issueTypes.map(t => `<option value="${t.name}">${t.name}</option>`).join('')}
                    </select>
                    <button class="btn btn-ghost btn-sm" onclick="clearFilters()">
                        <i data-lucide="x" style="width:14px;height:14px"></i>
                        ล้างตัวกรอง
                    </button>
                </div>
            </div>

            <!-- Results -->
            <div class="results-header" id="results-header"></div>
            <div id="ticket-list-container">
                <!-- Tickets will be rendered here -->
            </div>
        </div>
    `;
}

function filterTickets() {
    const query = document.getElementById('search-input')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';
    const priority = document.getElementById('filter-priority')?.value || '';
    const issue_type = document.getElementById('filter-type')?.value || '';

    const filters = {};
    if (query) filters.query = query;
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (issue_type) filters.issue_type = issue_type;

    const tickets = TicketService.filter(filters);

    // Update results header
    const headerEl = document.getElementById('results-header');
    if (headerEl) {
        headerEl.innerHTML = `<span class="results-count">พบ ${tickets.length} รายการ</span>`;
    }

    // Render tickets
    const container = document.getElementById('ticket-list-container');
    if (container) {
        container.innerHTML = renderTicketTable(tickets);
        if (window.lucide) lucide.createIcons();
    }
}

function clearFilters() {
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('filter-status');
    const priorityFilter = document.getElementById('filter-priority');
    const typeFilter = document.getElementById('filter-type');

    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = '';
    if (priorityFilter) priorityFilter.value = '';
    if (typeFilter) typeFilter.value = '';

    filterTickets();
}

// Initialize ticket list after rendering
function initTicketListPage() {
    filterTickets();
}
