'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const WB_SECTIONS: Record<string, string> = {
  // Товары
  products:'Товары', brands:'Бренды', content:'Контент', abtest:'A/B тест карточки',
  recommendations:'Рекомендации', substitution:'Подмена артикула',
  // Цены
  prices:'Цены и скидки', cashback:'Кэшбэк', promotions:'Акции',
  // Отзывы
  feedbacks:'Отзывы', questions:'Вопросы', claims:'Претензии покупателей', chat:'Чат с покупателями',
  // Склад
  supplies:'Поставки', stocks:'Остатки', orders:'Заказы (FBS)', returns:'Возвраты', logistics:'Логистика',
  // Аналитика
  analytics:'Аналитика', content_analytics:'Аналитика контента',
  search_analytics:'Поисковая аналитика', platform_analytics:'Аналитика платформы',
  // Финансы
  finance:'Финансы', income:'Доходы и расходы', calculator:'Калькулятор прибыли',
  // Реклама
  advertising:'Реклама',
  // Прочее
  tariffs:'Тарифы', levels:'Уровни продавца', showcase:'Витрина продавца',
  monetization:'Монетизация данных', support:'Поддержка', knowledge:'База знаний', other:'Прочее',
};
const OZON_SECTIONS: Record<string, string> = {
  // Товары
  products:'Товары', certificates:'Сертификаты', merge:'Объединение товаров',
  // Заказы
  orders_fbo:'Заказы FBO', orders_fbs:'Заказы FBS', returns:'Возвраты',
  // Склад
  stocks:'Остатки', warehouse:'Склад', supplies:'Поставки', logistics:'Логистика',
  // Цены
  prices:'Цены', highlights:'Акции и хайлайты',
  // Отзывы
  reviews:'Отзывы', questions:'Вопросы', complaints:'Жалобы',
  // Аналитика
  analytics:'Аналитика', analytics_search:'Поисковая аналитика',
  // Финансы
  finance:'Финансы',
  // Продвижение
  promotion:'Продвижение',
  // Прочее
  rating:'Рейтинг', chat:'Чат', dashboard:'Дашборд', other:'Прочее',
};
const ACTION_LABELS: Record<string, string> = {
  // WB Заказы
  wb_order_accept:'Принял заказ', wb_order_cancel:'Отменил заказ',
  wb_order_filter:'Фильтр заказов', wb_order_export:'Экспорт заказов',
  // WB Отзывы/Вопросы
  wb_review_reply:'Ответил на отзыв', wb_review_complain:'Жалоба на отзыв',
  wb_question_reply:'Ответил на вопрос',
  // WB Товары
  wb_product_create:'Создал товар', wb_product_edit:'Редактировал товар',
  wb_product_delete:'Удалил товар', wb_product_upload:'Загрузил файл',
  // WB Цены
  wb_price_save:'Сохранил цены', wb_price_edit:'Изменил цену', wb_price_upload:'Загрузил файл',
  // WB Остатки/Поставки
  wb_stock_update:'Обновил остатки', wb_stock_upload:'Загрузил остатки',
  wb_supply_create:'Создал поставку', wb_supply_confirm:'Подтвердил поставку', wb_supply_print:'Напечатал этикетки',
  // WB Реклама
  wb_ads_create:'Создал кампанию', wb_ads_pause:'Приостановил рекламу',
  wb_ads_start:'Запустил рекламу', wb_ads_budget:'Изменил бюджет', wb_ads_filter:'Фильтр рекламы',
  // WB Прочее
  wb_chat_send:'Отправил сообщение', wb_promo_join:'Вступил в акцию',
  wb_analytics_export:'Экспорт отчёта', wb_analytics_filter:'Применил фильтр',
  wb_finance_export:'Скачал документ',
  // Ozon Заказы
  ozon_order_accept:'Принял заказ', ozon_order_cancel:'Отменил заказ',
  ozon_order_export:'Экспорт заказов', ozon_order_label:'Напечатал этикетку',
  ozon_fbo_filter:'Фильтр FBO', ozon_fbo_export:'Экспорт FBO',
  ozon_fbs_filter:'Фильтр FBS', ozon_fbs_export:'Экспорт FBS',
  // Ozon Товары
  ozon_product_create:'Создал товар', ozon_product_edit:'Редактировал товар',
  ozon_product_upload:'Загрузил файл',
  // Ozon Цены/Остатки
  ozon_price_save:'Сохранил цены', ozon_price_edit:'Изменил цену', ozon_price_upload:'Загрузил файл',
  ozon_stock_update:'Обновил остатки', ozon_stock_upload:'Загрузил файл',
  // Ozon Поставки
  ozon_supply_create:'Создал поставку', ozon_supply_confirm:'Подтвердил поставку',
  // Ozon Отзывы/Вопросы
  ozon_review_reply:'Ответил на отзыв', ozon_review_complain:'Жалоба на отзыв',
  ozon_question_reply:'Ответил на вопрос',
  // Ozon Аналитика/Финансы/Реклама
  ozon_analytics_export:'Экспорт', ozon_analytics_filter:'Применил фильтр',
  ozon_finance_export:'Скачал документ',
  ozon_ads_create:'Создал кампанию', ozon_ads_pause:'Приостановил', ozon_ads_budget:'Изменил бюджет',
  ozon_chat_send:'Отправил сообщение', ozon_promo_join:'Вступил в акцию',
};

