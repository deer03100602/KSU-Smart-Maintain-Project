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

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <div className="app-container">
          <Navbar />
          <main className="main-content" id="main-content">
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
          </main>
        </div>
      </AppProvider>
    </HashRouter>
  )
}
