// ============================================================
// TicketCard.js — Reusable Ticket Card React Component
// ============================================================

'use client';

import React from 'react';
import Link from 'next/link';
import { 
    Monitor, AppWindow, Wifi, Printer, School, 
    KeyRound, CircleHelp, ArrowDown, Minus, ArrowUp, 
    AlertTriangle, MapPin, User, UserCheck, Inbox 
} from 'lucide-react';
import { parseDescriptionAndAttachments } from '@/lib/utils';

const STATUS_COLORS = {
    'Open': { bg: '#3b82f620', text: '#60a5fa', border: '#3b82f640' },
    'In Progress': { bg: '#f59e0b20', text: '#fbbf24', border: '#f59e0b40' },
    'Waiting for Information': { bg: '#a855f720', text: '#c084fc', border: '#a855f740' },
    'Resolved': { bg: '#22c55e20', text: '#4ade80', border: '#22c55e40' },
    'Closed': { bg: '#6b728020', text: '#9ca3af', border: '#6b728040' },
    'Cancelled': { bg: '#ef444420', text: '#f87171', border: '#ef444440' }
};

const PRIORITY_COLORS = {
    'Low': { bg: '#22c55e20', text: '#4ade80', border: '#22c55e40' },
    'Medium': { bg: '#3b82f620', text: '#60a5fa', border: '#3b82f640' },
    'High': { bg: '#f59e0b20', text: '#fbbf24', border: '#f59e0b40' },
    'Urgent': { bg: '#ef444420', text: '#f87171', border: '#ef444440' }
};

const priorityIcons = {
    'Low': <ArrowDown style={{ width: 12, height: 12 }} />,
    'Medium': <Minus style={{ width: 12, height: 12 }} />,
    'High': <ArrowUp style={{ width: 12, height: 12 }} />,
    'Urgent': <AlertTriangle style={{ width: 12, height: 12 }} />
};

const issueTypeIcons = {
    'Computer Hardware': <Monitor style={{ width: 14, height: 14 }} />,
    'Software / Application': <AppWindow style={{ width: 14, height: 14 }} />,
    'Network / Internet': <Wifi style={{ width: 14, height: 14 }} />,
    'Printer / Scanner': <Printer style={{ width: 14, height: 14 }} />,
    'Classroom / Lab Room': <School style={{ width: 14, height: 14 }} />,
    'Account / Login': <KeyRound style={{ width: 14, height: 14 }} />,
    'Other': <CircleHelp style={{ width: 14, height: 14 }} />
};

// Simple utility to format time elapsed
export function timeAgo(isoString) {
    if (!isoString) return '-';
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
    
    return past.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: '2-digit'
    });
}

export default function TicketCard({ ticket, compact = false }) {
    const statusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS['Open'];
    const priorityColor = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS['Medium'];

    if (compact) {
        return (
            <Link href={`/tickets/${ticket.id}`} className="ticket-card ticket-card-compact">
                <div className="ticket-card-left">
                    <span className="ticket-no">{ticket.ticket_no}</span>
                    <span className="ticket-title-compact">{ticket.title}</span>
                </div>
                <div className="ticket-card-right">
                    <span 
                        className="status-badge" 
                        style={{ background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}` }}
                    >
                        {ticket.status}
                    </span>
                    <span 
                        className="priority-badge" 
                        style={{ background: priorityColor.bg, color: priorityColor.text, border: `1px solid ${priorityColor.border}` }}
                    >
                        {priorityIcons[ticket.priority]}
                        {ticket.priority}
                    </span>
                </div>
            </Link>
        );
    }

    // Extract image attachment if present in description
    let firstImageUrl = null;
    if (ticket.description) {
        const { attachments } = parseDescriptionAndAttachments(ticket.description);
        const imgAtt = attachments.find(a => a.isImage && a.url && a.url !== '#');
        if (imgAtt) {
            firstImageUrl = imgAtt.url;
        }
    }

    return (
        <Link href={`/tickets/${ticket.id}`} className="ticket-card" style={{ position: 'relative' }}>
            <div className="ticket-card-header">
                <div className="ticket-card-id-row">
                    <span className="ticket-no">{ticket.ticket_no}</span>
                    <span className="ticket-time">{timeAgo(ticket.created_at)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <h3 className="ticket-card-title" style={{ flex: 1 }}>{ticket.title}</h3>
                    {firstImageUrl && (
                        <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: '8px',
                            overflow: 'hidden',
                            flexShrink: 0,
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            background: '#000'
                        }}>
                            <img src={firstImageUrl} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                    )}
                </div>
            </div>
            
            <div className="ticket-card-meta">
                <div className="ticket-meta-item">
                    {issueTypeIcons[ticket.issue_type] || <CircleHelp style={{ width: 14, height: 14 }} />}
                    <span>{ticket.issue_type}</span>
                </div>
                <div className="ticket-meta-item">
                    <MapPin style={{ width: 14, height: 14 }} />
                    <span>{ticket.location || '-'}</span>
                </div>
                <div className="ticket-meta-item">
                    <User style={{ width: 14, height: 14 }} />
                    <span>{ticket.requester_name}</span>
                </div>
                {ticket.assigned_to && (
                    <div className="ticket-meta-item">
                        <UserCheck style={{ width: 14, height: 14 }} />
                        <span>{ticket.assigned_to}</span>
                    </div>
                )}
            </div>
            
            <div className="ticket-card-footer">
                <span 
                    className="status-badge" 
                    style={{ background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}` }}
                >
                    {ticket.status}
                </span>
                <span 
                    className="priority-badge" 
                    style={{ background: priorityColor.bg, color: priorityColor.text, border: `1px solid ${priorityColor.border}` }}
                >
                    {priorityIcons[ticket.priority]}
                    {ticket.priority}
                </span>
            </div>
        </Link>
    );
}

export function TicketGrid({ tickets }) {
    if (tickets.length === 0) {
        return (
            <div className="empty-state">
                <Inbox className="empty-icon" />
                <h3>ไม่พบ Ticket</h3>
                <p>ยังไม่มีรายการปัญหาที่ตรงกับเงื่อนไข</p>
            </div>
        );
    }

    return (
        <div className="ticket-grid">
            {tickets.map(t => (
                <TicketCard key={t.id} ticket={t} />
            ))}
        </div>
    );
}
