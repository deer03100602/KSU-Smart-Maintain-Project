import { parseDescriptionAndAttachments } from './utils';

export function generateOfficialReportPdf({ ticket, expenses = [], summary = {}, evidences = [], timelines = [] }) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('กรุณาอนุญาตป๊อปอัป (Pop-up) ในเบราว์เซอร์เพื่อเปิดเอกสารรายงาน');
        return;
    }

    const { cleanDescription, attachments } = parseDescriptionAndAttachments(ticket.description);
    
    // Combine explicit ticket evidences and attached images from ticket description
    const allImages = [...evidences];
    attachments.forEach(att => {
        if (att.isImage && !allImages.some(img => img.url === att.url)) {
            allImages.push({
                url: att.url,
                description: att.name,
                stage: 'BEFORE'
            });
        }
    });

    const formatDate = (d) => {
        if (!d) return '-';
        try {
            return new Date(d).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return String(d);
        }
    };

    const formatCurrency = (amount) => {
        return Number(amount || 0).toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const htmlContent = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>ใบรายงานสรุปงานซ่อมบำรุงและค่าใช้จ่าย - ${ticket.ticket_no}</title>
    <style>
        @page {
            size: A4;
            margin: 15mm 20mm;
        }
        body {
            font-family: 'Sarabun', 'TH Sarabun New', 'Angsana New', sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: #111;
            margin: 0;
            padding: 0;
            background: #fff;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #222;
            padding-bottom: 12px;
            margin-bottom: 16px;
        }
        .header-title {
            font-size: 20px;
            font-weight: bold;
            margin: 0;
        }
        .header-subtitle {
            font-size: 14px;
            color: #555;
            margin: 4px 0 0 0;
        }
        .meta-bar {
            display: flex;
            justify-content: space-between;
            margin-bottom: 16px;
            font-size: 13px;
        }
        .section-title {
            font-size: 14px;
            font-weight: bold;
            background-color: #f1f5f9;
            padding: 4px 8px;
            border-left: 4px solid #1e3a8a;
            margin-top: 14px;
            margin-bottom: 8px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            font-size: 13px;
        }
        table.border-table th, table.border-table td {
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
        }
        table.border-table th {
            background-color: #f8fafc;
            text-align: center;
            font-weight: bold;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 16px;
            margin-bottom: 12px;
            font-size: 13px;
        }
        .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-top: 40px;
            page-break-inside: avoid;
        }
        .sign-box {
            text-align: center;
            font-size: 13px;
            line-height: 1.8;
        }
        .sign-line {
            margin-top: 45px;
            border-bottom: 1px dotted #333;
            width: 70%;
            margin-left: auto;
            margin-right: auto;
        }
        .evidence-grid {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 12px;
        }
        .evidence-item {
            width: 130px;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 4px;
            text-align: center;
            font-size: 11px;
        }
        .evidence-item img {
            width: 100%;
            height: 90px;
            object-fit: cover;
            border-radius: 2px;
        }
        @media print {
            .no-print {
                display: none !important;
            }
        }
    </style>
