import React from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from '@/context/AppContext'
import Navbar from '@/components/Navbar'

import HomePage from '@/pages/Home'
import CreateTicketPage from '@/pages/CreateTicket'
import TicketListPage from '@/pages/Tickets'
import TicketDetailPage from '@/pages/TicketDetail'
import MyTicketsPage from '@/pages/MyTickets'
import DashboardPage from '@/pages/Dashboard'
import AdminManagementPage from '@/pages/Admin'
import AdminSettingsPage from '@/pages/AdminSettings'
import IssueTypesPage from '@/pages/IssueTypes'
import LoginPage from '@/pages/Login'
import SignupPage from '@/pages/Signup'
import ProfilePage from '@/pages/Profile'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled app error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: 500, margin: '4rem auto', padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 style={{ fontSize: '1.3rem', color: '#ef4444', marginBottom: '0.75rem' }}>เกิดข้อผิดพลาดในการแสดงผล</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {this.state.error?.message || 'ระบบพบปัญหาบางประการ กรุณากดรีเฟรชหรือกลับหน้าหลัก'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={() => window.location.reload()} className="btn btn-primary btn-sm">
              รีเฟรชหน้าเว็บ
            </button>
            <a href="#/" onClick={() => this.setState({ hasError: false })} className="btn btn-ghost btn-sm">
              กลับหน้าหลัก
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <div className="app-container">
          <Navbar />
          <main className="main-content" id="main-content">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/create" element={<CreateTicketPage />} />
                <Route path="/tickets" element={<TicketListPage />} />
                <Route path="/tickets/:id" element={<TicketDetailPage />} />
                <Route path="/my-tickets" element={<MyTicketsPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/admin" element={<AdminManagementPage />} />
                <Route path="/admin/settings" element={<AdminSettingsPage />} />
                <Route path="/settings" element={<AdminSettingsPage />} />
                <Route path="/issue-types" element={<IssueTypesPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
          </main>
        </div>
      </AppProvider>
    </HashRouter>
  )
}
