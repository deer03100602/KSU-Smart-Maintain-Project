// ============================================================
// createTicket.js — Create Ticket Form Page
// ============================================================

function renderCreateTicketPage() {
    const issueTypes = IssueTypeService.getAll();
    const currentUser = UserService.getCurrentUser();

    return `
        <div class="page-create fade-in">
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">
                        <i data-lucide="plus-circle" style="width:24px;height:24px"></i>
                        แจ้งปัญหาใหม่
                    </h1>
                    <p class="page-subtitle">กรอกรายละเอียดปัญหาเพื่อสร้าง Ticket ใหม่ในระบบ</p>
                </div>
            </div>

            <form id="create-ticket-form" class="ticket-form glass-card" onsubmit="handleCreateTicket(event)">
                <!-- Issue Info Section -->
                <div class="form-section">
                    <h3 class="form-section-title">
                        <i data-lucide="info" style="width:18px;height:18px"></i>
                        ข้อมูลปัญหา
                    </h3>
                    
                    <div class="form-group">
                        <label for="ticket-title" class="form-label">หัวข้อปัญหา <span class="required">*</span></label>
                        <input type="text" id="ticket-title" class="form-input" placeholder="เช่น คอมพิวเตอร์ห้อง Lab 301 เปิดไม่ติด" required maxlength="200">
                        <span class="form-hint">อธิบายย่อสรุปสั้นๆ ชัดเจน</span>
                    </div>

                    <div class="form-group">
                        <label for="ticket-description" class="form-label">รายละเอียดปัญหา <span class="required">*</span></label>
                        <textarea id="ticket-description" class="form-input form-textarea" placeholder="อธิบายรายละเอียดปัญหา เช่น อาการ สิ่งที่ลองทำแล้ว ฯลฯ" required rows="4"></textarea>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="ticket-type" class="form-label">ประเภทปัญหา <span class="required">*</span></label>
                            <select id="ticket-type" class="form-input form-select" required>
                                <option value="">-- เลือกประเภท --</option>
                                ${issueTypes.map(t => `<option value="${t.name}">${t.name}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="ticket-priority" class="form-label">ระดับความสำคัญ <span class="required">*</span></label>
                            <select id="ticket-priority" class="form-input form-select" required>
                                <option value="Low">Low — ไม่เร่งด่วน</option>
                                <option value="Medium" selected>Medium — ทั่วไป</option>
                                <option value="High">High — ส่งผลต่อการทำงาน</option>
                                <option value="Urgent">Urgent — ต้องแก้ไขโดยด่วน</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="ticket-location" class="form-label">สถานที่ <span class="required">*</span></label>
                        <input type="text" id="ticket-location" class="form-input" placeholder="เช่น ห้อง Lab 301 ชั้น 3 อาคาร IT" required>
                    </div>
                </div>

                <!-- Requester Info Section -->
                <div class="form-section">
                    <h3 class="form-section-title">
                        <i data-lucide="user" style="width:18px;height:18px"></i>
                        ข้อมูลผู้แจ้ง
                    </h3>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="ticket-name" class="form-label">ชื่อผู้แจ้ง <span class="required">*</span></label>
                            <input type="text" id="ticket-name" class="form-input" placeholder="ชื่อ-นามสกุล" required value="${currentUser.name || ''}">
                        </div>

                        <div class="form-group">
                            <label for="ticket-email" class="form-label">อีเมล</label>
                            <input type="email" id="ticket-email" class="form-input" placeholder="email@example.com" value="${currentUser.email || ''}">
                        </div>
                    </div>
                </div>

                <!-- Submit -->
                <div class="form-actions">
                    <button type="button" class="btn btn-ghost" onclick="navigateTo('home')">ยกเลิก</button>
                    <button type="submit" class="btn btn-primary btn-lg" id="submit-ticket-btn">
                        <i data-lucide="send" style="width:18px;height:18px"></i>
                        ส่งแจ้งปัญหา
                    </button>
                </div>
            </form>
        </div>
    `;
}

function handleCreateTicket(event) {
    event.preventDefault();

    const title = document.getElementById('ticket-title').value.trim();
    let description = document.getElementById('ticket-description').value.trim();
    const issue_type = document.getElementById('ticket-type').value;
    const priority = document.getElementById('ticket-priority').value;
    const location = document.getElementById('ticket-location').value.trim();
    const requester_name = document.getElementById('ticket-name').value.trim();
    const requester_email = document.getElementById('ticket-email').value.trim();
    const requester_group = document.getElementById('ticket-group') ? document.getElementById('ticket-group').value : 'นักศึกษา';

    // Validation
    if (!title || !description || !issue_type || !location || !requester_name) {
        Toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
        return;
    }

    // Save user info for next time
    UserService.setCurrentUser(requester_name, requester_email, requester_group);

    // Create ticket
    const ticket = TicketService.create({
        title, description, issue_type, priority, location,
        requester_name, requester_email, requester_group
    });

    // Show success modal
    Modal.show({
        title: '✅ แจ้งปัญหาสำเร็จ!',
        content: `
            <div class="success-ticket-info">
                <div class="ticket-id-display">
                    <span class="label">Ticket ID</span>
                    <span class="value">${ticket.ticket_no}</span>
                </div>
                <p>ปัญหาของคุณถูกบันทึกเรียบร้อยแล้ว<br>คุณสามารถใช้เลข Ticket ID นี้ในการติดตามสถานะได้</p>
            </div>
        `,
        confirmText: 'ดูรายละเอียด Ticket',
        cancelText: 'แจ้งปัญหาเพิ่ม',
        confirmClass: 'btn-primary',
        onConfirm: () => navigateTo(`ticket/${ticket.id}`),
        onCancel: () => navigateTo('create')
    });
}
