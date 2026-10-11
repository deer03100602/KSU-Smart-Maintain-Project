// ============================================================
// adminManagement.js — Admin Ticket Management Page
// ============================================================

function renderAdminManagementPage() {
    const issueTypes = IssueTypeService.getAll();
    const tickets = TicketService.getAll();
    const unassignedCount = tickets.filter(t => !t.assigned_to && t.status !== STATUSES.CANCELLED && t.status !== STATUSES.CLOSED).length;
    const unresolvedCount = tickets.filter(t => t.status !== STATUSES.RESOLVED && t.status !== STATUSES.CLOSED && t.status !== STATUSES.CANCELLED).length;
    const urgentCount = tickets.filter(t => t.priority === PRIORITIES.URGENT && t.status !== STATUSES.CLOSED && t.status !== STATUSES.CANCELLED).length;

    return `
        <div class="page-admin fade-in">
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title text-gradient">
                        <i data-lucide="shield" style="width:26px;height:26px;color:var(--primary-color)"></i>
                        จัดการ Ticket (สำหรับเจ้าหน้าที่)
                    </h1>
                    <p class="page-subtitle">ดูรายละเอียด มอบหมายงาน และอัปเดตสถานะปัญหาทั้งหมดในระบบ</p>
                </div>
            </div>

            <!-- Admin Overview Cards -->
            <div class="admin-stats-grid">
                <div class="admin-stat-card border-warning">
                    <div class="stat-header">
                        <span class="stat-title">งานค้างทั้งหมด</span>
                        <i data-lucide="clock" class="stat-icon text-warning"></i>
                    </div>
                    <div class="stat-value text-warning">${unresolvedCount}</div>
                    <div class="stat-desc">รอรับเรื่อง & กำลังดำเนินการ</div>
                </div>
                <div class="admin-stat-card border-danger">
                    <div class="stat-header">
                        <span class="stat-title">งานด่วนที่สุด (Urgent)</span>
                        <i data-lucide="alert-triangle" class="stat-icon text-danger"></i>
                    </div>
                    <div class="stat-value text-danger">${urgentCount}</div>
                    <div class="stat-desc">ต้องได้รับการแก้ไขโดยด่วน</div>
                </div>
                <div class="admin-stat-card border-info">
                    <div class="stat-header">
                        <span class="stat-title">ยังไม่ได้มอบหมาย</span>
                        <i data-lucide="user-minus" class="stat-icon text-info"></i>
                    </div>
                    <div class="stat-value text-info">${unassignedCount}</div>
                    <div class="stat-desc">รอการมอบหมายเจ้าหน้าที่</div>
                </div>
            </div>

            <!-- Filters and Actions Section -->
            <div class="admin-control-bar glass-card">
                <div class="control-search">
                    <i data-lucide="search" class="search-icon"></i>
                    <input type="text" id="admin-search" class="form-input" placeholder="ค้นหาด้วยเลข Ticket, หัวข้อ, ผู้แจ้ง..." oninput="filterAdminTickets()">
                </div>
                <div class="control-filters">
                    <select id="admin-filter-status" class="form-input form-select" onchange="filterAdminTickets()">
                        <option value="">ทุกสถานะ</option>
                        ${Object.values(STATUSES).map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                    <select id="admin-filter-priority" class="form-input form-select" onchange="filterAdminTickets()">
                        <option value="">ทุกระดับความสำคัญ</option>
                        ${Object.values(PRIORITIES).map(p => `<option value="${p}">${p}</option>`).join('')}
                    </select>
                    <select id="admin-filter-assignee" class="form-input form-select" onchange="filterAdminTickets()">
                        <option value="">เจ้าหน้าที่ทั้งหมด</option>
                        <option value="unassigned">ยังไม่ได้มอบหมาย</option>
                        ${STAFF_MEMBERS.map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                    <button class="btn btn-ghost btn-sm" onclick="clearAdminFilters()">
                        <i data-lucide="x" style="width:14px;height:14px"></i>
                        ล้างตัวกรอง
                    </button>
                </div>
            </div>

            <!-- Bulk Operations Bar -->
            <div class="bulk-actions-bar glass-card hidden" id="bulk-actions-bar">
                <div class="bulk-info">
                    <i data-lucide="check-square" class="text-primary"></i>
                    <span id="bulk-selected-count">เลือกแล้ว 0 รายการ</span>
                </div>
                <div class="bulk-buttons">
                    <div class="bulk-action-group">
                        <label class="form-label compact">เปลี่ยนสถานะกลุ่ม:</label>
                        <select id="bulk-status-select" class="form-input form-select compact-select" onchange="applyBulkStatus(this.value)">
                            <option value="">-- เลือกสถานะ --</option>
                            ${Object.values(STATUSES).map(s => `<option value="${s}">${s}</option>`).join('')}
                        </select>
                    </div>
                    <div class="bulk-action-group">
                        <label class="form-label compact">มอบหมายกลุ่ม:</label>
                        <select id="bulk-assignee-select" class="form-input form-select compact-select" onchange="applyBulkAssignee(this.value)">
                            <option value="">-- เลือกเจ้าหน้าที่ --</option>
                            ${STAFF_MEMBERS.map(s => `<option value="${s}">${s}</option>`).join('')}
                        </select>
                    </div>
                    <button class="btn btn-danger-ghost btn-sm" onclick="applyBulkDelete()">
                        <i data-lucide="trash-2" style="width:14px;height:14px"></i>
                        ลบที่เลือก
                    </button>
                </div>
            </div>

            <!-- Main Table Card -->
            <div class="table-card glass-card">
                <div class="table-responsive">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th style="width: 40px;">
                                    <input type="checkbox" id="select-all-tickets" onchange="toggleSelectAllTickets(this.checked)">
                                </th>
                                <th>Ticket ID</th>
                                <th>หัวข้อปัญหา</th>
                                <th>ประเภท</th>
                                <th>ระดับ</th>
                                <th>สถานะ</th>
                                <th>ผู้รับผิดชอบ</th>
                                <th>ผู้แจ้ง / วันที่แจ้ง</th>
                                <th style="width: 110px; text-align: center;">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody id="admin-table-body">
                            <!-- Table rows will be rendered here -->
                        </tbody>
                    </table>
                </div>
                <div id="admin-empty-state" class="empty-state hidden">
                    <i data-lucide="inbox" class="empty-icon"></i>
                    <h3>ไม่พบ Ticket ในระบบ</h3>
                    <p>ไม่มีรายการปัญหาที่ตรงกับเงื่อนไขการค้นหา</p>
                </div>
            </div>
        </div>
    `;
}

