// ============================================================
// page.js — Ticket List Page with Search & Filter
// Route: /tickets
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { List, Plus, Search, X, FileText, Printer } from 'lucide-react';
import { TicketGrid } from '@/components/TicketCard';
const THAI_MONTHS = [
    { value: 1, label: 'มกราคม' },
    { value: 2, label: 'กุมภาพันธ์' },
    { value: 3, label: 'มีนาคม' },
    { value: 4, label: 'เมษายน' },
    { value: 5, label: 'พฤษภาคม' },
    { value: 6, label: 'มิถุนายน' },
    { value: 7, label: 'กรกฎาคม' },
    { value: 8, label: 'สิงหาคม' },
    { value: 9, label: 'กันยายน' },
    { value: 10, label: 'ตุลาคม' },
    { value: 11, label: 'พฤศจิกายน' },
    { value: 12, label: 'ธันวาคม' }
];

export default function TicketListPage() {
    const [issueTypes, setIssueTypes] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch issue types on mount
    useEffect(() => {
        async function fetchIssueTypes() {
            try {
                const res = await fetch('/api/issue-types');
                if (res.ok) {
                    const data = await res.json();
                    setIssueTypes(data);
                }
            } catch (e) {
                console.error('Error fetching issue types:', e);
            }
        }
        fetchIssueTypes();
    }, []);

    // Filter states
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('');
    const [priority, setPriority] = useState('');
    const [issueType, setIssueType] = useState('');
    const [requesterGroup, setRequesterGroup] = useState('');

    // Date filter states
    const [period, setPeriod] = useState('all');
    const [customMode, setCustomMode] = useState('date'); // 'date' | 'month' | 'year' | 'range'

    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    const [selectedDay, setSelectedDay] = useState(currentDay);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedYear, setSelectedYear] = useState(currentYear);

    const [selectedMonthOnly, setSelectedMonthOnly] = useState(currentMonth);
    const [selectedYearOnly, setSelectedYearOnly] = useState(currentYear);

    const [selectedStartDay, setSelectedStartDay] = useState(currentDay);
    const [selectedStartMonth, setSelectedStartMonth] = useState(currentMonth);
    const [selectedStartYear, setSelectedStartYear] = useState(currentYear);

    const [selectedEndDay, setSelectedEndDay] = useState(currentDay);
    const [selectedEndMonth, setSelectedEndMonth] = useState(currentMonth);
    const [selectedEndYear, setSelectedEndYear] = useState(currentYear);

    const [customYear, setCustomYear] = useState(currentYear.toString());

    const getRangeForCustomMode = (mode, customYearVal) => {
        let startLocal, endLocal;

        if (mode === 'date') {
            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
            startLocal = new Date(`${dateStr}T00:00:00`);
            endLocal = new Date(`${dateStr}T23:59:59.999`);
        } else if (mode === 'month') {
            startLocal = new Date(selectedYearOnly, selectedMonthOnly - 1, 1, 0, 0, 0, 0);
            endLocal = new Date(selectedYearOnly, selectedMonthOnly, 0, 23, 59, 59, 999);
        } else if (mode === 'year') {
            const year = Number(customYearVal);
            startLocal = new Date(year, 0, 1, 0, 0, 0, 0);
            endLocal = new Date(year, 11, 31, 23, 59, 59, 999);
        } else if (mode === 'range') {
            const startDateStr = `${selectedStartYear}-${String(selectedStartMonth).padStart(2, '0')}-${String(selectedStartDay).padStart(2, '0')}`;
            const endDateStr = `${selectedEndYear}-${String(selectedEndMonth).padStart(2, '0')}-${String(selectedEndDay).padStart(2, '0')}`;
            startLocal = new Date(`${startDateStr}T00:00:00`);
            endLocal = new Date(`${endDateStr}T23:59:59.999`);
        }

        return {
            startISO: startLocal.toISOString(),
            endISO: endLocal.toISOString()
        };
    };

    // Fetch and filter tickets dynamically
    useEffect(() => {
        async function fetchTickets() {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (query.trim()) params.append('query', query.trim());
                if (status) params.append('status', status);
                if (priority) params.append('priority', priority);
                if (issueType) params.append('issue_type', issueType);
                if (requesterGroup) params.append('requester_group', requesterGroup);
                
                params.append('period', period);
                if (period === 'custom') {
                    const { startISO, endISO } = getRangeForCustomMode(customMode, customYear);
                    params.append('startDate', startISO);
                    params.append('endDate', endISO);
                }

                const res = await fetch(`/api/tickets?${params.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    setTickets(data);
                }
            } catch (e) {
                console.error('Error fetching tickets:', e);
            } finally {
                setLoading(false);
            }
        }
        
        // Debounce search slightly
        const timer = setTimeout(fetchTickets, 150);
        return () => clearTimeout(timer);
    }, [
        query, status, priority, issueType, requesterGroup,
        period, customMode, customYear,
        selectedDay, selectedMonth, selectedYear,
        selectedMonthOnly, selectedYearOnly,
        selectedStartDay, selectedStartMonth, selectedStartYear,
        selectedEndDay, selectedEndMonth, selectedEndYear
    ]);

    const clearFilters = () => {
        setQuery('');
        setStatus('');
        setPriority('');
        setIssueType('');
        setRequesterGroup('');
        setPeriod('all');
    };

    const handleExportCSV = (ticketsList) => {
        const headers = ['Ticket ID', 'Title', 'Description', 'Category', 'Priority', 'Status', 'Location', 'Requester Name', 'Requester Email', 'Assigned To', 'Created At', 'Updated At'];
        const rows = ticketsList.map(t => [
            t.ticket_no,
            t.title,
            t.description ? t.description.replace(/"/g, '""').replace(/\n/g, ' ') : '',
            t.issue_type,
            t.priority,
            t.status,
            t.location || '',
            t.requester_name,
            t.requester_email || '',
            t.assigned_to || '',
            t.created_at,
            t.updated_at
        ]);

        const csvContent = "\uFEFF" + [
            headers.join(','),
            ...rows.map(e => e.map(val => `"${val}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `tickets_report_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrintPDF = (ticketsList) => {
        const printWindow = window.open('', '_blank');
        const tableRows = ticketsList.map(t => `
            <tr>
                <td style="font-family: monospace; font-weight: bold;">${t.ticket_no}</td>
                <td>
                    <div style="font-weight: bold;">${t.title}</div>
                    <div style="font-size: 0.8rem; color: #666;">${t.location || '-'}</div>
                </td>
                <td>${t.issue_type}</td>
                <td>${t.priority}</td>
                <td>${t.status}</td>
                <td>${t.assigned_to || '-'}</td>
                <td>${new Date(t.created_at).toLocaleDateString('th-TH')}</td>
            </tr>
        `).join('');

        const html = `
            <html>
                <head>
                    <title>รายงานรายการตั๋วปัญหา - Mini Helpdesk</title>
                    <style>
                        body { font-family: 'Sarabun', 'Helvetica Neue', Arial, sans-serif; padding: 20px; color: #333; }
                        h1 { font-size: 20px; margin-bottom: 5px; }
                        .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                        th { background-color: #f5f5f5; font-weight: bold; }
                        tr:nth-child(even) { background-color: #fafafa; }
                        @media print {
                            .print-btn { display: none; }
                        }
                    </style>
                </head>
                <body>
                     <div style="display: flex; justify-content: space-between; align-items: center;">
                         <h1>รายงานตั๋วปัญหา Mini Helpdesk</h1>
                         <button class="print-btn" onclick="window.print()" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">พิมพ์ PDF</button>
                     </div>
                     <div class="meta">
                         พิมพ์โดย: ผู้ใช้ระบบ | วันที่: ${new Date().toLocaleString('th-TH')} | จำนวนทั้งหมด: ${ticketsList.length} รายการ
                     </div>
                     <table>
                         <thead>
                             <tr>
                                 <th>Ticket ID</th>
                                 <th>หัวข้อ / สถานที่</th>
                                 <th>ประเภท</th>
                                 <th>ระดับ</th>
                                 <th>สถานะ</th>
                                 <th>ผู้รับผิดชอบ</th>
                                 <th>วันที่แจ้ง</th>
                             </tr>
                         </thead>
                         <tbody>
                             ${tableRows}
                         </tbody>
                     </table>
                     <script>
                         window.onload = function() {
                             setTimeout(() => { window.print(); }, 500);
                         }
                     </script>
                </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="page-ticket-list fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1 className="page-title">
                        <List style={{ width: 24, height: 24, marginRight: 8, display: 'inline', verticalAlign: 'middle' }} />
                        รายการ Ticket ทั้งหมด
                    </h1>
                    <p className="page-subtitle">ค้นหา ตรวจสอบ และติดตามความคืบหน้าของปัญหาไอทีทั้งหมดในระบบ</p>
                </div>
                <Link href="/create" className="btn btn-primary">
                    <Plus style={{ width: 16, height: 16 }} />
                    แจ้งปัญหาใหม่
                </Link>
            </div>

            {/* Search & Filter Bar */}
            <div className="filter-bar glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="search-box">
                    <Search className="search-icon" style={{ width: 18, height: 18 }} />
                    <input 
                        type="text" 
                        className="form-input search-input" 
                        placeholder="ค้นหาด้วย Ticket ID, หัวข้อ หรือรายละเอียด..." 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                
                <div className="filter-row">
                    <select 
                        className="form-input form-select filter-select"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                    >
                        <option value="all">ทุกช่วงเวลา</option>
                        <option value="custom">กำหนดเอง 📅</option>
                    </select>

                    <select 
                        className="form-input form-select filter-select"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="">ทุกสถานะ</option>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Waiting for Information">Waiting for Information</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>

                    <select 
                        className="form-input form-select filter-select"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                    >
                        <option value="">ทุกระดับ</option>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                    </select>

                    <select 
                        className="form-input form-select filter-select"
                        value={issueType}
                        onChange={(e) => setIssueType(e.target.value)}
                    >
                        <option value="">ทุกประเภท</option>
                        {issueTypes.map(t => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                    </select>

                    <select 
                        className="form-input form-select filter-select"
                        value={requesterGroup}
                        onChange={(e) => setRequesterGroup(e.target.value)}
                    >
                        <option value="">ทุกกลุ่มผู้ใช้</option>
                        <option value="นักศึกษา">นักศึกษา</option>
                        <option value="อาจารย์">อาจารย์</option>
                        <option value="เจ้าหน้าที่">เจ้าหน้าที่</option>
                        <option value="เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์">เจ้าหน้าที่ IT / ผู้ดูแลอุปกรณ์</option>
                        <option value="ผู้ดูแลระบบ">ผู้ดูแลระบบ</option>
                    </select>

                    <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                        <X style={{ width: 14, height: 14 }} />
                        ล้างตัวกรอง
                    </button>
                </div>

                {/* Custom Date Filter Panel */}
                {period === 'custom' && (
                    <div className="custom-date-filter-bar glass-card" style={{
                        padding: '1rem',
                        borderRadius: '8px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '1rem',
                        marginTop: '0rem',
                        marginBottom: '0rem',
                        boxShadow: 'none',
                        border: '1px solid var(--border-card)'
                    }}>
                        {/* Mode Selector */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>รูปแบบการกรอง</span>
                            <select
                                value={customMode}
                                onChange={(e) => setCustomMode(e.target.value)}
                                className="form-input form-select"
                                style={{ padding: '6px 12px', fontSize: '0.85rem', width: '160px', height: '36px' }}
                            >
                                <option value="date">ระบุวันที่</option>
                                <option value="month">ระบุเดือน</option>
                                <option value="year">ระบุปี</option>
                                <option value="range">เลือกช่วงเวลาเอง</option>
                            </select>
                        </div>

                        {/* Conditional inputs */}
                        {customMode === 'date' && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>วันที่</span>
                                    <select
                                        value={selectedDay}
                                        onChange={(e) => setSelectedDay(Number(e.target.value))}
                                        className="form-input form-select"
                                        style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '80px' }}
                                    >
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>เดือน</span>
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                        className="form-input form-select"
                                        style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '130px' }}
                                    >
                                        {THAI_MONTHS.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ปี</span>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="form-input form-select"
                                        style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '120px' }}
                                    >
                                        {Array.from({ length: 5 }, (_, i) => {
                                            const y = new Date().getFullYear() - i;
                                            return <option key={y} value={y}>{y + 543} (ค.ศ. {y})</option>;
                                        })}
                                    </select>
                                </div>
                            </div>
                        )}

                        {customMode === 'month' && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>เดือน</span>
                                    <select
                                        value={selectedMonthOnly}
                                        onChange={(e) => setSelectedMonthOnly(Number(e.target.value))}
                                        className="form-input form-select"
                                        style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '130px' }}
                                    >
                                        {THAI_MONTHS.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ปี</span>
                                    <select
                                        value={selectedYearOnly}
                                        onChange={(e) => setSelectedYearOnly(Number(e.target.value))}
                                        className="form-input form-select"
                                        style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '120px' }}
                                    >
                                        {Array.from({ length: 5 }, (_, i) => {
                                            const y = new Date().getFullYear() - i;
                                            return <option key={y} value={y}>{y + 543} (ค.ศ. {y})</option>;
                                        })}
                                    </select>
                                </div>
                            </div>
                        )}

                        {customMode === 'year' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>เลือกปี</span>
                                <select
                                    value={customYear}
                                    onChange={(e) => setCustomYear(e.target.value)}
                                    className="form-input form-select"
                                    style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '120px' }}
                                >
                                    {Array.from({ length: 5 }, (_, i) => {
                                        const y = new Date().getFullYear() - i;
                                        return <option key={y} value={y.toString()}>{y + 543} (ค.ศ. {y})</option>;
                                    })}
                                </select>
                            </div>
                        )}

                        {customMode === 'range' && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '0.25rem' }}>จาก</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>วันที่</span>
                                        <select
                                            value={selectedStartDay}
                                            onChange={(e) => setSelectedStartDay(Number(e.target.value))}
                                            className="form-input form-select"
                                            style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '80px' }}
                                        >
                                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>เดือน</span>
                                        <select
                                            value={selectedStartMonth}
                                            onChange={(e) => setSelectedStartMonth(Number(e.target.value))}
                                            className="form-input form-select"
                                            style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '130px' }}
                                        >
                                            {THAI_MONTHS.map(m => (
                                                <option key={m.value} value={m.value}>{m.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ปี</span>
                                        <select
                                            value={selectedStartYear}
                                            onChange={(e) => setSelectedStartYear(Number(e.target.value))}
                                            className="form-input form-select"
                                            style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '120px' }}
                                        >
                                            {Array.from({ length: 5 }, (_, i) => {
                                                const y = new Date().getFullYear() - i;
                                                return <option key={y} value={y}>{y + 543} (ค.ศ. {y})</option>;
                                            })}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '0.25rem' }}>ถึง</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>วันที่</span>
                                        <select
                                            value={selectedEndDay}
                                            onChange={(e) => setSelectedEndDay(Number(e.target.value))}
                                            className="form-input form-select"
                                            style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '80px' }}
                                        >
                                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>เดือน</span>
                                        <select
                                            value={selectedEndMonth}
                                            onChange={(e) => setSelectedEndMonth(Number(e.target.value))}
                                            className="form-input form-select"
                                            style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '130px' }}
                                        >
                                            {THAI_MONTHS.map(m => (
                                                <option key={m.value} value={m.value}>{m.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ปี</span>
                                        <select
                                            value={selectedEndYear}
                                            onChange={(e) => setSelectedEndYear(Number(e.target.value))}
                                            className="form-input form-select"
                                            style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '120px' }}
                                        >
                                            {Array.from({ length: 5 }, (_, i) => {
                                                const y = new Date().getFullYear() - i;
                                                return <option key={y} value={y}>{y + 543} (ค.ศ. {y})</option>;
                                            })}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Results Grid */}
            <div className="results-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="results-count">
                    {loading ? 'กำลังค้นหา...' : `พบ ${tickets.length} รายการ`}
                </span>
                {!loading && tickets.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleExportCSV(tickets)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                            <FileText style={{ width: 14, height: 14 }} />
                            ส่งออก CSV
                        </button>
                        <button 
                            className="btn btn-ghost btn-sm"
                            onClick={() => handlePrintPDF(tickets)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                            <Printer style={{ width: 14, height: 14 }} />
                            พิมพ์ตาราง PDF
                        </button>
                    </div>
                )}
            </div>

            <div id="ticket-list-container">
                {loading ? (
                    <p className="text-muted" style={{ textAlign: 'center', padding: '3rem' }}>กำลังโหลดรายการตั๋วปัญหา...</p>
                ) : (
                    <TicketGrid tickets={tickets} />
                )}
            </div>
        </div>
    );
}
