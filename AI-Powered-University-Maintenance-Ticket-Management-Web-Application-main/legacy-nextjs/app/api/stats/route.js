// ============================================================
// route.js — API Endpoint for analytical dashboard statistics
// Route: /api/stats
// ============================================================

import { NextResponse } from 'next/server';
import { DbService } from '@/lib/db';

// Force dynamic rendering — always query the live database
export const dynamic = 'force-dynamic';

export const revalidate = 0;

export async function GET(request) {
    try {
        const [tickets, issueTypes] = await Promise.all([
            DbService.getTickets(),
            DbService.getIssueTypes()
        ]);

        // Parse query parameter for period
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'all';
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        let filteredTickets = tickets;
        const now = new Date();

        if (period === 'day') {
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            filteredTickets = tickets.filter(t => new Date(t.created_at) >= oneDayAgo);
        } else if (period === 'week') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            filteredTickets = tickets.filter(t => new Date(t.created_at) >= oneWeekAgo);
        } else if (period === 'month') {
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            filteredTickets = tickets.filter(t => new Date(t.created_at) >= oneMonthAgo);
        } else if (period === 'custom' && startDate) {
            const start = new Date(startDate);
            const end = endDate ? new Date(endDate) : new Date(startDate);
            filteredTickets = tickets.filter(t => {
                const tDate = new Date(t.created_at);
                return tDate >= start && tDate <= end;
            });
        }

        // Compute all-time stats from ALL tickets (always reflects real totals)
        const allTimeStats = {
            total: tickets.length,
            byStatus: {
                'Open': 0,
                'In Progress': 0,
                'Waiting for Information': 0,
                'Resolved': 0,
                'Closed': 0,
                'Cancelled': 0
            },
            byPriority: {
                'Low': 0,
                'Medium': 0,
                'High': 0,
                'Urgent': 0
            }
        };

        tickets.forEach(t => {
            if (allTimeStats.byStatus[t.status] !== undefined) {
                allTimeStats.byStatus[t.status]++;
            }
            if (allTimeStats.byPriority[t.priority] !== undefined) {
                allTimeStats.byPriority[t.priority]++;
            }
        });

        const stats = {
            total: filteredTickets.length,
            allTimeStats,
            byStatus: {
                'Open': 0,
                'In Progress': 0,
                'Waiting for Information': 0,
                'Resolved': 0,
                'Closed': 0,
                'Cancelled': 0
            },
            byPriority: {
                'Low': 0,
                'Medium': 0,
                'High': 0,
                'Urgent': 0
            },
            byIssueType: {},
            // include both a short recent list and the full filtered tickets
            recentTickets: filteredTickets.slice(0, 5),
            ticketsForPeriod: filteredTickets,
            workloads: {}
        };

        // Initialize issue types count
        issueTypes.forEach(it => {
            stats.byIssueType[it.name] = 0;
        });

        // Count ticket values based on filtered tickets
        filteredTickets.forEach(t => {
            if (stats.byStatus[t.status] !== undefined) {
                stats.byStatus[t.status]++;
            }
            if (stats.byPriority[t.priority] !== undefined) {
                stats.byPriority[t.priority]++;
            }
            if (t.issue_type) {
                if (stats.byIssueType[t.issue_type] === undefined) {
                    stats.byIssueType[t.issue_type] = 0;
                }
                stats.byIssueType[t.issue_type]++;
            }
        });

        // Calculate workload stats for each staff member based on ALL tickets (since workload is independent of the selected period)
        const STAFF_MEMBERS = [
            'สมชาย ใจดี',
            'สุภาพร แก้วมณี',
            'ธนพล วงศ์สกุล',
            'พิมพ์ใจ รักเรียน',
            'อนุชา เทคโน'
        ];

        // Initialize workloads for static staff members
        STAFF_MEMBERS.forEach(s => {
            stats.workloads[s] = {
                total: 0,
                open: 0,
                inProgress: 0,
                waiting: 0,
                resolved: 0,
                closed: 0,
                cancelled: 0,
                active: 0
            };
        });

        // Initialize workload for unassigned tickets
        stats.workloads['ยังไม่ได้มอบหมาย'] = {
            total: 0,
            open: 0,
            inProgress: 0,
            waiting: 0,
            resolved: 0,
            closed: 0,
            cancelled: 0,
            active: 0
        };

        tickets.forEach(t => {
            const assignee = t.assigned_to ? t.assigned_to.trim() : 'ยังไม่ได้มอบหมาย';
            
            if (!stats.workloads[assignee]) {
                stats.workloads[assignee] = {
                    total: 0,
                    open: 0,
                    inProgress: 0,
                    waiting: 0,
                    resolved: 0,
                    closed: 0,
                    cancelled: 0,
                    active: 0
                };
            }
            
            stats.workloads[assignee].total++;
            
            if (t.status === 'Open') {
                stats.workloads[assignee].open++;
                stats.workloads[assignee].active++;
            } else if (t.status === 'In Progress') {
                stats.workloads[assignee].inProgress++;
                stats.workloads[assignee].active++;
            } else if (t.status === 'Waiting for Information') {
                stats.workloads[assignee].waiting++;
                stats.workloads[assignee].active++;
            } else if (t.status === 'Resolved') {
                stats.workloads[assignee].resolved++;
            } else if (t.status === 'Closed') {
                stats.workloads[assignee].closed++;
            } else if (t.status === 'Cancelled') {
                stats.workloads[assignee].cancelled++;
            }
        });

        return NextResponse.json(stats, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });
    } catch (e) {
        console.error('API Error in GET /api/stats:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
