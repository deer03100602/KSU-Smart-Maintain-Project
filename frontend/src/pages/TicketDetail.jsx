// ============================================================
// page.js — Ticket Detail Page
// Route: /tickets/[id]
// ============================================================



import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApp } from '@/context/AppContext';
import { 
    ArrowLeft, Edit, XCircle, Trash2, ClipboardCheck, Settings, 
    Save, Hash, Tag, MapPin, User, Mail, UserCheck, Calendar, Clock,
    Paperclip, FileText, QrCode, Printer, Eye, X, Maximize2, Image as ImageIcon,
    UploadCloud, Plus, Loader, Lock
} from 'lucide-react';
import { Link } from "react-router-dom";
import QRCode from 'qrcode';
import { parseDescriptionAndAttachments, isImageFile } from '@/lib/utils';
import TicketExpenseManager from '@/components/TicketExpenseManager';
import TicketWorkflowTimeline from '@/components/TicketWorkflowTimeline';
import TicketEvidenceManager from '@/components/TicketEvidenceManager';
import { generateOfficialReportPdf } from '@/lib/reportPdf';
import { 
    getStoredTicket, saveStoredTicket, syncTicketsWithServer, 
    getStoredExpenses, saveStoredExpenses, 
    getStoredTimelines, saveStoredTimelines, 
    getStoredEvidences, saveStoredEvidences, removeStoredTicket 
} from '@/lib/ticketStore';

const STATUSES = {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    WAITING: 'Waiting for Information',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
    CANCELLED: 'Cancelled'
};

const STATUS_COLORS = {
    'Open': { bg: '#3b82f620', text: '#60a5fa', border: '#3b82f640' },
    'In Progress': { bg: '#f59e0b20', text: '#fbbf24', border: '#f59e0b40' },
    'Waiting for Information': { bg: '#a855f720', text: '#c084fc', border: '#a855f740' },
    'Resolved': { bg: '#22c55e20', text: '#4ade80', border: '#22c55e40' },
    'Closed': { bg: '#6b728020', text: '#9ca3af', border: '#6b728040' },
    'Cancelled': { bg: '#ef444420', text: '#f87171', border: '#ef444440' }
};

const PRIORITIES = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    URGENT: 'Urgent'
};

const PRIORITY_COLORS = {
    'Low': { bg: '#22c55e20', text: '#4ade80', border: '#22c55e40' },
    'Medium': { bg: '#3b82f620', text: '#60a5fa', border: '#3b82f640' },
    'High': { bg: '#f59e0b20', text: '#fbbf24', border: '#f59e0b40' },
    'Urgent': { bg: '#ef444420', text: '#f87171', border: '#ef444440' }
};

const parseRequester = (fullName) => {
    if (!fullName) return { name: '', group: '' };
    const match = fullName.match(/^(.*?)\s*\((นักศึกษา|อาจารย์|เจ้าหน้าที่|เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์|ผู้ดูแลระบบ)\)$/);
    if (match) {
        return { name: match[1], group: match[2] };
    }
    return { name: fullName, group: 'นักศึกษา' };
};

