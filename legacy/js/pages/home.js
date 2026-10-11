// ============================================================
// home.js — Home Page
// ============================================================

function renderHomePage() {
    const stats = TicketService.getStats();
    const recentTickets = stats.recentTickets;

    return `
        <div class="page-home fade-in">
            <!-- Hero Section -->
            <section class="hero-section">
                <div class="hero-content">
                    <div class="hero-badge">
                        <i data-lucide="wrench" style="width:16px;height:16px"></i>
                        AI-Powered University Maintenance & Ticket Management Web Application
                    </div>
                    <h1 class="hero-title">ระบบแจ้งปัญหาซ่อมบำรุง<br><span class="gradient-text">และติดตามสถานะด้วย AI</span></h1>
                    <p class="hero-description">
                        แจ้งปัญหาอาคารสถานที่ ห้องเรียน อุปกรณ์ด้านไอที หรือสาธารณูปโภคภายในมหาวิทยาลัย
                        พร้อมระบบติดตามสถานะการแก้ไขแบบ Real-time
                    </p>
                    <div class="hero-actions">
                        <a href="#create" class="btn btn-primary btn-lg">
                            <i data-lucide="plus-circle" style="width:18px;height:18px"></i>
                            แจ้งปัญหาใหม่
                        </a>
                        <a href="#tickets" class="btn btn-ghost btn-lg">
                            <i data-lucide="list" style="width:18px;height:18px"></i>
                            ดูรายการ Ticket
                        </a>
                    </div>
                </div>
                <div class="hero-visual">
                    <div class="hero-illustration">
                        <div class="floating-card fc-1">
                            <i data-lucide="check-circle" style="width:24px;height:24px;color:#4ade80"></i>
                            <span>Resolved</span>
                        </div>
                        <div class="floating-card fc-2">
                            <i data-lucide="clock" style="width:24px;height:24px;color:#fbbf24"></i>
                            <span>In Progress</span>
                        </div>
                        <div class="floating-card fc-3">
                            <i data-lucide="alert-circle" style="width:24px;height:24px;color:#60a5fa"></i>
                            <span>New Ticket</span>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Stats Cards -->
            <section class="stats-section">
                <div class="stats-grid">
                    <div class="stat-card stat-total">
                        <div class="stat-icon">
                            <i data-lucide="ticket" style="width:24px;height:24px"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-number">${stats.total}</span>
                            <span class="stat-label">Ticket ทั้งหมด</span>
                        </div>
                    </div>
                    <div class="stat-card stat-open">
                        <div class="stat-icon">
                            <i data-lucide="circle-dot" style="width:24px;height:24px"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-number">${stats.byStatus['Open'] || 0}</span>
                            <span class="stat-label">รอรับเรื่อง</span>
                        </div>
                    </div>
                    <div class="stat-card stat-progress">
                        <div class="stat-icon">
                            <i data-lucide="loader" style="width:24px;height:24px"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-number">${stats.byStatus['In Progress'] || 0}</span>
                            <span class="stat-label">กำลังดำเนินการ</span>
                        </div>
                    </div>
                    <div class="stat-card stat-resolved">
                        <div class="stat-icon">
                            <i data-lucide="check-circle-2" style="width:24px;height:24px"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-number">${(stats.byStatus['Resolved'] || 0) + (stats.byStatus['Closed'] || 0)}</span>
                            <span class="stat-label">แก้ไขแล้ว</span>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Recent Tickets -->
            <section class="recent-section">
                <div class="section-header">
                    <h2 class="section-title">
                        <i data-lucide="clock" style="width:20px;height:20px"></i>
                        Ticket ล่าสุด
                    </h2>
                    <a href="#tickets" class="btn btn-ghost btn-sm">ดูทั้งหมด →</a>
                </div>
                <div class="recent-tickets">
                    ${recentTickets.length > 0 ? 
                        recentTickets.map(t => renderTicketCard(t, { compact: false })).join('') :
                        '<p class="text-muted">ยังไม่มี Ticket</p>'
                    }
                </div>
            </section>

            <!-- How it works -->
            <section class="how-section">
                <h2 class="section-title center-text">
                    <i data-lucide="zap" style="width:20px;height:20px"></i>
                    ขั้นตอนการใช้งาน
                </h2>
                <div class="steps-grid">
                    <div class="step-card">
                        <div class="step-number">1</div>
                        <div class="step-icon"><i data-lucide="edit-3" style="width:28px;height:28px"></i></div>
                        <h3>แจ้งปัญหา</h3>
                        <p>กรอกแบบฟอร์มแจ้งปัญหาพร้อมรายละเอียด</p>
                    </div>
                    <div class="step-card">
                        <div class="step-number">2</div>
                        <div class="step-icon"><i data-lucide="ticket" style="width:28px;height:28px"></i></div>
                        <h3>รับ Ticket ID</h3>
                        <p>ระบบสร้างเลข Ticket สำหรับติดตามสถานะ</p>
                    </div>
                    <div class="step-card">
                        <div class="step-number">3</div>
                        <div class="step-icon"><i data-lucide="wrench" style="width:28px;height:28px"></i></div>
                        <h3>ดำเนินการแก้ไข</h3>
                        <p>เจ้าหน้าที่รับเรื่องและดำเนินการแก้ไข</p>
                    </div>
                    <div class="step-card">
                        <div class="step-number">4</div>
                        <div class="step-icon"><i data-lucide="check-circle" style="width:28px;height:28px"></i></div>
                        <h3>ปัญหาได้รับการแก้ไข</h3>
                        <p>ติดตามผลและปิดงานเมื่อเสร็จสิ้น</p>
                    </div>
                </div>
            </section>
        </div>
    `;
}
