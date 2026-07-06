'use client';
import { Sidebar } from '@/components/layouts/Sidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { useIsMobile } from '@/hooks/useIsMobile';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg-tertiary)' }}>
      <Sidebar />
      <main style={{ flex:1, minWidth:0, overflowY:'auto', paddingTop: isMobile ? '60px' : '0' }}>
        {children}
      </main>
      <NotificationBell />
      <ChatWidget />
    </div>
  );
}