const PLATFORM_COLOR: Record<string, string> = { WILDBERRIES:'#a78bfa', OZON:'#4d9de0' };
const tooltipStyle = { background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'8px', fontSize:'12px' };

export default function SectionAnalyticsPage() {
  const router = useRouter();
  const [token, setToken]     = useState('');
  const [events, setEvents]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState('7');
  const [platform, setPlatform] = useState<'ALL'|'WILDBERRIES'|'OZON'>('ALL');
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [selectedSection, setSelectedSection] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    fetch('https://employee-tracker.ru/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : []));
    load(t, '7', 'ALL', '');
  }, []);

  const load = async (t: string, days: string, plat: string, empId: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days, limit: '500' });
      if (plat !== 'ALL') params.set('platform', plat);
      if (empId) params.set('userId', empId);
      const res = await fetch('https://employee-tracker.ru/api/v1/analytics/activity/summary?' + params, {
        headers: { Authorization: 'Bearer ' + t },
      });
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  };

  // Build section stats from events
  const buildSectionStats = () => {
    const stats: Record<string, { section: string; label: string; platform: string; events: number; timeSeconds: number; actions: Record<string, number> }> = {};
    
    events.forEach((emp: any) => {
      if (!emp.sections) return;
      Object.entries(emp.sections as Record<string, any>).forEach(([key, val]: [string, any]) => {
        const [plat, section] = key.split(':');
        if (platform !== 'ALL' && plat !== platform) return;
        if (selectedSection && section !== selectedSection) return;
        const id = plat + ':' + section;
        if (!stats[id]) {
          const label = plat === 'WILDBERRIES' ? (WB_SECTIONS[section] ?? section) : (OZON_SECTIONS[section] ?? section);
          stats[id] = { section, label, platform: plat, events: 0, timeSeconds: 0, actions: {} };
        }
        stats[id].events += val.events ?? 0;
        stats[id].timeSeconds += val.timeSeconds ?? 0;
        if (val.actions) {
          Object.entries(val.actions as Record<string, number>).forEach(([action, count]) => {
            stats[id].actions[action] = (stats[id].actions[action] ?? 0) + count;
          });
        }
      });
    });
    return Object.values(stats).sort((a, b) => b.events - a.events);
  };

  // Build employee section breakdown
  const buildEmployeeStats = () => {
    return events.map((emp: any) => {
      let totalEvents = 0;
      let topSection = '';
      let topEvents = 0;
      if (emp.sections) {
        Object.entries(emp.sections as Record<string, any>).forEach(([key, val]: [string, any]) => {
          const [, section] = key.split(':');
          const ev = (val as any).events ?? 0;
          totalEvents += ev;
          if (ev > topEvents) { topEvents = ev; topSection = section; }
        });
      }
      return { ...emp, totalEvents, topSection };
    }).sort((a: any, b: any) => b.totalEvents - a.totalEvents);
  };

  const sectionStats = buildSectionStats();
  const employeeStats = buildEmployeeStats();
  const maxEvents = Math.max(...sectionStats.map(s => s.events), 1);

  const fmtTime = (sec: number) => {
    if (!sec || sec <= 0) return null;
    if (sec < 60) return sec + 'с';
    if (sec < 3600) return Math.floor(sec/60) + 'м ' + (sec%60) + 'с';
    return Math.floor(sec/3600) + 'ч ' + Math.floor((sec%3600)/60) + 'м';
  };

  const totalTime = sectionStats.reduce((s, sec) => s + sec.timeSeconds, 0);

  // Deduplicate sections by label
  const allSectionsRaw = platform === 'OZON' ? OZON_SECTIONS : platform === 'WILDBERRIES' ? WB_SECTIONS : { ...WB_SECTIONS, ...OZON_SECTIONS };
  const seen = new Set<string>();
  const allSections: Record<string, string> = {};
  Object.entries(allSectionsRaw).forEach(([k, v]) => {
    if (!seen.has(v as string)) { seen.add(v as string); allSections[k] = v as string; }
  });

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-tertiary)' }}>
      {/* Header */}
      <div style={{ background:'var(--bg-primary)', borderBottom:'0.5px solid var(--border)', padding:'14px 24px', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <button onClick={() => router.push('/dashboard/analytics')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'13px', color:'var(--text-muted)', padding:'4px 8px', borderRadius:'6px' }}>← Назад</button>
            <h1 style={{ fontSize:'16px', fontWeight:600, color:'var(--text-primary)', margin:0 }}>Активность по разделам</h1>
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {/* Period */}
          <div style={{ display:'flex', gap:'3px', background:'var(--bg-secondary)', borderRadius:'8px', padding:'3px' }}>
            {[{l:'Сегодня',v:'1'},{l:'7 дней',v:'7'},{l:'14 дней',v:'14'},{l:'30 дней',v:'30'}].map(opt => (
              <button key={opt.v} onClick={() => { setPeriod(opt.v); load(token, opt.v, platform, selectedEmp); }}
                style={{ padding:'4px 10px', borderRadius:'6px', fontSize:'12px', border:'none', cursor:'pointer', background: period===opt.v ? 'var(--bg-primary)' : 'transparent', color: period===opt.v ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: period===opt.v ? 500 : 400 }}>
                {opt.l}
              </button>
            ))}
          </div>
          {/* Platform */}
          <div style={{ display:'flex', gap:'3px', background:'var(--bg-secondary)', borderRadius:'8px', padding:'3px' }}>
            {[{l:'Все',v:'ALL'},{l:'Wildberries',v:'WILDBERRIES'},{l:'Ozon',v:'OZON'}].map(opt => (
              <button key={opt.v} onClick={() => { setPlatform(opt.v as any); load(token, period, opt.v, selectedEmp); }}
                style={{ padding:'4px 10px', borderRadius:'6px', fontSize:'12px', border:'none', cursor:'pointer', background: platform===opt.v ? 'var(--bg-primary)' : 'transparent', color: platform===opt.v ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: platform===opt.v ? 500 : 400 }}>
                {opt.l}
              </button>
            ))}
          </div>
          {/* Employee */}
          <select value={selectedEmp} onChange={e => { setSelectedEmp(e.target.value); load(token, period, platform, e.target.value); }}
            style={{ background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'8px', padding:'6px 10px', fontSize:'12px', color:'var(--text-primary)', outline:'none' }}>
            <option value="">Все сотрудники</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          {/* Section */}
          <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
            style={{ background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'8px', padding:'6px 10px', fontSize:'12px', color:'var(--text-primary)', outline:'none' }}>
            <option value="">Все разделы</option>
            {Object.entries(allSections).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'var(--text-muted)', fontSize:'13px' }}>Загрузка...</div>
      ) : (
        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'16px' }}>

          {sectionStats.length === 0 ? (
            <div style={{ background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'48px', textAlign:'center' }}>
              <p style={{ fontSize:'36px', marginBottom:'12px' }}>📊</p>
              <p style={{ fontSize:'15px', fontWeight:500, color:'var(--text-primary)', marginBottom:'6px' }}>Нет данных по разделам</p>
              <p style={{ fontSize:'13px', color:'var(--text-muted)' }}>Переустановите расширение и откройте WB или Ozon</p>
            </div>
          ) : (
            <>
              {/* Time summary cards */}
              {totalTime > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'10px' }}>
                  {sectionStats.filter(s => s.timeSeconds > 0).slice(0,6).map(s => {
                    const color = PLATFORM_COLOR[s.platform] ?? '#a78bfa';
                    const pct = Math.round(s.timeSeconds / totalTime * 100);
                    return (
                      <div key={s.platform+':'+s.section} style={{ background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px' }}>
                          <span style={{ fontSize:'10px', fontWeight:600, padding:'2px 6px', borderRadius:'4px', background: s.platform==='WILDBERRIES' ? 'rgba(167,139,250,0.15)' : 'rgba(77,157,224,0.15)', color, flexShrink:0 }}>
                            {s.platform === 'WILDBERRIES' ? 'WB' : 'OZ'}
                          </span>
                          <span style={{ fontSize:'12px', fontWeight:500, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.label}</span>
                        </div>
                        <p style={{ fontSize:'22px', fontWeight:600, color, margin:'0 0 4px' }}>{fmtTime(s.timeSeconds)}</p>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--text-muted)' }}>
                          <span>{s.events} кликов</span>
                          <span>{pct}% времени</span>
                        </div>
                        <div style={{ height:'3px', background:'var(--bg-secondary)', borderRadius:'2px', overflow:'hidden', marginTop:'8px' }}>
                          <div style={{ height:'3px', width:pct+'%', background:color, borderRadius:'2px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Section bars */}
              <div style={{ background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'18px' }}>
                <p style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)', margin:'0 0 16px' }}>Активность по разделам</p>
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {sectionStats.slice(0, 12).map(s => {
                    const pct = Math.round(s.events / maxEvents * 100);
                    const color = PLATFORM_COLOR[s.platform] ?? '#a78bfa';
                    return (
                      <div key={s.platform+':'+s.section}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <span style={{ fontSize:'10px', fontWeight:600, padding:'2px 6px', borderRadius:'4px', background: s.platform==='WILDBERRIES' ? 'rgba(167,139,250,0.15)' : 'rgba(77,157,224,0.15)', color }}>
                              {s.platform === 'WILDBERRIES' ? 'WB' : 'OZ'}
                            </span>
                            <span style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)' }}>{s.label}</span>
                          </div>
                          <div style={{ display:'flex', gap:'12px', fontSize:'12px', alignItems:'center' }}>
                            <span style={{ color }}>{s.events} кликов</span>
                            {fmtTime(s.timeSeconds) && (
                              <span style={{ display:'flex', alignItems:'center', gap:'4px', color:'var(--text-muted)', background:'var(--bg-secondary)', padding:'2px 8px', borderRadius:'10px' }}>
                                ⏱ {fmtTime(s.timeSeconds)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ height:'6px', background:'var(--bg-secondary)', borderRadius:'3px', overflow:'hidden' }}>
                          <div style={{ height:'6px', width: pct+'%', background: color, borderRadius:'3px', transition:'width 0.5s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions breakdown */}
              {sectionStats.some(s => Object.keys(s.actions).length > 0) && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  {sectionStats.filter(s => Object.keys(s.actions).length > 0).slice(0,4).map(s => {
                    const color = PLATFORM_COLOR[s.platform] ?? '#a78bfa';
                    const actions = Object.entries(s.actions).filter(([k]) => !k.includes('ping') && !k.includes('section_enter') && !k.includes('section_leave')).sort(([,a],[,b]) => (b as number)-(a as number)).slice(0,6);
                    return (
                      <div key={s.platform+':'+s.section} style={{ background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
                          <span style={{ fontSize:'10px', fontWeight:600, padding:'2px 6px', borderRadius:'4px', background: s.platform==='WILDBERRIES' ? 'rgba(167,139,250,0.15)' : 'rgba(77,157,224,0.15)', color }}>
                            {s.platform === 'WILDBERRIES' ? 'WB' : 'OZ'}
                          </span>
                          <p style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)', margin:0 }}>{s.label}</p>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                          {actions.map(([action, count]) => (
                            <div key={action} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span style={{ fontSize:'12px', color:'var(--text-secondary)' }}>{ACTION_LABELS[action] ?? (action.includes('filter') ? 'Применил фильтр' : action.includes('search') ? 'Поиск' : action.replace(/^(wb_|ozon_)/, '').replace(/_/g, ' '))}</span>
                              <span style={{ fontSize:'12px', fontWeight:600, color, background: s.platform==='WILDBERRIES' ? 'rgba(167,139,250,0.1)' : 'rgba(77,157,224,0.1)', padding:'2px 8px', borderRadius:'10px' }}>{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Employee table */}
              <div style={{ background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', background:'var(--bg-secondary)' }}>
                  <p style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:0 }}>По сотрудникам</p>
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      {['Сотрудник','Топ-раздел','Событий','Разделов','Время'].map(h => (
                        <th key={h} style={{ padding:'10px 16px', fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', background:'var(--bg-secondary)', borderBottom:'0.5px solid var(--border)', textAlign: h==='Сотрудник' ? 'left' : 'center' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employeeStats.map((emp: any) => {
                      const topLabel = WB_SECTIONS[emp.topSection] ?? OZON_SECTIONS[emp.topSection] ?? emp.topSection;
                      const sectionCount = emp.sections ? Object.keys(emp.sections).length : 0;
                      const totalTime = emp.sections ? Object.values(emp.sections as any).reduce((s: number, v: any) => s + (v.timeSeconds ?? 0), 0) : 0;
                      return (
                        <tr key={emp.userId}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='var(--bg-secondary)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                          <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                              <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <span style={{ color:'white', fontSize:'11px', fontWeight:600 }}>{emp.name?.charAt(0)}</span>
                              </div>
                              <span style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)' }}>{emp.name}</span>
                            </div>
                          </td>
                          <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center' }}>
                            {topLabel ? <span style={{ fontSize:'12px', padding:'3px 8px', borderRadius:'12px', background:'var(--accent-bg)', color:'var(--accent)' }}>{topLabel}</span> : <span style={{ color:'var(--text-muted)', fontSize:'12px' }}>—</span>}
                          </td>
                          <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', fontWeight:500, color:'var(--accent)' }}>{emp.totalEvents}</td>
                          <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', color:'var(--text-secondary)' }}>{sectionCount}</td>
                          <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', fontWeight: totalTime > 0 ? 500 : 400, color: totalTime > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {totalTime > 0 ? (
                            <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'4px' }}>
                              ⏱ {fmtTime(totalTime as number)}
                            </span>
                          ) : '—'}
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
      )}
    </div>
  );
}
