const fs = require('fs');
const path = require('path');
function write(p, c) { fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,c); console.log('✓',p); }

// ─── Reports backend service ──────────────────────────────────
write('../../employee-tracker/apps/backend/src/analytics/report.service.ts', `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getFullReport(orgId: string, days: number) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const [users, tasks, events] = await Promise.all([
      this.prisma.user.findMany({
        where: { orgId },
        select: { id: true, name: true, email: true, roles: true, status: true, createdAt: true },
      }),
      this.prisma.task.findMany({
        where: { orgId, deletedAt: null },
        select: { id: true, title: true, status: true, priority: true, assigneeId: true, createdAt: true, completedAt: true, dueDate: true },
      }),
      this.prisma.activityEvent.findMany({
        where: { orgId, createdAt: { gte: from } },
        select: { userId: true, platform: true, eventType: true, platformData: true, clientTimestamp: true, createdAt: true },
      }),
    ]);

    // Build per-user stats
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const userStats: Record<string, any> = {};

    for (const u of users) {
      userStats[u.id] = {
        id: u.id, name: u.name, email: u.email,
        role: u.roles?.[0] ?? 'EMPLOYEE',
        status: u.status,
        totalClicks: 0,
        platforms: {} as Record<string, number>,
        sections: {} as Record<string, { clicks: number; timeSeconds: number }>,
        tasks: { created: 0, inProgress: 0, done: 0 },
        lastEnterBySection: {} as Record<string, number>,
      };
    }

    for (const e of events) {
      const s = userStats[e.userId];
      if (!s) continue;
      const plat = e.platform ?? 'OTHER';
      s.platforms[plat] = (s.platforms[plat] ?? 0) + 1;
      if (e.eventType === 'click') s.totalClicks++;

      const pd = e.platformData as any;
      if (pd?.section && pd.section !== 'other' && pd.section !== 'unknown') {
        const key = plat + ':' + pd.section;
        if (!s.sections[key]) s.sections[key] = { clicks: 0, timeSeconds: 0 };
        if (e.eventType === 'click') s.sections[key].clicks++;
        if (e.eventType?.includes('section_enter')) s.lastEnterBySection[key] = Number(e.clientTimestamp);
        if (e.eventType?.includes('section_leave') && s.lastEnterBySection[key]) {
          const spent = Math.round((Number(e.clientTimestamp) - s.lastEnterBySection[key]) / 1000);
          if (spent > 0 && spent < 7200) s.sections[key].timeSeconds += spent;
          delete s.lastEnterBySection[key];
        }
      }
    }

    for (const t of tasks) {
      if (t.assigneeId && userStats[t.assigneeId]) {
        const s = userStats[t.assigneeId];
        if (t.status === 'IN_PROGRESS') s.tasks.inProgress++;
        else if (t.status === 'DONE') s.tasks.done++;
        else s.tasks.created++;
      }
    }

    const SECTION_LABELS: Record<string, string> = {
      orders:'Заказы', feedbacks:'Отзывы', reviews:'Отзывы', questions:'Вопросы',
      products:'Товары', prices:'Цены', stocks:'Остатки', remains:'Остатки',
      supplies:'Поставки', supply:'Поставки', advertising:'Реклама',
      analytics:'Аналитика', finance:'Финансы', chat:'Чат',
      promotions:'Акции', promotion:'Продвижение', logistics:'Логистика',
      rating:'Рейтинг', other:'Прочее',
    };

    return {
      period: { days, from: from.toISOString(), to: new Date().toISOString() },
      orgId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalEmployees: users.length,
        totalClicks: events.filter(e => e.eventType === 'click').length,
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'DONE').length,
      },
      employees: Object.values(userStats).map((s: any) => ({
        ...s,
        sectionsFormatted: Object.entries(s.sections)
          .map(([key, val]: [string, any]) => {
            const [plat, section] = key.split(':');
            return { platform: plat, section, label: SECTION_LABELS[section] ?? section, ...val };
          })
          .sort((a, b) => b.clicks - a.clicks),
      })),
      tasks: tasks.map(t => ({
        ...t,
        assigneeName: t.assigneeId ? userMap[t.assigneeId]?.name ?? '—' : '—',
      })),
      sectionLabels: SECTION_LABELS,
    };
  }
}
`);

