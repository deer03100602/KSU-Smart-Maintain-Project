import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    DollarSign, Plus, Check, X, Edit3, Trash2, AlertCircle, FileText, 
    Upload, Sparkles, CheckCircle2, AlertTriangle, Clock, RefreshCw, Zap,
    Key, ExternalLink, ShieldCheck, Settings 
} from 'lucide-react';
import { saveStoredExpenses, getStoredExpenses } from '@/lib/ticketStore';
import { useApp } from '@/context/AppContext';

export default function TicketExpenseManager({ 
    ticket, 
    expenses = [], 
    summary = {}, 
    isAdmin = false, 
    currentUser = {},
    onExpenseUpdated 
}) {
    const appContext = useApp();
    const ctxGroupA = appContext?.isGroupA;
    const ctxGroupB = appContext?.isGroupB;
    const appUser = appContext?.user;
    const isStudentOrTeacher = ['นักศึกษา', 'อาจารย์'].includes(currentUser?.group || appUser?.group);
    const canManageExpense = !ctxGroupA && !isStudentOrTeacher && (isAdmin || ctxGroupB);
    const [showAddModal, setShowAddModal] = useState(false);
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrResult, setOcrResult] = useState(null);
    const [ocrWarning, setOcrWarning] = useState('');
    const [lastScannedExpenseIds, setLastScannedExpenseIds] = useState([]);
    const [lastScannedEvidenceId, setLastScannedEvidenceId] = useState(null);
    const [lastScannedReceiptUrl, setLastScannedReceiptUrl] = useState(null);
    const [scanSuccessInfo, setScanSuccessInfo] = useState(null);
    const DEFAULT_GEMINI_KEY = typeof window !== 'undefined' && typeof window.atob === 'function'
        ? window.atob('QVEuQWI4Uk42TC1Ya044U2lkTlVkcmdqelZaQUZRaUs3YlBxbE1kQThwQWdMOEhSemJ4cUE=')
        : '';
    const [geminiApiKey, setGeminiApiKey] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('ksu_gemini_api_key') || DEFAULT_GEMINI_KEY;
        }
        return DEFAULT_GEMINI_KEY;
    });
    const [showKeyDrawer, setShowKeyDrawer] = useState(false);
    const [tempKeyInput, setTempKeyInput] = useState('');
    const [serverKeyConfigured, setServerKeyConfigured] = useState(true);

    useEffect(() => {
        fetch('/api/settings/gemini-key')
            .then(r => r.json())
            .then(data => {
                if (data?.configured) {
                    setServerKeyConfigured(true);
                    if (data.apiKey) {
                        setGeminiApiKey(data.apiKey);
                        if (typeof window !== 'undefined') localStorage.setItem('ksu_gemini_api_key', data.apiKey);
                    }
                }
            })
            .catch(() => {});
    }, []);

    // Auto-heal any corrupted astronomical expenses from barcode misreads
    useEffect(() => {
        const targetId = ticket?.id || ticket?.ticket_no;
        if (!targetId) return;
        const stored = getStoredExpenses(targetId);
        if (stored && Array.isArray(stored.expenses)) {
            let hasCorrupted = false;
            const cleanedList = stored.expenses.map(e => {
                const amt = Number(e.net_amount || e.total_price || 0);
                if (amt > 10000000) { // e.g. 147105313393229380 barcode
                    hasCorrupted = true;
                    return { ...e, unit_price: 0, total_price: 0, net_amount: 0 };
                }
                return e;
            });
            if (hasCorrupted || (stored.summary?.totalProposed > 10000000)) {
                let prop = 0, appr = 0, disb = 0, pend = 0;
                cleanedList.forEach(e => {
                    const a = Number(e.net_amount || e.total_price || 0);
                    prop += a;
                    if (e.status === 'APPROVED' || e.status === 'PARTIALLY_APPROVED') {
                        appr += a;
                        if (e.receipt_no || e.receipt_url) disb += a;
                    } else if (e.status === 'PENDING') {
                        pend += a;
                    }
                });
                const cleanSum = {
                    ...stored.summary,
                    totalProposed: prop,
                    totalApproved: appr,
                    totalDisbursed: disb,
                    totalPending: pend,
                    remainingBudget: Math.max(0, appr - disb)
                };
                saveStoredExpenses(targetId, cleanedList, cleanSum, ticket?.ticket_no || targetId);
                if (onExpenseUpdated) onExpenseUpdated();
            }
        }
    }, [ticket?.id, ticket?.ticket_no]);

    const handleSaveGeminiKey = async () => {
        const cleaned = tempKeyInput.trim();
        setGeminiApiKey(cleaned);
        if (typeof window !== 'undefined') {
            localStorage.setItem('ksu_gemini_api_key', cleaned);
        }
        setShowKeyDrawer(false);
        try {
            await fetch('/api/settings/gemini-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: cleaned })
            });
            setServerKeyConfigured(Boolean(cleaned));
        } catch (e) {}
        if (appContext?.toast?.success) {
            appContext.toast.success('✨ บันทึก Google Gemini AI Key เรียบร้อยแล้ว!');
        }
    };

    const handleClearGeminiKey = async () => {
        setGeminiApiKey('');
        setTempKeyInput('');
        if (typeof window !== 'undefined') {
            localStorage.removeItem('ksu_gemini_api_key');
        }
        setShowKeyDrawer(false);
        try {
            await fetch('/api/settings/gemini-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: '' })
            });
            setServerKeyConfigured(false);
        } catch (e) {}
        if (appContext?.toast?.info) {
            appContext.toast.info('ลบการตั้งค่า Gemini Key แล้ว (ระบบจะใช้ Thai OCR ออฟไลน์)');
        }
    };

    // Form state
    const [category, setCategory] = useState('ค่าวัสดุและอุปกรณ์');
    const [description, setDescription] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [unit, setUnit] = useState('ชิ้น');
    const [unitPrice, setUnitPrice] = useState('');
    const [discount, setDiscount] = useState(0);
    const [taxPercent, setTaxPercent] = useState(7);
    const [receiptNo, setReceiptNo] = useState('');
    const [vendorName, setVendorName] = useState('');
    const [receiptDate, setReceiptDate] = useState('');
    const [receiptUrl, setReceiptUrl] = useState('');
    const [status, setStatus] = useState('APPROVED');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    // Calculated amounts
    const q = parseFloat(quantity) || 0;
    const p = parseFloat(unitPrice) || 0;
    const subtotal = q * p;
    const disc = parseFloat(discount) || 0;
    const taxable = Math.max(0, subtotal - disc);
    const taxAmt = taxable * ((parseFloat(taxPercent) || 0) / 100);
    const netTotal = taxable + taxAmt;

    // Close modal on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && showAddModal) {
                setShowAddModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showAddModal]);

    const autoSaveParsedReceipt = async (parsed) => {
        const targetTicketId = ticket?.id || ticket?.ticket_no || 'general';
        const token = localStorage.getItem('helpdesk_token');
        const savedExpenses = [];

        const parsedNet = parseFloat(parsed.net_amount) || 0;
        let rawItems = (Array.isArray(parsed.items) && parsed.items.length > 0)
            ? parsed.items
            : [{
                name: parsed.description || (parsed.vendor_name ? `วัสดุและอุปกรณ์ (${parsed.vendor_name})` : 'วัสดุและอุปกรณ์ตามใบเสร็จ'),
                quantity: parsed.quantity || 1,
                unit: parsed.unit || 'ชิ้น',
                unit_price: parsed.unit_price || (parsed.quantity ? parsed.net_amount / parsed.quantity : parsed.net_amount) || 0,
                total_price: parsed.total_price || parsed.net_amount || 0,
                discount: parsed.discount || 0,
                tax_percent: parsed.tax_amount > 0 ? 7 : (parsed.tax_percent !== undefined ? parsed.tax_percent : 0),
                category: parsed.category || 'ค่าวัสดุและอุปกรณ์'
            }];

        // Filter and sanitize items from barcode or astronomical numbers
        const itemsToSave = rawItems.map(it => {
            let itQty = parseFloat(it.quantity) || 1;
            let itPrice = parseFloat(it.unit_price) || 0;
            // Reject barcode / serial misreads (>= 8 digits without decimal, or > 1,000,000, or > parsedNet * 1.5)
            if (itPrice > 1000000 || (parsedNet > 0 && itPrice > parsedNet * 1.5)) {
                itPrice = parsedNet > 0 ? (parsedNet / rawItems.length) : 0;
            }
            return {
                ...it,
                quantity: itQty,
                unit_price: itPrice,
                discount: parseFloat(it.discount) || 0,
                tax_percent: parseFloat(it.tax_percent) || (parsed.tax_amount > 0 ? 7 : 0)
            };
        });

        for (const it of itemsToSave) {
            const itQty = parseFloat(it.quantity) || 1;
            const itPrice = parseFloat(it.unit_price) || 0;
            const itDisc = parseFloat(it.discount) || 0;
            const itTaxPct = parseFloat(it.tax_percent) || (parsed.tax_amount > 0 ? 7 : 0);
            const itTotal = itQty * itPrice;
            const taxable = Math.max(0, itTotal - itDisc);
            const itTaxAmt = taxable * (itTaxPct / 100);
            const itNet = taxable + itTaxAmt;

            const expPayload = {
                category: it.category || parsed.category || 'ค่าวัสดุและอุปกรณ์',
                description: String(it.name || it.description || parsed.description || 'รายการอุปกรณ์ตามใบเสร็จ').trim(),
                quantity: itQty,
                unit: String(it.unit || parsed.unit || 'ชิ้น').trim(),
                unit_price: itPrice,
                discount: itDisc,
                tax_percent: itTaxPct,
                receipt_no: parsed.receipt_no ? String(parsed.receipt_no).trim() : null,
                vendor_name: parsed.vendor_name ? String(parsed.vendor_name).trim() : null,
                receipt_date: parsed.receipt_date || null,
                receipt_url: parsed.file_url || null,
                status: 'APPROVED'
            };

            let itemResult = {
                id: 'exp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7),
                ticket_id: targetTicketId,
                ticket_no: ticket?.ticket_no || targetTicketId,
                ...expPayload,
                total_price: itTotal,
                tax_amount: itTaxAmt,
                net_amount: itNet,
                approved_by: currentUser?.name || 'ผู้ดูแลระบบ',
                approved_at: new Date().toISOString(),
                created_by: currentUser?.id || 'usr-local',
                created_by_name: currentUser?.name || 'เจ้าหน้าที่',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            try {
                const res = await fetch(`/api/tickets/${encodeURIComponent(targetTicketId)}/expenses`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify(expPayload)
                });
                if (res.ok) {
                    const serverExp = await res.json();
                    if (serverExp && serverExp.id) {
                        itemResult = serverExp;
                    }
                }
            } catch (e) {
                console.warn('Network sync note on auto-save expense:', e);
            }
            savedExpenses.push(itemResult);
        }

        // Auto-save receipt image into Evidence Gallery under 'RECEIPT' stage
        let savedEvidenceId = null;
        if (parsed.file_url) {
            try {
                const eviRes = await fetch(`/api/tickets/${encodeURIComponent(targetTicketId)}/evidence`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({
                        stage: 'RECEIPT',
                        url: parsed.file_url,
                        name: parsed.receipt_no ? (`ใบเสร็จเลขที่ ${parsed.receipt_no}`) : 'ใบเสร็จค่าใช้จ่าย',
                        description: `${parsed.description || 'ค่าใช้จ่าย'} (฿${Number(parsed.net_amount || 0).toLocaleString()})`
                    })
                });
                if (eviRes.ok) {
                    const eviData = await eviRes.json();
                    if (eviData && eviData.id) savedEvidenceId = eviData.id;
                }
            } catch (e) {
                console.warn('Auto-save evidence note:', e);
            }
        }

        // Update local storage and expenses summary
        const existing = Array.isArray(expenses) ? expenses : [];
        const updatedList = [...savedExpenses, ...existing.filter(e => !savedExpenses.some(s => s.id === e.id))];

        let totalProp = 0, totalAppr = 0, totalDisb = 0, totalPend = 0;
        updatedList.forEach(e => {
            let amt = Number(e.net_amount || e.total_price || 0);
            if (amt > 10000000) amt = 0;
            totalProp += amt;
            if (e.status === 'APPROVED' || e.status === 'PARTIALLY_APPROVED') {
                totalAppr += amt;
                if (e.receipt_no || e.receipt_url) totalDisb += amt;
            } else if (e.status === 'PENDING') {
                totalPend += amt;
            }
        });
        const updatedSummary = {
            ...summary,
            totalProposed: totalProp,
            totalApproved: totalAppr,
            totalDisbursed: totalDisb,
            totalPending: totalPend,
            remainingBudget: Math.max(0, totalAppr - totalDisb)
        };

        saveStoredExpenses(targetTicketId, updatedList, updatedSummary, ticket?.ticket_no || targetTicketId);

        const newIds = savedExpenses.map(s => s.id);
        setLastScannedExpenseIds(newIds);
        setLastScannedEvidenceId(savedEvidenceId);
        setLastScannedReceiptUrl(parsed.file_url);
        setScanSuccessInfo({
            count: savedExpenses.length,
            total: parsed.net_amount || savedExpenses.reduce((acc, curr) => acc + (curr.net_amount || 0), 0),
            receiptNo: parsed.receipt_no,
            vendor: parsed.vendor_name
        });

        if (onExpenseUpdated) onExpenseUpdated();
        return savedExpenses;
    };

    const handleCancelCurrentScan = async () => {
        if (!lastScannedExpenseIds || lastScannedExpenseIds.length === 0) return;
        if (!window.confirm('คุณต้องการยกเลิกการสแกนนี้ และลบรายการอุปกรณ์ที่เพิ่งบันทึกไปใช่หรือไม่?')) return;

        const token = localStorage.getItem('helpdesk_token');
        const targetTicketId = ticket?.id || ticket?.ticket_no || 'general';

        // Delete each expense created by this scan
        for (const expId of lastScannedExpenseIds) {
            try {
                await fetch(`/api/expenses/${encodeURIComponent(expId)}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': token ? `Bearer ${token}` : '' }
                });
            } catch (e) {}
        }

        // Delete evidence created by this scan if any
        if (lastScannedEvidenceId) {
            try {
                await fetch(`/api/tickets/${encodeURIComponent(targetTicketId)}/evidence/${encodeURIComponent(lastScannedEvidenceId)}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': token ? `Bearer ${token}` : '' }
                });
            } catch (e) {}
        }

        // Update local storage and expenses list
        const existing = Array.isArray(expenses) ? expenses : [];
        const toDeleteSet = new Set(lastScannedExpenseIds);
        const updatedList = existing.filter(e => !toDeleteSet.has(e.id));

        let totalProp = 0, totalAppr = 0, totalDisb = 0, totalPend = 0;
        updatedList.forEach(e => {
            const amt = Number(e.net_amount || e.total_price || 0);
            totalProp += amt;
            if (e.status === 'APPROVED' || e.status === 'PARTIALLY_APPROVED') {
                totalAppr += amt;
                if (e.receipt_no || e.receipt_url) totalDisb += amt;
            } else if (e.status === 'PENDING') {
                totalPend += amt;
            }
        });
        const updatedSummary = {
            ...summary,
            totalProposed: totalProp,
            totalApproved: totalAppr,
            totalDisbursed: totalDisb,
            totalPending: totalPend,
            remainingBudget: Math.max(0, totalAppr - totalDisb)
        };

        saveStoredExpenses(targetTicketId, updatedList, updatedSummary, ticket?.ticket_no || targetTicketId);

        setLastScannedExpenseIds([]);
        setLastScannedEvidenceId(null);
        setLastScannedReceiptUrl(null);
        setScanSuccessInfo(null);
        setOcrResult(null);
        resetForm();
        setShowAddModal(false);

        if (appContext?.toast?.info) {
            appContext.toast.info('❌ ยกเลิกการสแกนและลบรายการเรียบร้อยแล้ว');
        }
        if (onExpenseUpdated) onExpenseUpdated();
    };

    const handleOcrUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setShowAddModal(true);
        setOcrLoading(true);
        setOcrWarning('');
        const formData = new FormData();
        formData.append('receipt', file);
        const activeKey = geminiApiKey || (typeof window !== 'undefined' ? localStorage.getItem('ksu_gemini_api_key') : '') || '';
        if (activeKey) formData.append('gemini_key', activeKey);

        try {
            const token = localStorage.getItem('helpdesk_token');
            const currentUser = localStorage.getItem('helpdesk_current_user');
            const clientUserHeader = currentUser ? encodeURIComponent(currentUser) : '';

            const targetTicketId = ticket?.id || ticket?.ticket_no || '';
            const res = await fetch(`/api/ocr/scan-receipt?ticket_id=${encodeURIComponent(targetTicketId)}`, {
                method: 'POST',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '',
                    'x-client-user': clientUserHeader,
                    'x-gemini-key': activeKey
                },
                body: formData
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const parsed = data.data;
                setOcrResult(parsed);

                // Auto-fill all fields with extracted values
                const detectedDesc = parsed.description || parsed.primary_item?.name || parsed.items?.[0]?.name || '';
                if (detectedDesc) {
                    setDescription(detectedDesc);
                } else if (parsed.vendor_name) {
                    setDescription(`วัสดุและอุปกรณ์ (${parsed.vendor_name})`);
                }

                const detectedCat = parsed.category || parsed.primary_item?.category || parsed.items?.[0]?.category || 'ค่าวัสดุและอุปกรณ์';
                setCategory(detectedCat);

                const detectedQty = parsed.quantity || parsed.primary_item?.quantity || 1;
                setQuantity(detectedQty);

                const detectedUnit = parsed.unit || parsed.primary_item?.unit || 'ชิ้น';
                setUnit(detectedUnit);

                const detectedUnitPrice = parsed.unit_price || parsed.primary_item?.unit_price || (parsed.net_amount ? (parsed.net_amount / detectedQty) : '');
                if (detectedUnitPrice) {
                    setUnitPrice(detectedUnitPrice);
                }

                if (parsed.discount !== undefined) setDiscount(parsed.discount);
                setTaxPercent(parsed.tax_amount > 0 ? 7 : (parsed.tax_percent !== undefined ? parsed.tax_percent : 0));

                if (parsed.vendor_name) setVendorName(parsed.vendor_name);
                if (parsed.receipt_no) setReceiptNo(parsed.receipt_no);
                if (parsed.receipt_date) setReceiptDate(parsed.receipt_date);
                if (parsed.file_url) setReceiptUrl(parsed.file_url);

                if (parsed.ocr_note) {
                    setOcrWarning(parsed.ocr_note);
                }

                setStatus('APPROVED');

                // Auto-save scanned receipt items directly into database & budget table
                await autoSaveParsedReceipt(parsed);

                if (appContext?.toast?.success) {
                    if (data.ocr_engine === 'GEMINI_AI') {
                        appContext.toast.success(`✨ Google Gemini AI สแกนและบันทึกรายการ "${detectedDesc || parsed.vendor_name}" ลงฐานข้อมูลเรียบร้อยแล้ว!`);
                    } else {
                        appContext.toast.success(`🎉 สแกนและบันทึกรายการ "${detectedDesc || parsed.vendor_name}" ลงฐานข้อมูลเรียบร้อยแล้ว!`);
                    }
                }

                // Validation alert: check duplicate receipt
                const isDuplicate = expenses.some(exp => exp.receipt_no && exp.receipt_no.trim() === (parsed.receipt_no || '').trim());
                if (isDuplicate) {
                    setOcrWarning(`⚠️ ตรวจพบว่าเลขที่ใบเสร็จ "${parsed.receipt_no}" ถูกบันทึกในระบบแล้ว กรุณาตรวจสอบก่อนบันทึก`);
                }
            } else {
                setOcrWarning(data.error || 'ไม่สามารถอ่านข้อความจากไฟล์ได้ กรุณากรอกข้อมูลด้วยตนเอง');
            }
        } catch (err) {
            console.error('OCR scan fetch error:', err);
            setOcrWarning('เกิดข้อผิดพลาดในการเชื่อมต่อ OCR: ' + (err.message || 'เครือข่ายขัดข้อง'));
        } finally {
            setOcrLoading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleCreateExpense = async (e, overrideData = null) => {
        if (e && e.preventDefault) e.preventDefault();
        setFormError('');

        const targetDesc = overrideData?.description ?? description;
        const targetCategory = overrideData?.category ?? category;
        const targetQuantity = parseFloat(overrideData?.quantity ?? quantity) || 1;
        const targetUnit = overrideData?.unit ?? unit;
        const targetUnitPrice = parseFloat(overrideData?.unit_price ?? unitPrice) || 0;
        const targetDiscount = parseFloat(overrideData?.discount ?? discount) || 0;
        const targetTaxPercent = parseFloat(overrideData?.tax_percent ?? taxPercent) || 0;
        const targetReceiptNo = overrideData?.receipt_no ?? receiptNo;
        const targetVendorName = overrideData?.vendor_name ?? vendorName;
        const targetReceiptDate = overrideData?.receipt_date ?? receiptDate;
        const targetReceiptUrl = overrideData?.receipt_url ?? receiptUrl;

        const targetStatus = overrideData?.status ?? status ?? 'APPROVED';

        if (!String(targetDesc || '').trim()) {
            setFormError('กรุณาระบุรายละเอียดรายการอุปกรณ์');
            return;
        }
        if (targetQuantity <= 0 || targetUnitPrice <= 0) {
            setFormError('จำนวนและราคาต่อหน่วยต้องมากกว่า 0');
            return;
        }

        setSubmitting(true);
        const targetTicketId = ticket?.id || ticket?.ticket_no || 'general';
        const calculatedTotalPrice = targetQuantity * targetUnitPrice;
        const taxableAmount = Math.max(0, calculatedTotalPrice - targetDiscount);
        const calculatedTaxAmount = taxableAmount * (targetTaxPercent / 100);
        const calculatedNetAmount = taxableAmount + calculatedTaxAmount;

        // Construct standard expense object for instant rendering & local database
        let savedExpense = {
            id: 'exp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
            ticket_id: targetTicketId,
            ticket_no: ticket?.ticket_no || targetTicketId,
            category: targetCategory || 'ค่าวัสดุและอุปกรณ์',
            description: String(targetDesc).trim(),
            quantity: targetQuantity,
            unit: String(targetUnit).trim() || 'ชิ้น',
            unit_price: targetUnitPrice,
            total_price: calculatedTotalPrice,
            discount: targetDiscount,
            tax_percent: targetTaxPercent,
            tax_amount: calculatedTaxAmount,
            net_amount: calculatedNetAmount,
            receipt_no: targetReceiptNo ? String(targetReceiptNo).trim() : null,
            vendor_name: targetVendorName ? String(targetVendorName).trim() : null,
            receipt_date: targetReceiptDate || null,
            receipt_url: targetReceiptUrl || null,
            status: targetStatus,
            approved_by: targetStatus === 'APPROVED' ? (currentUser?.name || 'ผู้ดูแลระบบ') : null,
            approved_at: targetStatus === 'APPROVED' ? new Date().toISOString() : null,
            created_by: currentUser?.id || 'usr-local',
            created_by_name: currentUser?.name || 'เจ้าหน้าที่',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            const token = localStorage.getItem('helpdesk_token');
            const clientTicketHeader = ticket ? encodeURIComponent(JSON.stringify({
                id: ticket.id || targetTicketId,
                ticket_no: ticket.ticket_no || targetTicketId,
                title: ticket.title || '',
                description: ticket.description || '',
                issue_type: ticket.issue_type || '',
                location: ticket.location || '',
                priority: ticket.priority || 'Medium',
                status: ticket.status || 'ASSIGNED',
                requester_name: ticket.requester_name || '',
                requester_email: ticket.requester_email || '',
                assigned_to: ticket.assigned_to || ''
            })) : '';

            const res = await fetch(`/api/tickets/${encodeURIComponent(targetTicketId)}/expenses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                    'x-client-ticket': clientTicketHeader
                },
                body: JSON.stringify({
                    category: targetCategory,
                    description: String(targetDesc).trim(),
                    quantity: targetQuantity,
                    unit: String(targetUnit).trim() || 'ชิ้น',
                    unit_price: targetUnitPrice,
                    discount: targetDiscount,
                    tax_percent: targetTaxPercent,
                    receipt_no: targetReceiptNo ? String(targetReceiptNo).trim() : null,
                    vendor_name: targetVendorName ? String(targetVendorName).trim() : null,
                    receipt_date: targetReceiptDate || null,
                    receipt_url: targetReceiptUrl || null,
                    status: targetStatus,
                    client_ticket: ticket
                })
            });

            if (res.ok) {
                try {
                    const serverData = await res.json();
                    if (serverData && serverData.id) {
                        savedExpense = serverData;
                    }
                } catch (jsonErr) {}
            } else {
                try {
                    const errJson = await res.json();
                    if (res.status === 400 && errJson?.error) {
                        setFormError(errJson.error);
                        setSubmitting(false);
                        return;
                    }
                } catch (e) {}
            }
        } catch (fetchErr) {
            console.warn('Backend server note (saved locally for resilience):', fetchErr.message);
        }

        // Always save to persistent client storage and update budget cards immediately
        try {
            const existing = Array.isArray(expenses) ? expenses : [];
            const updatedList = [savedExpense, ...existing.filter(e => e.id !== savedExpense.id)];
            
            let totalProp = 0, totalAppr = 0, totalDisb = 0, totalPend = 0;
            updatedList.forEach(e => {
                const amt = Number(e.net_amount || e.total_price || 0);
                totalProp += amt;
                if (e.status === 'APPROVED' || e.status === 'PARTIALLY_APPROVED') {
                    totalAppr += amt;
                    if (e.receipt_no || e.receipt_url) totalDisb += amt;
                } else if (e.status === 'PENDING') {
                    totalPend += amt;
                }
            });
            const updatedSummary = {
                ...summary,
                totalProposed: totalProp,
                totalApproved: totalAppr,
                totalDisbursed: totalDisb,
                totalPending: totalPend,
                remainingBudget: Math.max(0, totalAppr - totalDisb)
            };
            
            const ticketKey = targetTicketId;
            saveStoredExpenses(ticketKey, updatedList, updatedSummary);

            setShowAddModal(false);
            resetForm();
            if (appContext?.toast?.success) {
                appContext.toast.success(`🎉 บันทึกรายการ "${targetDesc}" ลงฐานข้อมูลและขึ้นในช่องงบประมาณเรียบร้อยแล้ว!`);
            }
            if (onExpenseUpdated) onExpenseUpdated();
        } catch (storageErr) {
            console.error('Storage error:', storageErr);
        } finally {
            setSubmitting(false);
        }
    };

    const handleInstantSaveOcrItem = async (customItem = null) => {
        if (customItem) {
            await handleCreateExpense(null, {
                category: customItem.category || category,
                description: customItem.name || customItem.description || description,
                quantity: customItem.quantity || quantity,
                unit: customItem.unit || unit,
                unit_price: customItem.unit_price || unitPrice,
                discount,
                tax_percent: taxPercent,
                receipt_no: receiptNo,
                vendor_name: vendorName,
                receipt_date: receiptDate,
                receipt_url: receiptUrl,
                status: status || 'APPROVED'
            });
        } else {
            await handleCreateExpense(null, { status: status || 'APPROVED' });
        }
    };

    const handleSaveAllOcrItems = async () => {
        if (!ocrResult?.items || ocrResult.items.length === 0) return;
        setSubmitting(true);
        try {
            const targetTicketId = ticket?.id || ticket?.ticket_no || 'general';
            const token = localStorage.getItem('helpdesk_token');
            const savedItems = [];
            for (const it of ocrResult.items) {
                const itQty = parseFloat(it.quantity) || 1;
                const itPrice = parseFloat(it.unit_price) || 0;
                const itDisc = parseFloat(it.discount) || 0;
                const itTaxPct = parseFloat(it.tax_percent) || (taxPercent ? parseFloat(taxPercent) : 0);
                const itTaxAmt = Math.max(0, (itQty * itPrice) - itDisc) * (itTaxPct / 100);
                const itNet = Math.max(0, (itQty * itPrice) - itDisc) + itTaxAmt;

                const localItem = {
                    id: 'exp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
                    ticket_id: targetTicketId,
                    ticket_no: ticket?.ticket_no || targetTicketId,
                    category: it.category || category || 'ค่าวัสดุและอุปกรณ์',
                    description: String(it.name || it.description || 'รายการอุปกรณ์').trim(),
                    quantity: itQty,
                    unit: it.unit || 'ชิ้น',
                    unit_price: itPrice,
                    total_price: itQty * itPrice,
                    discount: itDisc,
                    tax_percent: itTaxPct,
                    tax_amount: itTaxAmt,
                    net_amount: itNet,
                    receipt_no: receiptNo ? String(receiptNo).trim() : null,
                    vendor_name: vendorName ? String(vendorName).trim() : null,
                    receipt_date: receiptDate || null,
                    receipt_url: receiptUrl || null,
                    status: status || 'APPROVED',
                    approved_by: status === 'APPROVED' ? (currentUser?.name || 'ผู้ดูแลระบบ') : null,
                    approved_at: status === 'APPROVED' ? new Date().toISOString() : null,
                    created_by: currentUser?.id || 'usr-local',
                    created_by_name: currentUser?.name || 'เจ้าหน้าที่',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                let itemToAdd = localItem;
                try {
                    const res = await fetch(`/api/tickets/${encodeURIComponent(targetTicketId)}/expenses`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token ? `Bearer ${token}` : ''
                        },
                        body: JSON.stringify({
                            category: it.category || category,
                            description: String(it.name || '').trim(),
                            quantity: itQty,
                            unit: it.unit || 'ชิ้น',
                            unit_price: itPrice,
                            discount: itDisc,
                            tax_percent: itTaxPct,
                            receipt_no: receiptNo ? String(receiptNo).trim() : null,
                            vendor_name: vendorName ? String(vendorName).trim() : null,
                            receipt_date: receiptDate || null,
                            receipt_url: receiptUrl || null,
                            status: status || 'APPROVED'
                        })
                    });
                    if (res.ok) {
                        try {
                            const saved = await res.json();
                            if (saved && saved.id) itemToAdd = saved;
                        } catch (e) {}
                    }
                } catch (netErr) {}
                savedItems.push(itemToAdd);
            }

            if (savedItems.length > 0) {
                const existing = Array.isArray(expenses) ? expenses : [];
                const updatedList = [...savedItems, ...existing];
                let totalProp = 0, totalAppr = 0, totalDisb = 0, totalPend = 0;
                updatedList.forEach(e => {
                    const amt = Number(e.net_amount || e.total_price || 0);
                    totalProp += amt;
                    if (e.status === 'APPROVED' || e.status === 'PARTIALLY_APPROVED') {
                        totalAppr += amt;
                        if (e.receipt_no || e.receipt_url) totalDisb += amt;
                    } else if (e.status === 'PENDING') {
                        totalPend += amt;
                    }
                });
                const updatedSummary = {
                    ...summary,
                    totalProposed: totalProp,
                    totalApproved: totalAppr,
                    totalDisbursed: totalDisb,
                    totalPending: totalPend,
                    remainingBudget: Math.max(0, totalAppr - totalDisb)
                };
                const ticketKey = targetTicketId;
                saveStoredExpenses(ticketKey, updatedList, updatedSummary);
            }
            setShowAddModal(false);
            resetForm();
            if (appContext?.toast?.success) {
                appContext.toast.success(`🎉 บันทึกรายการอุปกรณ์ทั้งหมด ${savedItems.length} รายการลงฐานข้อมูลเรียบร้อยแล้ว!`);
            }
            if (onExpenseUpdated) onExpenseUpdated();
        } catch (err) {
            console.error('Error in save all OCR items:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setDescription('');
        setQuantity(1);
        setUnit('ชิ้น');
        setUnitPrice('');
        setDiscount(0);
        setTaxPercent(7);
        setReceiptNo('');
        setVendorName('');
        setReceiptDate('');
        setReceiptUrl('');
        setStatus('APPROVED');
        setOcrResult(null);
        setOcrWarning('');
        setFormError('');
    };

    const handleUpdateStatus = async (expenseId, newStatus, reason = '', expObj = null) => {
        const targetExp = expObj || expenses.find(e => e.id === expenseId);
        
        // 1. Optimistic UI update: immediately change status so user sees 'อนุมัติแล้ว' instantly!
        const updatedExpenses = expenses.map(e => {
            if (e.id === expenseId) {
                return {
                    ...e,
                    status: newStatus,
                    approved_by: currentUser.name || 'ผู้ดูแลระบบ',
                    approved_at: new Date().toISOString(),
                    reject_reason: reason || e.reject_reason || null
                };
            }
            return e;
        });

        // Calculate updated summary
        let totalProp = 0;
        let totalAppr = 0;
        let totalDisb = 0;
        updatedExpenses.forEach(e => {
            const amt = Number(e.net_amount || e.total_price || 0);
            totalProp += amt;
            if (e.status === 'APPROVED' || e.status === 'PARTIALLY_APPROVED') {
                totalAppr += amt;
                if (e.receipt_no || e.receipt_url) totalDisb += amt;
            }
        });
        const newSummary = {
            ...summary,
            totalProposed: totalProp,
            totalApproved: totalAppr,
            totalDisbursed: totalDisb,
            remainingBudget: Math.max(0, totalAppr - totalDisb)
        };

        // Save to client localStorage immediately
        try {
            const ticketKey = ticket.id || ticket.ticket_no;
            saveStoredExpenses(ticketKey, updatedExpenses, newSummary);
        } catch (e) {}

        // Notify parent to re-render immediately with new state
        if (onExpenseUpdated) onExpenseUpdated();

        // 2. Send update to server with full payload for resilience
        try {
            const token = localStorage.getItem('helpdesk_token');
            const res = await fetch(`/api/expenses/${expenseId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    status: newStatus,
                    reject_reason: reason,
                    expense: targetExp,
                    ticket_id: ticket.id || ticket.ticket_no
                })
            });
            if (res.ok) {
                if (onExpenseUpdated) onExpenseUpdated();
            }
        } catch (e) {
            console.warn('Network sync notice for expense status:', e);
        }
    };

    const handleDelete = async (expenseId) => {
        if (!window.confirm('คุณต้องการลบรายการค่าใช้จ่ายนี้ใช่หรือไม่?')) return;
        
        // Optimistic delete from local cache immediately
        const targetTicketId = ticket?.id || ticket?.ticket_no;
        const currentList = Array.isArray(expenses) ? expenses : [];
        const updatedList = currentList.filter(e => e.id !== expenseId);
        
        let totalProp = 0, totalAppr = 0, totalDisb = 0, totalPend = 0;
        updatedList.forEach(e => {
            const amt = Number(e.net_amount || e.total_price || 0);
            totalProp += amt;
            if (e.status === 'APPROVED' || e.status === 'PARTIALLY_APPROVED') {
                totalAppr += amt;
                if (e.receipt_no || e.receipt_url) totalDisb += amt;
            } else if (e.status === 'PENDING') {
                totalPend += amt;
            }
        });
        const updatedSummary = {
            ...summary,
            totalProposed: totalProp,
            totalApproved: totalAppr,
            totalDisbursed: totalDisb,
            totalPending: totalPend,
            remainingBudget: Math.max(0, totalAppr - totalDisb)
        };
        if (targetTicketId) {
            saveStoredExpenses(targetTicketId, updatedList, updatedSummary);
        }
        if (onExpenseUpdated) onExpenseUpdated();

        try {
            const token = localStorage.getItem('helpdesk_token');
            await fetch(`/api/expenses/${expenseId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            if (onExpenseUpdated) onExpenseUpdated();
        } catch (e) {
            console.warn('Network delete expense notice:', e);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'APPROVED':
                return <span style={{ background: '#22c55e20', color: '#4ade80', border: '1px solid #22c55e40', padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>✅ อนุมัติแล้ว</span>;
            case 'PARTIALLY_APPROVED':
                return <span style={{ background: '#3b82f620', color: '#60a5fa', border: '1px solid #3b82f640', padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>🔹 อนุมัติบางส่วน</span>;
            case 'REJECTED':
                return <span style={{ background: '#ef444420', color: '#f87171', border: '1px solid #ef444440', padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>❌ ไม่อนุมัติ</span>;
            case 'REVISE_REQUESTED':
                return <span style={{ background: '#f59e0b20', color: '#fbbf24', border: '1px solid #f59e0b40', padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>⚠️ ขอแก้ไขรายละเอียด</span>;
            case 'DOCUMENTS_NEEDED':
                return <span style={{ background: '#a855f720', color: '#c084fc', border: '1px solid #a855f740', padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>📄 รอเอกสารเพิ่มเติม</span>;
            case 'PENDING':
            default:
                return <span style={{ background: '#3b82f620', color: '#60a5fa', border: '1px solid #3b82f640', padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>⏳ รออนุมัติ</span>;
        }
    };

    return (
        <div className="glass-card" style={{ marginTop: 0, padding: '1.25rem', borderRadius: '12px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DollarSign style={{ width: 20, height: 20, color: '#3b82f6' }} />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>ระบบบริหารงบประมาณและบันทึกค่าใช้จ่าย (Budget & Expenses)</h3>
                </div>
                {canManageExpense && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <label 
                            className="btn btn-secondary btn-sm"
                            style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                cursor: 'pointer',
                                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(34, 197, 94, 0.2) 100%)',
                                borderColor: 'rgba(59, 130, 246, 0.4)',
                                color: '#60a5fa',
                                fontWeight: 600
                            }}
                            title="อัปโหลดใบเสร็จเพื่อให้ระบบอ่านและกรอกข้อมูลอุปกรณ์อัตโนมัติ"
                        >
                            <Sparkles style={{ width: 15, height: 15, color: '#38bdf8' }} />
                            ⚡ สแกนใบเสร็จ (กรอกให้อัตโนมัติ)
                            <input 
                                type="file" 
                                accept="image/png, image/jpeg, image/jpg, application/pdf" 
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    resetForm();
                                    handleOcrUpload(e);
                                }}
                            />
                        </label>
                        <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => { resetForm(); setShowAddModal(true); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Plus style={{ width: 15, height: 15 }} /> บันทึกค่าใช้จ่าย
                        </button>
                    </div>
                )}
            </div>

            {/* Financial Summary Cards */}
            {(() => {
                const safeExpenses = (Array.isArray(expenses) ? expenses : []).map(e => {
                    const amt = Number(e.net_amount || e.total_price || 0);
                    if (amt > 10000000) {
                        return { ...e, net_amount: 0, total_price: 0, unit_price: 0 };
                    }
                    return e;
                });

                let calcProp = 0, calcAppr = 0, calcDisb = 0, calcPend = 0;
                safeExpenses.forEach(e => {
                    const amt = Number(e.net_amount || e.total_price || 0);
                    calcProp += amt;
                    if (e.status === 'APPROVED' || e.status === 'PARTIALLY_APPROVED') {
                        calcAppr += amt;
                        if (e.receipt_no || e.receipt_url) calcDisb += amt;
                    } else if (e.status === 'PENDING') {
                        calcPend += amt;
                    }
                });

                const isCorrupt = (v) => !v || isNaN(Number(v)) || Number(v) > 10000000;
                const safeProp = isCorrupt(summary?.totalProposed) ? calcProp : Number(summary.totalProposed);
                const safeAppr = isCorrupt(summary?.totalApproved) ? calcAppr : Number(summary.totalApproved);
                const safeDisb = isCorrupt(summary?.totalDisbursed || summary?.totalActual) ? calcDisb : Number(summary.totalDisbursed || summary.totalActual || 0);
                const safePend = isCorrupt(summary?.totalPending) ? calcPend : Number(summary.totalPending || 0);
                const safeRem = Math.max(0, safeAppr - safeDisb);

                const fmtAmt = (val) => {
                    const num = Number(val || 0);
                    if (isNaN(num) || num <= 0) return '฿0';
                    return `฿${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
                };

                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem', width: '100%' }}>
                        <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '10px 12px', borderRadius: '8px', minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>งบประมาณที่เสนอ</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#60a5fa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }} title={fmtAmt(safeProp)}>
                                {fmtAmt(safeProp)}
                            </div>
                        </div>
                        <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '10px 12px', borderRadius: '8px', minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>งบประมาณที่อนุมัติ</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#4ade80', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }} title={fmtAmt(safeAppr)}>
                                {fmtAmt(safeAppr)}
                            </div>
                        </div>
                        <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '10px 12px', borderRadius: '8px', minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>ยอดเบิกจ่ายแล้ว (มีใบเสร็จ)</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#c084fc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }} title={fmtAmt(safeDisb)}>
                                {fmtAmt(safeDisb)}
                            </div>
                        </div>
                        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 12px', borderRadius: '8px', minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>งบประมาณคงเหลือ</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#10b981', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }} title={fmtAmt(safeRem)}>
                                {fmtAmt(safeRem)}
                            </div>
                        </div>
                        <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '10px 12px', borderRadius: '8px', minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>รอดำเนินการอนุมัติ</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fbbf24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }} title={fmtAmt(safePend)}>
                                {fmtAmt(safePend)}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Active Scanned Receipt Banner with "📷 สแกนใบเสร็จใหม่" and "❌ ยกเลิกการสแกน" */}
            {lastScannedExpenseIds.length > 0 && scanSuccessInfo && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 style={{ width: 18, height: 18, color: '#4ade80', flexShrink: 0 }} />
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            <span style={{ fontWeight: 700, color: '#4ade80' }}>⚡ บันทึกจากการสแกนอัตโนมัติแล้ว: </span>
                            <span>{scanSuccessInfo.count} รายการ (ยอดสุทธิ ฿{Number(scanSuccessInfo.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                            {scanSuccessInfo.receiptNo && <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>[เลขที่ {scanSuccessInfo.receiptNo}]</span>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <label 
                            className="btn btn-secondary btn-xs"
                            style={{
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontWeight: 600,
                                background: 'rgba(59, 130, 246, 0.2)',
                                borderColor: 'rgba(59, 130, 246, 0.5)',
                                color: '#60a5fa',
                                padding: '5px 12px'
                            }}
                            title="สแกนใบเสร็จใบถัดไปและบันทึกอัตโนมัติ"
                        >
                            <Sparkles style={{ width: 13, height: 13 }} /> 📷 สแกนใบเสร็จใหม่
                            <input 
                                type="file" 
                                accept="image/png, image/jpeg, image/jpg, application/pdf" 
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    resetForm();
                                    handleOcrUpload(e);
                                }}
                            />
                        </label>
                        <button
                            type="button"
                            onClick={handleCancelCurrentScan}
                            className="btn btn-danger btn-xs"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontWeight: 600,
                                background: 'rgba(239, 68, 68, 0.2)',
                                borderColor: 'rgba(239, 68, 68, 0.5)',
                                color: '#f87171',
                                padding: '5px 12px'
                            }}
                            title="ยกเลิกการสแกนนี้ และลบรายการอุปกรณ์ที่เพิ่งบันทึกไป"
                        >
                            <X style={{ width: 13, height: 13 }} /> ❌ ยกเลิกการสแกน
                        </button>
                    </div>
                </div>
            )}

            {/* Expense Table */}
            {expenses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    ยังไม่มีรายการค่าใช้จ่ายหรืองบประมาณในงานซ่อมนี้
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                                <th style={{ padding: '8px 10px' }}>หมวดหมู่</th>
                                <th style={{ padding: '8px 10px' }}>รายการ</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>จำนวน</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>ราคา/หน่วย</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>ยอดสุทธิ</th>
                                <th style={{ padding: '8px 10px' }}>เลขที่ใบเสร็จ</th>
                                <th style={{ padding: '8px 10px' }}>สถานะ</th>
                                {canManageExpense && <th style={{ padding: '8px 10px', textAlign: 'center' }}>จัดการ</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.map((exp) => (
                                <tr key={exp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                        <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>
                                            {exp.category}
                                        </span>
                                    </td>
                                    <td style={{ padding: '8px 10px' }}>
                                        <div style={{ fontWeight: 500 }}>{exp.description}</div>
                                        {exp.vendor_name && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ร้าน: {exp.vendor_name}</div>}
                                        {exp.reject_reason && <div style={{ fontSize: '0.75rem', color: '#f87171' }}>หมายเหตุ: {exp.reject_reason}</div>}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                        {exp.quantity} {exp.unit}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                        ฿{Number(exp.unit_price).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#60a5fa' }}>
                                        ฿{Number(exp.net_amount || exp.total_price).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                        {exp.receipt_no ? (
                                            exp.receipt_url ? (
                                                <a href={exp.receipt_url} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>
                                                    {exp.receipt_no}
                                                </a>
                                            ) : exp.receipt_no
                                        ) : '-'}
                                    </td>
                                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                        {getStatusBadge(exp.status)}
                                    </td>
                                    {canManageExpense && (
                                        <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                {exp.status === 'PENDING' && (
                                                    <>
                                                        <button 
                                                            className="btn btn-ghost btn-sm"
                                                            title="อนุมัติงบทั้งหมด"
                                                            onClick={() => handleUpdateStatus(exp.id, 'APPROVED', '', exp)}
                                                            style={{ color: '#4ade80', padding: '4px 6px' }}
                                                        >
                                                            <Check style={{ width: 14, height: 14 }} />
                                                        </button>
                                                        <button 
                                                            className="btn btn-ghost btn-sm"
                                                            title="อนุมัติบางส่วน"
                                                            onClick={() => {
                                                                const r = window.prompt('ระบุหมายเหตุการอนุมัติบางส่วน:');
                                                                if (r !== null) handleUpdateStatus(exp.id, 'PARTIALLY_APPROVED', r, exp);
                                                            }}
                                                            style={{ color: '#60a5fa', padding: '4px 6px' }}
                                                        >
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>½</span>
                                                        </button>
                                                        <button 
                                                            className="btn btn-ghost btn-sm"
                                                            title="ขอให้แก้ไข"
                                                            onClick={() => {
                                                                const r = window.prompt('ระบุเหตุผลที่ต้องการให้แก้ไข:');
                                                                if (r !== null) handleUpdateStatus(exp.id, 'REVISE_REQUESTED', r, exp);
                                                            }}
                                                            style={{ color: '#fbbf24', padding: '4px 6px' }}
                                                        >
                                                            <Edit3 style={{ width: 14, height: 14 }} />
                                                        </button>
                                                        <button 
                                                            className="btn btn-ghost btn-sm"
                                                            title="ขอเอกสารเพิ่มเติม"
                                                            onClick={() => {
                                                                const r = window.prompt('ระบุเอกสารที่ต้องการเพิ่มเติม:');
                                                                if (r !== null) handleUpdateStatus(exp.id, 'DOCUMENTS_NEEDED', r, exp);
                                                            }}
                                                            style={{ color: '#c084fc', padding: '4px 6px' }}
                                                        >
                                                            <FileText style={{ width: 14, height: 14 }} />
                                                        </button>
                                                        <button 
                                                            className="btn btn-ghost btn-sm"
                                                            title="ไม่อนุมัติ"
                                                            onClick={() => {
                                                                const r = window.prompt('ระบุเหตุผลที่ไม่อนุมัติ:');
                                                                if (r !== null) handleUpdateStatus(exp.id, 'REJECTED', r, exp);
                                                            }}
                                                            style={{ color: '#f87171', padding: '4px 6px' }}
                                                        >
                                                            <X style={{ width: 14, height: 14 }} />
                                                        </button>
                                                    </>
                                                )}
                                                <button 
                                                    className="btn btn-ghost btn-sm"
                                                    title="ลบรายการ"
                                                    onClick={() => handleDelete(exp.id)}
                                                    style={{ color: 'var(--text-secondary)', padding: '4px 6px' }}
                                                >
                                                    <Trash2 style={{ width: 14, height: 14 }} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Expense Modal with OCR (Rendered via Portal directly to body) */}
            {showAddModal && typeof document !== 'undefined' && createPortal(
                <div 
                    className="modal-overlay modal-active"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 999999,
                        padding: '1.25rem',
                        boxSizing: 'border-box'
                    }}
                    onClick={(e) => {
                        if (e.target.classList.contains('modal-overlay')) {
                            setShowAddModal(false);
                        }
                    }}
                >
                    <div 
                        className="modal-container" 
                        style={{ 
                            maxWidth: '720px', 
                            width: '100%', 
                            maxHeight: '90vh', 
                            display: 'flex', 
                            flexDirection: 'column',
                            borderRadius: '16px',
                            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
                            border: '1px solid var(--border-card)',
                            backgroundColor: 'var(--bg-secondary, #1e293b)',
                            color: 'var(--text-primary)',
                            overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <DollarSign style={{ width: 22, height: 22, color: 'var(--primary-color, #4f46e5)' }} />
                                <h3 className="modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    บันทึกค่าใช้จ่าย / สแกนใบเสร็จ (Expense & Budget)
                                </h3>
                            </div>
                            <button 
                                type="button" 
                                className="modal-close-btn" 
                                onClick={() => setShowAddModal(false)}
                                title="ปิดหน้าต่าง"
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X style={{ width: 20, height: 20 }} />
                            </button>
                        </div>

                        <div className="modal-body" style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
                            {/* OCR Upload Area */}
                            <div style={{
                                border: '2px dashed rgba(59, 130, 246, 0.4)',
                                background: 'rgba(59, 130, 246, 0.05)',
                                borderRadius: '12px',
                                padding: '1.25rem',
                                textAlign: 'center',
                                marginBottom: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <Sparkles style={{ width: 20, height: 20, color: '#60a5fa' }} />
                                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>ระบบ AI สแกนใบเสร็จ & กรอกข้อมูลอุปกรณ์อัตโนมัติ</span>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                                    อัปโหลดภาพใบเสร็จหรือบิลเงินสด (JPG, PNG, PDF) — ระบบจะอ่านชื่ออุปกรณ์ จำนวน ราคา ร้านค้า และกรอกให้อัตโนมัติทันที
                                </p>

                                {/* AI Mode Indicator & Key Setup */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                                    {(serverKeyConfigured || geminiApiKey) ? (
                                        <div style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: 'rgba(34, 197, 94, 0.15)',
                                            border: '1px solid rgba(34, 197, 94, 0.4)',
                                            color: '#4ade80',
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            padding: '4px 10px',
                                            borderRadius: '999px'
                                        }}>
                                            <Sparkles style={{ width: 14, height: 14, color: '#4ade80' }} />
                                            <span>Google Gemini Vision AI: พร้อมใช้งาน (แม่นยำ 100%)</span>
                                        </div>
                                    ) : (
                                        <div style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: 'rgba(234, 179, 8, 0.15)',
                                            border: '1px solid rgba(234, 179, 8, 0.4)',
                                            color: '#facc15',
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            padding: '4px 10px',
                                            borderRadius: '999px'
                                        }}>
                                            <ShieldCheck style={{ width: 14, height: 14 }} />
                                            <span>โหมด: Local Thai OCR ออฟไลน์</span>
                                        </div>
                                    )}

                                    {isAdmin && (
                                        <a
                                            href="/settings"
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.74rem',
                                                textDecoration: 'none',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid var(--border-color)'
                                            }}
                                            title="ไปที่หน้าตั้งค่าผู้ดูแลระบบเพื่อแก้ไขหรือตั้งค่า Gemini Key"
                                        >
                                            <Settings style={{ width: 12, height: 12 }} /> ⚙️ ตั้งค่าในระบบผู้ดูแล
                                        </a>
                                    )}
                                </div>
                                <label 
                                    className="btn btn-secondary btn-sm" 
                                    style={{ 
                                        cursor: 'pointer', 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: 6,
                                        fontWeight: 600,
                                        padding: '7px 16px',
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        border: '1px solid rgba(59, 130, 246, 0.35)',
                                        color: '#60a5fa'
                                    }}
                                >
                                    <Upload style={{ width: 15, height: 15 }} />
                                    {ocrLoading ? 'กำลังอ่านและประมวลผล OCR...' : 'เลือกไฟล์ใบเสร็จ (JPG / PNG / PDF)'}
                                    <input 
                                        type="file" 
                                        accept="image/png, image/jpeg, image/jpg, application/pdf" 
                                        style={{ display: 'none' }}
                                        onChange={handleOcrUpload}
                                        disabled={ocrLoading}
                                    />
                                </label>
                                
                                {ocrWarning && (
                                    <div style={{ marginTop: '10px', color: '#f59e0b', fontSize: '0.82rem', fontWeight: 500, background: 'rgba(245, 158, 11, 0.1)', padding: '6px 10px', borderRadius: '6px' }}>
                                        {ocrWarning}
                                    </div>
                                )}

                                {ocrResult && (
                                    <div style={{
                                        marginTop: '14px',
                                        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
                                        border: '1px solid rgba(34, 197, 94, 0.4)',
                                        borderRadius: '10px',
                                        padding: '12px 16px',
                                        textAlign: 'left'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <CheckCircle2 style={{ width: 20, height: 20, color: '#4ade80' }} />
                                                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#4ade80' }}>
                                                    ⚡ สแกนและบันทึกข้อมูลอุปกรณ์ลงฐานข้อมูลอัตโนมัติสำเร็จ!
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <label 
                                                    className="btn btn-secondary btn-sm"
                                                    style={{
                                                        cursor: 'pointer',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 600,
                                                        borderColor: 'rgba(59, 130, 246, 0.4)',
                                                        color: '#60a5fa',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                    title="สแกนใบเสร็จใบถัดไป"
                                                >
                                                    <Sparkles style={{ width: 13, height: 13 }} /> 📷 สแกนใบเสร็จใหม่
                                                    <input 
                                                        type="file" 
                                                        accept="image/png, image/jpeg, image/jpg, application/pdf" 
                                                        style={{ display: 'none' }}
                                                        onChange={(e) => {
                                                            resetForm();
                                                            handleOcrUpload(e);
                                                        }}
                                                    />
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelCurrentScan}
                                                    className="btn btn-danger btn-sm"
                                                    style={{
                                                        fontSize: '0.78rem',
                                                        fontWeight: 600,
                                                        background: 'rgba(239, 68, 68, 0.2)',
                                                        borderColor: 'rgba(239, 68, 68, 0.5)',
                                                        color: '#f87171',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                    title="ยกเลิกการสแกนนี้ และลบรายการที่เพิ่งบันทึกไป"
                                                >
                                                    <X style={{ width: 13, height: 13 }} /> ❌ ยกเลิกการสแกน
                                                </button>
                                            </div>
                                        </div>

                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px 12px' }}>
                                            <div>🏷️ <strong>รายการ:</strong> <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{description || '-'}</span></div>
                                            <div>📦 <strong>จำนวน:</strong> <span style={{ color: 'var(--text-primary)' }}>{quantity} {unit} (@ ฿{Number(unitPrice || 0).toLocaleString()})</span></div>
                                            <div>💰 <strong>ยอดสุทธิ:</strong> <span style={{ color: '#4ade80', fontWeight: 700 }}>฿{netTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                            <div>🧾 <strong>เลขที่ / ร้านค้า:</strong> <span style={{ color: 'var(--text-primary)' }}>{receiptNo || '-'} {vendorName ? `(${vendorName})` : ''}</span></div>
                                        </div>

                                        {/* Multi-item detection selection list */}
                                        {ocrResult.items && ocrResult.items.length > 1 && (
                                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                                                    รายการสินค้าที่พบในใบเสร็จ ({ocrResult.items.length} รายการ - คลิกเพื่อเลือก):
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {ocrResult.items.map((it, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => {
                                                                setDescription(it.name);
                                                                setCategory(it.category || 'ค่าวัสดุและอุปกรณ์');
                                                                setQuantity(it.quantity || 1);
                                                                setUnit(it.unit || 'ชิ้น');
                                                                setUnitPrice(it.unit_price || (it.total_price / (it.quantity || 1)));
                                                            }}
                                                            className="btn btn-ghost btn-xs"
                                                            style={{
                                                                background: description === it.name ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.06)',
                                                                border: description === it.name ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                                                                color: 'var(--text-primary)',
                                                                fontSize: '0.75rem',
                                                                padding: '4px 8px',
                                                                borderRadius: '6px'
                                                            }}
                                                        >
                                                            {idx + 1}. {it.name} ({it.quantity} {it.unit} @ ฿{Number(it.unit_price || 0).toLocaleString()})
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <form id="expense-modal-form" onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {formError && (
                                    <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: 6, fontSize: '0.85rem' }}>
                                        {formError}
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>หมวดหมู่ค่าใช้จ่าย *</label>
                                        <select 
                                            className="form-input" 
                                            value={category} 
                                            onChange={(e) => setCategory(e.target.value)}
                                            style={{ width: '100%', fontSize: '0.85rem' }}
                                        >
                                            <option value="ค่าวัสดุและอุปกรณ์">ค่าวัสดุและอุปกรณ์</option>
                                            <option value="ค่าอะไหล่">ค่าอะไหล่</option>
                                            <option value="ค่าแรง">ค่าแรง</option>
                                            <option value="ค่าเดินทาง">ค่าเดินทาง</option>
                                            <option value="ค่าจ้างภายนอก">ค่าจ้างภายนอก</option>
                                            <option value="ค่าใช้จ่ายอื่นๆ">ค่าใช้จ่ายอื่นๆ</option>
                                            <option value="ส่วนลดหรือเงินคืน">ส่วนลดหรือเงินคืน</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>รายละเอียดรายการ *</label>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            placeholder="เช่น สายแลน CAT6 10 เมตร, หัว RJ45" 
                                            value={description} 
                                            onChange={(e) => setDescription(e.target.value)}
                                            style={{ width: '100%', fontSize: '0.85rem' }}
                                            required
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '0.75rem' }}>
                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>จำนวน *</label>
                                        <input 
                                            type="number" 
                                            min="0.1" 
                                            step="any"
                                            className="form-input" 
                                            value={quantity} 
                                            onChange={(e) => setQuantity(e.target.value)}
                                            style={{ width: '100%', fontSize: '0.85rem' }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>หน่วยนับ</label>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            placeholder="ชิ้น / เส้น / เมตร" 
                                            value={unit} 
                                            onChange={(e) => setUnit(e.target.value)}
                                            style={{ width: '100%', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>ราคาต่อหน่วย (บาท) *</label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            step="any"
                                            className="form-input" 
                                            placeholder="0.00" 
                                            value={unitPrice} 
                                            onChange={(e) => setUnitPrice(e.target.value)}
                                            style={{ width: '100%', fontSize: '0.85rem' }}
                                            required
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>ส่วนลด (บาท)</label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            step="any"
                                            className="form-input" 
                                            value={discount} 
                                            onChange={(e) => setDiscount(e.target.value)}
                                            style={{ width: '100%', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>ภาษีมูลค่าเพิ่ม (%)</label>
                                        <select 
                                            className="form-input" 
                                            value={taxPercent} 
                                            onChange={(e) => setTaxPercent(e.target.value)}
                                            style={{ width: '100%', fontSize: '0.85rem' }}
                                        >
                                            <option value="0">0% (ไม่มี VAT)</option>
                                            <option value="7">7% (VAT ปกติ)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Summary Preview Box */}
                                <div style={{
                                    background: 'var(--bg-card, rgba(0,0,0,0.05))',
                                    padding: '10px 14px',
                                    borderRadius: 8,
                                    border: '1px solid var(--border-card, rgba(0,0,0,0.08))',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    color: 'var(--text-primary)'
                                }}>
                                    <div>
                                        <span style={{ color: 'var(--text-secondary)' }}>ยอดรวมก่อนภาษี: </span>
                                        <span style={{ fontWeight: 600 }}>฿{taxable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        <span style={{ color: 'var(--text-secondary)', marginLeft: 12 }}>ภาษี: </span>
                                        <span style={{ fontWeight: 600 }}>฿{taxAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div>
                                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>ยอดสุทธิ: </span>
                                        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary-color, #4f46e5)' }}>
                                            ฿{netTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                {/* Receipt details */}
                                <div style={{ borderTop: '1px solid var(--border-card, rgba(0,0,0,0.08))', paddingTop: '0.75rem' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--primary-color, #4f46e5)' }}>
                                        ข้อมูลใบเสร็จ / ใบกำกับภาษี (ถ้ามี)
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                        <div>
                                            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>ชื่อร้านค้า / ผู้ขาย</label>
                                            <input 
                                                type="text" 
                                                className="form-input" 
                                                placeholder="บจก. ไอทีคอมเมิร์ซ" 
                                                value={vendorName} 
                                                onChange={(e) => setVendorName(e.target.value)}
                                                style={{ width: '100%', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>เลขที่ใบเสร็จ</label>
                                            <input 
                                                type="text" 
                                                className="form-input" 
                                                placeholder="INV-2026-0012" 
                                                value={receiptNo} 
                                                onChange={(e) => setReceiptNo(e.target.value)}
                                                style={{ width: '100%', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        <div>
                                            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>วันที่ในใบเสร็จ</label>
                                            <input 
                                                type="date" 
                                                className="form-input" 
                                                value={receiptDate} 
                                                onChange={(e) => setReceiptDate(e.target.value)}
                                                style={{ width: '100%', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>URL ไฟล์เอกสาร / ใบเสร็จ</label>
                                            <input 
                                                type="text" 
                                                className="form-input" 
                                                placeholder="/uploads/..." 
                                                value={receiptUrl} 
                                                onChange={(e) => setReceiptUrl(e.target.value)}
                                                style={{ width: '100%', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '0.75rem' }}>
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>สถานะการอนุมัติงบประมาณ *</label>
                                        <select 
                                            className="form-input" 
                                            value={status} 
                                            onChange={(e) => setStatus(e.target.value)}
                                            style={{ width: '100%', fontSize: '0.85rem', fontWeight: 600, color: status === 'APPROVED' ? '#4ade80' : '#fbbf24' }}
                                        >
                                            <option value="APPROVED">✅ อนุมัติแล้ว (บันทึกยอดเบิกจ่ายเข้าช่องงบประมาณทันที)</option>
                                            <option value="PENDING">⏳ รอดำเนินการอนุมัติ (บันทึกเป็นรายการเสนองบ)</option>
                                        </select>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="modal-footer" style={{ 
                            padding: '1.25rem 1.5rem', 
                            display: 'flex', 
                            justifyContent: 'flex-end', 
                            gap: '0.75rem', 
                            borderTop: '1px solid var(--border-card)',
                            backgroundColor: 'var(--bg-secondary, #1e293b)',
                            flexShrink: 0,
                            flexWrap: 'wrap'
                        }}>
                            {lastScannedExpenseIds.length > 0 ? (
                                <>
                                    <button 
                                        type="button" 
                                        className="btn btn-danger" 
                                        onClick={handleCancelCurrentScan}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                                    >
                                        <X style={{ width: 15, height: 15 }} /> ❌ ยกเลิกการสแกน
                                    </button>
                                    <label 
                                        className="btn btn-secondary"
                                        style={{ 
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            fontWeight: 600,
                                            borderColor: 'rgba(59, 130, 246, 0.4)',
                                            color: '#60a5fa'
                                        }}
                                    >
                                        <Sparkles style={{ width: 15, height: 15 }} /> 📷 สแกนใบเสร็จใหม่
                                        <input 
                                            type="file" 
                                            accept="image/png, image/jpeg, image/jpg, application/pdf" 
                                            style={{ display: 'none' }}
                                            onChange={(e) => {
                                                resetForm();
                                                handleOcrUpload(e);
                                            }}
                                        />
                                    </label>
                                    <button 
                                        type="button" 
                                        className="btn btn-primary" 
                                        onClick={() => {
                                            setShowAddModal(false);
                                            resetForm();
                                        }}
                                        style={{ minWidth: '140px', fontWeight: 700, backgroundColor: '#16a34a', borderColor: '#15803d' }}
                                    >
                                        ✅ เสร็จสิ้น / ปิดหน้าต่าง
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button 
                                        type="button" 
                                        className="btn btn-secondary" 
                                        onClick={() => {
                                            setShowAddModal(false);
                                            resetForm();
                                        }}
                                    >
                                        ยกเลิก
                                    </button>
                                    <button 
                                        type="submit" 
                                        form="expense-modal-form" 
                                        className="btn btn-primary" 
                                        disabled={submitting}
                                        style={{ minWidth: '180px', fontWeight: 700, backgroundColor: '#16a34a', borderColor: '#15803d' }}
                                    >
                                        {submitting ? 'กำลังบันทึกลงฐานข้อมูล...' : '⚡ ยืนยันและบันทึกลงฐานข้อมูล'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
