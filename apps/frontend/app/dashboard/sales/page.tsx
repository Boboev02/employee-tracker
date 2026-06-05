'use client';
import { useState, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import * as XLSX from 'xlsx';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const fmtH = (h: number) => String(h).padStart(2, '0') + ':00';
const fmtNum = (n: number) => n.toLocaleString('ru');
const fmtMoney = (n: number) => fmtNum(Math.round(n)) + '₽';

interface Order { sku:string; name:string; brand:string; date:Date; hour:number; price:number; status:string; }

function parseWBExcel(data: ArrayBuffer): Order[] {
  const wb = XLSX.read(data, { type:'array', cellDates:true });
  const sheetName = wb.SheetNames.find(n => n.includes('Активн')||n.includes('Все')||n.includes('заказ')) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any>(ws, { header:1, defval:null });
  let headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i]?.some((c: any) => typeof c==='string' && c.includes('Артикул'))) { headerRow=i; break; }
  }
  if (headerRow===-1) return [];
  const headers: string[] = rows[headerRow];
  const col = (name: string) => headers.findIndex(h => typeof h==='string' && h.includes(name));
  const skuCol=col('Артикул продавца'), nameCol=col('Название'), brandCol=col('Бренд'),
        dateCol=col('Дата оформления'), priceCol=col('Стоимость'), statusCol=col('Статус заказа');
  const orders: Order[] = [];
  for (let i = headerRow+1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[skuCol]) continue;
    let date: Date|null = null;
    const rd = row[dateCol];
    if (rd instanceof Date) date=rd;
    else if (typeof rd==='string' && rd.length>8) date=new Date(rd);
    if (!date || isNaN(date.getTime())) continue;
    orders.push({ sku:String(row[skuCol]??''), name:String(row[nameCol]??''), brand:String(row[brandCol]??''),
      date, hour:date.getHours(), price:Number(row[priceCol]??0), status:String(row[statusCol]??'') });
  }
  return orders;
}

function FileDropZone({ label, color, onLoad }: { label:string; color:string; onLoad:(o:Order[],n:string)=>void }) {
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState('');
  const handle = useCallback((file: File) => {
    setLoading(true); setFilename(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      try { onLoad(parseWBExcel(e.target!.result as ArrayBuffer), file.name); }
      catch { onLoad([], file.name); }
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  }, [onLoad]);
  return (
    <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)handle(f);}}
      style={{border:`2px dashed ${drag?color:'#EDE9FE'}`,borderRadius:'16px',padding:'20px',textAlign:'center',background:drag?color+'10':'#F8F7FF',cursor:'pointer'}}
      onClick={()=>{const i=document.createElement('input');i.type='file';i.accept='.xlsx,.xls';i.onchange=()=>{if(i.files?.[0])handle(i.files[0]);};i.click();}}>
      {loading ? <p style={{color:'#9B97CC',fontSize:'13px',margin:0}}>Загружаю...</p>
        : filename ? <div><p style={{fontSize:'12px',fontWeight:700,color,margin:'0 0 2px'}}>✓ {filename}</p><p style={{fontSize:'11px',color:'#9B97CC',margin:0}}>Нажмите для замены</p></div>
        : <div><i className="ti ti-file-spreadsheet" style={{fontSize:'26px',color,display:'block',marginBottom:'6px'}} aria-hidden="true"/><p style={{fontSize:'13px',fontWeight:700,color:'#1a1040',margin:'0 0 3px'}}>{label}</p><p style={{fontSize:'11px',color:'#9B97CC',margin:0}}>xlsx файл WB</p></div>}
    </div>
  );
}

