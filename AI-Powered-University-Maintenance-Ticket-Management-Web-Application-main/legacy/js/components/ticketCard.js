// ============================================================
// ticketCard.js — Reusable Ticket Card Component
// ============================================================

function renderTicketCard(ticket, options = {}) {
    const { showActions = false, compact = false } = options;
    const statusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS['Open'];
    const priorityColor = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS['Medium'];

    const priorityIcons = {
        'Low': 'arrow-down',
        'Medium': 'minus',
        'High': 'arrow-up',
        'Urgent': 'alert-triangle'
    };

    const issueTypeIcons = {
        'Computer Hardware': 'monitor',
        'Software / Application': 'app-window',
        'Network / Internet': 'wifi',
        'Printer / Scanner': 'printer',
        'Classroom / Lab Room': 'school',
        'Account / Login': 'key-round',
        'Other': 'circle-help'
    };

    if (compact) {
        return `
            <div class="ticket-card ticket-card-compact" onclick="navigateTo('ticket/${ticket.id}')" data-id="${ticket.id}">
                <div class="ticket-card-left">
                    <span class="ticket-no">${ticket.ticket_no}</span>
                    <span class="ticket-title-compact">${ticket.title}</span>
                </div>
                <div class="ticket-card-right">
                    <span class="status-badge" style="background:${statusColor.bg};color:${statusColor.text};border:1px solid ${statusColor.border}">${ticket.status}</span>
                    <span class="priority-badge" style="background:${priorityColor.bg};color:${priorityColor.text};border:1px solid ${priorityColor.border}">
                        <i data-lucide="${priorityIcons[ticket.priority]}" style="width:12px;height:12px"></i>
                        ${ticket.priority}
                    </span>
                </div>
            </div>
        `;
    }

    return `
        <div class="ticket-card" onclick="navigateTo('ticket/${ticket.id}')" data-id="${ticket.id}">
            <div class="ticket-card-header">
                <div class="ticket-card-id-row">
                    <span class="ticket-no">${ticket.ticket_no}</span>
                    <span class="ticket-time">${timeAgo(ticket.created_at)}</span>
                </div>
                <h3 class="ticket-card-title">${ticket.title}</h3>
            </div>
            <div class="ticket-card-meta">
                <div class="ticket-meta-item">
                    <i data-lucide="${issueTypeIcons[ticket.issue_type] || 'circle-help'}" style="width:14px;height:14px"></i>
                    <span>${ticket.issue_type}</span>
                </div>
                <div class="ticket-meta-item">
                    <i data-lucide="map-pin" style="width:14px;height:14px"></i>
                    <span>${ticket.location || '-'}</span>
                </div>
                <div class="ticket-meta-item">
                    <i data-lucide="user" style="width:14px;height:14px"></i>
                    <span>${ticket.requester_name}</span>
                </div>
                ${ticket.assigned_to ? `
                    <div class="ticket-meta-item">
                        <i data-lucide="user-check" style="width:14px;height:14px"></i>
                        <span>${ticket.assigned_to}</span>
                    </div>
                ` : ''}
            </div>
            <div class="ticket-card-footer">
                <span class="status-badge" style="background:${statusColor.bg};color:${statusColor.text};border:1px solid ${statusColor.border}">${ticket.status}</span>
                <span class="priority-badge" style="background:${priorityColor.bg};color:${priorityColor.text};border:1px solid ${priorityColor.border}">
                    <i data-lucide="${priorityIcons[ticket.priority]}" style="width:12px;height:12px"></i>
                    ${ticket.priority}
                </span>
            </div>
        </div>
    `;
}

function renderTicketTable(tickets) {
    if (tickets.length === 0) {
        return `
            <div class="empty-state">
                <i data-lucide="inbox" class="empty-icon"></i>
                <h3>ไม่พบ Ticket</h3>
                <p>ยังไม่มีรายการปัญหาที่ตรงกับเงื่อนไข</p>
            </div>
        `;
    }

    return `
        <div class="ticket-grid">
            ${tickets.map(t => renderTicketCard(t)).join('')}
        </div>
    `;
}
