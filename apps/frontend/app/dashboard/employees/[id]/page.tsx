'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';

const API = 'https://employee-tracker.ru/api/v1';

const ROLES = ['ADMIN','MANAGER','EMPLOYEE','HR','VIEWER'];
const ROLE_COLORS: Record<string,string> = { ADMIN:'#7F77DD', MANAGER:'#3B82F6', EMPLOYEE:'#10B981', HR:'#F59E0B', VIEWER:'#9B97CC' };
const GENDERS: Record<string,string> = { MALE:'Мужской', FEMALE:'Женский' };

export default function EmployeeProfilePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [token, setToken] = useState('');
  const [user, setUser] = useState<any>(null);
  const [emp, setEmp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const h = (t: string) => ({ 'Content-Type':'application/json', Authorization:'Bearer '+t });

  useEffect(() => {
    const t = localStorage.getItem('access_token') || '';
    if (!t) { router.push('/login'); return; }
    setToken(t);
    try { setUser(JSON.parse(localStorage.getItem('user') || '{}')); } catch {}
    load(t);
  }, [id]);

  const load = async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch(API+'/employees/'+id, { headers: h(t) });
      const data = await res.json();
      setEmp(data);
      setForm({
        name: data.name || '',
        phone: data.phone || '',
        position: data.position || '',
        gender: data.gender || '',
        birthDate: data.birthDate ? data.birthDate.slice(0,10) : '',
        hiredAt: data.hiredAt ? data.hiredAt.slice(0,10) : '',
        role: data.roles?.[0] || 'EMPLOYEE',
      });
    } catch {}
    setLoading(false);
  };

  const isAdmin = user?.roles?.some((r: string) => ['ADMIN','SUPER_ADMIN','OWNER'].includes(r));

  const saveProfile = async () => {
    setSaving(true);
    try {
      await fetch(API+'/employees/'+id+'/profile', {
        method: 'PATCH', headers: h(token),
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          position: form.position,
          gender: form.gender || null,
          birthDate: form.birthDate || null,
          hiredAt: form.hiredAt || null,
        }),
      });
      if (form.role !== emp.roles?.[0]) {
        await fetch(API+'/employees/'+id+'/role', {
          method: 'PATCH', headers: h(token),
          body: JSON.stringify({ role: form.role }),
        });
      }
      setEditing(false);
      load(token);
    } catch {}
    setSaving(false);
  };

  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch(API + '/upload/file', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }, // без Content-Type — браузер сам проставит multipart boundary
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Не удалось загрузить файл (код ' + uploadRes.status + ')');
      const { url } = await uploadRes.json();

      const patchRes = await fetch(API + '/employees/' + id + '/profile', {
        method: 'PATCH', headers: h(token),
        body: JSON.stringify({ avatarUrl: url }),
      });
      if (!patchRes.ok) throw new Error('Не удалось сохранить фото (код ' + patchRes.status + ')');

      await load(token);
    } catch (e: any) {
      setAvatarError(e.message ?? 'Ошибка загрузки фото');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) return <div style={{padding:'40px',textAlign:'center',color:'#9B97CC'}}>Загрузка...</div>;
  if (!emp) return <div style={{padding:'40px',textAlign:'center',color:'#9B97CC'}}>Сотрудник не найден</div>;

  const role = emp.roles?.[0] ?? 'EMPLOYEE';
  const roleColor = ROLE_COLORS[role] ?? '#9B97CC';
  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };
  const inp: React.CSSProperties = { width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'8px 12px', fontSize:'13px', outline:'none', boxSizing:'border-box' };

  const age = emp.birthDate ? Math.floor((Date.now() - new Date(emp.birthDate).getTime()) / (365.25*24*60*60*1000)) : null;
  const tenure = emp.hiredAt ? Math.floor((Date.now() - new Date(emp.hiredAt).getTime()) / (365.25*24*60*60*1000*30)) : null;

  return (
    <div style={{minHeight:'100vh',background:'#ECEAF8'}}>
      <div style={{background:'white',padding:'14px 28px',display:'flex',alignItems:'center',gap:'12px',boxShadow:'0 4px 16px rgba(127,119,221,0.06)',position:'sticky',top:0,zIndex:10}}>
        <button onClick={()=>router.push('/dashboard/employees')} style={{background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:'#9B97CC'}}>← Назад</button>
        <span style={{color:'#EDE9FE'}}>|</span>
        <span style={{fontSize:'14px',fontWeight:700,color:'#1a1040',flex:1}}>{emp.name}</span>
        <span style={{background:roleColor+'20',color:roleColor,borderRadius:'8px',padding:'3px 10px',fontSize:'11px',fontWeight:700}}>{role}</span>
        {isAdmin && !editing && (
          <button onClick={()=>setEditing(true)} style={{background:'#F8F7FF',color:'#7F77DD',border:'1px solid #EDE9FE',borderRadius:'10px',padding:'7px 16px',fontSize:'12px',cursor:'pointer',fontWeight:600}}>✏️ Редактировать</button>
        )}
        {editing && (
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={saveProfile} disabled={saving} style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'10px',padding:'7px 16px',fontSize:'12px',cursor:'pointer',fontWeight:700}}>
              {saving?'Сохранение...':'Сохранить'}
            </button>
            <button onClick={()=>{setEditing(false);}} style={{background:'white',color:'#9B97CC',border:'1px solid #EDE9FE',borderRadius:'10px',padding:'7px 12px',fontSize:'12px',cursor:'pointer'}}>Отмена</button>
          </div>
        )}
      </div>

      <div style={{padding:'20px 28px',display:'grid',gridTemplateColumns:'280px 1fr',gap:'20px',maxWidth:'1100px'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
          <div style={{...card,textAlign:'center'}}>
            <div style={{position:'relative',width:'80px',height:'80px',margin:'0 auto 14px'}}>
              {emp.avatarUrl && !emp.avatarUrl.startsWith('data:') ? (
                <img src={emp.avatarUrl} alt={emp.name} style={{width:'80px',height:'80px',borderRadius:'50%',objectFit:'cover'}} />
              ) : emp.avatarUrl && emp.avatarUrl.startsWith('data:') ? (
                <img src={emp.avatarUrl} alt={emp.name} style={{width:'80px',height:'80px',borderRadius:'50%',objectFit:'cover'}} />
              ) : (
                <div style={{width:'80px',height:'80px',borderRadius:'50%',background:'linear-gradient(135deg,#7F77DD,#5248C5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',color:'white',fontWeight:700}}>
                  {emp.name.charAt(0).toUpperCase()}
                </div>
              )}
              {isAdmin && (
                <label style={{position:'absolute',bottom:0,right:0,width:'24px',height:'24px',borderRadius:'50%',background:'#7F77DD',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'12px'}}>
                  {uploadingAvatar ? '...' : '📷'}
                  <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}}
                    onChange={e=>{if(e.target.files?.[0]) uploadAvatar(e.target.files[0]); e.target.value='';}} />
                </label>
              )}
            </div>
            {avatarError && <p style={{fontSize:'11px',color:'#DC2626',background:'#FEF2F2',borderRadius:'8px',padding:'6px 10px',margin:'0 0 10px'}}>{avatarError}</p>}
            <h2 style={{fontSize:'16px',fontWeight:800,color:'#1a1040',margin:'0 0 4px'}}>{emp.name}</h2>
            {emp.position && <p style={{fontSize:'12px',color:'#7F77DD',margin:'0 0 4px',fontWeight:600}}>{emp.position}</p>}
            <p style={{fontSize:'12px',color:'#9B97CC',margin:'0 0 12px'}}>{emp.email}</p>
            <span style={{background:roleColor+'20',color:roleColor,borderRadius:'10px',padding:'4px 14px',fontSize:'12px',fontWeight:700}}>{role}</span>
            <div style={{display:'flex',gap:'8px',justifyContent:'center',marginTop:'12px'}}>
              <span style={{background:emp.status==='ACTIVE'?'#10B98120':'#EF444420',color:emp.status==='ACTIVE'?'#10B981':'#EF4444',borderRadius:'8px',padding:'3px 10px',fontSize:'11px',fontWeight:700}}>
                {emp.status==='ACTIVE'?'Активен':'Заблокирован'}
              </span>
            </div>
          </div>

          <div style={card}>
            <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 12px',fontWeight:700,textTransform:'uppercase'}}>Информация</p>
            {[
              {label:'Email', value: emp.email},
              {label:'Телефон', value: emp.phone || '—'},
              {label:'Пол', value: emp.gender ? GENDERS[emp.gender] : '—'},
              {label:'Дата рождения', value: emp.birthDate ? new Date(emp.birthDate).toLocaleDateString('ru') + (age ? ' ('+age+' лет)' : '') : '—'},
              {label:'Принят', value: emp.hiredAt ? new Date(emp.hiredAt).toLocaleDateString('ru') + (tenure ? ' ('+tenure+' мес.)' : '') : '—'},
              {label:'В системе с', value: new Date(emp.createdAt).toLocaleDateString('ru')},
            ].map(item => (
              <div key={item.label} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #F8F7FF',fontSize:'12px'}}>
                <span style={{color:'#9B97CC'}}>{item.label}</span>
                <span style={{color:'#1a1040',fontWeight:600,textAlign:'right',maxWidth:'60%'}}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
          {editing ? (
            <div style={card}>
              <p style={{fontSize:'15px',fontWeight:800,color:'#1a1040',margin:'0 0 16px'}}>Редактирование профиля</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
                <div>
                  <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 6px',fontWeight:600,textTransform:'uppercase'}}>Имя</p>
                  <input value={form.name} onChange={e=>setForm((f:any)=>({...f,name:e.target.value}))} style={inp} />
                </div>
                <div>
                  <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 6px',fontWeight:600,textTransform:'uppercase'}}>Должность</p>
                  <input value={form.position} onChange={e=>setForm((f:any)=>({...f,position:e.target.value}))} placeholder="Например: Дизайнер" style={inp} />
                </div>
                <div>
                  <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 6px',fontWeight:600,textTransform:'uppercase'}}>Телефон</p>
                  <input value={form.phone} onChange={e=>setForm((f:any)=>({...f,phone:e.target.value}))} placeholder="+7 (999) 000-00-00" style={inp} />
                </div>
                <div>
                  <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 6px',fontWeight:600,textTransform:'uppercase'}}>Пол</p>
                  <select value={form.gender} onChange={e=>setForm((f:any)=>({...f,gender:e.target.value}))} style={inp}>
                    <option value="">Не указан</option>
                    <option value="MALE">Мужской</option>
                    <option value="FEMALE">Женский</option>
                  </select>
                </div>
                <div>
                  <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 6px',fontWeight:600,textTransform:'uppercase'}}>Дата рождения</p>
                  <input type="date" value={form.birthDate} onChange={e=>setForm((f:any)=>({...f,birthDate:e.target.value}))} style={inp} />
                </div>
                <div>
                  <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 6px',fontWeight:600,textTransform:'uppercase'}}>Дата принятия</p>
                  <input type="date" value={form.hiredAt} onChange={e=>setForm((f:any)=>({...f,hiredAt:e.target.value}))} style={inp} />
                </div>
                <div style={{gridColumn:'1/-1'}}>
                  <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 6px',fontWeight:600,textTransform:'uppercase'}}>Роль</p>
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    {ROLES.map(r => (
                      <button key={r} type="button" onClick={()=>setForm((f:any)=>({...f,role:r}))}
                        style={{background:form.role===r?(ROLE_COLORS[r]??'#7F77DD'):'white',color:form.role===r?'white':(ROLE_COLORS[r]??'#7F77DD'),border:'1px solid '+(ROLE_COLORS[r]??'#7F77DD')+'60',borderRadius:'10px',padding:'6px 16px',fontSize:'12px',cursor:'pointer',fontWeight:700}}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={card}>
              <p style={{fontSize:'15px',fontWeight:800,color:'#1a1040',margin:'0 0 16px'}}>Профиль сотрудника</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
                {[
                  {label:'Должность', value: emp.position || 'Не указана'},
                  {label:'Телефон', value: emp.phone || 'Не указан'},
                  {label:'Пол', value: emp.gender ? GENDERS[emp.gender] : 'Не указан'},
                  {label:'Возраст', value: age ? age+' лет' : 'Не указан'},
                  {label:'Дата рождения', value: emp.birthDate ? new Date(emp.birthDate).toLocaleDateString('ru') : 'Не указана'},
                  {label:'Дата принятия', value: emp.hiredAt ? new Date(emp.hiredAt).toLocaleDateString('ru') : 'Не указана'},
                  {label:'Стаж', value: tenure ? tenure+' месяцев' : 'Не указан'},
                  {label:'Роль', value: role},
                ].map(item => (
                  <div key={item.label} style={{background:'#F8F7FF',borderRadius:'12px',padding:'12px 16px'}}>
                    <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 4px',fontWeight:600,textTransform:'uppercase'}}>{item.label}</p>
                    <p style={{fontSize:'14px',color:'#1a1040',margin:0,fontWeight:700}}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Отделы / Проекты / Задачи */}
          {(emp.departments?.length > 0 || emp.projects?.length > 0 || emp.tasks?.length > 0) && (
            <div style={card}>
              <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 14px' }}>Связи</p>

              {emp.departments?.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <p style={{ fontSize:11, color:'#9B97CC', margin:'0 0 6px', fontWeight:600 }}>🏢 Отделы</p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {emp.departments.map((d:any) => (
                      <span key={d.id} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'#1a1040', background:'#F8F7FF', padding:'4px 10px', borderRadius:20 }}>
                        <span style={{ width:7, height:7, borderRadius:'50%', background:d.color??'#7F77DD' }} /> {d.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {emp.projects?.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <p style={{ fontSize:11, color:'#9B97CC', margin:'0 0 6px', fontWeight:600 }}>📁 Проекты ({emp.projects.length})</p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {emp.projects.map((p:any) => (
                      <a key={p.id} href={`/dashboard/projects/${p.id}`} style={{ fontSize:12, fontWeight:600, color:'#7F77DD', background:'#EDE9FE', padding:'4px 10px', borderRadius:20, textDecoration:'none' }}>
                        {p.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {emp.tasks?.length > 0 && (
                <div>
                  <p style={{ fontSize:11, color:'#9B97CC', margin:'0 0 6px', fontWeight:600 }}>
                    ✅ Задачи ({emp.taskStats?.total ?? emp.tasks.length}) — готово: {emp.taskStats?.byStatus?.DONE ?? 0}
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {emp.tasks.slice(0,8).map((t:any) => (
                      <a key={t.id} href={`/dashboard/tasks/${t.id}`} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#1a1040', textDecoration:'none', padding:'5px 8px', background:'#F8F7FF', borderRadius:8 }}>
                        <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</span>
                        <span style={{ fontSize:10, fontWeight:700, color:'#9B97CC' }}>{t.status}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {isAdmin && !editing && (
            <div style={card}>
              <p style={{fontSize:'13px',fontWeight:700,color:'#1a1040',margin:'0 0 12px'}}>Действия</p>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                <button onClick={async()=>{
                  await fetch(API+'/employees/'+id+(emp.status==='ACTIVE'?'/suspend':'/activate'), {method:'PATCH',headers:h(token)});
                  load(token);
                }} style={{background:emp.status==='ACTIVE'?'#FEF3C7':'#D1FAE5',color:emp.status==='ACTIVE'?'#D97706':'#10B981',border:'none',borderRadius:'10px',padding:'8px 16px',fontSize:'12px',cursor:'pointer',fontWeight:700}}>
                  {emp.status==='ACTIVE'?'Заблокировать':'Разблокировать'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