</head>
<body>
    <div class="no-print" style="text-align: right; margin-bottom: 15px;">
        <button onclick="window.print()" style="padding: 8px 20px; background: #1e3a8a; color: white; border: none; border-radius: 4px; font-size: 14px; cursor: pointer;">
            🖨️ พิมพ์หรือบันทึกเป็น PDF (A4)
        </button>
    </div>

    <div class="header">
        <div class="header-title">มหาวิทยาลัยกาฬสินธุ์ (Kalasin University)</div>
        <div class="header-title" style="font-size: 17px; margin-top: 4px;">รายงานผลการดำเนินงานซ่อมบำรุงและสรุปค่าใช้จ่าย</div>
        <div class="header-subtitle">ระบบบริหารจัดการงานแจ้งซ่อม KSU Smart Maintain</div>
    </div>

    <div class="meta-bar">
        <div><strong>เลขที่ใบแจ้งซ่อม:</strong> <span style="font-family: monospace; font-size: 14px; font-weight: bold;">${ticket.ticket_no}</span></div>
        <div><strong>วันที่ออกรายงาน:</strong> ${formatDate(new Date())}</div>
    </div>

    <div class="section-title">1. ข้อมูลการแจ้งซ่อม ผู้รับผิดชอบ และกำหนดการดำเนินงาน</div>
    <div class="info-grid">
        <div><strong>หัวข้อปัญหา:</strong> ${ticket.title}</div>
        <div><strong>ประเภทปัญหา:</strong> ${ticket.issue_type}</div>
        <div><strong>สถานที่เกิดเหตุ:</strong> ${ticket.location || '-'}</div>
        <div><strong>ระดับความเร่งด่วน:</strong> ${ticket.priority}</div>
        <div><strong>ผู้แจ้งเรื่อง:</strong> ${ticket.requester_name}</div>
        <div><strong>อีเมลผู้แจ้ง:</strong> ${ticket.requester_email || '-'}</div>
        <div><strong>เจ้าหน้าที่ผู้รับผิดชอบหลัก:</strong> ${ticket.assigned_to || 'ยังไม่ได้ระบุ'}</div>
        <div><strong>ผู้ร่วมดำเนินงาน:</strong> ${ticket.co_workers || 'ไม่มี'}</div>
        <div><strong>วันเริ่มดำเนินงาน:</strong> ${ticket.start_date ? formatDate(ticket.start_date) : '-'}</div>
        <div><strong>วันกำหนดเสร็จ (Due Date):</strong> ${ticket.due_date ? formatDate(ticket.due_date) : '-'}</div>
        <div><strong>สถานะปัจจุบัน:</strong> ${ticket.status}</div>
        <div><strong>วันที่แจ้งเรื่อง:</strong> ${formatDate(ticket.created_at)}</div>
        <div><strong>วันที่ตรวจรับ/ปิดงาน:</strong> ${ticket.closed_at ? formatDate(ticket.closed_at) : 'อยู่ระหว่างดำเนินการ'}</div>
        <div><strong>ผู้ตรวจรับงาน:</strong> ${ticket.accepted_by || '-'}</div>
    </div>

    <div style="margin-bottom: 12px; font-size: 13px;">
        <strong>รายละเอียดปัญหา:</strong>
        <div style="background: #fafafa; border: 1px solid #e2e8f0; padding: 8px; border-radius: 4px; margin-top: 4px; white-space: pre-wrap;">
            ${cleanDescription || '-'}
        </div>
    </div>

    ${(() => {
        if (!ticket.completion_summary) return '';
        try {
            const cs = JSON.parse(ticket.completion_summary);
            return `
            <div class="section-title">2. รายงานสรุปผลการส่งมอบงานและการตรวจรับ (Handover Report)</div>
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; margin-bottom: 12px; font-size: 13px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px;">
                <div><strong>📌 สรุปปัญหาที่พบ:</strong> ${cs.problem_summary || '-'}</div>
                <div><strong>🔍 สาเหตุของปัญหา:</strong> ${cs.root_cause || '-'}</div>
                <div><strong>🛠️ วิธีการแก้ไขที่ดำเนินการ:</strong> ${cs.solution_method || '-'}</div>
                <div><strong>📦 วัสดุ/อะไหล่ที่ใช้:</strong> ${cs.materials_used || '-'}</div>
                <div><strong>🔬 ผลการทดสอบระบบ:</strong> ${cs.testing_results || '-'}</div>
                <div><strong>💡 ข้อแนะนำการใช้งาน:</strong> ${cs.recommendations || '-'}</div>
            </div>
            `;
        } catch (e) {
            return `
            <div class="section-title">2. รายงานสรุปผลการส่งมอบงาน</div>
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px; border-radius: 4px; margin-bottom: 12px; font-size: 13px;">
                ${ticket.completion_summary}
            </div>
            `;
        }
    })()}

    ${ticket.resolution_note ? `
    <div style="margin-bottom: 12px; font-size: 13px;">
        <strong>บันทึกผลการดำเนินงาน / วิธีแก้ไข:</strong>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 8px; border-radius: 4px; margin-top: 4px; color: #166534;">
            ${ticket.resolution_note}
        </div>
    </div>
    ` : ''}

    <div class="section-title">3. รายการงบประมาณ วัสดุอุปกรณ์ และค่าใช้จ่าย</div>
    <table class="border-table">
        <thead>
            <tr>
                <th style="width: 5%;">ลำดับ</th>
                <th style="width: 15%;">หมวดหมู่</th>
                <th style="width: 35%;">รายการ</th>
                <th style="width: 10%;">จำนวน</th>
                <th style="width: 15%;">ราคา/หน่วย (บาท)</th>
                <th style="width: 10%;">สถานะ</th>
                <th style="width: 10%;">ยอดสุทธิ (บาท)</th>
            </tr>
        </thead>
        <tbody>
            ${expenses.length === 0 ? `
                <tr>
                    <td colspan="7" style="text-align: center; color: #64748b;">ไม่มีรายการค่าใช้จ่ายในงานนี้</td>
                </tr>
            ` : expenses.map((exp, idx) => `
                <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td>${exp.category}</td>
                    <td>
                        ${exp.description}
                        ${exp.receipt_no ? `<br/><span style="font-size: 11px; color: #64748b;">ใบเสร็จ: ${exp.receipt_no} ${exp.vendor_name ? `(${exp.vendor_name})` : ''}</span>` : ''}
                    </td>
                    <td style="text-align: center;">${exp.quantity} ${exp.unit}</td>
                    <td style="text-align: right;">${formatCurrency(exp.unit_price)}</td>
                    <td style="text-align: center;">${exp.status === 'APPROVED' ? 'อนุมัติ' : (exp.status === 'REJECTED' ? 'ไม่อนุมัติ' : (exp.status === 'PARTIALLY_APPROVED' ? 'อนุมัติบางส่วน' : 'รออนุมัติ'))}</td>
                    <td style="text-align: right; font-weight: bold;">${formatCurrency(exp.net_amount || exp.total_price)}</td>
                </tr>
            `).join('')}
        </tbody>
        <tfoot>
            <tr style="background: #f8fafc; font-weight: bold;">
                <td colspan="6" style="text-align: right;">ยอดรวมงบประมาณที่เสนอ:</td>
                <td style="text-align: right;">฿${formatCurrency(summary.totalProposed)}</td>
            </tr>
            <tr style="background: #f0fdf4; font-weight: bold; color: #166534;">
                <td colspan="6" style="text-align: right;">ยอดรวมงบประมาณที่อนุมัติ:</td>
                <td style="text-align: right;">฿${formatCurrency(summary.totalApproved)}</td>
            </tr>
            <tr style="background: #faf5ff; font-weight: bold; color: #7e22ce;">
                <td colspan="6" style="text-align: right;">ยอดเบิกจ่ายจริง (มีใบเสร็จตามเงื่อนไข):</td>
                <td style="text-align: right;">฿${formatCurrency(summary.totalDisbursed || summary.totalApproved)}</td>
            </tr>
            <tr style="background: #ecfdf5; font-weight: bold; color: #047857;">
                <td colspan="6" style="text-align: right;">งบประมาณคงเหลือ:</td>
                <td style="text-align: right;">฿${formatCurrency(summary.remainingBudget || 0)}</td>
            </tr>
        </tfoot>
    </table>

    ${allImages.length > 0 ? `
    <div class="section-title">4. รูปภาพและหลักฐานการดำเนินงาน</div>
    <div class="evidence-grid">
        ${allImages.slice(0, 12).map(evi => `
            <div class="evidence-item">
                <img src="${evi.url}" alt="${evi.description}" onerror="this.style.display='none'" />
                <div style="font-weight: bold; margin-top: 2px;">${evi.stage === 'BEFORE' ? 'ก่อนซ่อม' : (evi.stage === 'DURING' ? 'ระหว่างซ่อม' : (evi.stage === 'PARTS' ? 'วัสดุ/อะไหล่' : (evi.stage === 'AFTER' ? 'หลังซ่อม' : (evi.stage === 'TESTING' ? 'ผลทดสอบ' : (evi.stage === 'HANDOVER' ? 'ส่งมอบงาน' : 'ใบเสร็จ')))))}</div>
                <div style="color: #64748b; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${evi.description || '-'}</div>
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="section-title">5. การลงนามตรวจรับและอนุมัติ (ห้ามสร้างลายเซ็นแทนบุคคลจริง)</div>
    <div class="signature-grid">
        <div class="sign-box">
            <div>ลงชื่อ..............................................................</div>
            <div class="sign-line"></div>
            <div>( ${ticket.assigned_to || '..........................................................'} )</div>
            <div>เจ้าหน้าที่ผู้ปฏิบัติงาน / ผู้จัดทำ</div>
            <div>วันที่ ...... / ...... / ..........</div>
        </div>

        <div class="sign-box">
            <div>ลงชื่อ..............................................................</div>
            <div class="sign-line"></div>
            <div>( ${ticket.requester_name ? ticket.requester_name.replace(/\(.*?\)/, '').trim() : '..........................................................'} )</div>
            <div>ผู้แจ้งซ่อม / ผู้ตรวจรับงาน</div>
            <div>วันที่ ...... / ...... / ..........</div>
        </div>

        <div class="sign-box">
            <div>ลงชื่อ..............................................................</div>
            <div class="sign-line"></div>
            <div>( .......................................................... )</div>
            <div>หัวหน้างาน / ผู้ตรวจสอบงบประมาณ</div>
            <div>วันที่ ...... / ...... / ..........</div>
        </div>

        <div class="sign-box">
            <div>ลงชื่อ..............................................................</div>
            <div class="sign-line"></div>
            <div>( .......................................................... )</div>
            <div>ผู้บริหาร / ผู้อนุมัติเบิกจ่าย</div>
            <div>วันที่ ...... / ...... / ..........</div>
        </div>
    </div>
</body>
</html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
}
