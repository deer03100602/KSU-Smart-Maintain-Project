// ============================================================
// issueTypes.js — Default Issue Types (Hardcoded Constants)
// ============================================================

export const DEFAULT_ISSUE_TYPES = [
    { id: 'it-hw', name: 'Computer Hardware', description: 'ปัญหาเครื่องคอมพิวเตอร์ เมาส์ คีย์บอร์ด จอภาพ หรืออุปกรณ์ต่อพ่วง', icon: 'monitor' },
    { id: 'it-sw', name: 'Software / Application', description: 'ปัญหาโปรแกรมใช้งานไม่ได้ ติดตั้งโปรแกรมไม่ได้ หรือโปรแกรมมี error', icon: 'app-window' },
    { id: 'it-net', name: 'Network / Internet', description: 'ปัญหาอินเทอร์เน็ต Wi-Fi LAN หรือการเชื่อมต่อเครือข่าย', icon: 'wifi' },
    { id: 'it-print', name: 'Printer / Scanner', description: 'ปัญหาเครื่องพิมพ์ เครื่องสแกน หรืออุปกรณ์สำนักงาน', icon: 'printer' },
    { id: 'it-room', name: 'Classroom / Lab Room', description: 'ปัญหาห้องเรียน ห้องปฏิบัติการ แอร์ ไฟ โปรเจคเตอร์ หรืออุปกรณ์ห้อง', icon: 'school' },
    { id: 'it-acc', name: 'Account / Login', description: 'ปัญหาการเข้าสู่ระบบ บัญชีผู้ใช้ หรือรหัสผ่าน', icon: 'key-round' },
    { id: 'it-other', name: 'Other', description: 'ปัญหาอื่น ๆ ที่ไม่อยู่ในหมวดข้างต้น', icon: 'circle-help' }
];