export default function TicketDetailPage(props) {
    const routeParams = useParams();
    const params = props.params || routeParams;
    const navigate = useNavigate();
    const router = { push: (url) => navigate(url), replace: (url) => navigate(url, { replace: true }), back: () => navigate(-1), refresh: () => window.location.reload() };
    const { id } = params;
    const { role, user: currentUser, toast, confirm, isGuest, isGroupA, isGroupB } = useApp();

    const [ticket, setTicket] = useState(null);
    const [issueTypes, setIssueTypes] = useState([]);
    const [staffMembers, setStaffMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingNote, setUpdatingNote] = useState(false);
    const [noteContent, setNoteContent] = useState('');
    const [selectedImageModal, setSelectedImageModal] = useState(null);
    const [uploadingDirectFile, setUploadingDirectFile] = useState(false);
    const [failedImages, setFailedImages] = useState({});

    useEffect(() => {
        async function fetchStaff() {
            try {
                const res = await fetch('/api/staff');
                if (res.ok) {
                    const data = await res.json();
                    setStaffMembers(Array.isArray(data) ? data : []);
                }
            } catch (e) {
                console.error('Failed to load staff:', e);
            }
        }
        fetchStaff();
    }, []);

    const handleAddCustomStaff = async () => {
        const name = window.prompt('กรุณาระบุชื่อ-นามสกุล ของเจ้าหน้าที่ / ช่างผู้รับผิดชอบที่ต้องการเพิ่ม:');
        if (name && name.trim()) {
            const clean = name.trim();
            try {
                const res = await fetch('/api/staff', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: clean })
                });
                if (res.ok) {
                    const data = await res.json();
                    setStaffMembers(data.staff || [...staffMembers, clean]);
                    toast.success(`เพิ่มเจ้าหน้าที่ "${clean}" สำเร็จ`);
                    return clean;
                }
            } catch (e) {
                console.error(e);
            }
            if (!staffMembers.includes(clean)) {
                setStaffMembers(prev => [...prev, clean]);
            }
            return clean;
        }
        return null;
    };

    const isActuallyGroupA = isGroupA || ['นักศึกษา', 'อาจารย์'].includes(currentUser?.group);
    const isActuallyGroupB = !isActuallyGroupA && (isGroupB || role === 'admin' || currentUser?.role === 'admin' || currentUser?.group === 'ผู้ดูแลระบบ' || currentUser?.group === 'เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์' || (currentUser?.email || '').toLowerCase().includes('admin'));
    const isAdmin = isActuallyGroupB;

    const handleDirectFileUpload = async (files) => {
        if (!files || files.length === 0) return;
        
        const validFiles = Array.from(files).filter(file => {
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`ไฟล์ ${file.name} มีขนาดใหญ่เกินไป (จำกัดไม่เกิน 10MB)`);
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) return;

        setUploadingDirectFile(true);
        try {
            const uploadPromises = validFiles.map(async (file) => {
                const formData = new FormData();
                formData.append('file', file);
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                if (res.ok) {
                    return await res.json();
                }
                throw new Error(`อัปโหลด ${file.name} ล้มเหลว`);
            });

            const results = await Promise.allSettled(uploadPromises);
            const successfulUploads = results.filter(r => r.status === 'fulfilled').map(r => r.value);
            
            if (successfulUploads.length > 0) {
                const attachmentTags = successfulUploads.map(data => `\n\n📎 [${data.name}](${data.url})`).join('');
                const updatedDescription = (ticket.description || '') + attachmentTags;

                const patchRes = await fetch(`/api/tickets/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ description: updatedDescription })
                });

                if (patchRes.ok) {
                    toast.success(`เพิ่มไฟล์แนบ ${successfulUploads.length} ไฟล์เรียบร้อยแล้ว`);
                    fetchTicketData();
                } else {
                    toast.error('ไม่สามารถอัปเดตไฟล์แนบเข้า Ticket ได้');
                }
            } else {
                toast.error('การอัปโหลดไฟล์ล้มเหลวทั้งหมด');
            }
        } catch (e) {
            console.error('Direct upload error:', e);
            toast.error('เกิดข้อผิดพลาดในการอัปโหลด');
        } finally {
            setUploadingDirectFile(false);
        }
    };

    const [expenses, setExpenses] = useState([]);
    const [expenseSummary, setExpenseSummary] = useState({});
    const [timelines, setTimelines] = useState([]);
    const [evidences, setEvidences] = useState([]);

    // Fetch ticket details, issue types, expenses, timeline, and evidence
    const fetchTicketData = async () => {
        // Step 1: Pre-populate from local storage cache for instant rendering
        const cachedTicket = getStoredTicket(id);
        if (cachedTicket) {
            setTicket(cachedTicket);
            setNoteContent(cachedTicket.resolution_note || '');
            const cachedExp = getStoredExpenses(id) || getStoredExpenses(cachedTicket.id);
            if (cachedExp) {
                setExpenses(cachedExp.expenses || []);
                setExpenseSummary(cachedExp.summary || {});
            }
            const cachedTml = getStoredTimelines(id) || getStoredTimelines(cachedTicket.id);
            if (Array.isArray(cachedTml) && cachedTml.length > 0) {
                setTimelines(cachedTml);
            }
            const cachedEvi = getStoredEvidences(id) || getStoredEvidences(cachedTicket.id);
            if (Array.isArray(cachedEvi) && cachedEvi.length > 0) {
                setEvidences(cachedEvi);
            }
            setLoading(false);
        }

        try {
            const clientTicketHeader = cachedTicket ? encodeURIComponent(JSON.stringify(cachedTicket)) : '';
            const reqHeaders = clientTicketHeader ? { 'x-client-ticket': clientTicketHeader } : {};

            let [ticketRes, typesRes, expRes, tmlRes, eviRes] = await Promise.all([
                fetch(`/api/tickets/${id}`, { headers: reqHeaders }),
                fetch('/api/issue-types'),
                fetch(`/api/tickets/${id}/expenses`, { headers: reqHeaders }),
                fetch(`/api/tickets/${id}/timeline`, { headers: reqHeaders }),
                fetch(`/api/tickets/${id}/evidence`, { headers: reqHeaders })
            ]);

            // Self-healing: if server gave 404 but we have cachedTicket, immediately sync and re-fetch once
            if (!ticketRes.ok && cachedTicket) {
                try {
                    await syncTicketsWithServer([cachedTicket]);
                    ticketRes = await fetch(`/api/tickets/${id}`, { headers: reqHeaders });
                } catch (syncRetryErr) {}
            }

            let ticketData = cachedTicket || null;

            if (ticketRes.ok) {
                const data = await ticketRes.json();
                ticketData = data;
                setTicket(data);
                setNoteContent(data.resolution_note || '');
                saveStoredTicket(data);
            } else {
                if (cachedTicket) {
                    // Re-sync local ticket to serverless container in background
                    syncTicketsWithServer([cachedTicket]).catch(() => {});
                } else {
                    toast.error('ไม่พบข้อมูล Ticket');
                }
            }

            if (typesRes.ok) {
                const typesData = await typesRes.json();
                setIssueTypes(typesData);
            }

            let expList = [];
            let expSum = {};
            if (expRes.ok) {
                const expData = await expRes.json();
                expList = expData.expenses || [];
                expSum = expData.summary || {};
            }

            const cachedExp = getStoredExpenses(id) || (ticketData?.id && getStoredExpenses(ticketData.id)) || (ticketData?.ticket_no && getStoredExpenses(ticketData.ticket_no));
            if (cachedExp && Array.isArray(cachedExp.expenses) && cachedExp.expenses.length > 0) {
                const expMap = new Map();
                // Put server items first
                expList.forEach(e => { if (e && e.id) expMap.set(e.id, e); });
                // Merge local items if local has newer status (e.g. APPROVED)
                cachedExp.expenses.forEach(e => {
                    if (e && e.id) {
                        if (!expMap.has(e.id)) {
                            expMap.set(e.id, e);
                        } else {
                            const s = expMap.get(e.id);
                            if (e.status === 'APPROVED' && s.status !== 'APPROVED') {
                                expMap.set(e.id, { ...s, ...e });
                            }
                        }
                    }
                });
                expList = Array.from(expMap.values()).map(e => {
                    const amt = Number(e.net_amount || e.total_price || 0);
                    if (amt > 10000000) {
                        return { ...e, net_amount: 0, total_price: 0, unit_price: 0 };
                    }
                    return e;
                });

                let totalProp = 0, totalAppr = 0, totalDisb = 0;
                expList.forEach(e => {
                    const amt = Number(e.net_amount || e.total_price || 0);
                    totalProp += amt;
                    if (e.status === 'APPROVED' || e.status === 'PARTIALLY_APPROVED') {
                        totalAppr += amt;
                        if (e.receipt_no || e.receipt_url) totalDisb += amt;
                    }
                });
                expSum = {
                    ...expSum,
                    totalProposed: totalProp,
                    totalApproved: totalAppr,
                    totalDisbursed: totalDisb,
                    remainingBudget: Math.max(0, totalAppr - totalDisb)
                };
            }

            setExpenses(expList);
            setExpenseSummary(expSum);
            saveStoredExpenses(id, expList, expSum, ticketData?.ticket_no || id);

            let tmlList = [];
            if (tmlRes.ok) {
                const tmlData = await tmlRes.json();
                if (Array.isArray(tmlData)) tmlList = tmlData;
            }
            const cachedTml = getStoredTimelines(id) || (ticketData?.id && getStoredTimelines(ticketData.id)) || (ticketData?.ticket_no && getStoredTimelines(ticketData.ticket_no));
            if (Array.isArray(cachedTml) && cachedTml.length > 0) {
                const tmlMap = new Map();
                const seenActions = new Set();
                [...tmlList, ...cachedTml].forEach(t => {
                    if (!t) return;
                    const actKey = t.action === 'CREATED' ? 'CREATED' : (t.id || (t.action + ':' + t.title));
                    if (!seenActions.has(actKey)) {
                        seenActions.add(actKey);
                        tmlMap.set(t.id || actKey, t);
                    }
                });
                tmlList = Array.from(tmlMap.values());
            }
            if (tmlList.length > 0) {
                setTimelines(tmlList);
                saveStoredTimelines(id, tmlList, ticketData?.ticket_no || id);
            }

            let eviList = [];
            if (eviRes.ok) {
                const eviData = await eviRes.json();
                if (Array.isArray(eviData)) eviList = eviData;
            }
            const cachedEvi = getStoredEvidences(id) || (ticketData?.id && getStoredEvidences(ticketData.id)) || (ticketData?.ticket_no && getStoredEvidences(ticketData.ticket_no));
            if (Array.isArray(cachedEvi) && cachedEvi.length > 0) {
                const eviMap = new Map();
                eviList.forEach(ev => { if (ev && ev.id) eviMap.set(ev.id, ev); });
                cachedEvi.forEach(ev => { if (ev && ev.id && !eviMap.has(ev.id)) eviMap.set(ev.id, ev); });
                eviList = Array.from(eviMap.values());
            }
            setEvidences(eviList);
            saveStoredEvidences(id, eviList, ticketData?.ticket_no || id);
        } catch (e) {
            console.error('Error fetching ticket detail:', e);
            if (!cachedTicket) {
                toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTicketData();
    }, [id]);

    const [qrCodeUrl, setQrCodeUrl] = useState('');

    useEffect(() => {
        if (ticket && typeof window !== 'undefined') {
            QRCode.toDataURL(window.location.href, { width: 180, margin: 2 })
                .then(url => {
                    setQrCodeUrl(url);
                })
                .catch(err => {
                    console.error('Error generating QR code:', err);
                });
        }
    }, [ticket]);

    const handlePrintSingleTicket = (t) => {
        const { cleanDescription: cleanDesc, attachments } = parseDescriptionAndAttachments(t.description);
        const reqInfo = parseRequester(t.requester_name);
        const activeExpenses = Array.isArray(expenses) ? expenses : [];
        const totalExpensesAmount = activeExpenses.reduce((sum, item) => sum + (Number(item.net_amount || item.total_price) || 0), 0);

        const allPrintImages = [...evidences];
        (attachments || []).forEach(att => {
            if ((att.isImage || isImageFile(att.name, att.url)) && !allPrintImages.some(img => img.url === att.url)) {
                allPrintImages.push({
                    url: att.url,
                    description: att.name,
                    stage: 'BEFORE'
                });
            }
        });

        const STAGE_ORDER_LIST = [
            { key: 'BEFORE', title: '📷 รูปภาพก่อนดำเนินการซ่อม (Before Maintenance)', short: 'ก่อนซ่อม' },
            { key: 'DURING', title: '⚙️ รูปภาพระหว่างดำเนินการซ่อม (During Maintenance)', short: 'ระหว่างซ่อม' },
            { key: 'PARTS', title: '📦 รูปภาพวัสดุและอุปกรณ์ / อะไหล่ที่ใช้ (Parts & Materials)', short: 'วัสดุ/อะไหล่' },
            { key: 'RECEIPT', title: '🧾 รูปภาพใบเสร็จรับเงินและหลักฐานการเงิน (Receipts & Expenses)', short: 'ใบเสร็จ/ค่าใช้จ่าย' },
            { key: 'AFTER', title: '🎉 รูปภาพหลังดำเนินการซ่อมเสร็จสิ้น (After Maintenance)', short: 'หลังซ่อมเสร็จ' },
            { key: 'TESTING', title: '🔬 รูปภาพผลการทดสอบการใช้งาน (Testing & Verification)', short: 'ผลทดสอบ' },
            { key: 'HANDOVER', title: '📋 รูปภาพการส่งมอบงานและการตรวจรับ (Handover & Inspection)', short: 'ส่งมอบงาน' }
        ];

        const normalizePdfStage = (st) => {
            const u = String(st || '').toUpperCase();
            if (u.includes('BEFORE') || u.includes('ก่อน')) return 'BEFORE';
            if (u.includes('DURING') || u.includes('ระหว่าง')) return 'DURING';
            if (u.includes('PART') || u.includes('MATERIAL') || u.includes('วัสดุ') || u.includes('อะไหล่')) return 'PARTS';
            if (u.includes('RECEIPT') || u.includes('EXPENSE') || u.includes('ใบเสร็จ')) return 'RECEIPT';
            if (u.includes('AFTER') || u.includes('หลัง')) return 'AFTER';
            if (u.includes('TEST') || u.includes('ทดสอบ')) return 'TESTING';
            if (u.includes('HANDOVER') || u.includes('INSPECT') || u.includes('ส่งมอบ') || u.includes('ตรวจรับ')) return 'HANDOVER';
            return 'BEFORE';
        };

        const printGroups = STAGE_ORDER_LIST.map(st => {
            const items = allPrintImages.filter(img => normalizePdfStage(img.stage) === st.key);
            return { ...st, items };
        }).filter(g => g.items.length > 0);
        const printWindow = window.open('', '_blank');
        const html = `
            <!DOCTYPE html>
            <html lang="th">
                <head>
                    <meta charset="utf-8">
                    <title>ใบสั่งงานซ่อมบำรุง - ${t.ticket_no} - มหาวิทยาลัยกาฬสินธุ์</title>
                    <style>
                        @page { size: A4; margin: 15mm; }
                        * { box-sizing: border-box; }
                        body { 
                            font-family: 'Sarabun', 'TH Sarabun New', 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif; 
                            padding: 24px; 
                            color: #1e293b; 
                            max-width: 860px; 
                            margin: 0 auto; 
                            line-height: 1.5; 
                            background: #fff;
                        }
                        .header { 
                            display: flex; 
                            justify-content: space-between; 
                            align-items: flex-start; 
                            border-bottom: 2px solid #0f172a; 
                            padding-bottom: 12px; 
                            margin-bottom: 18px; 
                        }
                        .inst-title { font-size: 19px; font-weight: 800; color: #0f172a; margin-bottom: 2px; }
                        .inst-sub { font-size: 13px; color: #475569; font-weight: 600; }
                        .doc-title { font-size: 15px; font-weight: 700; color: #2563eb; margin-top: 6px; letter-spacing: 0.5px; }
                        .ticket-badge { 
                            border: 2px solid #2563eb; 
                            border-radius: 8px; 
                            padding: 8px 14px; 
                            text-align: right; 
                            background: #eff6ff; 
                        }
                        .ticket-no { font-size: 20px; font-weight: 800; color: #1d4ed8; font-family: monospace; }
                        .print-meta { font-size: 11px; color: #64748b; margin-top: 3px; }
                        .info-table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            margin-bottom: 14px; 
                            font-size: 13px; 
                        }
                        .info-table td { 
                            padding: 6px 10px; 
                            border: 1px solid #cbd5e1; 
                            vertical-align: top; 
                        }
                        .info-table .label-col { 
                            width: 18%; 
                            background: #f8fafc; 
                            font-weight: 700; 
                            color: #334155; 
                        }
                        .info-table .val-col { width: 32%; }
                        .section-title { 
                            font-size: 13px; 
                            font-weight: 700; 
                            color: #0f172a; 
                            background: #e2e8f0; 
                            padding: 5px 10px; 
                            border-left: 4px solid #2563eb; 
                            margin: 14px 0 8px 0; 
                        }
                        .desc-box { 
                            border: 1px solid #cbd5e1; 
                            padding: 10px 12px; 
                            border-radius: 4px; 
                            background: #f8fafc; 
                            font-size: 13px; 
                            white-space: pre-wrap; 
                            min-height: 50px; 
                        }
                        .expense-table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            margin-top: 8px; 
                            font-size: 12px; 
                        }
                        .expense-table th { 
                            background: #f1f5f9; 
                            border: 1px solid #cbd5e1; 
                            padding: 6px 8px; 
                            text-align: left; 
                            font-weight: 700; 
                        }
                        .expense-table td { 
                            border: 1px solid #cbd5e1; 
                            padding: 6px 8px; 
                        }
                        /* Evidence Photos Grid & Stage Grouping */
                        .evidence-stage-group { margin-bottom: 14px; page-break-inside: avoid; }
                        .evidence-stage-header { font-size: 13px; font-weight: 700; color: #1e3a8a; background: #f0f7ff; border-left: 4px solid #2563eb; padding: 6px 10px; border-radius: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
                        .evidence-stage-badge { font-size: 11px; font-weight: 600; color: #475569; background: #ffffff; padding: 2px 8px; border-radius: 12px; border: 1px solid #cbd5e1; }
                        .evidence-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; margin-top: 6px; margin-bottom: 8px; }
                        .evidence-item { border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px; background: #ffffff; text-align: center; }
                        .evidence-item img { width: 100%; height: 90px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0; display: block; }
                        .evidence-label { font-weight: 600; color: #0f2b5c; margin-top: 4px; font-size: 11px; }
                        .evidence-desc { color: #64748b; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
                        .signatures-grid { 
                            display: grid; 
                            grid-template-columns: repeat(4, 1fr); 
                            gap: 12px; 
                            margin-top: 24px; 
                            page-break-inside: avoid; 
                        }
                        .sig-box { 
                            border: 1px solid #cbd5e1; 
                            border-radius: 6px; 
                            padding: 10px 8px; 
                            text-align: center; 
                            font-size: 11px; 
                            background: #ffffff; 
                        }
                        .sig-role { font-weight: 700; color: #1e293b; margin-bottom: 28px; }
                        .sig-line { border-bottom: 1px dotted #64748b; margin-bottom: 6px; }
                        .sig-name { color: #475569; margin-bottom: 4px; }
                        .sig-date { color: #64748b; font-size: 10px; }
                        .print-actions { text-align: center; margin-top: 25px; }
                        .btn-print { 
                            background: #2563eb; 
                            color: white; 
                            border: none; 
                            padding: 8px 20px; 
                            border-radius: 6px; 
                            font-size: 14px; 
                            font-weight: 600; 
                            cursor: pointer; 
                        }
                        @media print {
                            .print-actions { display: none !important; }
                            body { padding: 0; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <div class="inst-title">มหาวิทยาลัยกาฬสินธุ์ (KALASIN UNIVERSITY)</div>
                            <div class="inst-sub">ระบบแจ้งซ่อมสิ่งพานิชย์และอุปกรณ์อัจฉริยะภายในมหาวิทยาลัยด้วย AI (AI-Powered University Maintenance & Ticket Management Web Application)</div>
                            <div class="doc-title">ใบสั่งงานซ่อมบำรุงและบริการ (MAINTENANCE WORK ORDER)</div>
                        </div>
                        <div class="ticket-badge">
                            <div style="font-size: 11px; font-weight: 700; color: #1e3a8a;">เลขที่คำขอ / WORK ORDER NO.</div>
                            <div class="ticket-no">${t.ticket_no}</div>
                            <div class="print-meta">พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')}</div>
                        </div>
                    </div>

                    <table class="info-table">
                        <tr>
                            <td class="label-col">หัวข้อปัญหา</td>
                            <td class="val-col" colspan="3" style="font-weight: 700; font-size: 14px; color: #0f172a;">${t.title}</td>
                        </tr>
                        <tr>
                            <td class="label-col">ประเภทงานซ่อม</td>
                            <td class="val-col">${t.issue_type}</td>
                            <td class="label-col">ระดับความสำคัญ</td>
                            <td class="val-col" style="font-weight: 700; color: ${t.priority === 'Urgent' ? '#dc2626' : t.priority === 'High' ? '#ea580c' : '#2563eb'};">${t.priority}</td>
                        </tr>
                        <tr>
                            <td class="label-col">สถานที่เกิดเหตุ</td>
                            <td class="val-col">${t.location || 'ไม่ระบุ'}</td>
                            <td class="label-col">สถานะปัจจุบัน</td>
                            <td class="val-col" style="font-weight: 700;">${t.status}</td>
                        </tr>
                        <tr>
                            <td class="label-col">ผู้แจ้งซ่อม</td>
                            <td class="val-col">${reqInfo.name || t.requester_name} (${reqInfo.group || 'ผู้ใช้งาน'})</td>
                            <td class="label-col">อีเมล / ติดต่อ</td>
                            <td class="val-col">${t.requester_email || '-'}</td>
                        </tr>
                        <tr>
                            <td class="label-col">ช่างผู้รับผิดชอบ</td>
                            <td class="val-col" style="font-weight: 600;">${t.assigned_to || 'ยังไม่ได้มอบหมาย'}</td>
                            <td class="label-col">ช่างผู้ร่วมปฏิบัติงาน</td>
                            <td class="val-col">${t.co_workers || '-'}</td>
                        </tr>
                        <tr>
                            <td class="label-col">วันที่รับแจ้ง</td>
                            <td class="val-col">${new Date(t.created_at).toLocaleString('th-TH')}</td>
                            <td class="label-col">กำหนดส่งมอบงาน</td>
                            <td class="val-col">${t.due_date ? new Date(t.due_date).toLocaleDateString('th-TH') : 'ตามมาตรฐานบริการ'}</td>
                        </tr>
                        <tr>
                            <td class="label-col">สถานะงบประมาณ</td>
                            <td class="val-col">${t.budget_status || 'ยังไม่เสนอ'} (อนุมัติ: ${(t.approved_budget || 0).toLocaleString()} บาท)</td>
                            <td class="label-col">ยอดใช้จ่ายจริง</td>
                            <td class="val-col" style="font-weight: 700; color: #16a34a;">${(t.disbursed_amount || totalExpensesAmount).toLocaleString()} บาท</td>
                        </tr>
                    </table>

                    <div class="section-title">รายละเอียดปัญหาและความต้องการ</div>
                    <div class="desc-box">${cleanDesc || 'ไม่มีรายละเอียดเพิ่มเติม'}</div>

                    ${(t.resolution_note || t.completion_summary) ? `
                        <div class="section-title">สรุปผลการดำเนินงาน / วิธีการซ่อมแซม</div>
                        <div class="desc-box" style="background: #f0fdf4; border-color: #86efac; color: #14532d;">
                            ${t.completion_summary ? `<strong>สรุปงาน:</strong> ${t.completion_summary}<br/>` : ''}
                            ${t.resolution_note ? `<strong>บันทึกช่าง:</strong> ${t.resolution_note}` : ''}
                        </div>
                    ` : ''}

                    ${activeExpenses.length > 0 ? `
                        <div class="section-title">รายการเบิกจ่ายวัสดุ / อะไหล่ / ค่าแรงช่าง</div>
                        <table class="expense-table">
                            <thead>
                                <tr>
                                    <th style="width: 15%;">หมวดหมู่</th>
                                    <th>รายละเอียดวัสดุ / อุปกรณ์</th>
                                    <th style="width: 10%; text-align: center;">จำนวน</th>
                                    <th style="width: 12%; text-align: right;">ราคา/หน่วย</th>
                                    <th style="width: 14%; text-align: right;">รวมเงิน (บาท)</th>
                                    <th style="width: 14%; text-align: center;">สถานะ</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${activeExpenses.map(exp => `
                                    <tr>
                                        <td>${exp.category}</td>
                                        <td>${exp.description}</td>
                                        <td style="text-align: center;">${exp.quantity} ${exp.unit || ''}</td>
                                        <td style="text-align: right;">${Number(exp.unit_price || 0).toLocaleString()}</td>
                                        <td style="text-align: right; font-weight: 700;">${Number(exp.net_amount || exp.total_price || 0).toLocaleString()}</td>
                                        <td style="text-align: center;">${exp.status === 'APPROVED' ? 'อนุมัติแล้ว' : exp.status}</td>
                                    </tr>
                                `).join('')}
                                <tr style="background: #f8fafc; font-weight: 700;">
                                    <td colspan="4" style="text-align: right;">รวมยอดเบิกจ่ายทั้งสิ้น:</td>
                                    <td style="text-align: right; color: #15803d;">${totalExpensesAmount.toLocaleString()} บาท</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    ` : ''}

                    ${printGroups.length > 0 ? `
                        <div class="section-title">รูปภาพและหลักฐานการดำเนินงานซ่อมบำรุง (จำแนกตามขั้นตอนงาน)</div>
                        ${printGroups.map((grp, gIdx) => `
                            <div class="evidence-stage-group">
                                <div class="evidence-stage-header">
                                    <span>${gIdx + 1}. ${grp.title}</span>
                                    <span class="evidence-stage-badge">${grp.items.length} รายการ</span>
                                </div>
                                <div class="evidence-grid">
                                    ${grp.items.map(evi => `
                                        <div class="evidence-item">
                                            <img src="${evi.url}" alt="${evi.description || 'หลักฐานงานซ่อม'}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
                                            <div style="display: none; height: 90px; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; color: #64748b; font-size: 26px;">📄</div>
                                            <div class="evidence-label">${grp.short}</div>
                                            <div class="evidence-desc" title="${evi.description || evi.name || ''}">${evi.description || evi.name || '-'}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    ` : ''}

                    <div class="signatures-grid">
                        <div class="sig-box">
                            <div class="sig-role">ผู้แจ้งซ่อม / เจ้าหน้าที่</div>
                            <div class="sig-line"></div>
                            <div class="sig-name">(${reqInfo.name || t.requester_name})</div>
                            <div class="sig-date">วันที่ ......./......./...........</div>
                        </div>
                        <div class="sig-box">
                            <div class="sig-role">ช่างผู้รับผิดชอบงาน</div>
                            <div class="sig-line"></div>
                            <div class="sig-name">(${t.assigned_to || '.....................................'})</div>
                            <div class="sig-date">วันที่ ......./......./...........</div>
                        </div>
                        <div class="sig-box">
                            <div class="sig-role">ผู้ควบคุมงาน / แอดมิน</div>
                            <div class="sig-line"></div>
                            <div class="sig-name">(ผู้ดูแลระบบ KSU Smart Maintain)</div>
                            <div class="sig-date">วันที่ ......./......./...........</div>
                        </div>
                        <div class="sig-box">
                            <div class="sig-role">ผู้ตรวจรับมอบงาน</div>
                            <div class="sig-line"></div>
                            <div class="sig-name">(.....................................)</div>
                            <div class="sig-date">วันที่ ......./......./...........</div>
                        </div>
                    </div>

                    <div class="print-actions">
                        <button class="btn-print" onclick="window.print()">🖨️ สั่งพิมพ์ใบสั่งงานซ่อม (Print A4)</button>
                    </div>
                </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    };

    if (loading) {
        return (
            <div className="page-detail fade-in" style={{ textAlign: 'center', padding: '5rem' }}>
                <p className="text-muted">กำลังโหลดข้อมูล Ticket...</p>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="page-detail fade-in">
                <div className="empty-state">
                    <h3>ไม่พบ Ticket</h3>
                    <p>Ticket ที่คุณต้องการดูไม่พบในระบบ</p>
                    <Link to="/tickets" className="btn btn-primary">กลับไปรายการ Ticket</Link>
                </div>
            </div>
        );
    }

    const { cleanDescription, attachments } = parseDescriptionAndAttachments(ticket.description);

    const statusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS['Open'];
    const priorityColor = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS['Medium'];
    const isOwner = ticket.requester_name === currentUser.name;
    const canEdit = isAdmin || (isOwner && ticket.status === STATUSES.OPEN);
    const canCancel = isOwner && (ticket.status === STATUSES.OPEN || ticket.status === STATUSES.IN_PROGRESS);

    // Format Dates
    const formatDate = (isoString) => {
        if (!isoString) return '-';
        const d = new Date(isoString);
        return d.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Actions
    const handleUpdateStatus = async (newStatus) => {
        try {
            const res = await fetch(`/api/tickets/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                toast.success(`เปลี่ยนสถานะเป็น "${newStatus}" เรียบร้อย`);
                fetchTicketData();
            } else {
                toast.error('ไม่สามารถเปลี่ยนสถานะได้');
            }
        } catch (e) {
            console.error(e);
            toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    };

    const handleUpdateAssignee = async (assignee) => {
        try {
            const res = await fetch(`/api/tickets/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assigned_to: assignee })
            });
            if (res.ok) {
                toast.success(assignee ? `มอบหมายให้ "${assignee}" เรียบร้อย` : 'ยกเลิกการมอบหมายแล้ว');
                fetchTicketData();
            } else {
                toast.error('ไม่สามารถมอบหมายงานได้');
            }
        } catch (e) {
            console.error(e);
            toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    };

    const handleSaveAssignment = async ({ assignedTo, coWorkers, startDate, dueDate, priority }) => {
        try {
            const res = await fetch(`/api/tickets/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    assigned_to: assignedTo,
                    co_workers: coWorkers,
                    start_date: startDate ? new Date(startDate).toISOString() : null,
                    due_date: dueDate ? new Date(dueDate).toISOString() : null,
                    priority: priority
                })
            });
            if (res.ok) {
                toast.success('บันทึกการมอบหมายงานและแผนกำหนดการเรียบร้อย');
                fetchTicketData();
            } else {
                toast.error('ไม่สามารถบันทึกข้อมูลการมอบหมายได้');
            }
        } catch (e) {
            console.error(e);
            toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    };

    const handleSaveNote = async () => {
        setUpdatingNote(true);
        try {
            const clientTicketHeader = ticket ? encodeURIComponent(JSON.stringify(ticket)) : '';
            const res = await fetch(`/api/tickets/${id}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-client-ticket': clientTicketHeader
                },
                body: JSON.stringify({ resolution_note: noteContent })
            });
            if (res.ok) {
                toast.success('บันทึกหมายเหตุการดำเนินงานเรียบร้อย');
                
                // Immediately update local ticket state
                const updatedTicket = { 
                    ...ticket, 
                    resolution_note: noteContent, 
                    updated_at: new Date().toISOString() 
                };
                setTicket(updatedTicket);
                saveStoredTicket(updatedTicket);

                // Add timeline event immediately to state and localStorage so it displays instantly
                const noteText = String(noteContent || '').trim();
                let noteAction = 'NOTE_ADDED';
                let noteTitle = 'บันทึกหมายเหตุการดำเนินงาน';
                if (noteText.includes('[เริ่มงาน]')) {
                    noteAction = 'STARTED';
                    noteTitle = 'เริ่มดำเนินงานซ่อมบำรุง';
                } else if (noteText.includes('[รออุปกรณ์]')) {
                    noteAction = 'WAITING_PARTS';
                    noteTitle = 'รออุปกรณ์ / อะไหล่ / งบประมาณ';
                } else if (noteText.includes('[ส่งกลับแก้ไข]')) {
                    noteAction = 'RETURNED_FOR_REVISE';
                    noteTitle = 'ส่งกลับแก้ไขงาน';
                }

                const newTml = {
                    id: `tml-${Date.now()}`,
                    ticket_id: ticket.id,
                    ticket_no: ticket.ticket_no,
                    action: noteAction,
                    title: noteTitle,
                    description: noteContent,
                    actor_name: currentUser?.name || ticket.assigned_to || 'เจ้าหน้าที่ผู้รับผิดชอบ',
                    actor_role: currentUser?.role || 'staff',
                    created_at: new Date().toISOString()
                };

                setTimelines(prev => [...(prev || []), newTml]);
                const storedTml = getStoredTimelines(id) || [];
                saveStoredTimelines(id, [...storedTml, newTml]);

                fetchTicketData();
            } else {
                toast.error('ไม่สามารถบันทึกหมายเหตุได้');
            }
        } catch (e) {
            console.error(e);
            toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setUpdatingNote(false);
        }
    };

    const handleCancelTicket = () => {
        confirm(
            'ยกเลิก Ticket',
            'คุณต้องการยกเลิก Ticket นี้ใช่หรือไม่?',
            async () => {
                try {
                    const res = await fetch(`/api/tickets/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: STATUSES.CANCELLED })
                    });
                    if (res.ok) {
                        toast.success('ยกเลิก Ticket เรียบร้อย');
                        fetchTicketData();
                    } else {
                        toast.error('ไม่สามารถยกเลิกได้');
                    }
                } catch (e) {
                    console.error(e);
                    toast.error('เกิดข้อผิดพลาด');
                }
            },
            { confirmClass: 'btn-danger' }
        );
    };

    const handleDeleteTicket = () => {
        confirm(
            'ลบ Ticket',
            'คุณต้องการลบ Ticket นี้ใช่หรือไม่? การลบจะไม่สามารถกู้คืนได้',
            async () => {
                try {
                    // Remove from localStorage and notify other views immediately
                    removeStoredTicket(id);
                    if (ticket?.ticket_no) removeStoredTicket(ticket.ticket_no);

                    const res = await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        toast.success('ลบ Ticket เรียบร้อย');
                        router.push('/tickets');
                    } else {
                        toast.error('ไม่สามารถลบได้');
                    }
                } catch (e) {
                    console.error(e);
                    toast.error('เกิดข้อผิดพลาด');
                }
            },
            { confirmClass: 'btn-danger' }
        );
    };

    const showEditModal = () => {
        let titleVal = ticket.title;
        let descVal = ticket.description;
        let typeVal = ticket.issue_type;
        let locationVal = ticket.location;
        let priorityVal = ticket.priority;

        confirm(
            'แก้ไข Ticket',
            '',
            async () => {
                try {
                    const res = await fetch(`/api/tickets/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: titleVal,
                            description: descVal,
                            issue_type: typeVal,
                            location: locationVal,
                            priority: priorityVal
                        })
                    });
                    if (res.ok) {
                        toast.success('แก้ไข Ticket เรียบร้อย');
                        fetchTicketData();
                    } else {
                        toast.error('ไม่สามารถอัปเดตข้อมูลได้');
                    }
                } catch (e) {
                    console.error(e);
                }
            },
            {
                content: (
                    <div className="edit-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">หัวข้อปัญหา</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                defaultValue={ticket.title}
                                onChange={(e) => { titleVal = e.target.value; }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">รายละเอียด</label>
                            <textarea 
                                className="form-input form-textarea" 
                                rows={3}
                                defaultValue={ticket.description}
                                onChange={(e) => { descVal = e.target.value; }}
                            ></textarea>
                        </div>
                        <div className="form-group">
                            <label className="form-label">ประเภทปัญหา</label>
                            <select 
                                className="form-input form-select"
                                defaultValue={ticket.issue_type}
                                onChange={(e) => { typeVal = e.target.value; }}
                            >
                                {issueTypes.map(t => (
                                    <option key={t.id} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">สถานที่</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                defaultValue={ticket.location}
                                onChange={(e) => { locationVal = e.target.value; }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">ระดับความสำคัญ</label>
                            <select 
                                className="form-input form-select"
                                defaultValue={ticket.priority}
                                onChange={(e) => { priorityVal = e.target.value; }}
                            >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Urgent">Urgent</option>
                            </select>
                        </div>
                    </div>
                )
            }
        );
    };

    return (
        <div className="page-detail fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>
                        <ArrowLeft style={{ width: 16, height: 16 }} />
                        กลับ
                    </button>
                    <h1 className="page-title">{ticket.ticket_no}</h1>
                </div>
                <div className="page-header-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button 
                        className="btn btn-primary" 
                        onClick={() => generateOfficialReportPdf({ ticket, expenses, summary: expenseSummary, evidences, timelines })}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', borderColor: '#2563eb' }}
                    >
                        <FileText style={{ width: 16, height: 16 }} />
                        รายงาน A4 & PDF ทางการ
                    </button>
                    <button 
                        className="btn btn-ghost" 
                        onClick={() => handlePrintSingleTicket(ticket)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        title="พิมพ์ใบสั่งงานซ่อมบำรุงและบริการ มหาวิทยาลัยกาฬสินธุ์ รูปแบบ A4"
                    >
                        <Printer style={{ width: 16, height: 16 }} />
                        พิมพ์ใบสั่งงานซ่อม (Work Order)
                    </button>
                    {canEdit && (
                        <button className="btn btn-ghost" onClick={showEditModal}>
                            <Edit style={{ width: 16, height: 16 }} />
                            แก้ไข
                        </button>
                    )}
                    {canCancel && (
                        <button className="btn btn-danger-ghost" onClick={handleCancelTicket}>
                            <XCircle style={{ width: 16, height: 16 }} />
                            ยกเลิก
                        </button>
                    )}
                    {isAdmin && (
                        <button className="btn btn-danger-ghost" onClick={handleDeleteTicket}>
                            <Trash2 style={{ width: 16, height: 16 }} />
                            ลบ
                        </button>
                    )}
                </div>
            </div>

            <div className="detail-layout">
                {/* Main Content */}
                <div className="detail-main glass-card">
                    <div className="detail-title-section">
                        <h2 className="detail-title">{ticket.title}</h2>
                        <div className="detail-badges">
                            <span 
                                className="status-badge status-badge-lg" 
                                style={{ background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}` }}
                            >
                                {ticket.status}
                            </span>
                            <span 
                                className="priority-badge priority-badge-lg" 
                                style={{ background: priorityColor.bg, color: priorityColor.text, border: `1px solid ${priorityColor.border}` }}
                            >
                                {ticket.priority}
                            </span>
                        </div>
                    </div>

                    <div className="detail-description">
                        <h3 className="detail-label">รายละเอียดปัญหา</h3>
                        <p style={{ whiteSpace: 'pre-wrap' }}>{cleanDescription || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                    </div>

                    <div className="detail-attachments" style={{ marginTop: '1.5rem', marginBottom: '2.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <h3 className="detail-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                                <Paperclip style={{ width: 16, height: 16 }} />
                                ไฟล์แนบ ({attachments.length})
                            </h3>
                            <div>
                                <input 
                                    type="file" 
                                    id="direct-file-input" 
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            handleDirectFileUpload(e.target.files);
                                        }
                                        e.target.value = ''; // Reset input to allow selecting the same files again
                                    }}
                                />
                                <button 
                                    className="btn btn-ghost btn-sm"
                                    disabled={uploadingDirectFile}
                                    onClick={() => document.getElementById('direct-file-input').click()}
                                    style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}
                                >
                                    {uploadingDirectFile ? <Loader className="animate-spin" style={{ width: 14, height: 14 }} /> : <Plus style={{ width: 14, height: 14 }} />}
                                    {uploadingDirectFile ? 'กำลังอัปโหลด...' : 'เพิ่มไฟล์แนบ / รูปภาพ'}
                                </button>
                            </div>
                        </div>

                        {attachments.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center' }}>
                                {attachments.map((file, idx) => {
                                    const isImage = file.isImage || isImageFile(file.name, file.url);
                                    const fileKey = file.url || file.name || String(idx);
                                    const hasImgError = !!failedImages[fileKey];
                                    const isValidUrl = file.url && file.url !== '#' && !hasImgError;

                                    return (
                                        <div key={idx} style={{
                                            position: 'relative',
                                            width: '135px',
                                            height: '135px',
                                            flexShrink: 0
                                        }}>
                                            {isImage ? (
                                                <div 
                                                    onClick={() => isValidUrl && setSelectedImageModal(file.url)}
                                                    title={isValidUrl ? "คลิกเพื่อขยายดูรูปภาพ" : file.name}
                                                    style={{ 
                                                        width: '100%',
                                                        height: '100%', 
                                                        borderRadius: '12px', 
                                                        overflow: 'hidden', 
                                                        background: 'rgba(0,0,0,0.3)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        position: 'relative',
                                                        cursor: isValidUrl ? 'pointer' : 'default',
                                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)'
                                                    }}
                                                >
                                                    {isValidUrl ? (
                                                        <>
                                                            <img 
                                                                src={file.url} 
                                                                alt={file.name} 
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.25s ease' }} 
                                                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                                                                onError={(e) => {
                                                                    if (file.url && file.url.startsWith('/uploads/') && !e.currentTarget.dataset.retried) {
                                                                        e.currentTarget.dataset.retried = '1';
                                                                        e.currentTarget.src = file.url.substring(1);
                                                                        return;
                                                                    }
                                                                    if (file.url && !file.url.startsWith('/api/') && !e.currentTarget.dataset.retriedApi) {
                                                                        e.currentTarget.dataset.retriedApi = '1';
                                                                        e.currentTarget.src = `/api${file.url.startsWith('/') ? '' : '/'}${file.url}`;
                                                                        return;
                                                                    }
                                                                    setFailedImages(prev => ({ ...prev, [fileKey]: true }));
                                                                }}
                                                            />
                                                            <div style={{
                                                                position: 'absolute',
                                                                bottom: 6, right: 6,
                                                                background: 'rgba(0,0,0,0.6)',
                                                                backdropFilter: 'blur(4px)',
                                                                color: '#fff',
                                                                padding: '4px 8px',
                                                                borderRadius: '4px',
                                                                fontSize: '0.7rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 4
                                                            }}>
                                                                <Maximize2 style={{ width: 10, height: 10 }} />
                                                                ขยาย
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                                                            <ImageIcon style={{ width: 36, height: 36, margin: '0 auto 6px', color: '#60a5fa' }} />
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{file.name}</div>
                                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>รูปภาพแนบ</div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div style={{ 
                                                    width: '100%',
                                                    height: '100%', 
                                                    borderRadius: '12px', 
                                                    background: 'rgba(255,255,255,0.05)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'var(--text-secondary)',
                                                    padding: '0.5rem',
                                                    textAlign: 'center',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)'
                                                }}>
                                                    <FileText style={{ width: 36, height: 36, color: '#60a5fa', marginBottom: 4 }} />
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                                        {file.name}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                                ไม่มีไฟล์แนบ (คลิกปุ่มด้านบนเพื่ออัปโหลดรูปภาพหรือไฟล์แนบ)
                            </p>
                        )}
                    </div>

                    {ticket.resolution_note && (
                        <div className="detail-resolution" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                            <h3 className="detail-label">
                                <ClipboardCheck style={{ width: 16, height: 16 }} />
                                บันทึกการดำเนินงาน
                            </h3>
                            <p>{ticket.resolution_note}</p>
                        </div>
                    )}

                    {/* Admin management area & Assignment Schedule */}
                    {isAdmin && (
                        <div className="detail-admin-actions" style={{ marginTop: '2.5rem', background: 'var(--bg-card, rgba(255, 255, 255, 0.04))', padding: '1.5rem', borderRadius: '14px', border: '1px solid var(--border-card, rgba(0,0,0,0.08))', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <h3 className="detail-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: '1rem' }}>
                                    <Settings style={{ width: 16, height: 16, color: '#3b82f6' }} />
                                    การมอบหมายงาน & แผนกำหนดการ (Task Assignment & Schedule)
                                </h3>
                                <button 
                                    className="btn btn-primary btn-sm"
                                    onClick={() => {
                                        let selAssignee = ticket.assigned_to || '';
                                        let selCoWorkers = ticket.co_workers || '';
                                        let selStartDate = ticket.start_date ? ticket.start_date.split('T')[0] : '';
                                        let selDueDate = ticket.due_date ? ticket.due_date.split('T')[0] : '';
                                        let selPriority = ticket.priority || 'Medium';

                                        confirm(
                                            'กำหนดผู้รับผิดชอบ & แผนกำหนดการ',
                                            '',
                                            () => {
                                                handleSaveAssignment({
                                                    assignedTo: selAssignee,
                                                    coWorkers: selCoWorkers,
                                                    startDate: selStartDate,
                                                    dueDate: selDueDate,
                                                    priority: selPriority
                                                });
                                            },
                                            {
                                                content: (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                                                        <div>
                                                            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>ผู้รับผิดชอบหลัก *</label>
                                                            <select 
                                                                className="form-input"
                                                                defaultValue={selAssignee}
                                                                onChange={(e) => { selAssignee = e.target.value; }}
                                                                style={{ width: '100%' }}
                                                            >
                                                                <option value="">-- เลือกผู้รับผิดชอบหลัก --</option>
                                                                {[...new Set([...staffMembers, ...(ticket.assigned_to ? [ticket.assigned_to] : [])])].map(s => (
                                                                    <option key={s} value={s}>{s}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>ผู้ร่วมดำเนินงาน (คั่นด้วยจุลภาค เช่น สมชาย, วนิดา)</label>
                                                            <input 
                                                                type="text" 
                                                                className="form-input"
                                                                defaultValue={selCoWorkers}
                                                                onChange={(e) => { selCoWorkers = e.target.value; }}
                                                                placeholder="รายชื่อผู้ร่วมดำเนินงาน..."
                                                                style={{ width: '100%' }}
                                                            />
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                            <div>
                                                                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>วันเริ่มงาน</label>
                                                                <input 
                                                                    type="date" 
                                                                    className="form-input"
                                                                    defaultValue={selStartDate}
                                                                    onChange={(e) => { selStartDate = e.target.value; }}
                                                                    style={{ width: '100%' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>วันกำหนดเสร็จ (Due Date)</label>
                                                                <input 
                                                                    type="date" 
                                                                    className="form-input"
                                                                    defaultValue={selDueDate}
                                                                    onChange={(e) => { selDueDate = e.target.value; }}
                                                                    style={{ width: '100%' }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>ระดับความเร่งด่วน</label>
                                                            <select 
                                                                className="form-input"
                                                                defaultValue={selPriority}
                                                                onChange={(e) => { selPriority = e.target.value; }}
                                                                style={{ width: '100%' }}
                                                            >
                                                                <option value="Low">Low</option>
                                                                <option value="Medium">Medium</option>
                                                                <option value="High">High</option>
                                                                <option value="Urgent">Urgent</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                )
                                            }
                                        );
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    <UserCheck style={{ width: 14, height: 14 }} /> จัดการผู้รับผิดชอบ & กำหนดการ
                                </button>
                            </div>
                            
                            <div className="admin-action-grid">
                                <div className="form-group">
                                    <label className="form-label">เปลี่ยนสถานะ</label>
                                    <select 
                                        className="form-input form-select"
                                        value={ticket.status}
                                        onChange={(e) => handleUpdateStatus(e.target.value)}
                                    >
                                        {Object.values(STATUSES).map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="form-group">
                                    <label className="form-label">มอบหมายผู้รับผิดชอบหลัก</label>
                                    <select 
                                        className="form-input form-select"
                                        value={ticket.assigned_to || ''}
                                        onChange={async (e) => {
                                            const val = e.target.value;
                                            if (val === '__ADD_NEW__') {
                                                const newStaff = await handleAddCustomStaff();
                                                if (newStaff) handleUpdateAssignee(newStaff);
                                            } else {
                                                handleUpdateAssignee(val);
                                            }
                                        }}
                                    >
                                        <option value="">-- ยังไม่ได้มอบหมาย --</option>
                                        {[...new Set([...staffMembers, ...(ticket.assigned_to ? [ticket.assigned_to] : [])])].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                        <option value="__ADD_NEW__">+ กำหนดชื่อเจ้าหน้าที่ใหม่...</option>
                                    </select>
                                </div>

                                <div className="form-group form-group-full">
                                    <label className="form-label">เพิ่มหมายเหตุการดำเนินงาน</label>
                                    <textarea 
                                        className="form-input form-textarea" 
                                        rows={3} 
                                        placeholder="บันทึกผลการดำเนินงานหรือวิธีแก้ไข..."
                                        value={noteContent}
                                        onChange={(e) => setNoteContent(e.target.value)}
                                    ></textarea>
                                    <button 
                                        className="btn btn-primary btn-sm" 
                                        style={{ marginTop: 8, alignSelf: 'flex-start' }}
                                        onClick={handleSaveNote}
                                        disabled={updatingNote}
                                    >
                                        <Save style={{ width: 14, height: 14 }} />
                                        บันทึกหมายเหตุ
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Completion Summary / Inspection Card */}
                    {ticket.completion_summary && (
                        <div className="glass-card" style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.3)', background: 'rgba(34, 197, 94, 0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
                                <ClipboardCheck style={{ width: 20, height: 20, color: '#4ade80' }} />
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#4ade80' }}>
                                    รายงานสรุปการส่งมอบงาน & ผลการตรวจรับ (Handover & Inspection)
                                </h3>
                            </div>
                            {(() => {
                                try {
                                    const cs = JSON.parse(ticket.completion_summary);
                                    return (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px' }}>
                                                <strong style={{ color: '#60a5fa' }}>📌 สรุปปัญหาที่พบ:</strong>
                                                <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>{cs.problem_summary || '-'}</p>
                                            </div>
                                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px' }}>
                                                <strong style={{ color: '#fbbf24' }}>🔍 สาเหตุของปัญหา:</strong>
                                                <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>{cs.root_cause || '-'}</p>
                                            </div>
                                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px' }}>
                                                <strong style={{ color: '#4ade80' }}>🛠️ วิธีการแก้ไขที่ดำเนินการ:</strong>
                                                <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>{cs.solution_method || '-'}</p>
                                            </div>
                                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px' }}>
                                                <strong style={{ color: '#a78bfa' }}>📦 วัสดุและอุปกรณ์ที่ใช้:</strong>
                                                <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>{cs.materials_used || '-'}</p>
                                            </div>
                                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px' }}>
                                                <strong style={{ color: '#38bdf8' }}>🔬 ผลการทดสอบหลังซ่อม:</strong>
                                                <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>{cs.testing_results || '-'}</p>
                                            </div>
                                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px' }}>
                                                <strong style={{ color: '#fb7185' }}>💡 ข้อแนะนำการใช้งาน/บำรุงรักษา:</strong>
                                                <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>{cs.recommendations || '-'}</p>
                                            </div>
                                            {ticket.accepted_by && (
                                                <div style={{ gridColumn: '1 / -1', background: 'rgba(34, 197, 94, 0.1)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                                                    <span style={{ color: '#4ade80', fontWeight: 600 }}>✅ ตรวจรับและยืนยันเสร็จสิ้นโดย:</span> {ticket.accepted_by} {ticket.accepted_at ? `เมื่อ ${formatDate(ticket.accepted_at)}` : ''}
                                                </div>
                                            )}
                                        </div>
                                    );
                                } catch (e) {
                                    return <p style={{ fontSize: '0.85rem' }}>{ticket.completion_summary}</p>;
                                }
                            })()}
                        </div>
                    )}

                    {/* Access Control: Guests cannot view/interact with Workflow Timeline, Evidence Gallery, or Budget & Expenses */}
                    {isGuest ? (
                        <div className="glass-card" style={{
                            marginTop: '1.5rem',
                            padding: '2rem 1.5rem',
                            borderRadius: '16px',
                            textAlign: 'center',
                            background: 'rgba(30, 41, 59, 0.45)',
                            border: '1px dashed var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.85rem'
                        }}>
                            <div style={{
                                width: 52,
                                height: 52,
                                borderRadius: '50%',
                                background: 'rgba(239, 68, 68, 0.12)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#f87171'
                            }}>
                                <Lock style={{ width: 26, height: 26 }} />
                            </div>
                            <div style={{ maxWidth: 520 }}>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    ข้อมูลส่วนนี้สงวนสิทธิ์เฉพาะผู้เข้าสู่ระบบและเจ้าหน้าที่เท่านั้น
                                </h4>
                                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                    ผู้ใช้งานทั่วไป (Guest) ดูได้เฉพาะข้อมูลสรุปงานซ่อมเบื้องต้นเท่านั้น ไม่สามารถเข้าถึงหรือคลิก: <strong>ขั้นตอนดำเนินงาน (Workflow Timeline)</strong>, <strong>รูปภาพหลักฐานงานซ่อม (Before / During / After)</strong> และ <strong>ระบบบริหารงบประมาณ (Budget & Expenses)</strong> ได้จนกว่าจะเข้าสู่ระบบ
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                <Link to={`/login?redirect=/tickets/${id}`} className="btn btn-primary" style={{ textDecoration: 'none', padding: '0.55rem 1.25rem', fontSize: '0.88rem' }}>
                                    เข้าสู่ระบบเพื่อดูข้อมูลเต็มรูปแบบ
                                </Link>
                                <Link to="/signup" className="btn btn-ghost" style={{ textDecoration: 'none', padding: '0.55rem 1rem', fontSize: '0.88rem' }}>
                                    สมัครสมาชิก
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Integrated Workflow Timeline */}
                            <TicketWorkflowTimeline 
                                ticket={ticket} 
                                timelines={timelines} 
                                isAdmin={isActuallyGroupB} 
                                currentUser={currentUser} 
                                onActionCompleted={fetchTicketData} 
                            />

                            {/* Full-width Stacked Horizontal Sections for Evidence Gallery & Budget/Expenses */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1.75rem',
                                marginTop: '1.75rem',
                                width: '100%'
                            }}>
                                {/* 1. Integrated Evidence & Photo Manager (Full Width Horizontal) */}
                                <div style={{ width: '100%', minWidth: 0 }}>
                                    <TicketEvidenceManager 
                                        ticket={ticket} 
                                        evidences={evidences} 
                                        currentUser={currentUser} 
                                        isAdmin={isActuallyGroupB}
                                        onEvidenceAdded={fetchTicketData} 
                                    />
                                </div>

                                {/* 2. Integrated Budget & Expenses with OCR (Full Width Horizontal) */}
                                <div style={{ width: '100%', minWidth: 0 }}>
                                    <TicketExpenseManager 
                                        ticket={ticket} 
                                        expenses={expenses} 
                                        summary={expenseSummary} 
                                        isAdmin={isActuallyGroupB} 
                                        currentUser={currentUser} 
                                        onExpenseUpdated={fetchTicketData} 
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Sidebar Info */}
                <div className="detail-sidebar">
                    <div className="detail-info-card glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1.25rem' }}>
                        <h3 className="detail-info-title" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 0.75rem 0', alignSelf: 'flex-start' }}>
                            <QrCode style={{ width: 14, height: 14 }} /> QR Code ติดตามสถานะ
                        </h3>
                        {qrCodeUrl ? (
                            <div style={{ background: 'white', padding: '8px', borderRadius: '8px', display: 'inline-block', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                <img src={qrCodeUrl} alt="Ticket QR Code" style={{ width: 130, height: 130, display: 'block' }} />
                            </div>
                        ) : (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>กำลังสร้าง QR Code...</span>
                        )}
                        <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: '1.4' }}>
                            สแกนด้วยสมาร์ทโฟนเพื่อเปิดหน้าตั๋วปัญหานี้และติดตามสถานะได้ทันที
                        </span>
                    </div>

                    <div className="detail-info-card glass-card">
                        <h3 className="detail-info-title">ข้อมูล Ticket</h3>
                        <div className="detail-info-list">
                            <div className="detail-info-item">
                                <span className="info-label"><Hash style={{ width: 14, height: 14 }} /> Ticket No</span>
                                <span className="info-value">{ticket.ticket_no}</span>
                            </div>
                            <div className="detail-info-item">
                                <span className="info-label"><Tag style={{ width: 14, height: 14 }} /> ประเภท</span>
                                <span className="info-value">{ticket.issue_type}</span>
                            </div>
                            <div className="detail-info-item">
                                <span className="info-label"><MapPin style={{ width: 14, height: 14 }} /> สถานที่</span>
                                <span className="info-value">{ticket.location || '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="detail-info-card glass-card">
                        <h3 className="detail-info-title">ข้อมูลผู้แจ้ง</h3>
                        <div className="detail-info-list">
                            <div className="detail-info-item">
                                <span className="info-label"><User style={{ width: 14, height: 14 }} /> ชื่อ</span>
                                <span className="info-value">{parseRequester(ticket.requester_name).name}</span>
                            </div>
                            <div className="detail-info-item">
                                <span className="info-label"><UserCheck style={{ width: 14, height: 14 }} /> กลุ่มผู้ใช้งาน</span>
                                <span className="info-value">
                                    <span className="user-role-badge" style={{
                                        display: 'inline-block',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        background: 'rgba(59, 130, 246, 0.1)',
                                        color: '#60a5fa',
                                        border: '1px solid rgba(59, 130, 246, 0.2)'
                                    }}>
                                        {parseRequester(ticket.requester_name).group || 'นักศึกษา'}
                                    </span>
                                </span>
                            </div>
                            <div className="detail-info-item">
                                <span className="info-label"><Mail style={{ width: 14, height: 14 }} /> อีเมล</span>
                                <span className="info-value">{ticket.requester_email || '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="detail-info-card glass-card">
                        <h3 className="detail-info-title">ผู้รับผิดชอบ & ทีมงาน</h3>
                        <div className="detail-info-list">
                            <div className="detail-info-item">
                                <span className="info-label"><UserCheck style={{ width: 14, height: 14 }} /> ผู้รับผิดชอบหลัก</span>
                                <span className="info-value">{ticket.assigned_to || 'ยังไม่ได้มอบหมาย'}</span>
                            </div>
                            {ticket.co_workers && (
                                <div className="detail-info-item">
                                    <span className="info-label"><User style={{ width: 14, height: 14 }} /> ผู้ร่วมดำเนินงาน</span>
                                    <span className="info-value">{ticket.co_workers}</span>
                                </div>
                            )}
                            {ticket.accepted_by && (
                                <div className="detail-info-item">
                                    <span className="info-label"><ClipboardCheck style={{ width: 14, height: 14 }} /> ผู้ตรวจรับงาน</span>
                                    <span className="info-value" style={{ color: '#4ade80' }}>{ticket.accepted_by}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="detail-info-card glass-card">
                        <h3 className="detail-info-title">กำหนดเวลา & แผนงาน</h3>
                        <div className="detail-info-list">
                            {ticket.start_date && (
                                <div className="detail-info-item">
                                    <span className="info-label"><Calendar style={{ width: 14, height: 14 }} /> วันเริ่มงาน</span>
                                    <span className="info-value">{formatDate(ticket.start_date)}</span>
                                </div>
                            )}
                            {ticket.due_date && (
                                <div className="detail-info-item">
                                    <span className="info-label"><Calendar style={{ width: 14, height: 14 }} /> กำหนดเสร็จ</span>
                                    <span className="info-value" style={{ color: '#fbbf24', fontWeight: 600 }}>{formatDate(ticket.due_date)}</span>
                                </div>
                            )}
                            <div className="detail-info-item">
                                <span className="info-label"><Calendar style={{ width: 14, height: 14 }} /> วันที่สร้าง</span>
                                <span className="info-value">{formatDate(ticket.created_at)}</span>
                            </div>
                            <div className="detail-info-item">
                                <span className="info-label"><Clock style={{ width: 14, height: 14 }} /> แก้ไขล่าสุด</span>
                                <span className="info-value">{formatDate(ticket.updated_at)}</span>
                            </div>
                            {ticket.closed_at && (
                                <div className="detail-info-item">
                                    <span className="info-label"><Settings style={{ width: 14, height: 14 }} /> วันที่ปิดงาน</span>
                                    <span className="info-value">{formatDate(ticket.closed_at)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {selectedImageModal && typeof document !== 'undefined' && createPortal(
                <div 
                    onClick={() => setSelectedImageModal(null)}
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 999999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem',
                        cursor: 'zoom-out'
                    }}
                >
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setSelectedImageModal(null)}
                            style={{
                                position: 'absolute',
                                top: -15, right: -15,
                                background: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: 32, height: 32,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                zIndex: 10
                            }}
                        >
                            <X style={{ width: 18, height: 18 }} />
                        </button>
                        <img 
                            src={selectedImageModal} 
                            alt="Attached Image Preview" 
                            style={{
                                maxWidth: '90vw',
                                maxHeight: '85vh',
                                borderRadius: '12px',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                                objectFit: 'contain'
                            }}
                        />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
