import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    DollarSign, Plus, Check, X, Edit3, Trash2, AlertCircle, FileText, 
    Upload, Sparkles, CheckCircle2, AlertTriangle, Clock, RefreshCw 
} from 'lucide-react';
import { saveStoredExpenses } from '@/lib/ticketStore';

export default function TicketExpenseManager({ 
    ticket, 
    expenses = [], 
    summary = {}, 
    isAdmin = false, 
    currentUser = {},
    onExpenseUpdated 
}) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrResult, setOcrResult] = useState(null);
    const [ocrWarning, setOcrWarning] = useState('');

    // Form state
    const [category, setCategory] = useState('อุปกรณ์');
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

    const handleOcrUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setOcrLoading(true);
        setOcrWarning('');
        const formData = new FormData();
        formData.append('receipt', file);

        try {
            const res = await fetch('/api/ocr/scan-receipt', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const parsed = data.data;
                setOcrResult(parsed);
                if (parsed.vendor_name) setVendorName(parsed.vendor_name);
                if (parsed.receipt_no) setReceiptNo(parsed.receipt_no);
                if (parsed.receipt_date) setReceiptDate(parsed.receipt_date);
                if (parsed.net_amount) {
                    setUnitPrice(parsed.net_amount);
                    setQuantity(1);
                    setTaxPercent(parsed.tax_amount > 0 ? 7 : 0);
                }
                if (parsed.file_url) setReceiptUrl(parsed.file_url);

                // Validation alert: check duplicate receipt
                const isDuplicate = expenses.some(exp => exp.receipt_no && exp.receipt_no.trim() === (parsed.receipt_no || '').trim());
                if (isDuplicate) {
                    setOcrWarning(`⚠️ ตรวจพบว่าเลขที่ใบเสร็จ "${parsed.receipt_no}" ถูกบันทึกในระบบแล้ว กรุณาตรวจสอบก่อนบันทึก`);
                }
            } else {
                setOcrWarning(data.error || 'ไม่สามารถอ่านข้อความจากไฟล์ได้');
            }
        } catch (err) {
            setOcrWarning('เกิดข้อผิดพลาดในการเชื่อมต่อ OCR');
        } finally {
            setOcrLoading(false);
        }
    };

    const handleCreateExpense = async (e) => {
        e.preventDefault();
        setFormError('');
        if (!description.trim()) {
            setFormError('กรุณาระบุรายละเอียดรายการ');
            return;
        }
        if (q <= 0 || p <= 0) {
            setFormError('จำนวนและราคาต่อหน่วยต้องมากกว่า 0');
            return;
        }

        setSubmitting(true);
        try {
            const token = localStorage.getItem('helpdesk_token');
            const res = await fetch(`/api/tickets/${ticket.id}/expenses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    category,
                    description: description.trim(),
                    quantity: q,
                    unit: unit.trim() || 'ชิ้น',
                    unit_price: p,
                    discount: disc,
                    tax_percent: parseFloat(taxPercent) || 0,
                    receipt_no: receiptNo.trim() || null,
                    vendor_name: vendorName.trim() || null,
                    receipt_date: receiptDate || null,
                    receipt_url: receiptUrl || null
                })
            });

            const data = await res.json();
            if (res.ok) {
                setShowAddModal(false);
                resetForm();
                if (onExpenseUpdated) onExpenseUpdated();
            } else {
                setFormError(data.error || 'เกิดข้อผิดพลาดในการบันทึกงบประมาณ');
            }
        } catch (err) {
            setFormError('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว');
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
        try {
            const token = localStorage.getItem('helpdesk_token');
            const res = await fetch(`/api/expenses/${expenseId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            if (res.ok) {
                if (onExpenseUpdated) onExpenseUpdated();
            }
        } catch (e) {
            console.error(e);
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
                {isAdmin && (
                    <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => { resetForm(); setShowAddModal(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Plus style={{ width: 15, height: 15 }} /> บันทึกค่าใช้จ่าย / สแกนใบเสร็จ
                    </button>
                )}
            </div>

            {/* Financial Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>งบประมาณที่เสนอ</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#60a5fa' }}>฿{(summary.totalProposed || 0).toLocaleString()}</div>
                </div>
                <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>งบประมาณที่อนุมัติ</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#4ade80' }}>฿{(summary.totalApproved || 0).toLocaleString()}</div>
                </div>
                <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ยอดเบิกจ่ายแล้ว (มีใบเสร็จ)</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#c084fc' }}>฿{(summary.totalDisbursed || summary.totalActual || 0).toLocaleString()}</div>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>งบประมาณคงเหลือ</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#10b981' }}>฿{(summary.remainingBudget || 0).toLocaleString()}</div>
                </div>
                <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>รอดำเนินการอนุมัติ</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#fbbf24' }}>฿{(summary.totalPending || 0).toLocaleString()}</div>
                </div>
            </div>

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
                                {isAdmin && <th style={{ padding: '8px 10px', textAlign: 'center' }}>จัดการ</th>}
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
                                    {isAdmin && (
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
                                borderRadius: '8px',
                                padding: '1rem',
                                textAlign: 'center',
                                marginBottom: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <Sparkles style={{ width: 18, height: 18, color: '#60a5fa' }} />
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>ระบบ OCR สแกนใบเสร็จอัตโนมัติ (AI Receipt Scanner)</span>
                                </div>
                                <p style={{ fontSize: '0.785rem', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                                    รองรับไฟล์ภาพ JPG, PNG และ PDF — สกัดชื่อร้านค้า วันที่ เลขที่ใบเสร็จ และยอดรวมสุทธิอัตโนมัติ
                                </p>
                                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <Upload style={{ width: 14, height: 14 }} />
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
                                    <div style={{ marginTop: '8px', color: '#f59e0b', fontSize: '0.8rem', fontWeight: 500 }}>
                                        {ocrWarning}
                                    </div>
                                )}
                                {ocrResult && (
                                    <div style={{ marginTop: '8px', color: '#10b981', fontSize: '0.8rem', fontWeight: 500 }}>
                                        ✅ ดึงข้อมูลสำเร็จ! กรุณาตรวจสอบความถูกต้องของฟอร์มด้านล่างก่อนบันทึก
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
                            flexShrink: 0
                        }}>
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
                                style={{ minWidth: '150px', fontWeight: 600 }}
                            >
                                {submitting ? 'กำลังบันทึก...' : 'บันทึกรายการงบประมาณ'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
