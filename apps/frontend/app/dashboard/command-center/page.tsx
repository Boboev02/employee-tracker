'use client';
import { useState } from 'react';
import Overview from './Overview';
import MapView from './MapView';

export default function CommandCenterPage() {
  const [tab, setTab] = useState<'overview' | 'map'>('overview');

  // Карта рендерит собственный полноэкранный layout, поэтому отдаём
  // ей весь экран и рисуем переключатель поверх.
  if (tab === 'map') {
    return (
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 10, left: 210, zIndex: 50 }}>
          <Tabs tab={tab} setTab={setTab} />
        </div>
        <MapView />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d0f14', color: '#e8eaf0', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 24px', background: '#151820', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>⚡ Command Center</div>
          <div style={{ fontSize: 10, color: '#4a5168' }}>Что происходит в компании</div>
        </div>
        <Tabs tab={tab} setTab={setTab} />
      </div>
      <Overview />
    </div>
  );
}

function Tabs({ tab, setTab }: { tab: string; setTab: (t: any) => void }) {
  const item = (id: string, label: string) => (
    <button key={id} onClick={() => setTab(id)}
      style={{
        background: tab === id ? '#6b5ce7' : 'transparent',
        color: tab === id ? '#fff' : '#8892aa',
        border: 'none', borderRadius: 8, padding: '6px 14px',
        fontSize: 12.5, cursor: 'pointer', font: 'inherit',
      }}>
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 4, background: '#1a1e2a', borderRadius: 10, padding: 3 }}>
      {item('overview', 'Обзор')}
      {item('map', 'Карта')}
    </div>
  );
}
