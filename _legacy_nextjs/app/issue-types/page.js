// ============================================================
// page.js — Issue Types Management Page
// Route: /issue-types
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Settings, Plus, Edit2, Trash2 } from 'lucide-react';
import * as Icons from 'lucide-react';

const iconMap = {
    'monitor': Icons.Monitor,
    'app-window': Icons.AppWindow,
    'wifi': Icons.Wifi,
    'printer': Icons.Printer,
    'school': Icons.School,
    'key-round': Icons.KeyRound,
    'circle-help': Icons.CircleHelp,
    'wrench': Icons.Wrench,
    'shield': Icons.Shield,
    'activity': Icons.Activity
};

const ICONS_LIST = ['monitor', 'app-window', 'wifi', 'printer', 'school', 'key-round', 'circle-help', 'wrench', 'shield', 'activity'];

export default function IssueTypesPage() {
    const router = useRouter();
    const { role, toast, confirm } = useApp();

    const [issueTypes, setIssueTypes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Guard checking
    useEffect(() => {
        if (role !== 'admin') {
            toast.warning('คุณไม่มีสิทธิ์เข้าถึงหน้าตั้งค่าประเภทปัญหา');
            router.push('/');
        }
    }, [role]);

    const fetchIssueTypes = async () => {
        try {
            const res = await fetch('/api/issue-types');
            if (res.ok) {
                const data = await res.json();
                setIssueTypes(data);
            }
        } catch (e) {
            console.error('Error fetching issue types:', e);
            toast.error('ไม่สามารถโหลดข้อมูลประเภทปัญหาได้');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (role === 'admin') {
            fetchIssueTypes();
        }
    }, [role]);

    const showCreateModal = () => {
        let nameVal = '';
        let descVal = '';
        let iconVal = 'circle-help';

        confirm(
            'เพิ่มประเภทปัญหาใหม่',
            '',
            async () => {
                if (!nameVal.trim()) {
                    toast.error('กรุณากรอกชื่อประเภทปัญหา');
                    return;
                }
                try {
                    const res = await fetch('/api/issue-types', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: nameVal.trim(),
                            description: descVal.trim(),
                            icon: iconVal
                        })
                    });
                    if (res.ok) {
                        toast.success('เพิ่มประเภทปัญหาสำเร็จ');
                        fetchIssueTypes();
                    } else {
                        const err = await res.json();
                        toast.error(`ไม่สามารถเพิ่มประเภทปัญหาได้: ${err.error || ''}`);
                    }
                } catch (e) {
                    console.error(e);
                    toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
                }
            },
            {
                confirmText: 'เพิ่มประเภท',
                cancelText: 'ยกเลิก',
                content: (
                    <div className="edit-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">ชื่อประเภทปัญหา <span className="required">*</span></label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="เช่น Network / Internet"
                                onChange={(e) => { nameVal = e.target.value; }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">รายละเอียด</label>
                            <textarea 
                                className="form-input form-textarea" 
                                placeholder="คำอธิบายสั้นๆ เกี่ยวกับปัญหาประเภทนี้..."
                                rows={3}
                                onChange={(e) => { descVal = e.target.value; }}
                            ></textarea>
                        </div>
                        <div className="form-group">
                            <label className="form-label">ไอคอน</label>
                            <select 
                                className="form-input form-select"
                                defaultValue="circle-help"
                                onChange={(e) => { iconVal = e.target.value; }}
                            >
                                {ICONS_LIST.map(iconName => (
                                    <option key={iconName} value={iconName}>{iconName}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )
            }
        );
    };

    const showEditModal = (typeItem) => {
        let nameVal = typeItem.name;
        let descVal = typeItem.description;
        let iconVal = typeItem.icon || 'circle-help';

        confirm(
            'แก้ไขประเภทปัญหา',
            '',
            async () => {
                if (!nameVal.trim()) {
                    toast.error('กรุณากรอกชื่อประเภทปัญหา');
                    return;
                }
                try {
                    const res = await fetch(`/api/issue-types/${typeItem.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: nameVal.trim(),
                            description: descVal.trim(),
                            icon: iconVal
                        })
                    });
                    if (res.ok) {
                        toast.success('แก้ไขประเภทปัญหาสำเร็จ');
                        fetchIssueTypes();
                    } else {
                        const err = await res.json();
                        toast.error(`ไม่สามารถแก้ไขประเภทปัญหาได้: ${err.error || ''}`);
                    }
                } catch (e) {
                    console.error(e);
                    toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
                }
            },
            {
                confirmText: 'บันทึก',
                cancelText: 'ยกเลิก',
                content: (
                    <div className="edit-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">ชื่อประเภทปัญหา <span className="required">*</span></label>
                            <input 
                                type="text" 
                                className="form-input" 
                                defaultValue={typeItem.name}
                                onChange={(e) => { nameVal = e.target.value; }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">รายละเอียด</label>
                            <textarea 
                                className="form-input form-textarea" 
                                defaultValue={typeItem.description}
                                rows={3}
                                onChange={(e) => { descVal = e.target.value; }}
                            ></textarea>
                        </div>
                        <div className="form-group">
                            <label className="form-label">ไอคอน</label>
                            <select 
                                className="form-input form-select"
                                defaultValue={typeItem.icon || 'circle-help'}
                                onChange={(e) => { iconVal = e.target.value; }}
                            >
                                {ICONS_LIST.map(iconName => (
                                    <option key={iconName} value={iconName}>{iconName}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )
            }
        );
    };

    const handleDeleteType = (id) => {
        confirm(
            'ยืนยันการลบประเภทปัญหา',
            'คุณแน่ใจหรือไม่ว่าต้องการลบประเภทปัญหานี้? ใบงานที่ใช้ประเภทปัญหานี้อาจไม่แสดงประเภทตามเดิม',
            async () => {
                try {
                    const res = await fetch(`/api/issue-types/${id}`, {
                        method: 'DELETE'
                    });
                    if (res.ok) {
                        toast.success('ลบประเภทปัญหาสำเร็จ');
                        fetchIssueTypes();
                    } else {
                        const err = await res.json();
                        toast.error(`ไม่สามารถลบได้: ${err.error || ''}`);
                    }
                } catch (e) {
                    console.error(e);
                    toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
                }
            },
            {
                confirmClass: 'btn-danger'
            }
        );
    };

    if (role !== 'admin') return null;

    return (
        <div className="page-issue-types fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1 className="page-title text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Settings style={{ width: 26, height: 26, color: 'var(--primary-color)' }} />
                        จัดการประเภทปัญหาในระบบ
                    </h1>
                    <p className="page-subtitle">แสดงรายการและจัดการหมวดหมู่ประเภทปัญหาทั้งหมดที่เปิดใช้งานในระบบแจ้งซ่อม</p>
                </div>
                <button className="btn btn-primary" onClick={showCreateModal}>
                    <Plus style={{ width: 16, height: 16 }} />
                    เพิ่มประเภทปัญหา
                </button>
            </div>

            {loading ? (
                <p className="text-muted" style={{ textAlign: 'center', padding: '3rem' }}>กำลังโหลดข้อมูลประเภทปัญหา...</p>
            ) : issueTypes.length === 0 ? (
                <div className="empty-state">
                    <h3>ไม่พบประเภทปัญหาในระบบ</h3>
                    <p>กรุณากดปุ่มเพิ่มประเภทปัญหาด้านบนเพื่อสร้างใหม่</p>
                </div>
            ) : (
                <div className="issue-types-grid">
                    {issueTypes.map(type => {
                        const IconEl = iconMap[type.icon] || Icons.CircleHelp;
                        return (
                            <div key={type.id} className="type-card glass-card">
                                <div className="type-card-header">
                                    <div className="type-icon-wrapper">
                                        <IconEl className="type-icon" style={{ width: 22, height: 22 }} />
                                    </div>
                                    <div className="type-card-actions">
                                        <button className="btn btn-ghost btn-icon-sm" onClick={() => showEditModal(type)} title="แก้ไข">
                                            <Edit2 style={{ width: 14, height: 14 }} />
                                        </button>
                                        <button className="btn btn-danger-ghost btn-icon-sm" onClick={() => handleDeleteType(type.id)} title="ลบ">
                                            <Trash2 style={{ width: 14, height: 14 }} />
                                        </button>
                                    </div>
                                </div>
                                <div className="type-card-body" style={{ marginTop: '1rem' }}>
                                    <h3 className="type-title" style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{type.name}</h3>
                                    <p className="type-desc text-muted" style={{ fontSize: '0.85rem', minHeight: '3rem', margin: 0 }}>{type.description || 'ไม่มีคำอธิบาย'}</p>
                                    <span className="type-id-tag" style={{ display: 'inline-block', marginTop: '1rem', fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.6 }}>ID: {type.id}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
