// ============================================================
// myTickets.js — My Tickets Page
// ============================================================

function renderMyTicketsPage() {
    const currentUser = UserService.getCurrentUser();

    return `
        <div class="page-my-tickets fade-in">
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">
                        <i data-lucide="user" style="width:24px;height:24px"></i>
                        ปัญหาของฉัน
                    </h1>
                    <p class="page-subtitle">ติดตามสถานะปัญหาที่คุณแจ้งไว้เข้าระบบ</p>
                </div>
                <a href="#create" class="btn btn-primary">
                    <i data-lucide="plus" style="width:16px;height:16px"></i>
                    แจ้งปัญหาใหม่
                </a>
            </div>

            <!-- Profile / Filter settings -->
            <div class="profile-card glass-card">
                <div class="profile-icon">
                    <i data-lucide="user-circle" style="width:48px;height:48px;color:var(--primary-color)"></i>
                </div>
                <div class="profile-details">
                    <h3>โปรไฟล์ผู้แจ้งปัญหาจำลอง</h3>
                    <p class="text-muted">ระบบระบุตัวตนของคุณจากชื่อและอีเมลด้านล่างเพื่อแสดงรายการปัญหากระทู้ของคุณ</p>
                    
                    <form id="profile-update-form" class="profile-form" onsubmit="updateProfile(event)">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">ชื่อผู้แจ้ง</label>
                                <input type="text" id="profile-name" class="form-input" value="${currentUser.name}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">อีเมล</label>
                                <input type="email" id="profile-email" class="form-input" value="${currentUser.email}">
                            </div>
                            <div class="form-group btn-group-align">
                                <button type="submit" class="btn btn-ghost btn-sm">
                                    <i data-lucide="save" style="width:14px;height:14px"></i>
                                    อัปเดตและกรอง
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            <!-- My Tickets Container -->
            <div class="results-header" id="my-results-header"></div>
            <div id="my-tickets-container">
                <!-- User's tickets will be rendered here -->
            </div>
        </div>
    `;
}

function updateProfile(event) {
    event.preventDefault();
    const name = document.getElementById('profile-name').value.trim();
    const email = document.getElementById('profile-email').value.trim();

    if (!name) {
        Toast.error('กรุณากรอกชื่อผู้แจ้ง');
        return;
    }

    UserService.setCurrentUser(name, email);
    Toast.success('อัปเดตข้อมูลผู้ใช้งานจำลองแล้ว');
    filterMyTickets();
}

function filterMyTickets() {
    const currentUser = UserService.getCurrentUser();
    
    // Get all tickets and filter by requester_name (case insensitive match)
    const tickets = TicketService.getAll().filter(t => 
        t.requester_name.toLowerCase().trim() === currentUser.name.toLowerCase().trim() ||
        (currentUser.email && t.requester_email.toLowerCase().trim() === currentUser.email.toLowerCase().trim())
    );

    // Update count header
    const headerEl = document.getElementById('my-results-header');
    if (headerEl) {
        headerEl.innerHTML = `<span class="results-count">พบปัญหาของคุณ ${tickets.length} รายการ</span>`;
    }

    // Render tickets
    const container = document.getElementById('my-tickets-container');
    if (container) {
        container.innerHTML = renderTicketTable(tickets);
        if (window.lucide) lucide.createIcons();
    }
}

// Called after rendering the page
function initMyTicketsPage() {
    filterMyTickets();
}
