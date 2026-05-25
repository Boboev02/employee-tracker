const fs = require('fs');
const path = require('path');

let c = fs.readFileSync(path.join(process.cwd(), 'app/dashboard/analytics/sections/page.tsx'), 'utf8');

// 1. Update fmtTime to be more readable
c = c.replace(
  `  const fmtTime = (sec: number) => {
    if (sec < 60) return sec + 'с';
    if (sec < 3600) return Math.floor(sec/60) + 'м';
    return Math.floor(sec/3600) + 'ч ' + Math.floor((sec%3600)/60) + 'м';
  };`,
  `  const fmtTime = (sec: number) => {
    if (!sec || sec <= 0) return null;
    if (sec < 60) return sec + 'с';
    if (sec < 3600) return Math.floor(sec/60) + 'м ' + (sec%60) + 'с';
    return Math.floor(sec/3600) + 'ч ' + Math.floor((sec%3600)/60) + 'м';
  };

  const totalTime = sectionStats.reduce((s, sec) => s + sec.timeSeconds, 0);`
);

// 2. Add time summary cards above the bars
c = c.replace(
  `              {/* Section bars */}
              <div style={{ background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'18px' }}>
                <p style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)', margin:'0 0 16px' }}>Активность по разделам</p>`,
  `              {/* Time summary cards */}
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
                <p style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)', margin:'0 0 16px' }}>Активность по разделам</p>`
);

// 3. Show time in section bars
c = c.replace(
  `                          <div style={{ display:'flex', gap:'12px', fontSize:'12px' }}>
                            <span style={{ color }}>{s.events} событий</span>
                            {s.timeSeconds > 0 && <span style={{ color:'var(--text-muted)' }}>{fmtTime(s.timeSeconds)}</span>}
                          </div>`,
  `                          <div style={{ display:'flex', gap:'12px', fontSize:'12px', alignItems:'center' }}>
                            <span style={{ color }}>{s.events} кликов</span>
                            {fmtTime(s.timeSeconds) && (
                              <span style={{ display:'flex', alignItems:'center', gap:'4px', color:'var(--text-muted)', background:'var(--bg-secondary)', padding:'2px 8px', borderRadius:'10px' }}>
                                ⏱ {fmtTime(s.timeSeconds)}
                              </span>
                            )}
                          </div>`
);

// 4. Update employee table to show time properly
c = c.replace(
  `<td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', color:'var(--text-muted)' }}>{totalTime > 0 ? fmtTime(totalTime as number) : '—'}</td>`,
  `<td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', fontWeight: totalTime > 0 ? 500 : 400, color: totalTime > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {totalTime > 0 ? (
                            <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'4px' }}>
                              ⏱ {fmtTime(totalTime as number)}
                            </span>
                          ) : '—'}
                        </td>`
);

fs.writeFileSync(path.join(process.cwd(), 'app/dashboard/analytics/sections/page.tsx'), c);
console.log('✅ Section time display updated');