function filterAdminTickets() {
    const query = document.getElementById('admin-search')?.value || '';
    const status = document.getElementById('admin-filter-status')?.value || '';
    const priority = document.getElementById('admin-filter-priority')?.value || '';
    const assigneeFilter = document.getElementById('admin-filter-assignee')?.value || '';

    let tickets = TicketService.getAll();

    // Text Search
    if (query.trim()) {
        const q = query.toLowerCase().trim();
        tickets = tickets.filter(t =>
            t.ticket_no.toLowerCase().includes(q) ||
            t.title.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.requester_name.toLowerCase().includes(q) ||
            t.location.toLowerCase().includes(q)
        );
    }

    // Status Filter
    if (status) {
        tickets = tickets.filter(t => t.status === status);
    }

    // Priority Filter
    if (priority) {
        tickets = tickets.filter(t => t.priority === priority);
    }

    // Assignee Filter
    if (assigneeFilter) {
        if (assigneeFilter === 'unassigned') {
            tickets = tickets.filter(t => !t.assigned_to);
        } else {
            tickets = tickets.filter(t => t.assigned_to === assigneeFilter);
        }
    }

    renderAdminTableRows(tickets);
}

function renderAdminTableRows(tickets) {
    const tbody = document.getElementById('admin-table-body');
    const emptyState = document.getElementById('admin-empty-state');
    const selectAllCheckbox = document.getElementById('select-all-tickets');

    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    updateBulkActionBar();

    if (!tbody) return;

    if (tickets.length === 0) {
        tbody.innerHTML = '';
        emptyState?.classList.remove('hidden');
        return;
    }

    emptyState?.classList.add('hidden');

    tbody.innerHTML = tickets.map(ticket => {
        const statusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS['Open'];
        const priorityColor = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS['Medium'];

        return `
            <tr class="admin-table-row" data-id="${ticket.id}">
                <td>
                    <input type="checkbox" class="ticket-row-checkbox" value="${ticket.id}" onchange="updateBulkActionBar()">
                </td>
                <td class="font-mono text-bold" onclick="navigateTo('ticket/${ticket.id}')" style="cursor:pointer; color:var(--primary-color)">
                    ${ticket.ticket_no}
                </td>
                <td onclick="navigateTo('ticket/${ticket.id}')" style="cursor:pointer">
                    <div class="table-ticket-title">${ticket.title}</div>
                    <div class="table-ticket-desc">${ticket.location || '-'}</div>
                </td>
                <td>
                    <span class="table-type-badge">${ticket.issue_type}</span>
                </td>
                <td>
                    <span class="priority-dot-badge">
                        <span class="priority-dot" style="background:${priorityColor.text}"></span>
                        ${ticket.priority}
                    </span>
                </td>
                <td>
                    <select class="table-select-status" style="color:${statusColor.text}; background:${statusColor.bg}; border: 1px solid ${statusColor.border}"
                        onchange="changeTicketStatusInline('${ticket.id}', this.value)">
                        ${Object.values(STATUSES).map(s => `<option value="${s}" ${ticket.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </td>
                <td>
                    <select class="table-select-assignee" onchange="changeTicketAssigneeInline('${ticket.id}', this.value)">
                        <option value="">-- ยังไม่ได้มอบหมาย --</option>
                        ${STAFF_MEMBERS.map(s => `<option value="${s}" ${ticket.assigned_to === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </td>
                <td>
                    <div class="table-user-name">${ticket.requester_name}</div>
                    <div class="table-user-date">${timeAgo(ticket.created_at)}</div>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-ghost btn-icon-sm" title="ดูรายละเอียด" onclick="navigateTo('ticket/${ticket.id}')">
                            <i data-lucide="eye" style="width:16px;height:16px"></i>
                        </button>
                        <button class="btn btn-ghost btn-icon-sm" title="แก้ไข" onclick="showEditTicketModal('${ticket.id}')">
                            <i data-lucide="edit" style="width:16px;height:16px"></i>
                        </button>
                        <button class="btn btn-danger-ghost btn-icon-sm" title="ลบ" onclick="deleteTicketInline('${ticket.id}')">
                            <i data-lucide="trash-2" style="width:16px;height:16px"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function clearAdminFilters() {
    const search = document.getElementById('admin-search');
    const status = document.getElementById('admin-filter-status');
    const priority = document.getElementById('admin-filter-priority');
    const assignee = document.getElementById('admin-filter-assignee');

    if (search) search.value = '';
    if (status) status.value = '';
    if (priority) priority.value = '';
    if (assignee) assignee.value = '';

    filterAdminTickets();
}

// ── Inline Editing Handlers ───────────────────────────────────

function changeTicketStatusInline(id, newStatus) {
    TicketService.update(id, { status: newStatus });
    Toast.success(`อัปเดตสถานะสำเร็จ`);
    filterAdminTickets();
}

function changeTicketAssigneeInline(id, assignee) {
    TicketService.update(id, { assigned_to: assignee });
    Toast.success(assignee ? `มอบหมายงานให้ "${assignee}" สำเร็จ` : 'ยกเลิกการมอบหมายสำเร็จ');
    filterAdminTickets();
}

function deleteTicketInline(id) {
    Modal.confirm('ลบ Ticket', 'คุณแน่ใจหรือไม่ว่าต้องการลบ Ticket นี้ออกถาวร?', () => {
        TicketService.delete(id);
        Toast.success('ลบรายการสำเร็จ');
        filterAdminTickets();
    });
}

// ── Bulk Actions Handlers ─────────────────────────────────────

function toggleSelectAllTickets(checked) {
    const checkboxes = document.querySelectorAll('.ticket-row-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
    updateBulkActionBar();
}

function getSelectedTicketIds() {
    const checkboxes = document.querySelectorAll('.ticket-row-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function updateBulkActionBar() {
    const selectedIds = getSelectedTicketIds();
    const bar = document.getElementById('bulk-actions-bar');
    const countText = document.getElementById('bulk-selected-count');

    if (bar && countText) {
        if (selectedIds.length > 0) {
            bar.classList.remove('hidden');
            countText.innerText = `เลือกแล้ว ${selectedIds.length} รายการ`;
        } else {
            bar.classList.add('hidden');
        }
    }
}

function applyBulkStatus(status) {
    if (!status) return;
    const selectedIds = getSelectedTicketIds();
    if (selectedIds.length === 0) return;

    Modal.confirm('ยืนยันแก้ไขหลายรายการ', `ต้องการเปลี่ยนสถานะของ Ticket ที่เลือกทั้งหมด ${selectedIds.length} รายการ เป็น "${status}" ใช่หรือไม่?`, () => {
        selectedIds.forEach(id => {
            TicketService.update(id, { status });
        });
        Toast.success(`เปลี่ยนสถานะเป็น "${status}" สำเร็จ ${selectedIds.length} รายการ`);
        
        // Reset dropdown
        const select = document.getElementById('bulk-status-select');
        if (select) select.value = '';

        filterAdminTickets();
    });
}

function applyBulkAssignee(assignee) {
    if (!assignee) return;
    const selectedIds = getSelectedTicketIds();
    if (selectedIds.length === 0) return;

    Modal.confirm('ยืนยันมอบหมายงาน', `ต้องการมอบหมายงานที่เลือกทั้งหมด ${selectedIds.length} รายการ ให้กับ "${assignee}" ใช่หรือไม่?`, () => {
        selectedIds.forEach(id => {
            TicketService.update(id, { assigned_to: assignee });
        });
        Toast.success(`มอบหมายงานให้ "${assignee}" สำเร็จ ${selectedIds.length} รายการ`);

        // Reset dropdown
        const select = document.getElementById('bulk-assignee-select');
        if (select) select.value = '';

        filterAdminTickets();
    });
}

function applyBulkDelete() {
    const selectedIds = getSelectedTicketIds();
    if (selectedIds.length === 0) return;

    Modal.confirm('ยืนยันลบหลายรายการ', `คุณต้องการลบ Ticket ที่เลือกทั้งหมด ${selectedIds.length} รายการ ใช่หรือไม่? การลบนี้ไม่สามารถย้อนกลับได้!`, () => {
        selectedIds.forEach(id => {
            TicketService.delete(id);
        });
        Toast.success(`ลบสำเร็จ ${selectedIds.length} รายการ`);
        filterAdminTickets();
    });
}

// Called after rendering the page
function initAdminManagementPage() {
    filterAdminTickets();
}