function KpiCard({label,val,sub,accent,bg,icon,alert}:{label:string;val:string|number;sub?:string;accent:string;bg:string;icon:string;alert?:boolean}) {
  return (
    <div style={{background:'white',borderRadius:'16px',padding:'14px 16px',boxShadow:'0 4px 16px rgba(127,119,221,0.08)',border:alert?'1.5px solid #FCA5A5':'none',position:'relative'}}>
      {alert&&<div style={{position:'absolute',top:'8px',right:'8px',width:'8px',height:'8px',borderRadius:'50%',background:'#EF4444'}}/>}
      <div style={{width:'32px',height:'32px',borderRadius:'10px',background:bg,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'8px'}}>
        <i className={'ti '+icon} style={{fontSize:'16px',color:accent}} aria-hidden="true"/>
      </div>
      <p style={{fontSize:'10px',color:'#9B97CC',margin:'0 0 2px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px'}}>{label}</p>
      <p style={{fontSize:'22px',fontWeight:800,color:'#1a1040',margin:0,letterSpacing:'-0.5px'}}>{val}</p>
      {sub&&<p style={{fontSize:'11px',color:accent,margin:'2px 0 0',fontWeight:600}}>{sub}</p>}
    </div>
  );
}

export default function SalesComparisonPage() {
  const [ordersA, setOrdersA] = useState<Order[]>([]);
  const [ordersB, setOrdersB] = useState<Order[]>([]);
  const [labelA, setLabelA] = useState('Сегодня');
  const [labelB, setLabelB] = useState('Вчера');
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [filterHourFrom, setFilterHourFrom] = useState(0);
  const [filterHourTo, setFilterHourTo] = useState(23);
  const [tab, setTab] = useState<'dashboard'|'hours'|'skus'|'days'>('dashboard');

  const allSkus = useMemo(() => Array.from(new Set([...ordersA,...ordersB].map(o=>o.sku))).sort(), [ordersA,ordersB]);
  const hasFiles = ordersA.length>0 || ordersB.length>0;

  const applyFilters = (orders: Order[]) => orders.filter(o =>
    (selectedSkus.length===0 || selectedSkus.includes(o.sku)) &&
    o.hour>=filterHourFrom && o.hour<=filterHourTo
  );
  const filteredA = useMemo(()=>applyFilters(ordersA),[ordersA,selectedSkus,filterHourFrom,filterHourTo]);
  const filteredB = useMemo(()=>applyFilters(ordersB),[ordersB,selectedSkus,filterHourFrom,filterHourTo]);

  const skuStats = useMemo(()=>{
    const map: Record<string,{sku:string;name:string;cntA:number;cntB:number;sumA:number;sumB:number}> = {};
    [...ordersA,...ordersB].forEach(o=>{ if(!map[o.sku])map[o.sku]={sku:o.sku,name:o.name,cntA:0,cntB:0,sumA:0,sumB:0}; });
    filteredA.forEach(o=>{map[o.sku].cntA++;map[o.sku].sumA+=o.price;});
    filteredB.forEach(o=>{map[o.sku].cntB++;map[o.sku].sumB+=o.price;});
    return Object.values(map).map(s=>({...s,diff:s.cntA-s.cntB,diffPct:s.cntB>0?Math.round((s.cntA-s.cntB)/s.cntB*100):(s.cntA>0?100:0)}));
  },[filteredA,filteredB,ordersA,ordersB]);

  const top5 = useMemo(()=>[...skuStats].sort((a,b)=>b.cntA-a.cntA).slice(0,5),[skuStats]);
  const topGrowth = useMemo(()=>[...skuStats].filter(s=>s.diff>0).sort((a,b)=>b.diffPct-a.diffPct).slice(0,5),[skuStats]);
  const topDrop = useMemo(()=>[...skuStats].filter(s=>s.diff<0).sort((a,b)=>a.diffPct-b.diffPct).slice(0,5),[skuStats]);

  const hourlyData = useMemo(()=>HOURS.map(h=>({hour:fmtH(h),[labelA]:filteredA.filter(o=>o.hour===h).length,[labelB]:filteredB.filter(o=>o.hour===h).length})),[filteredA,filteredB,labelA,labelB]);
  const skuTableData = useMemo(()=>[...skuStats].sort((a,b)=>b.cntA-a.cntA),[skuStats]);

  const daysMap: Record<string,{a:number;b:number}> = {};
  [...filteredA.map(o=>({d:o.date.toISOString().slice(0,10),s:'a'})),...filteredB.map(o=>({d:o.date.toISOString().slice(0,10),s:'b'}))].forEach(({d,s})=>{
    if(!daysMap[d])daysMap[d]={a:0,b:0};
    daysMap[d][s as 'a'|'b']++;
  });
  const dayData = Object.entries(daysMap).sort(([a],[b])=>a.localeCompare(b)).map(([date,v])=>({date:date.slice(5),[labelA]:v.a,[labelB]:v.b}));

  const totalA=filteredA.length, totalB=filteredB.length;
  const totalDiff=totalA-totalB, totalDiffPct=totalB>0?Math.round(totalDiff/totalB*100):0;
  const sumA=filteredA.reduce((s,o)=>s+o.price,0), sumB=filteredB.reduce((s,o)=>s+o.price,0);

  const card: React.CSSProperties = {background:'white',borderRadius:'20px',padding:'20px',boxShadow:'0 4px 16px rgba(127,119,221,0.08)'};
  const tabBtn = (id: typeof tab, lbl: string) => (
    <button onClick={()=>setTab(id)} style={{padding:'7px 16px',borderRadius:'20px',fontSize:'12px',fontWeight:tab===id?700:500,border:'none',cursor:'pointer',background:tab===id?'linear-gradient(135deg,#7F77DD,#5248C5)':'transparent',color:tab===id?'white':'#9B97CC',transition:'all 0.2s'}}>{lbl}</button>
  );

  return (
    <div style={{minHeight:'100vh',background:'#ECEAF8'}}>
      <div style={{background:'white',padding:'14px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:10,boxShadow:'0 4px 16px rgba(127,119,221,0.06)'}}>
        <div>
          <h1 style={{fontSize:'18px',fontWeight:800,color:'#1a1040',margin:0}}>Сравнение продаж WB</h1>
          <p style={{fontSize:'11px',color:'#9B97CC',margin:'2px 0 0'}}>Лента заказов — аналитика и сравнение периодов</p>
        </div>
        {hasFiles && (
          <div style={{display:'flex',gap:'4px',background:'#F8F7FF',borderRadius:'20px',padding:'3px'}}>
            {tabBtn('dashboard','🎯 Дашборд')}
            {tabBtn('hours','📊 По часам')}
            {tabBtn('skus','📦 Артикулы')}
            {tabBtn('days','📅 По дням')}
          </div>
        )}
      </div>

      <div style={{padding:'20px 28px',display:'flex',flexDirection:'column',gap:'16px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
          <div>
            <label style={{fontSize:'11px',fontWeight:700,color:'#7F77DD',display:'block',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.4px'}}>Период A — Сегодня</label>
            <FileDropZone label="Загрузить файл A" color="#7F77DD" onLoad={(o,n)=>{setOrdersA(o);setLabelA(n.slice(0,15));setSelectedSkus([]);setTab('dashboard');}}/>
          </div>
          <div>
            <label style={{fontSize:'11px',fontWeight:700,color:'#2563EB',display:'block',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.4px'}}>Период B — Вчера</label>
            <FileDropZone label="Загрузить файл B" color="#2563EB" onLoad={(o,n)=>{setOrdersB(o);setLabelB(n.slice(0,15));}}/>
          </div>
        </div>

        {hasFiles && (
          <>
            <div style={{...card,display:'flex',gap:'16px',alignItems:'flex-start',flexWrap:'wrap'}}>
              <div style={{flex:2,minWidth:'280px'}}>
                <label style={{fontSize:'10px',color:'#9B97CC',display:'block',marginBottom:'6px',fontWeight:600,textTransform:'uppercase'}}>
                  Артикулы ({selectedSkus.length===0?'все':selectedSkus.length+' выбрано'})
                </label>
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                  <button onClick={()=>setSelectedSkus([])} style={{padding:'4px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:selectedSkus.length===0?700:400,border:'none',cursor:'pointer',background:selectedSkus.length===0?'#7F77DD':'#F8F7FF',color:selectedSkus.length===0?'white':'#6B7280'}}>Все</button>
                  {allSkus.map(sku=>{
                    const sel=selectedSkus.includes(sku);
                    return <button key={sku} onClick={()=>setSelectedSkus(prev=>sel?prev.filter(s=>s!==sku):[...prev,sku])} style={{padding:'4px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:sel?700:400,border:'none',cursor:'pointer',background:sel?'#EDE9FE':'#F8F7FF',color:sel?'#7F77DD':'#6B7280'}}>{sku}</button>;
                  })}
                </div>
              </div>
              <div>
                <label style={{fontSize:'10px',color:'#9B97CC',display:'block',marginBottom:'6px',fontWeight:600,textTransform:'uppercase'}}>Часы</label>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <select value={filterHourFrom} onChange={e=>setFilterHourFrom(+e.target.value)} style={{background:'#F8F7FF',border:'1px solid #EDE9FE',borderRadius:'10px',padding:'6px 10px',fontSize:'12px',color:'#1a1040',outline:'none'}}>
                    {HOURS.map(h=><option key={h} value={h}>{fmtH(h)}</option>)}
                  </select>
                  <span style={{color:'#9B97CC'}}>—</span>
                  <select value={filterHourTo} onChange={e=>setFilterHourTo(+e.target.value)} style={{background:'#F8F7FF',border:'1px solid #EDE9FE',borderRadius:'10px',padding:'6px 10px',fontSize:'12px',color:'#1a1040',outline:'none'}}>
                    {HOURS.map(h=><option key={h} value={h}>{fmtH(h)}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {tab==='dashboard' && (
              <>
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'10px'}}>
                  <KpiCard label="Заказов сегодня" val={fmtNum(totalA)} sub={(totalDiff>=0?'+':'')+totalDiff+' vs вчера'} accent="#7F77DD" bg="#EDE9FE" icon="ti-shopping-cart"/>
                  <KpiCard label="Заказов вчера" val={fmtNum(totalB)} accent="#2563EB" bg="#DBEAFE" icon="ti-history"/>
                  <KpiCard label="Динамика" val={(totalDiffPct>=0?'+':'')+totalDiffPct+'%'} accent={totalDiffPct>=0?'#16A34A':'#DC2626'} bg={totalDiffPct>=0?'#DCFCE7':'#FEE2E2'} icon={totalDiffPct>=0?'ti-trending-up':'ti-trending-down'} alert={totalDiffPct<-15}/>
                  <KpiCard label="Сумма сегодня" val={fmtMoney(sumA)} sub={(sumA-sumB>=0?'+':'')+fmtMoney(sumA-sumB)} accent="#D97706" bg="#FEF3C7" icon="ti-currency-ruble"/>
                  <KpiCard label="Артикулов" val={new Set(filteredA.map(o=>o.sku)).size} accent="#6B7280" bg="#F3F4F6" icon="ti-box"/>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>
                  <div style={card}>
                    <p style={{fontSize:'13px',fontWeight:700,color:'#1a1040',margin:'0 0 14px'}}>🏆 ТОП-5 артикулов</p>
                    <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                      {top5.map((s,i)=>(
                        <div key={s.sku} style={{display:'flex',alignItems:'center',gap:'10px'}}>
                          <span style={{width:'20px',height:'20px',borderRadius:'6px',background:i===0?'#FEF3C7':i===1?'#F3F4F6':i===2?'#FEE2E2':'#F8F7FF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:i===0?'#D97706':'#9B97CC',flexShrink:0}}>{i+1}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:'12px',fontWeight:600,color:'#1a1040',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.sku}</p>
                            <div style={{height:'4px',background:'#F3F0FF',borderRadius:'2px',marginTop:'4px'}}><div style={{height:'4px',width:(top5[0].cntA>0?s.cntA/top5[0].cntA*100:0)+'%',background:'#7F77DD',borderRadius:'2px'}}/></div>
                          </div>
                          <span style={{fontSize:'14px',fontWeight:800,color:'#7F77DD',flexShrink:0}}>{s.cntA}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={card}>
                    <p style={{fontSize:'13px',fontWeight:700,color:'#1a1040',margin:'0 0 14px'}}>📈 Наибольший рост</p>
                    {topGrowth.length===0 ? <p style={{fontSize:'12px',color:'#9B97CC',textAlign:'center',padding:'16px 0'}}>Нет данных</p>
                      : <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{topGrowth.map(s=>(
                          <div key={s.sku} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px',background:'#F0FDF4',borderRadius:'10px'}}>
                            <div style={{flex:1,minWidth:0}}><p style={{fontSize:'12px',fontWeight:600,color:'#1a1040',margin:0}}>{s.sku}</p><p style={{fontSize:'10px',color:'#9B97CC',margin:0}}>{s.cntB}→{s.cntA} шт</p></div>
                            <span style={{fontSize:'12px',fontWeight:800,color:'#16A34A',background:'#DCFCE7',padding:'2px 8px',borderRadius:'20px',flexShrink:0}}>+{s.diffPct}%</span>
                          </div>))}</div>}
                  </div>
                  <div style={card}>
                    <p style={{fontSize:'13px',fontWeight:700,color:'#1a1040',margin:'0 0 14px'}}>📉 Критичное падение</p>
                    {topDrop.length===0 ? <p style={{fontSize:'12px',color:'#9B97CC',textAlign:'center',padding:'16px 0'}}>Нет данных</p>
                      : <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{topDrop.map(s=>(
                          <div key={s.sku} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px',background:'#FFF5F5',borderRadius:'10px',border:'1px solid #FEE2E2'}}>
                            <div style={{flex:1,minWidth:0}}><p style={{fontSize:'12px',fontWeight:600,color:'#1a1040',margin:0}}>{s.sku}</p><p style={{fontSize:'10px',color:'#9B97CC',margin:0}}>{s.cntB}→{s.cntA} шт</p></div>
                            <span style={{fontSize:'12px',fontWeight:800,color:'#DC2626',background:'#FEE2E2',padding:'2px 8px',borderRadius:'20px',flexShrink:0}}>{s.diffPct}%</span>
                          </div>))}</div>}
                  </div>
                </div>

                <div style={card}>
                  <p style={{fontSize:'13px',fontWeight:700,color:'#1a1040',margin:'0 0 14px'}}>📊 Динамика по часам</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={hourlyData}>
                      <defs>
                        <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7F77DD" stopOpacity={0.3}/><stop offset="95%" stopColor="#7F77DD" stopOpacity={0}/></linearGradient>
                        <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#93C5FD" stopOpacity={0.3}/><stop offset="95%" stopColor="#93C5FD" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F0FF"/>
                      <XAxis dataKey="hour" tick={{fontSize:9,fill:'#9B97CC'}} interval={2}/>
                      <YAxis tick={{fontSize:9,fill:'#9B97CC'}}/>
                      <Tooltip contentStyle={{background:'white',border:'1px solid #EDE9FE',borderRadius:'10px',fontSize:'12px'}}/>
                      <Legend wrapperStyle={{fontSize:'11px'}}/>
                      <Area type="monotone" dataKey={labelA} stroke="#7F77DD" fill="url(#gA)" strokeWidth={2}/>
                      <Area type="monotone" dataKey={labelB} stroke="#93C5FD" fill="url(#gB)" strokeWidth={2}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {(topDrop.some(s=>s.diffPct<-30)||totalDiffPct<-20) && (
                  <div style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:'16px',padding:'14px 18px',display:'flex',gap:'12px'}}>
                    <i className="ti ti-alert-triangle" style={{fontSize:'20px',color:'#DC2626',flexShrink:0}} aria-hidden="true"/>
                    <div>
                      <p style={{fontSize:'13px',fontWeight:700,color:'#1a1040',margin:'0 0 4px'}}>Требует внимания</p>
                      {totalDiffPct<-20&&<p style={{fontSize:'12px',color:'#DC2626',margin:'0 0 2px'}}>• Общие продажи упали на {Math.abs(totalDiffPct)}%</p>}
                      {topDrop.filter(s=>s.diffPct<-30).map(s=><p key={s.sku} style={{fontSize:'12px',color:'#DC2626',margin:'0 0 2px'}}>• {s.sku}: падение на {Math.abs(s.diffPct)}% ({s.cntB}→{s.cntA} заказов)</p>)}
                    </div>
                  </div>
                )}
              </>
            )}

            {tab==='hours' && (
              <div style={card}>
                <p style={{fontSize:'14px',fontWeight:700,color:'#1a1040',margin:'0 0 16px'}}>Заказы по часам</p>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={hourlyData} barSize={12}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F0FF"/>
                    <XAxis dataKey="hour" tick={{fontSize:10,fill:'#9B97CC'}}/>
                    <YAxis tick={{fontSize:10,fill:'#9B97CC'}}/>
                    <Tooltip contentStyle={{background:'white',border:'1px solid #EDE9FE',borderRadius:'10px',fontSize:'12px'}}/>
                    <Legend wrapperStyle={{fontSize:'12px'}}/>
                    <Bar dataKey={labelA} fill="#7F77DD" radius={[4,4,0,0]}/>
                    <Bar dataKey={labelB} fill="#93C5FD" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {tab==='skus' && (
              <div style={{...card,padding:0,overflow:'hidden'}}>
                <div style={{padding:'14px 20px',borderBottom:'1px solid #F3F0FF'}}><p style={{fontSize:'14px',fontWeight:700,color:'#1a1040',margin:0}}>Все артикулы</p></div>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr style={{background:'#F8F7FF'}}>
                    {['Артикул','Название','Сегодня','Вчера','Δ шт','Δ %','Сумма A','Сумма B'].map(h=>(
                      <th key={h} style={{padding:'10px 14px',fontSize:'10px',fontWeight:700,color:'#9B97CC',textTransform:'uppercase',textAlign:['Артикул','Название'].includes(h)?'left':'center',borderBottom:'1px solid #F3F0FF'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{skuTableData.map((row,i)=>(
                    <tr key={i} style={{borderBottom:'1px solid #F9F8FF'}} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                      <td style={{padding:'10px 14px',fontSize:'12px',fontWeight:700,color:'#1a1040'}}>{row.sku}</td>
                      <td style={{padding:'10px 14px',fontSize:'11px',color:'#6B7280',maxWidth:'160px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.name}</td>
                      <td style={{padding:'10px 14px',textAlign:'center',fontSize:'14px',fontWeight:700,color:'#7F77DD'}}>{row.cntA}</td>
                      <td style={{padding:'10px 14px',textAlign:'center',fontSize:'14px',fontWeight:700,color:'#2563EB'}}>{row.cntB}</td>
                      <td style={{padding:'10px 14px',textAlign:'center'}}><span style={{fontSize:'12px',fontWeight:700,color:row.diff>0?'#16A34A':row.diff<0?'#DC2626':'#9B97CC',background:row.diff>0?'#DCFCE7':row.diff<0?'#FEE2E2':'#F3F4F6',padding:'2px 8px',borderRadius:'20px'}}>{row.diff>0?'+':''}{row.diff}</span></td>
                      <td style={{padding:'10px 14px',textAlign:'center'}}><span style={{fontSize:'11px',fontWeight:700,color:row.diffPct>0?'#16A34A':row.diffPct<0?'#DC2626':'#9B97CC'}}>{row.diffPct>0?'+':''}{row.diffPct}%</span></td>
                      <td style={{padding:'10px 14px',textAlign:'center',fontSize:'11px',color:'#6B7280'}}>{fmtMoney(row.sumA)}</td>
                      <td style={{padding:'10px 14px',textAlign:'center',fontSize:'11px',color:'#6B7280'}}>{fmtMoney(row.sumB)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            {tab==='days' && (
              <div style={card}>
                <p style={{fontSize:'14px',fontWeight:700,color:'#1a1040',margin:'0 0 16px'}}>Заказы по дням</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dayData} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F0FF"/>
                    <XAxis dataKey="date" tick={{fontSize:11,fill:'#9B97CC'}}/>
                    <YAxis tick={{fontSize:11,fill:'#9B97CC'}}/>
                    <Tooltip contentStyle={{background:'white',border:'1px solid #EDE9FE',borderRadius:'10px',fontSize:'12px'}}/>
                    <Legend wrapperStyle={{fontSize:'12px'}}/>
                    <Bar dataKey={labelA} fill="#7F77DD" radius={[4,4,0,0]}/>
                    <Bar dataKey={labelB} fill="#93C5FD" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {!hasFiles && (
          <div style={{...card,textAlign:'center',padding:'60px'}}>
            <div style={{fontSize:'48px',marginBottom:'16px'}}>📊</div>
            <p style={{fontSize:'16px',fontWeight:700,color:'#1a1040',margin:'0 0 8px'}}>Загрузите файлы для анализа</p>
            <p style={{fontSize:'13px',color:'#9B97CC',margin:0}}>Скачайте Ленту заказов из WB за два дня и сравните продажи</p>
          </div>
        )}
      </div>
    </div>
  );
}
