// ============================================================
// issueTypes.js — Issue Type Management Page (Admin Only)
// ============================================================

function renderIssueTypesPage() {
    const issueTypes = IssueTypeService.getAll();

    return `
        <div class="page-issue-types fade-in">
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title text-gradient">
                        <i data-lucide="settings" style="width:26px;height:26px;color:var(--primary-color)"></i>
                        จัดการประเภทปัญหา
                    </h1>
                    <p class="page-subtitle">เพิ่ม ลบ หรือแก้ไขประเภทปัญหานำทางในแบบฟอร์มแจ้งซ่อม</p>
                </div>
                <button class="btn btn-primary" onclick="showAddIssueTypeModal()">
                    <i data-lucide="plus" style="width:16px;height:16px"></i>
                    เพิ่มประเภทใหม่
                </button>
            </div>

            <!-- Grid displaying categories -->
            <div class="issue-types-grid" id="issue-types-grid">
                ${issueTypes.map(type => `
                    <div class="type-card glass-card" id="type-card-${type.id}">
                        <div class="type-card-header">
                            <div class="type-icon-wrapper">
                                <i data-lucide="${type.icon || 'circle-help'}" class="type-icon"></i>
                            </div>
                            <div class="type-card-actions">
                                <button class="btn btn-ghost btn-icon-sm" onclick="showEditIssueTypeModal('${type.id}')" title="แก้ไข">
                                    <i data-lucide="edit-2" style="width:14px;height:14px"></i>
                                </button>
                                <button class="btn btn-danger-ghost btn-icon-sm" onclick="deleteIssueType('${type.id}')" title="ลบ">
                                    <i data-lucide="trash-2" style="width:14px;height:14px"></i>
                                </button>
                            </div>
                        </div>
                        <div class="type-card-body">
                            <h3 class="type-title">${type.name}</h3>
                            <p class="type-desc text-muted">${type.description || 'ไม่มีคำอธิบาย'}</p>
                            <span class="type-id-tag">ID: ${type.id}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ── Modals & Action Handlers ───────────────────────────────────

function showAddIssueTypeModal() {
    const icons = ['monitor', 'app-window', 'wifi', 'printer', 'school', 'key-round', 'circle-help', 'wrench', 'shield', 'activity'];

    Modal.show({
        title: 'เพิ่มประเภทปัญหาใหม่',
        content: `
            <div class="issue-type-form">
                <div class="form-group">
                    <label class="form-label">ชื่อประเภทปัญหา <span class="required">*</span></label>
                    <input type="text" id="new-type-name" class="form-input" placeholder="เช่น ระบบสแกนใบหน้า" required>
                </div>
                <div class="form-group">
                    <label class="form-label">คำอธิบาย</label>
                    <textarea id="new-type-desc" class="form-input form-textarea" placeholder="คำอธิบายรายละเอียดประเภทนี้..." rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">เลือกไอคอน (Lucide Icon)</label>
                    <div class="icon-selector-grid">
                        ${icons.map((icon, index) => `
                            <label class="icon-option">
                                <input type="radio" name="new-type-icon" value="${icon}" ${index === 0 ? 'checked' : ''}>
                                <div class="icon-option-box">
                                    <i data-lucide="${icon}"></i>
                                    <span>${icon}</span>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                </div>
            </div>
        `,
        confirmText: 'สร้างประเภท',
        confirmClass: 'btn-primary',
        onConfirm: () => {
            const name = document.getElementById('new-type-name').value.trim();
            const description = document.getElementById('new-type-desc').value.trim();
            const icon = document.querySelector('input[name="new-type-icon"]:checked')?.value || 'circle-help';

            if (!name) {
                Toast.error('กรุณากรอกชื่อประเภทปัญหา');
                return;
            }

            IssueTypeService.create({ name, description, icon });
            Toast.success('เพิ่มประเภทปัญหาสำเร็จแล้ว');
            renderApp();
        }
    });
}

function showEditIssueTypeModal(id) {
    const type = IssueTypeService.getById(id);
    if (!type) return;

    const icons = ['monitor', 'app-window', 'wifi', 'printer', 'school', 'key-round', 'circle-help', 'wrench', 'shield', 'activity'];

    Modal.show({
        title: 'แก้ไขประเภทปัญหา',
        content: `
            <div class="issue-type-form">
                <div class="form-group">
                    <label class="form-label">ชื่อประเภทปัญหา <span class="required">*</span></label>
                    <input type="text" id="edit-type-name" class="form-input" value="${type.name}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">คำอธิบาย</label>
                    <textarea id="edit-type-desc" class="form-input form-textarea" rows="3">${type.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">เลือกไอคอน (Lucide Icon)</label>
                    <div class="icon-selector-grid">
                        ${icons.map(icon => `
                            <label class="icon-option">
                                <input type="radio" name="edit-type-icon" value="${icon}" ${type.icon === icon ? 'checked' : ''}>
                                <div class="icon-option-box">
                                    <i data-lucide="${icon}"></i>
                                    <span>${icon}</span>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                </div>
            </div>
        `,
        confirmText: 'บันทึกการแก้ไข',
        confirmClass: 'btn-primary',
        onConfirm: () => {
            const name = document.getElementById('edit-type-name').value.trim();
            const description = document.getElementById('edit-type-desc').value.trim();
            const icon = document.querySelector('input[name="edit-type-icon"]:checked')?.value || 'circle-help';

            if (!name) {
                Toast.error('กรุณากรอกชื่อประเภทปัญหา');
                return;
            }

            IssueTypeService.update(id, { name, description, icon });
            Toast.success('แก้ไขประเภทปัญหาเรียบร้อย');
            renderApp();
        }
    });
}

function deleteIssueType(id) {
    Modal.confirm('ลบประเภทปัญหา', 'คุณแน่ใจหรือไม่ว่าต้องการลบประเภทปัญหานี้? ปัญหาที่ผูกกับประเภทนี้ในอดีตอาจไม่สอดคล้อง', () => {
        IssueTypeService.delete(id);
        Toast.success('ลบประเภทปัญหาสำเร็จแล้ว');
        renderApp();
    });
}

function initIssueTypesPage() {
    // No special initialization required beyond rendering
}
