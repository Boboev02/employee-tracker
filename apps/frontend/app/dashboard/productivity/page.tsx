'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

const GRADE_STYLE: Record<string,{bg:string;c:string;grad:string}> = {
  A: { bg:'#DCFCE7', c:'#16A34A', grad:'linear-gradient(135deg,#16A34A,#15803D)' },
  B: { bg:'#DBEAFE', c:'#2563EB', grad:'linear-gradient(135deg,#2563EB,#1D4ED8)' },
  C: { bg:'#FEF9C3', c:'#CA8A04', grad:'linear-gradient(135deg,#CA8A04,#A16207)' },
  D: { bg:'#FEF3C7', c:'#D97706', grad:'linear-gradient(135deg,#D97706,#B45309)' },
  F: { bg:'#FEE2E2', c:'#DC2626', grad:'linear-gradient(135deg,#DC2626,#B91C1C)' },
};
const AVATAR_COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2'];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0)??0) % AVATAR_COLORS.length];

function ScoreRing({ score, grade }: { score:number; grade:string }) {
  const gs = GRADE_STYLE[grade] ?? GRADE_STYLE['F'];
  const r = 38; const circ = 2*Math.PI*r; const offset = circ-(score/100)*circ;
  return (
    <div style={{ position:'relative', width:'96px', height:'96px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <svg width="96" height="96" style={{ transform:'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r={r} fill="none" stroke="#F3F0FF" strokeWidth="8"/>
        <circle cx="48" cy="48" r={r} fill="none" stroke={gs.c} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:'stroke-dashoffset 0.8s ease' }}/>
      </svg>
      <div style={{ position:'absolute', textAlign:'center' }}>
        <div style={{ fontSize:'22px', fontWeight:800, color:'#1a1040', lineHeight:1, letterSpacing:'-1px' }}>{score}</div>
        <div style={{ fontSize:'13px', fontWeight:700, color:gs.c }}>{grade}</div>
      </div>
    </div>
  );
}

