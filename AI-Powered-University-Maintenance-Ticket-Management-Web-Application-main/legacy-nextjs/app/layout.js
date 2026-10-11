// ============================================================
// layout.js — Core Root Layout for Next.js App Router
// ============================================================

import React from 'react';
import '@/app/globals.css';
import { AppProvider } from '@/context/AppContext';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'KSU SMART MAINTAIN | ระบบแจ้งซ่อมสิ่งพาณิชย์และอุปกรณ์อัจฉริยะ มหาวิทยาลัยกาฬสินธุ์',
  description: 'ระบบแจ้งปัญหาและติดตามสถานะการซ่อมบำรุงสิ่งพาณิชย์และอุปกรณ์อัจฉริยะ มหาวิทยาลัยกาฬสินธุ์ ด้วย AI',
  icons: {
    icon: '/ksu-logo-icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('helpdesk_theme')||'dark';document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){}`,
          }}
        />
      </head>
      <body>
        <AppProvider>
          <div className="app-container">
            {/* Sidebar drawer and Mobile Navigation */}
            <Navbar />
            
            {/* Main Page Area */}
            <main className="main-content" id="main-content">
              {children}
            </main>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
