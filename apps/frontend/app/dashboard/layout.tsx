import { Sidebar } from '@/components/layouts/Sidebar';
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg-tertiary)' }}>
      <Sidebar />
      <main style={{ flex:1, minWidth:0, overflowY:'auto' }}>{children}</main>
    </div>
  );
}
