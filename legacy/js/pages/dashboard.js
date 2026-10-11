// ============================================================
// dashboard.js — Dashboard Page with Charts
// ============================================================

let statusChartInstance = null;
let priorityChartInstance = null;
let typeChartInstance = null;

function renderDashboardPage() {
    const stats = TicketService.getStats();

    return `
        <div class="page-dashboard fade-in">
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title text-gradient">
                        <i data-lucide="bar-chart-3" style="width:26px;height:26px;color:var(--primary-color)"></i>
                        รายงานสถิติและ Dashboard
                    </h1>
                    <p class="page-subtitle">แสดงข้อมูลเชิงวิเคราะห์ของระบบงานซ่อมบำรุง AI-Powered University Maintenance แบบ Real-time</p>
                </div>
            </div>

            <!-- Stats Overview Grid -->
            <div class="dashboard-stats-grid">
                <div class="dash-stat-card">
                    <div class="dash-stat-icon" style="background:#4f46e520; color:#4f46e5">
                        <i data-lucide="ticket" style="width:24px;height:24px"></i>
                    </div>
                    <div class="dash-stat-info">
                        <span class="dash-stat-label">ตั๋วทั้งหมด</span>
                        <span class="dash-stat-number">${stats.total}</span>
                    </div>
                </div>
                <div class="dash-stat-card">
                    <div class="dash-stat-icon" style="background:#eab30820; color:#eab308">
                        <i data-lucide="loader" style="width:24px;height:24px"></i>
                    </div>
                    <div class="dash-stat-info">
                        <span class="dash-stat-label">กำลังดำเนินการ</span>
                        <span class="dash-stat-number">${stats.byStatus['In Progress'] || 0}</span>
                    </div>
                </div>
                <div class="dash-stat-card">
                    <div class="dash-stat-icon" style="background:#22c55e20; color:#22c55e">
                        <i data-lucide="check-circle" style="width:24px;height:24px"></i>
                    </div>
                    <div class="dash-stat-info">
                        <span class="dash-stat-label">แก้ไขเสร็จสิ้น</span>
                        <span class="dash-stat-number">${(stats.byStatus['Resolved'] || 0) + (stats.byStatus['Closed'] || 0)}</span>
                    </div>
                </div>
                <div class="dash-stat-card">
                    <div class="dash-stat-icon" style="background:#ef444420; color:#ef4444">
                        <i data-lucide="alert-triangle" style="width:24px;height:24px"></i>
                    </div>
                    <div class="dash-stat-info">
                        <span class="dash-stat-label">ตั๋วด่วนที่สุด</span>
                        <span class="dash-stat-number">${stats.byPriority['Urgent'] || 0}</span>
                    </div>
                </div>
            </div>

            <!-- Charts Row 1 -->
            <div class="charts-row">
                <div class="chart-card glass-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">สัดส่วนปัญหาตามสถานะ (Status)</h3>
                    </div>
                    <div class="chart-canvas-container">
                        <canvas id="statusChart"></canvas>
                    </div>
                </div>
                <div class="chart-card glass-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">ระดับความเร่งด่วน (Priority)</h3>
                    </div>
                    <div class="chart-canvas-container">
                        <canvas id="priorityChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Charts Row 2 -->
            <div class="charts-row">
                <div class="chart-card glass-card chart-card-full">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title">จำนวนปัญหาแยกตามหมวดหมู่ประเภทปัญหา (Issue Type)</h3>
                    </div>
                    <div class="chart-canvas-container-wide">
                        <canvas id="typeChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function initDashboardPage() {
    // Destroy previous chart instances if they exist
    if (statusChartInstance) { statusChartInstance.destroy(); statusChartInstance = null; }
    if (priorityChartInstance) { priorityChartInstance.destroy(); priorityChartInstance = null; }
    if (typeChartInstance) { typeChartInstance.destroy(); typeChartInstance = null; }

    const stats = TicketService.getStats();

    if (!window.Chart) {
        console.warn('Chart.js was not loaded yet.');
        return;
    }

    // Chart Options & Shared Colors
    const isDark = ThemeService.getCurrentTheme() === 'dark';
    const fontColor = isDark ? '#9ca3af' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    Chart.defaults.color = fontColor;
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';

    // 1. Status Chart (Doughnut)
    const statusCtx = document.getElementById('statusChart')?.getContext('2d');
    if (statusCtx) {
        const labels = Object.keys(stats.byStatus);
        const data = Object.values(stats.byStatus);
        
        // Match status colors from data.js
        const backgroundColors = labels.map(status => {
            return STATUS_COLORS[status]?.text || '#6366f1';
        });

        statusChartInstance = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: isDark ? '#111827' : '#ffffff',
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
                            font: { size: 12 }
                        }
                    }
                }
            }
        });
    }

    // 2. Priority Chart (Bar)
    const priorityCtx = document.getElementById('priorityChart')?.getContext('2d');
    if (priorityCtx) {
        const labels = Object.keys(stats.byPriority);
        const data = Object.values(stats.byPriority);
        const backgroundColors = labels.map(p => PRIORITY_COLORS[p]?.text || '#6366f1');

        priorityChartInstance = new Chart(priorityCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'จำนวนตั๋ว',
                    data: data,
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
                        grid: { display: false }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { precision: 0 }
                    }
                }
            }
        });
    }

    // 3. Issue Type Chart (Horizontal Bar)
    const typeCtx = document.getElementById('typeChart')?.getContext('2d');
    if (typeCtx) {
        const labels = Object.keys(stats.byIssueType);
        const data = Object.values(stats.byIssueType);

        typeChartInstance = new Chart(typeCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'จำนวนปัญหาแยกตามประเภท',
                    data: data,
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
                        ticks: { precision: 0 }
                    },
                    y: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
}
