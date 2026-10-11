// ============================================================
// page.js — Analytical Dashboard
// Route: /dashboard
// ============================================================



import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { BarChart3, Ticket, Loader, CheckCircle, AlertTriangle, Users, UserPlus, Plus, Trash2, X, Settings } from 'lucide-react';
import TicketCard from '@/components/TicketCard';
import Chart from 'chart.js/auto';

const STATUS_COLORS = {
    'Open': '#3b82f6',
    'In Progress': '#f59e0b',
    'Waiting for Information': '#a855f7',
    'Resolved': '#22c55e',
    'Closed': '#6b7280',
    'Cancelled': '#ef4444'
};

const PRIORITY_COLORS = {
    'Low': '#22c55e',
    'Medium': '#3b82f6',
    'High': '#f59e0b',
    'Urgent': '#ef4444'
};

const MODE_COLORS = {
    date: '#f59e0b',
    month: '#3b82f6',
    year: '#22c55e',
    range: '#8b5cf6'
};

const SUGGESTED_ROLES = [
    'ช่างเทคนิคคอมพิวเตอร์และเครือข่าย',
    'ช่างไฟฟ้าและอิเล็กทรอนิกส์',
    'ช่างประปาและสุขาภิบาล',
    'ช่างอาคารสถานที่และครุภัณฑ์'
];

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

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 20 }, (_, i) => 2017 + i);
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);



