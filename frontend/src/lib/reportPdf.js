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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ใบรายงานสรุปผลการดำเนินงานซ่อมบำรุงและค่าใช้จ่าย - ${ticket.ticket_no}</title>
    <!-- Google Fonts: Sarabun for crisp, standard, distortion-free Thai typography -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
    <style>
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        @page {
            size: A4 portrait;
            margin: 12mm 15mm 15mm 15mm;
        }
        body {
            font-family: 'Sarabun', 'TH Sarabun New', 'Noto Sans Thai', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif;
            font-size: 13.5px;
            line-height: 1.55;
            color: #1e293b;
            background-color: #f1f5f9;
            margin: 0;
            padding: 24px 0 40px;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        /* Top Action Bar in Browser View */
        .print-toolbar {
            position: sticky;
            top: 0;
            z-index: 1000;
            max-width: 210mm;
            margin: 0 auto 16px;
            padding: 10px 16px;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        .btn-print {
            padding: 8px 18px;
            background: #1e3a8a;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            font-size: 13.5px;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: background 0.2s;
        }
        .btn-print:hover {
            background: #172554;
        }
        .btn-close {
            padding: 8px 14px;
            background: #f8fafc;
            color: #475569;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 13px;
            font-family: inherit;
            cursor: pointer;
        }
        .btn-close:hover {
            background: #e2e8f0;
        }

        /* A4 Paper Sheet Frame */
        .a4-page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 16mm 18mm 20mm;
            background: #ffffff;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
            border-radius: 6px;
            position: relative;
        }

        /* Document Header */
        .doc-header {
            text-align: center;
            border-bottom: 2.5px solid #0f2b5c;
            padding-bottom: 12px;
            margin-bottom: 14px;
        }
        .doc-title-main {
            font-size: 19px;
            font-weight: 700;
            color: #0f2b5c;
            margin: 0;
            letter-spacing: -0.2px;
        }
        .doc-title-sub {
            font-size: 16px;
            font-weight: 600;
            color: #1e3a8a;
            margin: 4px 0 2px;
        }
        .doc-title-org {
            font-size: 13px;
            color: #64748b;
            margin: 0;
        }

        /* Meta Bar (Ticket No & Date) */
        .meta-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 14px;
            margin-bottom: 14px;
            font-size: 13px;
        }
        .ticket-code-pill {
            display: inline-block;
            background: #0f2b5c;
            color: #ffffff;
            padding: 2px 10px;
            border-radius: 4px;
            font-weight: 700;
            font-size: 13px;
            letter-spacing: 0.5px;
        }

        /* Section Title Styling */
        .section-title {
            font-size: 14px;
            font-weight: 700;
            color: #0f2b5c;
            background: #f1f5f9;
            border-left: 4px solid #1e3a8a;
            border-bottom: 1px solid #e2e8f0;
            padding: 6px 12px;
            margin-top: 16px;
            margin-bottom: 8px;
            border-radius: 0 4px 4px 0;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        /* Structured Key-Value Table */
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
            font-size: 13px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            overflow: hidden;
        }
        .info-table td {
            padding: 6px 10px;
            vertical-align: middle;
            border: 1px solid #f1f5f9;
        }
        .info-table td.lbl {
            width: 18%;
            color: #475569;
            font-weight: 600;
            background: #f8fafc;
            white-space: nowrap;
            border-right: 1px solid #e2e8f0;
        }
        .info-table td.val {
            width: 32%;
            color: #0f172a;
            font-weight: 400;
        }

        /* Problem Description Box */
        .desc-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 14px;
            margin-bottom: 12px;
            font-size: 13px;
            color: #1e293b;
            line-height: 1.6;
            white-space: pre-wrap;
            word-break: break-word;
        }

        /* Handover Box */
        .handover-card {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 10px 14px;
            margin-bottom: 12px;
            font-size: 13px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 16px;
        }
        .handover-item-title {
            font-weight: 600;
            color: #0f2b5c;
            margin-bottom: 2px;
        }

        /* Badges */
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            line-height: 1.3;
        }
        .badge-danger { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
        .badge-warning { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .badge-success { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
        .badge-info { background: #e0f2fe; color: #075985; border: 1px solid #7dd3fc; }
        .badge-neutral { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }

        /* Expense Table */
        table.border-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            margin-bottom: 12px;
            font-size: 12.5px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            overflow: hidden;
        }
        table.border-table th {
            background: #0f2b5c;
            color: #ffffff;
            padding: 7px 8px;
            font-weight: 600;
            border: 1px solid #0f2b5c;
            text-align: center;
            font-size: 12.5px;
        }
        table.border-table td {
            border: 1px solid #e2e8f0;
            padding: 6px 8px;
            vertical-align: middle;
        }
        table.border-table tbody tr:nth-child(even) td {
            background: #f8fafc;
        }
        table.border-table tfoot td {
            padding: 7px 10px;
            font-size: 13px;
        }

        /* Evidence Photos Grid */
        .evidence-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: 10px;
            margin-top: 8px;
            margin-bottom: 14px;
        }
        .evidence-item {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 5px;
            background: #ffffff;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .evidence-item img {
            width: 100%;
            height: 90px;
            object-fit: cover;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
            display: block;
        }
        .evidence-label {
            font-weight: 600;
            color: #0f2b5c;
            margin-top: 4px;
            font-size: 11px;
        }
        .evidence-desc {
            color: #64748b;
            font-size: 10px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin-top: 1px;
        }

        /* Signatures Grid (4 columns) */
        .signature-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-top: 24px;
            margin-bottom: 10px;
            page-break-inside: avoid;
        }
        .sign-box {
            text-align: center;
            font-size: 11.5px;
            line-height: 1.5;
            background: #fafafa;
            border: 1px dashed #cbd5e1;
            border-radius: 6px;
            padding: 10px 4px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .sign-title {
            font-weight: 600;
            color: #475569;
            font-size: 11.5px;
            white-space: nowrap;
        }
        .sign-line {
            margin-top: 34px;
            margin-bottom: 6px;
            border-bottom: 1px dotted #475569;
            width: 82%;
            margin-left: auto;
            margin-right: auto;
        }
        .sign-name {
            font-size: 10.5px;
            color: #1e293b;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            padding: 0 2px;
            line-height: 1.4;
        }
        .sign-sub {
            color: #64748b;
            font-size: 10.5px;
            white-space: nowrap;
            line-height: 1.4;
        }
        .sign-date {
            color: #64748b;
            font-size: 10.5px;
            margin-top: 2px;
            white-space: nowrap;
            line-height: 1.4;
        }

        /* Print Settings */
        @media print {
            body {
                background: #ffffff !important;
                padding: 0 !important;
            }
            .a4-page {
                width: 100% !important;
                min-height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border-radius: 0 !important;
            }
            .no-print {
                display: none !important;
            }
            .signature-grid {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <!-- Top Action Bar -->
    <div class="no-print print-toolbar">
        <div style="font-weight: 600; font-size: 14.5px; color: #0f2b5c; display: flex; align-items: center; gap: 8px;">
            <span>📄 ตัวอย่างเอกสารรายงานสรุปงานซ่อมบำรุงและค่าใช้จ่าย (A4)</span>
        </div>
        <div style="display: flex; gap: 8px;">
            <button onclick="window.print()" class="btn-print">
                🖨️ พิมพ์หรือบันทึกเป็น PDF (A4)
            </button>
            <button onclick="window.close()" class="btn-close">
                ✕ ปิดหน้าต่าง
            </button>
        </div>
    </div>

    <!-- Main A4 Page Document -->
    <div class="a4-page">
        <!-- University & Report Header -->
        <div class="doc-header">
            <h1 class="doc-title-main">มหาวิทยาลัยกาฬสินธุ์ (Kalasin University)</h1>
            <h2 class="doc-title-sub">รายงานผลการดำเนินงานซ่อมบำรุงและสรุปค่าใช้จ่าย</h2>
            <p class="doc-title-org">ระบบแจ้งซ่อมสิ่งพานิชย์และอุปกรณ์อัจฉริยะภายในมหาวิทยาลัยด้วย AI (AI-Powered University Maintenance & Ticket Management Web Application)</p>
        </div>

        <!-- Meta Information Bar -->
        <div class="meta-bar">
            <div>
                <strong style="color: #475569;">เลขที่ใบแจ้งซ่อม:</strong> 
                <span class="ticket-code-pill">${ticket.ticket_no}</span>
            </div>
            <div>
                <strong style="color: #475569;">วันที่พิมพ์เอกสาร:</strong> 
                <span style="font-weight: 600; color: #0f2b5c;">${formatDate(new Date())}</span>
            </div>
        </div>

        <!-- Section 1: Ticket Info & Schedule -->
        <div class="section-title">
            <span>1. ข้อมูลการแจ้งซ่อม ผู้รับผิดชอบ และกำหนดการดำเนินงาน</span>
        </div>

        <table class="info-table">
            <tbody>
                <tr>
                    <td class="lbl">หัวข้อปัญหา:</td>
                    <td class="val" colspan="3"><strong style="color: #0f2b5c; font-size: 13.5px;">${ticket.title}</strong></td>
                </tr>
                <tr>
                    <td class="lbl">ประเภทปัญหา:</td>
                    <td class="val"><span class="badge badge-neutral">${ticket.issue_type}</span></td>
                    <td class="lbl">ระดับความเร่งด่วน:</td>
                    <td class="val">
                        <span class="badge ${
                            ticket.priority === 'High' || ticket.priority === 'ด่วนมาก' || ticket.priority === 'ฉุกเฉิน' ? 'badge-danger' : 
                            (ticket.priority === 'Medium' || ticket.priority === 'ปานกลาง' || ticket.priority === 'ด่วน' ? 'badge-warning' : 'badge-info')
                        }">
                            ${ticket.priority}
                        </span>
                    </td>
                </tr>
                <tr>
                    <td class="lbl">สถานที่เกิดเหตุ:</td>
                    <td class="val">${ticket.location || '-'}</td>
                    <td class="lbl">สถานะปัจจุบัน:</td>
                    <td class="val">
                        <span class="badge ${
                            ticket.status === 'Closed' ? 'badge-success' : 
                            (ticket.status === 'Cancelled' ? 'badge-danger' : 
                            (ticket.status === 'In Progress' ? 'badge-primary' : 'badge-info'))
                        }">
                            ${ticket.status}
                        </span>
                    </td>
                </tr>
                <tr>
                    <td class="lbl">ผู้แจ้งเรื่อง:</td>
                    <td class="val">${ticket.requester_name}</td>
                    <td class="lbl">อีเมลผู้แจ้ง:</td>
                    <td class="val">${ticket.requester_email || '-'}</td>
                </tr>
                <tr>
                    <td class="lbl">เจ้าหน้าที่ผู้รับผิดชอบ:</td>
                    <td class="val"><strong>${ticket.assigned_to || 'ยังไม่ได้ระบุ'}</strong></td>
                    <td class="lbl">ผู้ร่วมดำเนินงาน:</td>
                    <td class="val">${ticket.co_workers || 'ไม่มี'}</td>
                </tr>
                <tr>
                    <td class="lbl">วันที่แจ้งเรื่อง:</td>
                    <td class="val">${formatDate(ticket.created_at)}</td>
                    <td class="lbl">วันกำหนดเสร็จ (Due Date):</td>
                    <td class="val">${ticket.due_date ? formatDate(ticket.due_date) : '-'}</td>
                </tr>
                <tr>
                    <td class="lbl">วันเริ่มดำเนินงาน:</td>
                    <td class="val">${ticket.start_date ? formatDate(ticket.start_date) : '-'}</td>
                    <td class="lbl">วันที่ตรวจรับ/ปิดงาน:</td>
                    <td class="val">${ticket.closed_at ? formatDate(ticket.closed_at) : 'อยู่ระหว่างดำเนินการ'}</td>
                </tr>
                <tr>
                    <td class="lbl">รับผิดชอบโดย/หน่วยงาน:</td>
                    <td class="val">${ticket.assigned_dept || 'ฝ่ายบำรุงรักษาและเทคโนโลยี'}</td>
                    <td class="lbl">ผู้ตรวจรับงาน:</td>
                    <td class="val">${ticket.accepted_by || '-'}</td>
                </tr>
            </tbody>
        </table>

        <div style="margin-top: 8px; margin-bottom: 12px;">
            <div style="font-weight: 600; color: #475569; font-size: 13px; margin-bottom: 4px;">รายละเอียดปัญหา:</div>
            <div class="desc-box">${cleanDescription || '-'}</div>
        </div>

        <!-- Section 2: Handover Report (if available) -->
        ${(() => {
            if (!ticket.completion_summary) return '';
            try {
                const cs = JSON.parse(ticket.completion_summary);
                return `
                <div class="section-title">2. รายงานสรุปผลการส่งมอบงานและการตรวจรับ (Handover Report)</div>
                <div class="handover-card">
                    <div>
                        <div class="handover-item-title">📌 สรุปปัญหาที่ตรวจพบ:</div>
                        <div>${cs.problem_summary || '-'}</div>
                    </div>
                    <div>
                        <div class="handover-item-title">🔍 สาเหตุของปัญหา:</div>
                        <div>${cs.root_cause || '-'}</div>
                    </div>
                    <div>
                        <div class="handover-item-title">🛠️ วิธีการและขั้นตอนแก้ไข:</div>
                        <div>${cs.solution_method || '-'}</div>
                    </div>
                    <div>
                        <div class="handover-item-title">📦 รายการวัสดุ/อะไหล่ที่ใช้จริง:</div>
                        <div>${cs.materials_used || '-'}</div>
                    </div>
                    <div>
                        <div class="handover-item-title">🔬 ผลการทดสอบการใช้งาน:</div>
                        <div>${cs.testing_results || '-'}</div>
                    </div>
                    <div>
                        <div class="handover-item-title">💡 ข้อเสนอแนะหรือสิ่งที่ต้องติดตาม:</div>
                        <div>${cs.recommendations || '-'}</div>
                    </div>
                </div>
                `;
            } catch (e) {
                return `
                <div class="section-title">2. รายงานสรุปผลการส่งมอบงาน</div>
                <div class="desc-box">${ticket.completion_summary}</div>
                `;
            }
        })()}

        ${ticket.resolution_note ? `
        <div style="margin-bottom: 12px; font-size: 13px;">
            <div style="font-weight: 600; color: #166534; font-size: 13px; margin-bottom: 4px;">บันทึกผลการดำเนินงาน / วิธีแก้ไข:</div>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px 14px; border-radius: 6px; color: #166534; line-height: 1.55;">
                ${ticket.resolution_note}
            </div>
        </div>
        ` : ''}

        <!-- Section 3: Budget, Parts & Expenses Table -->
        <div class="section-title">3. รายการงบประมาณ วัสดุอุปกรณ์ และค่าใช้จ่าย</div>
        <table class="border-table">
            <thead>
                <tr>
                    <th style="width: 6%;">ลำดับ</th>
                    <th style="width: 14%;">หมวดหมู่</th>
                    <th style="width: 32%;">รายการ / รายละเอียด</th>
                    <th style="width: 11%;">จำนวน</th>
                    <th style="width: 13%;">ราคา/หน่วย (บาท)</th>
                    <th style="width: 11%;">สถานะ</th>
                    <th style="width: 13%;">ยอดสุทธิ (บาท)</th>
                </tr>
            </thead>
            <tbody>
                ${expenses.length === 0 ? `
                    <tr>
                        <td colspan="7" style="text-align: center; color: #64748b; padding: 14px;">ไม่มีรายการค่าใช้จ่ายในงานนี้</td>
                    </tr>
                ` : expenses.map((exp, idx) => `
                    <tr>
                        <td style="text-align: center; font-weight: 600;">${idx + 1}</td>
                        <td style="text-align: center;"><span class="badge badge-neutral">${exp.category}</span></td>
                        <td>
                            <strong style="color: #0f2b5c;">${exp.description}</strong>
                            ${exp.receipt_no ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">เลขที่ใบเสร็จ: ${exp.receipt_no} ${exp.vendor_name ? `(${exp.vendor_name})` : ''}</div>` : ''}
                        </td>
                        <td style="text-align: center;">${exp.quantity} ${exp.unit}</td>
                        <td style="text-align: right;">${formatCurrency(exp.unit_price)}</td>
                        <td style="text-align: center;">
                            <span class="badge ${exp.status === 'APPROVED' ? 'badge-success' : (exp.status === 'REJECTED' ? 'badge-danger' : 'badge-warning')}">
                                ${exp.status === 'APPROVED' ? 'อนุมัติ' : (exp.status === 'REJECTED' ? 'ไม่อนุมัติ' : (exp.status === 'PARTIALLY_APPROVED' ? 'อนุมัติบางส่วน' : 'รออนุมัติ'))}
                            </span>
                        </td>
                        <td style="text-align: right; font-weight: 700; color: #0f2b5c;">${formatCurrency(exp.net_amount || exp.total_price)}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr style="background: #f8fafc; font-weight: 600;">
                    <td colspan="6" style="text-align: right; color: #475569;">ยอดรวมงบประมาณที่เสนอ:</td>
                    <td style="text-align: right; font-weight: 700; color: #0f2b5c;">฿${formatCurrency(summary.totalProposed)}</td>
                </tr>
                <tr style="background: #f0fdf4; font-weight: 600; color: #166534;">
                    <td colspan="6" style="text-align: right;">ยอดรวมงบประมาณที่อนุมัติ:</td>
                    <td style="text-align: right; font-weight: 700;">฿${formatCurrency(summary.totalApproved)}</td>
                </tr>
                <tr style="background: #faf5ff; font-weight: 600; color: #7e22ce;">
                    <td colspan="6" style="text-align: right;">ยอดเบิกจ่ายจริง (มีใบเสร็จตามเงื่อนไข):</td>
                    <td style="text-align: right; font-weight: 700;">฿${formatCurrency(summary.totalDisbursed || summary.totalApproved)}</td>
                </tr>
                <tr style="background: #ecfdf5; font-weight: 700; color: #047857; font-size: 13.5px;">
                    <td colspan="6" style="text-align: right;">งบประมาณคงเหลือ:</td>
                    <td style="text-align: right; font-weight: 700; font-size: 14px;">฿${formatCurrency(summary.remainingBudget || 0)}</td>
                </tr>
            </tfoot>
        </table>

        <!-- Section 4: Attached Photos & Evidence -->
        ${allImages.length > 0 ? `
        <div class="section-title">4. รูปภาพและหลักฐานการดำเนินงาน</div>
        <div class="evidence-grid">
            ${allImages.slice(0, 12).map(evi => `
                <div class="evidence-item">
                    <img src="${evi.url}" alt="${evi.description || 'หลักฐานงานซ่อม'}" onerror="this.style.display='none'" />
                    <div class="evidence-label">${evi.stage === 'BEFORE' ? '📷 ก่อนซ่อม' : (evi.stage === 'DURING' ? '⚙️ ระหว่างซ่อม' : (evi.stage === 'PARTS' ? '📦 วัสดุ/อะไหล่' : (evi.stage === 'AFTER' ? '🎉 หลังซ่อม' : (evi.stage === 'TESTING' ? '🔬 ผลทดสอบ' : (evi.stage === 'HANDOVER' ? '📋 ส่งมอบงาน' : '🧾 ใบเสร็จ')))))}</div>
                    <div class="evidence-desc" title="${evi.description || ''}">${evi.description || '-'}</div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        <!-- Section 5: Official Signatures -->
        <div class="section-title">5. การลงนามตรวจรับและอนุมัติ (ห้ามสร้างลายเซ็นแทนบุคคลจริง)</div>
        <div class="signature-grid">
            <div class="sign-box">
                <div class="sign-title">ผู้ปฏิบัติงาน / ผู้จัดทำ</div>
                <div class="sign-line"></div>
                <div class="sign-name">( ${ticket.assigned_to || '..............................'} )</div>
                <div class="sign-sub">เจ้าหน้าที่ผู้รับผิดชอบ</div>
                <div class="sign-date">วันที่ ...... / ...... / ..........</div>
            </div>

            <div class="sign-box">
                <div class="sign-title">ผู้แจ้งซ่อม / ตรวจรับ</div>
                <div class="sign-line"></div>
                <div class="sign-name">( ${ticket.requester_name ? ticket.requester_name.replace(/\(.*?\)/, '').trim() : '..............................'} )</div>
                <div class="sign-sub">ผู้แจ้งซ่อม / ผู้ตรวจรับงาน</div>
                <div class="sign-date">วันที่ ...... / ...... / ..........</div>
            </div>

            <div class="sign-box">
                <div class="sign-title">ผู้ตรวจสอบงบประมาณ</div>
                <div class="sign-line"></div>
                <div class="sign-name">( .............................. )</div>
                <div class="sign-sub">หัวหน้างาน / ผู้ตรวจสอบ</div>
                <div class="sign-date">วันที่ ...... / ...... / ..........</div>
            </div>

            <div class="sign-box">
                <div class="sign-title">ผู้อนุมัติเบิกจ่าย</div>
                <div class="sign-line"></div>
                <div class="sign-name">( .............................. )</div>
                <div class="sign-sub">ผู้บริหาร / ผู้อนุมัติงบประมาณ</div>
                <div class="sign-date">วันที่ ...... / ...... / ..........</div>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
}