// ─── Add to analytics controller ─────────────────────────────
let controller = fs.readFileSync('../../employee-tracker/apps/backend/src/analytics/analytics.controller.ts', 'utf8');
if (!controller.includes('report')) {
  controller = controller.replace(
    `import { AnalyticsController } from './analytics.controller';`,
    `import { AnalyticsController } from './analytics.controller';`
  );
  // Add report endpoint
  controller = controller.replace(
    `  @Get('productivity')`,
    `  @Get('report')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions('org:read')
  async getReport(@CurrentUser() user: any, @Query('days') days = '7') {
    return this.reportService.getFullReport(user.orgId, parseInt(days));
  }

  @Get('productivity')`
  );
  fs.writeFileSync('../../employee-tracker/apps/backend/src/analytics/analytics.controller.ts', controller);
  console.log('✓ analytics.controller.ts updated');
}

// ─── Reports frontend page ────────────────────────────────────
write('app/dashboard/reports/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const SECTION_LABELS: Record<string, string> = {
  orders:'Заказы', feedbacks:'Отзывы', reviews:'Отзывы', questions:'Вопросы',
  products:'Товары', prices:'Цены', stocks:'Остатки', remains:'Остатки',
  supplies:'Поставки', supply:'Поставки', advertising:'Реклама',
  analytics:'Аналитика', finance:'Финансы', chat:'Чат',
  promotions:'Акции', promotion:'Продвижение', logistics:'Логистика',
  rating:'Рейтинг', other:'Прочее',
};

function fmtTime(sec: number) {
  if (!sec || sec <= 0) return '—';
  if (sec < 60) return sec + 'с';
  if (sec < 3600) return Math.floor(sec/60) + 'м';
  return Math.floor(sec/3600) + 'ч ' + Math.floor((sec%3600)/60) + 'м';
}

