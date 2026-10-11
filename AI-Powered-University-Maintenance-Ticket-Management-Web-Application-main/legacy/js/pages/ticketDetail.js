// ============================================================
// ticketDetail.js — Ticket Detail Page
// ============================================================

function renderTicketDetailPage(ticketId) {
    const ticket = TicketService.getById(ticketId);
    if (!ticket) {
        return `
            <div class="page-detail fade-in">
                <div class="empty-state">
                    <i data-lucide="file-question" class="empty-icon"></i>
                    <h3>ไม่พบ Ticket</h3>
                    <p>Ticket ที่คุณต้องการดูไม่พบในระบบ</p>
                    <a href="#tickets" class="btn btn-primary">กลับไปรายการ Ticket</a>
                </div>
            </div>
        `;
    }

    const statusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS['Open'];
    const priorityColor = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS['Medium'];
    const isAdmin = RoleService.isAdmin();
    const isOwner = ticket.requester_name === UserService.getCurrentUser().name;
    const canEdit = isAdmin || (isOwner && ticket.status === STATUSES.OPEN);
    const canCancel = isOwner && (ticket.status === STATUSES.OPEN || ticket.status === STATUSES.IN_PROGRESS);

    const priorityIcons = { 'Low': 'arrow-down', 'Medium': 'minus', 'High': 'arrow-up', 'Urgent': 'alert-triangle' };

    return `
        <div class="page-detail fade-in">
            <div class="page-header">
                <div class="page-header-left">
                    <button class="btn btn-ghost btn-sm" onclick="history.back()">
                        <i data-lucide="arrow-left" style="width:16px;height:16px"></i>
                        กลับ
                    </button>
                    <h1 class="page-title">${ticket.ticket_no}</h1>
                </div>
                <div class="page-header-actions">
                    ${canEdit ? `
                        <button class="btn btn-ghost" onclick="showEditTicketModal('${ticket.id}')">
                            <i data-lucide="edit" style="width:16px;height:16px"></i>
                            แก้ไข
                        </button>
                    ` : ''}
                    ${canCancel ? `
                        <button class="btn btn-danger-ghost" onclick="cancelTicket('${ticket.id}')">
                            <i data-lucide="x-circle" style="width:16px;height:16px"></i>
                            ยกเลิก
                        </button>
                    ` : ''}
                    ${isAdmin ? `
                        <button class="btn btn-danger-ghost" onclick="deleteTicket('${ticket.id}')">
                            <i data-lucide="trash-2" style="width:16px;height:16px"></i>
                            ลบ
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="detail-layout">
                <!-- Main Content -->
                <div class="detail-main glass-card">
                    <div class="detail-title-section">
                        <h2 class="detail-title">${ticket.title}</h2>
                        <div class="detail-badges">
                            <span class="status-badge status-badge-lg" style="background:${statusColor.bg};color:${statusColor.text};border:1px solid ${statusColor.border}">
                                ${ticket.status}
                            </span>
                            <span class="priority-badge priority-badge-lg" style="background:${priorityColor.bg};color:${priorityColor.text};border:1px solid ${priorityColor.border}">
                                <i data-lucide="${priorityIcons[ticket.priority]}" style="width:14px;height:14px"></i>
                                ${ticket.priority}
                            </span>
                        </div>
                    </div>

                    <div class="detail-description">
                        <h3 class="detail-label">รายละเอียดปัญหา</h3>
                        <p>${ticket.description}</p>
                    </div>

                    ${ticket.resolution_note ? `
                        <div class="detail-resolution">
                            <h3 class="detail-label">
                                <i data-lucide="clipboard-check" style="width:16px;height:16px"></i>
                                บันทึกการดำเนินงาน
                            </h3>
                            <p>${ticket.resolution_note}</p>
                        </div>
                    ` : ''}

                    <!-- Admin Actions -->
                    ${isAdmin ? `
                        <div class="detail-admin-actions">
                            <h3 class="detail-label">
                                <i data-lucide="settings" style="width:16px;height:16px"></i>
                                การจัดการ (Admin)
                            </h3>
                            <div class="admin-action-grid">
                                <div class="form-group">
                                    <label class="form-label">เปลี่ยนสถานะ</label>
                                    <select id="detail-status" class="form-input form-select" onchange="updateTicketStatus('${ticket.id}', this.value)">
                                        ${Object.values(STATUSES).map(s => `
                                            <option value="${s}" ${ticket.status === s ? 'selected' : ''}>${s}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">มอบหมายผู้รับผิดชอบ</label>
                                    <select id="detail-assignee" class="form-input form-select" onchange="updateTicketAssignee('${ticket.id}', this.value)">
                                        <option value="">-- ยังไม่ได้มอบหมาย --</option>
                                        ${STAFF_MEMBERS.map(s => `
                                            <option value="${s}" ${ticket.assigned_to === s ? 'selected' : ''}>${s}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group form-group-full">
                                    <label class="form-label">เพิ่มหมายเหตุการดำเนินงาน</label>
                                    <textarea id="detail-note" class="form-input form-textarea" rows="3" placeholder="บันทึกผลการดำเนินงานหรือวิธีแก้ไข...">${ticket.resolution_note || ''}</textarea>
                                    <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="updateTicketNote('${ticket.id}')">
                                        <i data-lucide="save" style="width:14px;height:14px"></i>
                                        บันทึกหมายเหตุ
                                    </button>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Sidebar Info -->
                <div class="detail-sidebar">
                    <div class="detail-info-card glass-card">
                        <h3 class="detail-info-title">ข้อมูล Ticket</h3>
                        <div class="detail-info-list">
                            <div class="detail-info-item">
                                <span class="info-label"><i data-lucide="hash" style="width:14px;height:14px"></i> Ticket No</span>
                                <span class="info-value">${ticket.ticket_no}</span>
                            </div>
                            <div class="detail-info-item">
                                <span class="info-label"><i data-lucide="tag" style="width:14px;height:14px"></i> ประเภท</span>
                                <span class="info-value">${ticket.issue_type}</span>
                            </div>
                            <div class="detail-info-item">
                                <span class="info-label"><i data-lucide="map-pin" style="width:14px;height:14px"></i> สถานที่</span>
                                <span class="info-value">${ticket.location || '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="detail-info-card glass-card">
                        <h3 class="detail-info-title">ข้อมูลผู้แจ้ง</h3>
                        <div class="detail-info-list">
                            <div class="detail-info-item">
                                <span class="info-label"><i data-lucide="user" style="width:14px;height:14px"></i> ชื่อ</span>
                                <span class="info-value">${ticket.requester_name}</span>
                            </div>
                            <div class="detail-info-item">
                                <span class="info-label"><i data-lucide="mail" style="width:14px;height:14px"></i> อีเมล</span>
                                <span class="info-value">${ticket.requester_email || '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="detail-info-card glass-card">
                        <h3 class="detail-info-title">ผู้รับผิดชอบ</h3>
                        <div class="detail-info-list">
                            <div class="detail-info-item">
                                <span class="info-label"><i data-lucide="user-check" style="width:14px;height:14px"></i> มอบหมายให้</span>
                                <span class="info-value">${ticket.assigned_to || 'ยังไม่ได้มอบหมาย'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="detail-info-card glass-card">
                        <h3 class="detail-info-title">วันที่</h3>
                        <div class="detail-info-list">
                            <div class="detail-info-item">
                                <span class="info-label"><i data-lucide="calendar" style="width:14px;height:14px"></i> วันที่สร้าง</span>
                                <span class="info-value">${formatDate(ticket.created_at)}</span>
                            </div>
                            <div class="detail-info-item">
                                <span class="info-label"><i data-lucide="clock" style="width:14px;height:14px"></i> แก้ไขล่าสุด</span>
                                <span class="info-value">${formatDate(ticket.updated_at)}</span>
                            </div>
                            ${ticket.closed_at ? `
                                <div class="detail-info-item">
                                    <span class="info-label"><i data-lucide="check-circle" style="width:14px;height:14px"></i> วันที่ปิด</span>
                                    <span class="info-value">${formatDate(ticket.closed_at)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ── Action handlers ──────────────────────────────────────────

function updateTicketStatus(id, newStatus) {
    TicketService.update(id, { status: newStatus });
    Toast.success(`เปลี่ยนสถานะเป็น "${newStatus}" เรียบร้อย`);
    renderApp();
}

function updateTicketAssignee(id, assignee) {
    TicketService.update(id, { assigned_to: assignee });
    Toast.success(assignee ? `มอบหมายให้ "${assignee}" เรียบร้อย` : 'ยกเลิกการมอบหมายแล้ว');
}

function updateTicketNote(id) {
    const note = document.getElementById('detail-note')?.value || '';
    TicketService.update(id, { resolution_note: note });
    Toast.success('บันทึกหมายเหตุเรียบร้อย');
}

function cancelTicket(id) {
    Modal.confirm('ยกเลิก Ticket', 'คุณต้องการยกเลิก Ticket นี้ใช่หรือไม่?', () => {
        TicketService.update(id, { status: STATUSES.CANCELLED });
        Toast.success('ยกเลิก Ticket เรียบร้อย');
        renderApp();
    });
}

function deleteTicket(id) {
    Modal.confirm('ลบ Ticket', 'คุณต้องการลบ Ticket นี้ใช่หรือไม่? การลบจะไม่สามารถกู้คืนได้', () => {
        TicketService.delete(id);
        Toast.success('ลบ Ticket เรียบร้อย');
        navigateTo('tickets');
    });
}

function showEditTicketModal(id) {
    const ticket = TicketService.getById(id);
    if (!ticket) return;

    const issueTypes = IssueTypeService.getAll();

    Modal.show({
        title: 'แก้ไข Ticket',
        content: `
            <div class="edit-form">
                <div class="form-group">
                    <label class="form-label">หัวข้อปัญหา</label>
                    <input type="text" id="edit-title" class="form-input" value="${ticket.title}">
                </div>
                <div class="form-group">
                    <label class="form-label">รายละเอียด</label>
                    <textarea id="edit-description" class="form-input form-textarea" rows="3">${ticket.description}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">ประเภทปัญหา</label>
                    <select id="edit-type" class="form-input form-select">
                        ${issueTypes.map(t => `<option value="${t.name}" ${ticket.issue_type === t.name ? 'selected' : ''}>${t.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">สถานที่</label>
                    <input type="text" id="edit-location" class="form-input" value="${ticket.location}">
                </div>
                <div class="form-group">
                    <label class="form-label">ระดับความสำคัญ</label>
                    <select id="edit-priority" class="form-input form-select">
                        ${Object.values(PRIORITIES).map(p => `<option value="${p}" ${ticket.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
                    </select>
                </div>
            </div>
        `,
        confirmText: 'บันทึก',
        confirmClass: 'btn-primary',
        onConfirm: () => {
            const updates = {
                title: document.getElementById('edit-title').value.trim(),
                description: document.getElementById('edit-description').value.trim(),
                issue_type: document.getElementById('edit-type').value,
                location: document.getElementById('edit-location').value.trim(),
                priority: document.getElementById('edit-priority').value
            };
            TicketService.update(id, updates);
            Toast.success('แก้ไข Ticket เรียบร้อย');
            renderApp();
        }
    });
}