export default function DashboardPage() {
    const { toast, theme, role } = useApp();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('all');
    const [newTechInput, setNewTechInput] = useState('');
    const [isAddingTech, setIsAddingTech] = useState(false);
    const [showTechModal, setShowTechModal] = useState(false);
    const [modalTechInput, setModalTechInput] = useState('');

    // Custom period state
    const [customMode, setCustomMode] = useState('date'); // 'date' | 'month' | 'year' | 'range'

    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    const [selectedDay, setSelectedDay] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState('');

    const [selectedMonthOnly, setSelectedMonthOnly] = useState('');
    const [selectedYearOnly, setSelectedYearOnly] = useState('');

    const [selectedStartDay, setSelectedStartDay] = useState('');
    const [selectedStartMonth, setSelectedStartMonth] = useState('');
    const [selectedStartYear, setSelectedStartYear] = useState('');

    const [selectedEndDay, setSelectedEndDay] = useState('');
    const [selectedEndMonth, setSelectedEndMonth] = useState('');
    const [selectedEndYear, setSelectedEndYear] = useState('');

    const [customYear, setCustomYear] = useState('');

    const statusChartRef = useRef(null);
    const priorityChartRef = useRef(null);
    const typeChartRef = useRef(null);
    const workloadChartRef = useRef(null);

    const statusChartInst = useRef(null);
    const priorityChartInst = useRef(null);
    const typeChartInst = useRef(null);
    const workloadChartInst = useRef(null);

    const formatThaiDate = (year, month, day) => {
        const monthLabel = THAI_MONTHS.find(m => m.value === month)?.label || month;
        return `${day} ${monthLabel} ${year + 543}`;
    };

    const isCustomSelectionValid = () => {
        if (customMode === 'date') {
            return selectedDay && selectedMonth && selectedYear;
        }
        if (customMode === 'month') {
            return selectedMonthOnly && selectedYearOnly;
        }
        if (customMode === 'year') {
            return customYear;
        }
        if (customMode === 'range') {
            return selectedStartDay && selectedStartMonth && selectedStartYear && selectedEndDay && selectedEndMonth && selectedEndYear;
        }
        return false;
    };

    const getCustomFilterLabel = () => {
        if (!isCustomSelectionValid()) {
            return '-';
        }

        if (customMode === 'date') {
            return formatThaiDate(selectedYear, selectedMonth, selectedDay);
        }
        if (customMode === 'month') {
            return `${THAI_MONTHS.find(m => m.value === selectedMonthOnly)?.label || selectedMonthOnly} ${selectedYearOnly + 543}`;
        }
        if (customMode === 'year') {
            return `${Number(customYear) + 543}`;
        }
        if (customMode === 'range') {
            return `${formatThaiDate(selectedStartYear, selectedStartMonth, selectedStartDay)} – ${formatThaiDate(selectedEndYear, selectedEndMonth, selectedEndDay)}`;
        }
        return '-';
    };

    const getRangeForCustomMode = (mode, customYearVal) => {
        if (!isCustomSelectionValid()) {
            return { startISO: '', endISO: '' };
        }

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

    const fetchStats = async (selectedPeriod = period, startISO = null, endISO = null) => {
        try {
            setLoading(true);
            let url = `/api/stats?period=${selectedPeriod}`;
            if (selectedPeriod === 'custom' && startISO && endISO) {
                url += `&startDate=${encodeURIComponent(startISO)}&endDate=${encodeURIComponent(endISO)}`;
            }
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            } else {
                toast.error('ไม่สามารถโหลดข้อมูลสถิติได้');
            }
        } catch (e) {
            console.error('Error fetching stats:', e);
        } finally {
            setLoading(false);
        }
    };

    const handlePeriodChange = (newPeriod) => {
        setPeriod(newPeriod);
        if (newPeriod !== 'custom') {
            fetchStats(newPeriod);
        }
    };

    const handleAddTechDirect = async (nameToAdd) => {
        const targetName = (nameToAdd || newTechInput || modalTechInput).trim();
        if (!targetName) {
            toast.error('กรุณาระบุชื่อเจ้าหน้าที่หรือตำแหน่งช่าง');
            return;
        }
        setIsAddingTech(true);
        try {
            const res = await fetch('/api/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: targetName })
            });
            if (res.ok) {
                toast.success(`เพิ่มเจ้าหน้าที่ "${targetName}" เรียบร้อยแล้ว`);
                setNewTechInput('');
                setModalTechInput('');
                if (period === 'custom' && isCustomSelectionValid()) {
                    const { startISO, endISO } = getRangeForCustomMode(customMode, customYear);
                    fetchStats('custom', startISO, endISO);
                } else {
                    fetchStats(period);
                }
            } else {
                const err = await res.json();
                toast.error(err.error || 'ไม่สามารถเพิ่มเจ้าหน้าที่ได้');
            }
        } catch (e) {
            toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setIsAddingTech(false);
        }
    };

    const handleRemoveTechDirect = async (nameToRemove) => {
        if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ "${nameToRemove}" ออกจากรายชื่อเจ้าหน้าที่?`)) {
            return;
        }
        try {
            const res = await fetch(`/api/staff/${encodeURIComponent(nameToRemove)}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toast.success(`ลบเจ้าหน้าที่ "${nameToRemove}" แล้ว`);
                if (period === 'custom' && isCustomSelectionValid()) {
                    const { startISO, endISO } = getRangeForCustomMode(customMode, customYear);
                    fetchStats('custom', startISO, endISO);
                } else {
                    fetchStats(period);
                }
            } else {
                toast.error('ไม่สามารถลบเจ้าหน้าที่ได้');
            }
        } catch (e) {
            toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    };

    useEffect(() => {
        fetchStats('all');
    }, []);

    useEffect(() => {
        if (period === 'custom') {
            if (!isCustomSelectionValid()) {
                setStats(null);
                if (loading) {
                    setLoading(false);
                }
                return;
            }
            const { startISO, endISO } = getRangeForCustomMode(customMode, customYear);
            fetchStats('custom', startISO, endISO);
        }
    }, [
        period, customMode, customYear,
        selectedDay, selectedMonth, selectedYear,
        selectedMonthOnly, selectedYearOnly,
        selectedStartDay, selectedStartMonth, selectedStartYear,
        selectedEndDay, selectedEndMonth, selectedEndYear
    ]);

    useEffect(() => {
        if (!stats) return;

        const isDark = theme === 'dark';
        const fontColor = isDark ? '#9ca3af' : '#64748b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        // Destroy previous instances
        if (statusChartInst.current) statusChartInst.current.destroy();
        if (priorityChartInst.current) priorityChartInst.current.destroy();
        if (typeChartInst.current) typeChartInst.current.destroy();

        // 1. Status Doughnut Chart
        if (statusChartRef.current) {
            const labels = Object.keys(stats.byStatus);
            const data = Object.values(stats.byStatus);
            const backgroundColors = labels.map(label => STATUS_COLORS[label] || '#6366f1');

            statusChartInst.current = new Chart(statusChartRef.current, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data,
                        backgroundColor: backgroundColors,
                        borderColor: theme === 'dark' ? '#111827' : '#ffffff',
                        borderWidth: 2,
                        hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: fontColor,
                                font: { size: 12, family: 'Inter, Sarabun, sans-serif' }
                            }
                        }
                    }
                }
            });
        }

        // 2. Priority Bar Chart
        if (priorityChartRef.current) {
            const labels = Object.keys(stats.byPriority);
            const data = Object.values(stats.byPriority);
            const backgroundColors = labels.map(label => PRIORITY_COLORS[label] || '#6366f1');

            priorityChartInst.current = new Chart(priorityChartRef.current, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'จำนวนตั๋ว',
                        data,
                        backgroundColor: backgroundColors,
                        borderRadius: 6,
                        maxBarThickness: 30
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: fontColor, font: { family: 'Inter, Sarabun, sans-serif' } }
                        },
                        y: {
                            grid: { color: gridColor },
                            ticks: { precision: 0, color: fontColor, font: { family: 'Inter, Sarabun, sans-serif' } }
                        }
                    }
                }
            });
        }

        // 3. Issue Type Horizontal Bar Chart
        if (typeChartRef.current) {
            const labels = Object.keys(stats.byIssueType);
            const data = Object.values(stats.byIssueType);

            typeChartInst.current = new Chart(typeChartRef.current, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'จำนวนปัญหาแยกตามประเภท',
                        data,
                        backgroundColor: 'rgba(99, 102, 241, 0.8)',
                        borderColor: '#6366f1',
                        borderWidth: 1,
                        borderRadius: 4,
                        maxBarThickness: 20
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: { precision: 0, color: fontColor, font: { family: 'Inter, Sarabun, sans-serif' } }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { color: fontColor, font: { family: 'Inter, Sarabun, sans-serif' } }
                        }
                    }
                }
            });
        }

        // 4. Staff Workload Horizontal Bar Chart
        if (workloadChartRef.current && stats.workloads && Object.keys(stats.workloads).length > 0) {
            const assignees = Object.keys(stats.workloads);
            const activeTasks = assignees.map(name => stats.workloads[name].active);
            const totalTasks = assignees.map(name => stats.workloads[name].total);

            workloadChartInst.current = new Chart(workloadChartRef.current, {
                type: 'bar',
                data: {
                    labels: assignees,
                    datasets: [
                        {
                            label: 'งานที่กำลังดำเนินการ (Active)',
                            data: activeTasks,
                            backgroundColor: 'rgba(245, 158, 11, 0.8)',
                            borderColor: '#f59e0b',
                            borderWidth: 1,
                            borderRadius: 4,
                            maxBarThickness: 20
                        },
                        {
                            label: 'งานทั้งหมดที่ได้รับมอบหมาย',
                            data: totalTasks,
                            backgroundColor: 'rgba(99, 102, 241, 0.4)',
                            borderColor: 'rgba(99, 102, 241, 0.8)',
                            borderWidth: 1,
                            borderRadius: 4,
                            maxBarThickness: 20
                        }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                color: fontColor,
                                font: { size: 11, family: 'Inter, Sarabun, sans-serif' }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: { precision: 0, color: fontColor, font: { family: 'Inter, Sarabun, sans-serif' } }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { color: fontColor, font: { family: 'Inter, Sarabun, sans-serif' } }
                        }
                    }
                }
            });
        }

        return () => {
            if (statusChartInst.current) statusChartInst.current.destroy();
            if (priorityChartInst.current) priorityChartInst.current.destroy();
            if (typeChartInst.current) typeChartInst.current.destroy();
            if (workloadChartInst.current) workloadChartInst.current.destroy();
        };
    }, [stats, theme]);

    // Use allTimeStats for summary cards so they always show real totals
    const allTime = stats?.allTimeStats || {};

    // Determine current display values: for custom period show stats for the selected range (if valid),
    // otherwise fall back to all-time summary values.
    const totalCount = loading ? '...' : (period === 'custom' ? (isCustomSelectionValid() && stats ? stats.total : '-') : (allTime.total || 0));
    const inProgressCount = loading ? '...' : (period === 'custom' ? (isCustomSelectionValid() && stats ? (stats.byStatus?.['In Progress'] || 0) : '-') : (allTime.byStatus?.['In Progress'] || 0));
    const resolvedAndClosed = loading ? '...' : (period === 'custom' ? (isCustomSelectionValid() && stats ? ((stats.byStatus?.['Resolved'] || 0) + (stats.byStatus?.['Closed'] || 0)) : '-') : ((allTime.byStatus?.['Resolved'] || 0) + (allTime.byStatus?.['Closed'] || 0)));
    const urgentCount = loading ? '...' : (period === 'custom' ? (isCustomSelectionValid() && stats ? (stats.byPriority?.['Urgent'] || 0) : '-') : (allTime.byPriority?.['Urgent'] || 0));

    // Workloads summary (aggregated from stats.workloads for the current range)
    const workloadsData = stats?.workloads || {};
    let workloadTotal = 0;
    let workloadCompleted = 0;
    let workloadActive = 0;
    Object.values(workloadsData).forEach(d => {
        const t = d.total || 0;
        const comp = (d.resolved || 0) + (d.closed || 0);
        const act = d.active || 0;
        workloadTotal += t;
        workloadCompleted += comp;
        workloadActive += act;
    });
    const workloadClosureRate = workloadTotal > 0 ? Math.round((workloadCompleted / workloadTotal) * 100) : 0;
    const workloadTotalDisplay = loading ? '...' : (period === 'custom' ? (isCustomSelectionValid() && stats ? workloadTotal : '-') : (workloadTotal || '-'));
    const workloadCompletedDisplay = loading ? '...' : (period === 'custom' ? (isCustomSelectionValid() && stats ? workloadCompleted : '-') : (workloadCompleted || '-'));
    const workloadClosureRateDisplay = loading ? '...' : (period === 'custom' ? (isCustomSelectionValid() && stats ? `${workloadClosureRate}%` : '-') : (workloadTotal > 0 ? `${workloadClosureRate}%` : '-'));

    return (
        <div className="page-dashboard fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div className="page-header-left">
                    <h1 className="page-title text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BarChart3 style={{ width: 26, height: 26, color: 'var(--primary-color)' }} />
                        รายงานสถิติและ Dashboard
                    </h1>
                    <p className="page-subtitle">แสดงข้อมูลเชิงวิเคราะห์ของระบบงาน Mini Helpdesk แบบ Real-time</p>
                </div>
                {/* Period Selector Tabs */}
                <div className="period-selector-tabs">
                    {[
                        { id: 'all', label: 'ทั้งหมด' },
                        { id: 'custom', label: 'กำหนดเอง 📅' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handlePeriodChange(tab.id)}
                            style={{
                                padding: '6px 16px',
                                border: 'none',
                                background: period === tab.id ? 'var(--primary-color)' : 'transparent',
                                color: period === tab.id ? '#ffffff' : 'var(--text-secondary)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                transition: 'all var(--transition-fast)'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom Date Filter Panel */}
            {period === 'custom' && (
                <div className="custom-date-filter-bar glass-card" style={{ borderTop: `3px solid ${MODE_COLORS[customMode] || 'transparent'}` }}>
                    {/* Mode Selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: MODE_COLORS[customMode] || '#94a3b8' }}></span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>รูปแบบการกรอง</span>
                        </div>
                        <select
                            value={customMode}
                            onChange={(e) => setCustomMode(e.target.value)}
                            className="form-input form-select"
                            style={{ padding: '6px 12px', fontSize: '0.85rem', width: '160px', height: '36px', borderColor: MODE_COLORS[customMode] || 'var(--border-color)' }}
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
                                    onChange={(e) => setSelectedDay(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="form-input form-select"
                                    style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '80px' }}
                                >
                                    <option value="">-</option>
                                    {DAY_OPTIONS.map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>เดือน</span>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="form-input form-select"
                                    style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '130px' }}
                                >
                                    <option value="">-</option>
                                    {THAI_MONTHS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ปี</span>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="form-input form-select"
                                    style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '120px' }}
                                >
                                    <option value="">-</option>
                                    {YEAR_OPTIONS.map(y => (
                                        <option key={y} value={y}>{y + 543}</option>
                                    ))}
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
                                    onChange={(e) => setSelectedMonthOnly(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="form-input form-select"
                                    style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '130px' }}
                                >
                                    <option value="">-</option>
                                    {THAI_MONTHS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ปี</span>
                                <select
                                    value={selectedYearOnly}
                                    onChange={(e) => setSelectedYearOnly(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="form-input form-select"
                                    style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '120px' }}
                                >
                                    <option value="">-</option>
                                    {YEAR_OPTIONS.map(y => (
                                        <option key={y} value={y}>{y + 543}</option>
                                    ))}
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
                                <option value="">-</option>
                                {YEAR_OPTIONS.map(y => (
                                    <option key={y} value={y.toString()}>{y + 543}</option>
                                ))}
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
                                        onChange={(e) => setSelectedStartDay(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="form-input form-select"
                                        style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '80px' }}
                                    >
                                        <option value="">-</option>
                                        {DAY_OPTIONS.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>เดือน</span>
                                    <select
                                        value={selectedStartMonth}
                                        onChange={(e) => setSelectedStartMonth(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="form-input form-select"
                                        style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '130px' }}
                                    >
                                        <option value="">-</option>
                                        {THAI_MONTHS.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ปี</span>
                                    <select
                                        value={selectedStartYear}
                                        onChange={(e) => setSelectedStartYear(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="form-input form-select"
                                        style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '120px' }}
                                    >
                                        <option value="">-</option>
                                        {YEAR_OPTIONS.map(y => (
                                            <option key={y} value={y}>{y + 543}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '0.25rem' }}>ถึง</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>วันที่</span>
                                    <select
                                        value={selectedEndDay}
                                        onChange={(e) => setSelectedEndDay(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="form-input form-select"
                                        style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '80px' }}
                                    >
                                        <option value="">-</option>
                                        {DAY_OPTIONS.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>เดือน</span>
                                    <select
                                        value={selectedEndMonth}
                                        onChange={(e) => setSelectedEndMonth(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="form-input form-select"
                                        style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '130px' }}
                                    >
                                        <option value="">-</option>
                                        {THAI_MONTHS.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ปี</span>
                                    <select
                                        value={selectedEndYear}
                                        onChange={(e) => setSelectedEndYear(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="form-input form-select"
                                        style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px', width: '120px' }}
                                    >
                                        <option value="">-</option>
                                        {YEAR_OPTIONS.map(y => (
                                            <option key={y} value={y}>{y + 543}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {period === 'custom' && isCustomSelectionValid() && stats ? (
                <div className="custom-period-summary glass-card" style={{ marginTop: '1rem', padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                    <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>ช่วงที่เลือก</span>
                        <span style={{ fontWeight: 700 }}>{getCustomFilterLabel()}</span>
                    </div>
                    <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>ตั๋วที่ค้นพบ</span>
                        <span style={{ fontWeight: 700, fontSize: '1.15rem' }}>
                            {loading ? '...' : stats.total}
                        </span>
                    </div>
                    {stats.total === 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                            <AlertTriangle style={{ width: 16, height: 16 }} />
                            <span>ไม่มีตั๋วในช่วงเวลาที่เลือก</span>
                        </div>
                    )}
                </div>
            ) : period === 'custom' ? (
                <div className="custom-period-summary glass-card" style={{ marginTop: '1rem', padding: '1rem', color: 'var(--text-secondary)' }}>
                    กรุณาเลือกวันที่ เดือน และปีให้ครบก่อนจึงจะแสดงสรุปได้
                </div>
            ) : null}

            {/* Stats Overview Grid */}
            <div className="dashboard-stats-grid">
                <div className="dash-stat-card">
                    <div className="dash-stat-icon" style={{ background: '#4f46e520', color: '#4f46e5' }}>
                        <Ticket style={{ width: 24, height: 24 }} />
                    </div>
                    <div className="dash-stat-info">
                        <span className="dash-stat-label">ตั๋วทั้งหมด</span>
                        <span className="dash-stat-number">{totalCount}</span>
                    </div>
                </div>
                <div className="dash-stat-card">
                    <div className="dash-stat-icon" style={{ background: '#eab30820', color: '#eab308' }}>
                        <Loader style={{ width: 24, height: 24 }} />
                    </div>
                    <div className="dash-stat-info">
                        <span className="dash-stat-label">กำลังดำเนินการ</span>
                        <span className="dash-stat-number">{inProgressCount}</span>
                    </div>
                </div>
                <div className="dash-stat-card">
                    <div className="dash-stat-icon" style={{ background: '#22c55e20', color: '#22c55e' }}>
                        <CheckCircle style={{ width: 24, height: 24 }} />
                    </div>
                    <div className="dash-stat-info">
                        <span className="dash-stat-label">แก้ไขเสร็จสิ้น</span>
                        <span className="dash-stat-number">{resolvedAndClosed}</span>
                    </div>
                </div>
                <div className="dash-stat-card">
                    <div className="dash-stat-icon" style={{ background: '#ef444420', color: '#ef4444' }}>
                        <AlertTriangle style={{ width: 24, height: 24 }} />
                    </div>
                    <div className="dash-stat-info">
                        <span className="dash-stat-label">ตั๋วด่วนที่สุด</span>
                        <span className="dash-stat-number">{urgentCount}</span>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            {loading ? (
                <p className="text-muted" style={{ textAlign: 'center', padding: '5rem' }}>กำลังประมวลผลข้อมูลสถิติ...</p>
            ) : period === 'custom' && !isCustomSelectionValid() ? (
                <p className="text-muted" style={{ textAlign: 'center', padding: '3rem' }}>กรุณาเลือกวันที่ เดือน และปีให้ครบก่อนจึงจะแสดงกราฟและสรุปรายงาน</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="charts-row">
                        <div className="chart-card glass-card">
                            <div className="chart-card-header">
                                <h3 className="chart-card-title">สัดส่วนปัญหาตามสถานะ (Status)</h3>
                            </div>
                            <div className="chart-canvas-container">
                                <canvas ref={statusChartRef}></canvas>
                            </div>
                        </div>
                        <div className="chart-card glass-card">
                            <div className="chart-card-header">
                                <h3 className="chart-card-title">ระดับความเร่งด่วน (Priority)</h3>
                            </div>
                            <div className="chart-canvas-container">
                                <canvas ref={priorityChartRef}></canvas>
                            </div>
                        </div>
                    </div>

                    <div className="charts-row">
                        <div className="chart-card glass-card chart-card-full">
                            <div className="chart-card-header">
                                <h3 className="chart-card-title">จำนวนปัญหาแยกตามหมวดหมู่ประเภทปัญหา (Issue Type)</h3>
                            </div>
                            <div className="chart-canvas-container-wide">
                                <canvas ref={typeChartRef}></canvas>
                            </div>
                        </div>
                    </div>

                    {/* Staff Workload Section (Always visible, customizable by user) */}
                    <div className="page-header" style={{ marginTop: '1.5rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div className="page-header-left">
                            <h2 className="section-title text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.4rem', margin: 0 }}>
                                <Users style={{ width: 22, height: 22, color: 'var(--primary-color)' }} />
                                ภาระงานของเจ้าหน้าที่ (Staff Workloads)
                            </h2>
                            <p className="page-subtitle" style={{ margin: '0.25rem 0 0 0' }}>แสดงข้อมูลการกระจายงาน อัตราการปิดงาน และสถานะงานค้างของเจ้าหน้าที่แต่ละราย</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                                type="button"
                                onClick={() => setShowTechModal(true)}
                                className="btn btn-primary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.45rem 0.9rem', cursor: 'pointer' }}
                            >
                                <UserPlus style={{ width: 16, height: 16 }} />
                                จัดการ / เพิ่มเจ้าหน้าที่
                            </button>
                        </div>
                    </div>

                    <div className="charts-row" style={{ alignItems: 'stretch' }}>
                        {/* Left: Workload Bar Chart */}
                        <div className="chart-card glass-card" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                            <div className="chart-card-header">
                                <h3 className="chart-card-title">เปรียบเทียบภาระงานของเจ้าหน้าที่ (Active vs Total)</h3>
                            </div>
                            {stats?.workloads && Object.keys(stats.workloads).length > 0 ? (
                                <div className="chart-canvas-container" style={{ height: '320px' }}>
                                    <canvas ref={workloadChartRef}></canvas>
                                </div>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>
                                    <Users style={{ width: 48, height: 48, strokeWidth: 1.5, opacity: 0.35, marginBottom: '0.75rem' }} />
                                    <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-primary)' }}>ยังไม่มีข้อมูลกราฟภาระงาน</p>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: '0.25rem' }}>เพิ่มรายชื่อเจ้าหน้าที่ด้านขวา หรือคลิกปุ่ม "จัดการ / เพิ่มเจ้าหน้าที่" เพื่อเริ่มต้นแสดงกราฟ</span>
                                </div>
                            )}
                        </div>

                        {/* Right: Workload Summary & Table */}
                        <div className="chart-card glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
                            <div className="chart-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 className="chart-card-title">สรุปรายละเอียดภาระงานและอัตราการปิดงาน</h3>
                            </div>

                            {/* Metric Badges */}
                            <div style={{ display: 'flex', gap: '0.75rem', margin: '0.5rem 0 0.75rem 0', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ padding: '8px 14px', borderRadius: 8, background: '#4f46e515', border: '1px solid #4f46e540', minWidth: 110 }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>งานทั้งหมด</div>
                                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#4f46e5' }}>{workloadTotalDisplay}</div>
                                </div>
                                <div style={{ padding: '8px 14px', borderRadius: 8, background: '#22c55e15', border: '1px solid #22c55e40', minWidth: 110 }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>เสร็จแล้ว</div>
                                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#22c55e' }}>{workloadCompletedDisplay}</div>
                                </div>
                                <div style={{ padding: '8px 14px', borderRadius: 8, background: '#3b82f615', border: '1px solid #3b82f640', minWidth: 110 }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>อัตราการปิดงาน</div>
                                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#3b82f6' }}>{workloadClosureRateDisplay}</div>
                                </div>
                            </div>

                            {/* Inline Quick Add Input */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="พิมพ์ชื่อเจ้าหน้าที่ หรือตำแหน่งช่าง เช่น ช่างสมใจ..."
                                    value={newTechInput}
                                    onChange={(e) => setNewTechInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddTechDirect();
                                        }
                                    }}
                                    style={{ fontSize: '0.85rem', padding: '6px 10px', height: '34px', flex: 1 }}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddTechDirect()}
                                    disabled={isAddingTech}
                                    className="btn btn-primary"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', padding: '0 12px', height: '34px', whiteSpace: 'nowrap' }}
                                >
                                    <Plus style={{ width: 14, height: 14 }} />
                                    เพิ่ม
                                </button>
                            </div>

                            {/* Suggestion Chips */}
                            {(!stats?.workloads || Object.keys(stats.workloads).length < 5) && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ตำแหน่งแนะนำ:</span>
                                    {SUGGESTED_ROLES.filter(r => !Object.keys(stats?.workloads || {}).includes(r)).map(roleName => (
                                        <button
                                            key={roleName}
                                            type="button"
                                            onClick={() => handleAddTechDirect(roleName)}
                                            style={{
                                                background: 'rgba(59, 130, 246, 0.1)',
                                                border: '1px dashed rgba(59, 130, 246, 0.4)',
                                                color: '#93c5fd',
                                                borderRadius: '12px',
                                                padding: '2px 8px',
                                                fontSize: '0.73rem',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 2
                                            }}
                                        >
                                            + {roleName}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Workload Table */}
                            <div style={{ overflowX: 'auto', flex: 1 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-card)', textAlign: 'left' }}>
                                            <th style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>เจ้าหน้าที่</th>
                                            <th style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)', textAlign: 'center' }}>งานค้าง</th>
                                            <th style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)', textAlign: 'center' }}>เสร็จสิ้น</th>
                                            <th style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)', textAlign: 'center' }}>ทั้งหมด</th>
                                            <th style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)', width: '25%' }}>อัตราสำเร็จ</th>
                                            <th style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)', textAlign: 'center', width: '32px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!stats?.workloads || Object.keys(stats.workloads).length === 0 ? (
                                            <tr>
                                                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                                                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 500, color: 'var(--text-primary)' }}>ยังไม่มีรายชื่อเจ้าหน้าที่ในระบบ</p>
                                                    <span style={{ fontSize: '0.8rem' }}>พิมพ์ชื่อเจ้าหน้าที่ในช่องด้านบน หรือคลิกตำแหน่งแนะนำเพื่อเพิ่มรายชื่อลงในระบบได้ทันที</span>
                                                </td>
                                            </tr>
                                        ) : (
                                            Object.entries(stats.workloads).map(([name, data]) => {
                                                const total = data.total || 0;
                                                const completed = (data.resolved || 0) + (data.closed || 0);
                                                const active = data.active || 0;
                                                const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
                                                const isUnassigned = name === 'ยังไม่ได้มอบหมาย';

                                                return (
                                                    <tr key={name} style={{ borderBottom: '1px solid var(--table-border)' }}>
                                                        <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{name}</td>
                                                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                                                            <span style={{
                                                                padding: '2px 8px',
                                                                borderRadius: '4px',
                                                                background: active > 0 ? 'var(--warning-bg)' : 'var(--badge-neutral-bg)',
                                                                color: active > 0 ? 'var(--warning-color)' : 'var(--badge-neutral-color)',
                                                                fontWeight: active > 0 ? 'bold' : 'normal',
                                                                fontSize: '0.8rem'
                                                            }}>
                                                                {active}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', color: 'var(--success-color)' }}>
                                                            {completed}
                                                        </td>
                                                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                            {total}
                                                        </td>
                                                        <td style={{ padding: '0.65rem 0.5rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <div style={{ flex: 1, height: '6px', background: 'var(--progress-track-bg)', borderRadius: '3px', overflow: 'hidden' }}>
                                                                    <div style={{
                                                                        height: '100%',
                                                                        width: `${percent}%`,
                                                                        background: percent === 100 ? 'var(--success-color)' : 'var(--primary-color)',
                                                                        borderRadius: '3px'
                                                                    }}></div>
                                                                </div>
                                                                <span style={{ minWidth: '30px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                                    {percent}%
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                                                            {!isUnassigned && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveTechDirect(name)}
                                                                    style={{
                                                                        background: 'transparent',
                                                                        border: 'none',
                                                                        color: 'var(--text-secondary)',
                                                                        cursor: 'pointer',
                                                                        padding: 2,
                                                                        opacity: 0.6
                                                                    }}
                                                                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.opacity = '1'; }}
                                                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.opacity = '0.6'; }}
                                                                    title={`ลบ ${name}`}
                                                                >
                                                                    <Trash2 style={{ width: 14, height: 14 }} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Manage Staff Modal */}
                    {showTechModal && (
                        <div style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.65)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 9999,
                            padding: '1rem'
                        }}>
                            <div className="glass-card" style={{
                                width: '100%',
                                maxWidth: '520px',
                                padding: '1.75rem',
                                borderRadius: '12px',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                                maxHeight: '90vh',
                                overflowY: 'auto'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Users style={{ width: 20, height: 20, color: 'var(--primary-color)' }} />
                                        จัดการรายชื่อเจ้าหน้าที่ / ช่าง
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setShowTechModal(false)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
                                    >
                                        <X style={{ width: 20, height: 20 }} />
                                    </button>
                                </div>

                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                                    เพิ่มหรือลบรายชื่อเจ้าหน้าที่ผู้รับผิดชอบงานซ่อมบำรุง โดยรายชื่อเหล่านี้จะแสดงในกราฟภาระงานและตัวเลือกมอบหมายงาน (Assign)
                                </p>

                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="ระบุชื่อ-สกุล หรือตำแหน่งช่าง เช่น ช่างสมคิด..."
                                        value={modalTechInput}
                                        onChange={(e) => setModalTechInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddTechDirect(modalTechInput);
                                            }
                                        }}
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleAddTechDirect(modalTechInput)}
                                        disabled={isAddingTech}
                                        className="btn btn-primary"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                                    >
                                        <Plus style={{ width: 16, height: 16 }} />
                                        เพิ่ม
                                    </button>
                                </div>

                                <div style={{ marginBottom: '1.25rem' }}>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                                        ตำแหน่งแนะนำ (คลิกเพื่อเพิ่มได้ทันที):
                                    </span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        {SUGGESTED_ROLES.map(r => (
                                            <button
                                                key={r}
                                                type="button"
                                                onClick={() => handleAddTechDirect(r)}
                                                style={{
                                                    background: 'rgba(59, 130, 246, 0.1)',
                                                    border: '1px dashed rgba(59, 130, 246, 0.4)',
                                                    color: '#93c5fd',
                                                    borderRadius: '16px',
                                                    padding: '3px 10px',
                                                    fontSize: '0.78rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                + {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.75rem' }}>
                                        รายชื่อเจ้าหน้าที่ในระบบปัจจุบัน ({Object.keys(stats?.workloads || {}).filter(k => k !== 'ยังไม่ได้มอบหมาย').length} คน):
                                    </span>
                                    {Object.keys(stats?.workloads || {}).filter(k => k !== 'ยังไม่ได้มอบหมาย').length === 0 ? (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>
                                            ยังไม่มีรายชื่อเจ้าหน้าที่ในระบบ
                                        </p>
                                    ) : (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                                            {Object.keys(stats.workloads).filter(k => k !== 'ยังไม่ได้มอบหมาย').map(name => (
                                                <div
                                                    key={name}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.4rem',
                                                        padding: '0.35rem 0.75rem',
                                                        background: 'rgba(59, 130, 246, 0.1)',
                                                        border: '1px solid rgba(59, 130, 246, 0.25)',
                                                        borderRadius: '16px',
                                                        color: '#93c5fd',
                                                        fontSize: '0.85rem'
                                                    }}
                                                >
                                                    <span>{name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveTechDirect(name)}
                                                        style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2, display: 'inline-flex' }}
                                                        title={`ลบ ${name}`}
                                                    >
                                                        <X style={{ width: 14, height: 14 }} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowTechModal(false)}
                                        className="btn btn-ghost"
                                    >
                                        ปิดหน้าต่าง
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tickets list for custom period */}
                    {period === 'custom' && stats?.ticketsForPeriod?.length > 0 && (
                        <div className="glass-card" style={{ marginTop: '1rem', padding: '0.75rem 0.85rem' }}>
                            <div className="page-header" style={{ marginBottom: '0.4rem' }}>
                                <div className="page-header-left">
                                    <h3 className="chart-card-title">รายการตั๋วสำหรับช่วงที่เลือก ({stats.ticketsForPeriod.length})</h3>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gap: '0.65rem' }}>
                                {stats.ticketsForPeriod.map(t => (
                                    <div key={t.id} style={{ borderBottom: '1px solid var(--table-border)', padding: '0.35rem 0' }}>
                                        <TicketCard ticket={t} compact />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