function buildExcel(report: any) {
  // Build CSV with BOM for Excel
  const BOM = '\\uFEFF';
  const rows: string[][] = [];

  rows.push(['ОТЧЁТ ПО СОТРУДНИКАМ', '', '', '', '', '', '', '']);
  rows.push(['Период:', report.period.days + ' дней', '', 'Сформирован:', new Date(report.generatedAt).toLocaleString('ru'), '', '', '']);
  rows.push([]);

  // Summary
  rows.push(['СВОДКА', '', '', '']);
  rows.push(['Сотрудников', report.summary.totalEmployees, 'Кликов', report.summary.totalClicks]);
  rows.push(['Задач всего', report.summary.totalTasks, 'Выполнено задач', report.summary.completedTasks]);
  rows.push([]);

  // Employees
  rows.push(['СОТРУДНИКИ', '', '', '', '', '', '', '']);
  rows.push(['Имя', 'Email', 'Роль', 'Кликов', 'Задач в работе', 'Задач выполнено', 'Топ раздел', 'Время в топ разделе']);
  for (const emp of report.employees) {
    const top = emp.sectionsFormatted[0];
    rows.push([
      emp.name, emp.email, emp.role,
      emp.totalClicks,
      emp.tasks.inProgress, emp.tasks.done,
      top ? (top.platform === 'WILDBERRIES' ? 'WB ' : 'OZ ') + top.label : '—',
      top ? fmtTime(top.timeSeconds) : '—',
    ]);
  }
  rows.push([]);

  // Activity by sections
  rows.push(['АКТИВНОСТЬ ПО РАЗДЕЛАМ', '', '', '', '']);
  rows.push(['Сотрудник', 'Платформа', 'Раздел', 'Кликов', 'Время']);
  for (const emp of report.employees) {
    for (const sec of emp.sectionsFormatted) {
      rows.push([emp.name, sec.platform === 'WILDBERRIES' ? 'Wildberries' : 'Ozon', sec.label, sec.clicks, fmtTime(sec.timeSeconds)]);
    }
  }
  rows.push([]);

  // Tasks
  rows.push(['ЗАДАЧИ', '', '', '', '', '']);
  rows.push(['Название', 'Статус', 'Приоритет', 'Исполнитель', 'Создана', 'Дедлайн']);
  const STATUS: Record<string, string> = { NEW:'Новая', IN_PROGRESS:'В работе', REVIEW:'Проверка', DONE:'Готово', BLOCKED:'Заблокирована' };
  const PRIORITY: Record<string, string> = { LOW:'Низкий', MEDIUM:'Средний', HIGH:'Высокий', CRITICAL:'Критический' };
  for (const t of report.tasks) {
    rows.push([t.title, STATUS[t.status]??t.status, PRIORITY[t.priority]??t.priority, t.assigneeName, new Date(t.createdAt).toLocaleDateString('ru'), t.dueDate ? new Date(t.dueDate).toLocaleDateString('ru') : '—']);
  }

  const csv = BOM + rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(';')).join('\\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = 'report-' + report.period.days + 'd-' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function buildPDF(report: any) {
  const STATUS: Record<string, string> = { NEW:'Новая', IN_PROGRESS:'В работе', REVIEW:'Проверка', DONE:'Готово', BLOCKED:'Заблокирована' };
  const PRIORITY: Record<string, string> = { LOW:'Низкий', MEDIUM:'Средний', HIGH:'Высокий', CRITICAL:'Критический' };

  const html = \`<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 0; padding: 24px; }
  h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px; color: #18181b; }
  h2 { font-size: 14px; font-weight: 600; margin: 24px 0 10px; color: #18181b; border-bottom: 1.5px solid #e4e4e7; padding-bottom: 6px; }
  .meta { font-size: 11px; color: #71717a; margin-bottom: 20px; }
  .summary { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 8px; }
  .kpi { background: #f4f4f5; border-radius: 8px; padding: 12px; }
  .kpi-val { font-size: 22px; font-weight: 700; color: #18181b; }
  .kpi-label { font-size: 10px; color: #71717a; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { background: #f4f4f5; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e4e4e7; }
  td { padding: 8px 10px; border-bottom: 1px solid #f4f4f5; font-size: 11px; color: #18181b; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .wb { background: rgba(139,124,246,0.12); color: #8b7cf6; }
  .oz { background: rgba(77,157,224,0.12); color: #4d9de0; }
  .done { background: #f0fdf4; color: #22c55e; }
  .in-progress { background: #eff6ff; color: #378add; }
  .new { background: #f4f4f5; color: #71717a; }
  .review { background: #fff7ed; color: #f97316; }
  .critical { background: #fef2f2; color: #ef4444; }
  @media print { body { padding: 16px; } }
</style></head><body>
<h1>Отчёт по сотрудникам</h1>
<div class="meta">Период: \${report.period.days} дней &nbsp;|&nbsp; Сформирован: \${new Date(report.generatedAt).toLocaleString('ru')}</div>

<div class="summary">
  <div class="kpi"><div class="kpi-val">\${report.summary.totalEmployees}</div><div class="kpi-label">Сотрудников</div></div>
  <div class="kpi"><div class="kpi-val">\${report.summary.totalClicks}</div><div class="kpi-label">Кликов</div></div>
  <div class="kpi"><div class="kpi-val">\${report.summary.totalTasks}</div><div class="kpi-label">Задач</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#22c55e">\${report.summary.completedTasks}</div><div class="kpi-label">Выполнено</div></div>
</div>

<h2>Сотрудники</h2>
<table>
  <thead><tr><th>Имя</th><th>Роль</th><th>Кликов</th><th>В работе</th><th>Выполнено</th><th>Топ раздел</th><th>Время</th></tr></thead>
  <tbody>
    \${report.employees.map((emp: any) => {
      const top = emp.sectionsFormatted[0];
      return \`<tr>
        <td><strong>\${emp.name}</strong><br><span style="color:#71717a;font-size:10px">\${emp.email}</span></td>
        <td>\${emp.role}</td>
        <td style="color:#8b7cf6;font-weight:600">\${emp.totalClicks}</td>
        <td style="color:#378add">\${emp.tasks.inProgress}</td>
        <td style="color:#22c55e">\${emp.tasks.done}</td>
        <td>\${top ? \`<span class="badge \${top.platform==='WILDBERRIES'?'wb':'oz'}">\${top.platform==='WILDBERRIES'?'WB':'OZ'}</span> \${top.label}\` : '—'}</td>
        <td>\${top ? fmtTime(top.timeSeconds) : '—'}</td>
      </tr>\`;
    }).join('')}
  </tbody>
</table>

<h2>Активность по разделам</h2>
<table>
  <thead><tr><th>Сотрудник</th><th>Платформа</th><th>Раздел</th><th>Кликов</th><th>Время</th></tr></thead>
  <tbody>
    \${report.employees.flatMap((emp: any) => emp.sectionsFormatted.map((sec: any) => \`<tr>
      <td>\${emp.name}</td>
      <td><span class="badge \${sec.platform==='WILDBERRIES'?'wb':'oz'}">\${sec.platform==='WILDBERRIES'?'Wildberries':'Ozon'}</span></td>
      <td>\${sec.label}</td>
      <td style="color:#8b7cf6;font-weight:600">\${sec.clicks}</td>
      <td>\${fmtTime(sec.timeSeconds)}</td>
    </tr>\`)).join('')}
  </tbody>
</table>

<h2>Задачи</h2>
<table>
  <thead><tr><th>Название</th><th>Статус</th><th>Приоритет</th><th>Исполнитель</th><th>Дедлайн</th></tr></thead>
  <tbody>
    \${report.tasks.map((t: any) => {
      const stCls = t.status==='DONE'?'done':t.status==='IN_PROGRESS'?'in-progress':t.status==='REVIEW'?'review':'new';
      const prCls = t.priority==='CRITICAL'||t.priority==='HIGH'?'critical':'';
      return \`<tr>
        <td>\${t.title}</td>
        <td><span class="badge \${stCls}">\${STATUS[t.status]??t.status}</span></td>
        <td><span class="badge \${prCls}">\${PRIORITY[t.priority]??t.priority}</span></td>
        <td>\${t.assigneeName}</td>
        <td>\${t.dueDate?new Date(t.dueDate).toLocaleDateString('ru'):'—'}</td>
      </tr>\`;
    }).join('')}
  </tbody>
</table>
</body></html>\`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.print(); }, 500);
}

export default function ReportsPage() {
  const router = useRouter();
  const [token, setToken]     = useState('');
  const [report, setReport]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod]   = useState('7');
  const [generated, setGenerated] = useState<Date|null>(null);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  const generate = async (days: string) => {
    setLoading(true); setPeriod(days);
    try {
      const res = await fetch('http://localhost:3001/api/v1/analytics/report?days=' + days, {
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await res.json();
      setReport(data); setGenerated(new Date());
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'20px' };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-tertiary)' }}>
      <div style={{ background:'var(--bg-primary)', borderBottom:'0.5px solid var(--border)', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10 }}>
        <div>
          <h1 style={{ fontSize:'16px', fontWeight:600, color:'var(--text-primary)', margin:0 }}>Отчёты</h1>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', margin:'2px 0 0' }}>Полный отчёт по сотрудникам и активности</p>
        </div>
        {report && (
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => buildExcel(report)}
              style={{ background:'var(--green-bg)', color:'var(--green)', border:'none', padding:'8px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:500, cursor:'pointer' }}>
              ↓ Excel (CSV)
            </button>
            <button onClick={() => buildPDF(report)}
              style={{ background:'var(--accent-bg)', color:'var(--accent)', border:'none', padding:'8px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:500, cursor:'pointer' }}>
              🖨 PDF / Печать
            </button>
          </div>
        )}
      </div>

      <div style={{ padding:'24px', display:'flex', flexDirection:'column', gap:'16px', maxWidth:'1000px' }}>

        {/* Period selection */}
        <div style={card}>
          <p style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)', margin:'0 0 14px' }}>Выберите период и сформируйте отчёт</p>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
            {[
              { label:'За сегодня',  days:'1',  icon:'📅' },
              { label:'За 7 дней',   days:'7',  icon:'📊' },
              { label:'За 14 дней',  days:'14', icon:'📈' },
              { label:'За 30 дней',  days:'30', icon:'🗓️' },
            ].map(opt => (
              <button key={opt.days} onClick={() => generate(opt.days)} disabled={loading}
                style={{ display:'flex', alignItems:'center', gap:'8px', padding:'12px 20px', borderRadius:'10px', border:'0.5px solid var(--border)', background: period===opt.days && report ? 'var(--accent-bg)' : 'var(--bg-secondary)', color: period===opt.days && report ? 'var(--accent)' : 'var(--text-primary)', fontSize:'13px', fontWeight:500, cursor:loading?'not-allowed':'pointer', opacity:loading?0.7:1, transition:'all 0.15s' }}>
                <span>{opt.icon}</span>
                {loading && period===opt.days ? 'Формирую...' : opt.label}
              </button>
            ))}
          </div>
          {generated && <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:'10px 0 0' }}>Сформирован: {generated.toLocaleString('ru')}</p>}
        </div>

        {!report && !loading && (
          <div style={{ ...card, textAlign:'center', padding:'48px' }}>
            <p style={{ fontSize:'36px', marginBottom:'12px' }}>📊</p>
            <p style={{ fontSize:'15px', fontWeight:500, color:'var(--text-primary)', marginBottom:'6px' }}>Выберите период выше</p>
            <p style={{ fontSize:'13px', color:'var(--text-muted)' }}>Отчёт включает активность, задачи и время по разделам</p>
          </div>
        )}

        {report && (
          <>
            {/* Summary */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px' }}>
              {[
                { label:'Сотрудников',   value: report.summary.totalEmployees, color:'var(--text-primary)' },
                { label:'Кликов',         value: report.summary.totalClicks,    color:'var(--accent)' },
                { label:'Задач',          value: report.summary.totalTasks,     color:'var(--blue)' },
                { label:'Выполнено',      value: report.summary.completedTasks, color:'var(--green)' },
              ].map(k => (
                <div key={k.label} style={card}>
                  <p style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 6px' }}>{k.label}</p>
                  <p style={{ fontSize:'24px', fontWeight:600, color:k.color, margin:0 }}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Employees table */}
            <div style={{ ...card, padding:0, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', background:'var(--bg-secondary)' }}>
                <p style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:0 }}>Сотрудники</p>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['Сотрудник','Роль','Кликов','В работе','Выполнено','Топ раздел','Время'].map(h => (
                      <th key={h} style={{ padding:'10px 16px', fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', background:'var(--bg-secondary)', borderBottom:'0.5px solid var(--border)', textAlign: h==='Сотрудник'?'left':'center' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.employees.map((emp: any) => {
                    const top = emp.sectionsFormatted[0];
                    return (
                      <tr key={emp.id} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='var(--bg-secondary)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                        <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <span style={{ color:'white', fontSize:'11px', fontWeight:600 }}>{emp.name.charAt(0)}</span>
                            </div>
                            <div>
                              <p style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)', margin:0 }}>{emp.name}</p>
                              <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:0 }}>{emp.email}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center' }}>
                          <span style={{ fontSize:'11px', padding:'3px 8px', borderRadius:'12px', background:'var(--accent-bg)', color:'var(--accent)' }}>{emp.role}</span>
                        </td>
                        <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', fontWeight:600, color:'var(--accent)' }}>{emp.totalClicks}</td>
                        <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', color:'var(--blue)' }}>{emp.tasks.inProgress}</td>
                        <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', color:'var(--green)' }}>{emp.tasks.done}</td>
                        <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center' }}>
                          {top ? (
                            <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'4px', fontSize:'12px' }}>
                              <span style={{ fontSize:'10px', fontWeight:600, padding:'2px 5px', borderRadius:'4px', background: top.platform==='WILDBERRIES'?'rgba(139,124,246,0.12)':'rgba(77,157,224,0.12)', color: top.platform==='WILDBERRIES'?'#8b7cf6':'#4d9de0' }}>
                                {top.platform==='WILDBERRIES'?'WB':'OZ'}
                              </span>
                              {top.label}
                            </span>
                          ) : <span style={{ color:'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', color:'var(--text-secondary)' }}>
                          {top ? fmtTime(top.timeSeconds) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Sections breakdown */}
            <div style={{ ...card, padding:0, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', background:'var(--bg-secondary)' }}>
                <p style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:0 }}>Активность по разделам</p>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['Сотрудник','Платформа','Раздел','Кликов','Время'].map(h => (
                      <th key={h} style={{ padding:'10px 16px', fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', background:'var(--bg-secondary)', borderBottom:'0.5px solid var(--border)', textAlign: h==='Сотрудник'?'left':'center' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.employees.flatMap((emp: any) =>
                    emp.sectionsFormatted.map((sec: any, i: number) => (
                      <tr key={emp.id+sec.section+i} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='var(--bg-secondary)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                        <td style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)', fontSize:'13px', fontWeight:500, color:'var(--text-primary)' }}>{emp.name}</td>
                        <td style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center' }}>
                          <span style={{ fontSize:'10px', fontWeight:600, padding:'2px 6px', borderRadius:'4px', background: sec.platform==='WILDBERRIES'?'rgba(139,124,246,0.12)':'rgba(77,157,224,0.12)', color: sec.platform==='WILDBERRIES'?'#8b7cf6':'#4d9de0' }}>
                            {sec.platform==='WILDBERRIES'?'Wildberries':'Ozon'}
                          </span>
                        </td>
                        <td style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', color:'var(--text-secondary)' }}>{sec.label}</td>
                        <td style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', fontWeight:600, color:'var(--accent)' }}>{sec.clicks}</td>
                        <td style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', color:'var(--text-secondary)' }}>{fmtTime(sec.timeSeconds)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Tasks */}
            <div style={{ ...card, padding:0, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', background:'var(--bg-secondary)' }}>
                <p style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:0 }}>Задачи</p>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['Название','Статус','Приоритет','Исполнитель','Дедлайн'].map(h => (
                      <th key={h} style={{ padding:'10px 16px', fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', background:'var(--bg-secondary)', borderBottom:'0.5px solid var(--border)', textAlign:'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.tasks.map((t: any) => {
                    const STATUS_STYLE: Record<string, {bg:string;color:string;label:string}> = {
                      NEW:{bg:'var(--bg-secondary)',color:'var(--text-muted)',label:'Новая'},
                      IN_PROGRESS:{bg:'var(--blue-bg)',color:'var(--blue)',label:'В работе'},
                      REVIEW:{bg:'var(--orange-bg)',color:'var(--orange)',label:'Проверка'},
                      DONE:{bg:'var(--green-bg)',color:'var(--green)',label:'Готово'},
                      BLOCKED:{bg:'var(--red-bg)',color:'var(--red)',label:'Заблок.'},
                    };
                    const PRIO_STYLE: Record<string, {bg:string;color:string;label:string}> = {
                      LOW:{bg:'var(--bg-secondary)',color:'var(--text-muted)',label:'Низкий'},
                      MEDIUM:{bg:'var(--blue-bg)',color:'var(--blue)',label:'Средний'},
                      HIGH:{bg:'var(--orange-bg)',color:'var(--orange)',label:'Высокий'},
                      CRITICAL:{bg:'var(--red-bg)',color:'var(--red)',label:'Критич.'},
                    };
                    const ss = STATUS_STYLE[t.status] ?? STATUS_STYLE.NEW;
                    const ps = PRIO_STYLE[t.priority] ?? PRIO_STYLE.MEDIUM;
                    return (
                      <tr key={t.id} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='var(--bg-secondary)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                        <td style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)', fontSize:'13px', color:'var(--text-primary)' }}>{t.title}</td>
                        <td style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)' }}>
                          <span style={{ fontSize:'11px', fontWeight:500, padding:'3px 8px', borderRadius:'12px', background:ss.bg, color:ss.color }}>{ss.label}</span>
                        </td>
                        <td style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)' }}>
                          <span style={{ fontSize:'11px', fontWeight:500, padding:'3px 8px', borderRadius:'12px', background:ps.bg, color:ps.color }}>{ps.label}</span>
                        </td>
                        <td style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)', fontSize:'13px', color:'var(--text-secondary)' }}>{t.assigneeName}</td>
                        <td style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)', fontSize:'13px', color: t.dueDate && new Date(t.dueDate)<new Date() ? 'var(--red)' : 'var(--text-secondary)' }}>
                          {t.dueDate ? new Date(t.dueDate).toLocaleDateString('ru') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
`);

// Add Reports to Sidebar
let sidebar = fs.readFileSync('components/layouts/Sidebar.tsx', 'utf8');
if (!sidebar.includes('reports')) {
  sidebar = sidebar.replace(
    `  { href: '/dashboard/export',       icon: '↓',  label: 'Экспорт',        admin: true  },`,
    `  { href: '/dashboard/reports',      icon: '📋', label: 'Отчёты',         admin: true  },
  { href: '/dashboard/export',       icon: '↓',  label: 'Экспорт',        admin: true  },`
  );
  fs.writeFileSync('components/layouts/Sidebar.tsx', sidebar);
  console.log('✓ sidebar updated');
}

console.log('\n✅ Reports page created');