export default function ProductivityPage() {
  const router = useRouter();
  const [token, setToken]   = useState('');
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7');
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t); load(t,'7');
  }, []);

  const load = async (t: string, days: string) => {
    setLoading(true);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/analytics/productivity?days='+days, { headers:{ Authorization:'Bearer '+t } });
      const data = await res.json();
      const arr = Array.isArray(data)?data:[];
      setScores(arr); if (arr.length>0) setSelected(arr[0]);
    } finally { setLoading(false); }
  };

  const radarData = selected ? [
    { factor:'Активность',   value:selected.factors.activity },
    { factor:'Стабильность', value:selected.factors.consistency },
    { factor:'Задачи',       value:selected.factors.tasks },
    { factor:'Фокус',        value:selected.factors.focus },
  ] : [];

  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'18px 20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      <div style={{ background:'white', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>Продуктивность</h1>
          <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>Рейтинг и факторы команды</p>
        </div>
        <div style={{ display:'flex', gap:'3px', background:'#F8F7FF', borderRadius:'20px', padding:'3px' }}>
          {[{l:'7 дней',v:'7'},{l:'14 дней',v:'14'},{l:'30 дней',v:'30'}].map(opt=>(
            <button key={opt.v} onClick={()=>{ setPeriod(opt.v); load(token,opt.v); }}
              style={{ padding:'5px 14px', borderRadius:'16px', fontSize:'11px', fontWeight:period===opt.v?700:500, border:'none', cursor:'pointer', background:period===opt.v?'linear-gradient(135deg,#7F77DD,#5248C5)':'transparent', color:period===opt.v?'white':'#9B97CC', transition:'all 0.2s', boxShadow:period===opt.v?'0 2px 8px rgba(127,119,221,0.3)':'none' }}>
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'#9B97CC', fontSize:'13px' }}>Загрузка...</div>
      ) : (
        <div style={{ padding:'20px 28px', display:'flex', flexDirection:'column', gap:'16px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:'16px' }}>
            {/* Leaderboard */}
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 4px' }}>Рейтинг</p>
              {scores.map((sc,i)=>{
                const gs = GRADE_STYLE[sc.grade]??GRADE_STYLE['F'];
                const isSelected = selected?.userId===sc.userId;
                return (
                  <div key={sc.userId} onClick={()=>setSelected(sc)}
                    style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 14px', borderRadius:'16px', cursor:'pointer', background:isSelected?'white':'#F8F7FF', boxShadow:isSelected?'0 4px 16px rgba(127,119,221,0.12)':'none', transition:'all 0.2s', border:isSelected?'1px solid #EDE9FE':'1px solid transparent' }}>
                    <span style={{ fontSize:'13px', fontWeight:700, color:'#9B97CC', width:'18px', flexShrink:0 }}>{i+1}</span>
                    <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:avatarColor(sc.name), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ color:'white', fontSize:'12px', fontWeight:700 }}>{sc.name?.charAt(0)}</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'13px', fontWeight:600, color:'#1a1040', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sc.name}</p>
                      <p style={{ fontSize:'10px', color:'#9B97CC', margin:0 }}>{sc.details.activeDays}/{sc.details.totalDays} дней</p>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', letterSpacing:'-0.5px', lineHeight:1 }}>{sc.score}</div>
                      <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 7px', borderRadius:'10px', background:gs.bg, color:gs.c }}>{sc.grade}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail panel */}
            {selected && (
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                {/* Profile card */}
                <div style={{ ...card, display:'flex', alignItems:'center', gap:'20px' }}>
                  <ScoreRing score={selected.score} grade={selected.grade}/>
                  <div style={{ flex:1 }}>
                    <h2 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:'0 0 4px', letterSpacing:'-0.5px' }}>{selected.name}</h2>
                    <p style={{ fontSize:'12px', color:'#9B97CC', margin:'0 0 10px' }}>
                      {selected.details.activeDays} из {selected.details.totalDays} дней активен · ~{selected.details.avgEventsPerDay} событий/день
                    </p>
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                      {selected.details.topPlatform!=='—' && (
                        <span style={{ fontSize:'11px', fontWeight:600, padding:'3px 10px', borderRadius:'20px', background:'#EDE9FE', color:'#7F77DD' }}>{selected.details.topPlatform}</span>
                      )}
                      {selected.details.tasksCompleted>0 && (
                        <span style={{ fontSize:'11px', fontWeight:600, padding:'3px 10px', borderRadius:'20px', background:'#DCFCE7', color:'#16A34A' }}>{selected.details.tasksCompleted} задач выполнено</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Factors grid */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  {[
                    { key:'activity',    label:'Активность',   desc:'События vs среднее', icon:'ti-activity' },
                    { key:'consistency', label:'Стабильность', desc:'Регулярность работы', icon:'ti-calendar-check' },
                    { key:'tasks',       label:'Задачи',       desc:'Выполнение задач',    icon:'ti-checkbox' },
                    { key:'focus',       label:'Фокус',        desc:'Продуктивные разделы', icon:'ti-target' },
                  ].map(factor=>{
                    const val = selected.factors[factor.key];
                    const pct = Math.round((val/25)*100);
                    const color = pct>=80?'#16A34A':pct>=60?'#2563EB':pct>=40?'#CA8A04':'#DC2626';
                    const bg    = pct>=80?'#DCFCE7':pct>=60?'#DBEAFE':pct>=40?'#FEF9C3':'#FEE2E2';
                    return (
                      <div key={factor.key} style={card}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <div style={{ width:'32px', height:'32px', borderRadius:'10px', background:bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <i className={'ti '+factor.icon} style={{ fontSize:'16px', color }} aria-hidden="true"/>
                            </div>
                            <div>
                              <p style={{ fontSize:'13px', fontWeight:600, color:'#1a1040', margin:0 }}>{factor.label}</p>
                              <p style={{ fontSize:'10px', color:'#9B97CC', margin:0 }}>{factor.desc}</p>
                            </div>
                          </div>
                          <span style={{ fontSize:'18px', fontWeight:800, color, letterSpacing:'-0.5px' }}>{val}<span style={{ fontSize:'11px', color:'#9B97CC', fontWeight:500 }}>/25</span></span>
                        </div>
                        <div style={{ height:'6px', background:'#F3F0FF', borderRadius:'3px', overflow:'hidden' }}>
                          <div style={{ height:'6px', width:pct+'%', background:color, borderRadius:'3px', transition:'width 0.7s ease' }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Radar */}
                <div style={card}>
                  <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:'0 0 12px' }}>Профиль факторов</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#F3F0FF"/>
                      <PolarAngleAxis dataKey="factor" tick={{ fontSize:11, fill:'#9B97CC' }}/>
                      <Radar dataKey="value" stroke="#7F77DD" fill="#7F77DD" fillOpacity={0.15} strokeWidth={2.5}/>
                      <Tooltip formatter={(v:any)=>[v+' / 25','Балл']} contentStyle={{ background:'white', border:'1px solid #EDE9FE', borderRadius:'12px', fontSize:'12px', boxShadow:'0 4px 16px rgba(127,119,221,0.12)' }}/>
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Grade legend */}
          <div style={card}>
            <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 12px' }}>Шкала оценок</p>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {[{g:'A',r:'85–100',d:'Отличный'},{g:'B',r:'70–84',d:'Хороший'},{g:'C',r:'55–69',d:'Удовл.'},{g:'D',r:'40–54',d:'Внимание'},{g:'F',r:'0–39',d:'Низкий'}].map(g=>{
                const gs = GRADE_STYLE[g.g];
                return (
                  <div key={g.g} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 14px', borderRadius:'12px', background:gs.bg }}>
                    <span style={{ fontSize:'18px', fontWeight:800, color:gs.c }}>{g.g}</span>
                    <div>
                      <p style={{ fontSize:'12px', fontWeight:700, color:gs.c, margin:0 }}>{g.r}</p>
                      <p style={{ fontSize:'10px', color:gs.c, margin:0, opacity:0.7 }}>{g.d}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
