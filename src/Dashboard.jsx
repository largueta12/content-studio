import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const STATUS_COLORS = { pendiente:'#f59e0b', 'en-proceso':'#7c6deb', completado:'#22c55e' }
const STATUS_BG = { pendiente:'rgba(245,158,11,0.10)', 'en-proceso':'rgba(124,109,235,0.13)', completado:'rgba(34,197,94,0.10)' }
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const EDIT_COLS = ['sin-asignar','en-edicion','revision','listo']
const EDIT_LABELS = {'sin-asignar':'Sin asignar','en-edicion':'En edición','revision':'Revisión','listo':'Listo'}

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('pendientes')
  const [tasks, setTasks] = useState([])
  const [scripts, setScripts] = useState([])
  const [editProjects, setEditProjects] = useState([])
  const [customTabs, setCustomTabs] = useState([])
  const [selectedScript, setSelectedScript] = useState(null)
  const [filterPlatform, setFilterPlatform] = useState('todos')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [taskInput, setTaskInput] = useState('')
  const [taskPlatform, setTaskPlatform] = useState('general')
  const [newTabName, setNewTabName] = useState('')
  const [showAddTab, setShowAddTab] = useState(false)
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [aiLoading, setAiLoading] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [dragTaskId, setDragTaskId] = useState(null)
  const [dragEpId, setDragEpId] = useState(null)
  const [dragEpFrom, setDragEpFrom] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [t, s, ep, ct] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', user.id).order('position'),
      supabase.from('scripts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('edit_projects').select('*').eq('user_id', user.id).order('position'),
      supabase.from('custom_tabs').select('*').eq('user_id', user.id).order('position'),
    ])
    if (t.data) setTasks(t.data)
    if (s.data) setScripts(s.data)
    if (ep.data) setEditProjects(ep.data)
    if (ct.data) setCustomTabs(ct.data)
  }

  const addTask = async () => {
    if (!taskInput.trim()) return
    const { data } = await supabase.from('tasks').insert({ user_id: user.id, text: taskInput.trim(), platform: taskPlatform, status: 'pendiente', position: tasks.length }).select().single()
    if (data) setTasks(p => [...p, data])
    setTaskInput('')
  }

  const cycleStatus = async (id) => {
    const order = ['pendiente','en-proceso','completado']
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const next = order[(order.indexOf(task.status) + 1) % 3]
    setTasks(p => p.map(t => t.id === id ? {...t, status: next} : t))
    await supabase.from('tasks').update({ status: next }).eq('id', id)
    if (next === 'completado') {
      setTimeout(async () => {
        setTasks(p => p.filter(t => t.id !== id))
        await supabase.from('tasks').delete().eq('id', id)
      }, 800)
    }
  }

  const deleteTask = async (id) => {
    setTasks(p => p.filter(t => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }

  const dropTask = async (toId) => {
    if (!dragTaskId || dragTaskId === toId) return
    const from = tasks.findIndex(t => t.id === dragTaskId)
    const to = tasks.findIndex(t => t.id === toId)
    const reordered = [...tasks]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    setTasks(reordered)
    setDragTaskId(null)
    await Promise.all(reordered.map((t, i) => supabase.from('tasks').update({ position: i }).eq('id', t.id)))
  }

  const newScript = async () => {
    const { data } = await supabase.from('scripts').insert({ user_id: user.id, title: 'Nuevo guión', platform: 'youtube', status: 'idea', hook:'', intro:'', desarrollo:'', cta:'', notas:'' }).select().single()
    if (data) { setScripts(p => [data, ...p]); setSelectedScript(data) }
  }

  const updateScript = async (field, value) => {
    if (!selectedScript) return
    const updated = { ...selectedScript, [field]: value }
    setSelectedScript(updated)
    setScripts(p => p.map(s => s.id === updated.id ? updated : s))
    await supabase.from('scripts').update({ [field]: value }).eq('id', selectedScript.id)
  }

  const generateScript = async () => {
    if (!selectedScript) return
    setAiLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 1000,
          system: `Eres experto en contenido de ${selectedScript.platform}. Responde SOLO con JSON válido sin markdown: {"hook":"...","intro":"...","desarrollo":"...","cta":"...","notas":"..."}`,
          messages: [{ role: 'user', content: `Guión para ${selectedScript.platform} sobre: "${selectedScript.title}"` }]
        })
      })
      const d = await res.json()
      const txt = d.content.map(b => b.text || '').join('')
      const parsed = JSON.parse(txt.replace(/```json|```/g, '').trim())
      const updated = { ...selectedScript, ...parsed, status: 'borrador' }
      setSelectedScript(updated)
      setScripts(p => p.map(s => s.id === updated.id ? updated : s))
      await supabase.from('scripts').update({ ...parsed, status: 'borrador' }).eq('id', selectedScript.id)
    } catch(e) { console.error(e) }
    setAiLoading(false)
  }

  const addCustomTab = async () => {
    if (!newTabName.trim()) return
    const { data } = await supabase.from('custom_tabs').insert({ user_id: user.id, label: newTabName.trim(), position: customTabs.length }).select().single()
    if (data) { setCustomTabs(p => [...p, data]); setActiveTab('ct-' + data.id) }
    setNewTabName(''); setShowAddTab(false)
  }

  const removeCustomTab = async (id) => {
    setCustomTabs(p => p.filter(t => t.id !== id))
    if (activeTab === 'ct-' + id) setActiveTab('pendientes')
    await supabase.from('custom_tabs').delete().eq('id', id)
  }

  const dropEditProject = async (toCol) => {
    if (!dragEpId) return
    setEditProjects(p => p.map(ep => ep.id === dragEpId ? {...ep, column_name: toCol} : ep))
    await supabase.from('edit_projects').update({ column_name: toCol }).eq('id', dragEpId)
    setDragEpId(null); setDragEpFrom(null)
  }

  const addEditProject = async () => {
    const title = prompt('Nombre del proyecto:')
    if (!title) return
    const { data } = await supabase.from('edit_projects').insert({ user_id: user.id, title, platform: 'youtube', column_name: 'sin-asignar', assignee: '' }).select().single()
    if (data) setEditProjects(p => [...p, data])
  }

  const assignEditor = async (epId, name) => {
    setEditProjects(p => p.map(ep => ep.id === epId ? {...ep, assignee: name} : ep))
    await supabase.from('edit_projects').update({ assignee: name }).eq('id', epId)
  }

  const filteredTasks = tasks.filter(t => {
    const pOk = filterPlatform === 'todos' || t.platform === filterPlatform || t.platform === 'general'
    const sOk = filterStatus === 'todos' || t.status === filterStatus
    return pOk && sOk
  })

  const allTabs = [
    { id: 'pendientes', label: 'Pendientes', removable: false },
    { id: 'calendario', label: 'Calendario', removable: false },
    { id: 'guiones', label: 'Guiones', removable: false },
    { id: 'edicion', label: 'Edición', removable: false },
    ...customTabs.map(ct => ({ id: 'ct-' + ct.id, label: ct.label, removable: true, dbId: ct.id }))
  ]

  const renderCalendar = () => {
    const first = new Date(calYear, calMonth, 1).getDay()
    const days = new Date(calYear, calMonth + 1, 0).getDate()
    const today = new Date()
    const cells = []
    for (let i = 0; i < first; i++) cells.push(<div key={'e'+i} />)
    for (let d = 1; d <= days; d++) {
      const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear()
      const key = `${calYear}-${calMonth+1}-${d}`
      const dayScripts = scripts.filter(s => s.sched_date === key)
      cells.push(
        <div key={d} onClick={() => selectedScript && updateScript('sched_date', key)}
          style={{ minHeight:54, border:`0.5px solid ${isToday ? 'var(--text)' : 'var(--border)'}`, borderRadius:6, padding:5, cursor:'pointer' }}>
          <div style={{ fontSize:10, color: isToday ? 'var(--text)' : 'var(--text3)', fontWeight: isToday ? 500 : 400 }}>{d}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:3 }}>
            {dayScripts.map(s => <span key={s.id} style={{ width:6, height:6, borderRadius:'50%', background: s.platform==='youtube' ? '#c00' : s.platform==='tiktok' ? '#555' : '#888', display:'block' }} />)}
          </div>
        </div>
      )
    }
    return cells
  }

  const sidebarBtn = (label, isActive, onClick, dot) => (
    <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 8px', borderRadius:6, fontSize:12, border:'none', width:'100%', textAlign:'left', fontFamily:'inherit', cursor:'pointer', background: isActive ? 'var(--text)' : 'transparent', color: isActive ? 'var(--bg)' : 'var(--text2)', transition:'all .1s' }}>
      {dot && <span style={{ width:8, height:8, borderRadius:'50%', background:dot, flexShrink:0 }} />}
      {label}
    </button>
  )

  return (
    <div style={{ display:'grid', gridTemplateColumns:'196px 1fr', gridTemplateRows:'52px 1fr', height:'100vh', background:'var(--bg)', overflow:'hidden' }}>

      {/* TOPBAR */}
      <div style={{ gridColumn:'1/-1', borderBottom:'0.5px solid var(--border)', display:'flex', alignItems:'center', padding:'0 16px', gap:6, background:'var(--bg)' }}>
        <div style={{ fontSize:13, fontWeight:500, letterSpacing:'.04em', marginRight:8 }}>Studio</div>
        <div style={{ display:'flex', gap:2, flex:1, overflowX:'auto', alignItems:'center' }}>
          {allTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ background:'none', border:'none', padding:'5px 11px', borderRadius:6, fontSize:12, cursor:'pointer', color: activeTab===tab.id ? 'var(--bg)' : 'var(--text2)', backgroundColor: activeTab===tab.id ? 'var(--text)' : 'transparent', fontFamily:'inherit', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
              {tab.label}
              {tab.removable && <span onClick={e => { e.stopPropagation(); removeCustomTab(tab.dbId) }} style={{ fontSize:10, opacity:.6, cursor:'pointer' }}>✕</span>}
            </button>
          ))}
          <button onClick={() => setShowAddTab(true)} style={{ background:'none', border:'0.5px dashed var(--border2)', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', color:'var(--text3)', fontFamily:'inherit', whiteSpace:'nowrap' }}>+ pestaña</button>
        </div>
        <div style={{ position:'relative' }}>
          <button onClick={() => setShowProfile(!showProfile)} style={{ width:28, height:28, borderRadius:'50%', border:'0.5px solid var(--border2)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:11, fontWeight:500 }}>
            {user.user_metadata?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
          </button>
          {showProfile && (
            <div style={{ position:'absolute', right:0, top:36, background:'var(--bg)', border:'0.5px solid var(--border2)', borderRadius:8, padding:12, zIndex:100, minWidth:180, boxShadow:'0 4px 16px rgba(0,0,0,.08)' }}>
              <div style={{ fontSize:12, fontWeight:500, marginBottom:2 }}>{user.user_metadata?.full_name || 'Usuario'}</div>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:12 }}>{user.email}</div>
              <button onClick={onLogout} style={{ width:'100%', padding:6, border:'0.5px solid var(--border2)', borderRadius:6, fontSize:12, background:'none', cursor:'pointer', color:'var(--text2)', fontFamily:'inherit' }}>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SIDEBAR */}
      <div style={{ borderRight:'0.5px solid var(--border)', padding:'14px 10px', display:'flex', flexDirection:'column', gap:3, overflowY:'auto', background:'var(--bg)' }}>
        <div style={{ fontSize:10, fontWeight:500, color:'var(--text3)', letterSpacing:'.07em', textTransform:'uppercase', padding:'8px 8px 4px' }}>Plataforma</div>
        {sidebarBtn('Todo', filterPlatform==='todos', () => setFilterPlatform('todos'), null)}
        {sidebarBtn('YouTube', filterPlatform==='youtube', () => setFilterPlatform('youtube'), '#c00')}
        {sidebarBtn('TikTok', filterPlatform==='tiktok', () => setFilterPlatform('tiktok'), '#555')}
        {sidebarBtn('Instagram', filterPlatform==='instagram', () => setFilterPlatform('instagram'), '#888')}
        <div style={{ fontSize:10, fontWeight:500, color:'var(--text3)', letterSpacing:'.07em', textTransform:'uppercase', padding:'8px 8px 4px', marginTop:6 }}>Estado</div>
        {sidebarBtn('Todos', filterStatus==='todos', () => setFilterStatus('todos'), null)}
        {sidebarBtn('Pendiente', filterStatus==='pendiente', () => setFilterStatus('pendiente'), '#f59e0b')}
        {sidebarBtn('En proceso', filterStatus==='en-proceso', () => setFilterStatus('en-proceso'), '#7c6deb')}
        {sidebarBtn('Completado', filterStatus==='completado', () => setFilterStatus('completado'), '#22c55e')}
      </div>

      {/* MAIN */}
      <div style={{ overflowY:'auto', background:'var(--bg)', padding:20 }}>

        {showAddTab && (
          <div style={{ border:'0.5px solid var(--border2)', borderRadius:10, padding:14, marginBottom:14, display:'flex', flexDirection:'column', gap:8 }}>
            <input value={newTabName} onChange={e => setNewTabName(e.target.value)} onKeyDown={e => e.key==='Enter' && addCustomTab()} placeholder="Nombre de la pestaña..." style={{ padding:'6px 10px', border:'0.5px solid var(--border2)', borderRadius:6, fontSize:12 }} />
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={addCustomTab} style={{ flex:1, padding:6, border:'none', borderRadius:6, fontSize:12, cursor:'pointer', background:'var(--text)', color:'var(--bg)', fontFamily:'inherit' }}>Agregar</button>
              <button onClick={() => setShowAddTab(false)} style={{ flex:1, padding:6, border:'0.5px solid var(--border2)', borderRadius:6, fontSize:12, cursor:'pointer', background:'none', color:'var(--text2)', fontFamily:'inherit' }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* PENDIENTES */}
        {activeTab === 'pendientes' && (
          <div>
            <div style={{ fontSize:13, fontWeight:500, marginBottom:4 }}>Pendientes</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:16 }}>Tarea completada = desaparece automáticamente</div>
            <div style={{ display:'flex', gap:6, marginBottom:16 }}>
              <input value={taskInput} onChange={e => setTaskInput(e.target.value)} onKeyDown={e => e.key==='Enter' && addTask()} placeholder="Nueva tarea..." style={{ flex:1, padding:'7px 10px', border:'0.5px solid var(--border2)', borderRadius:7, fontSize:12 }} />
              <select value={taskPlatform} onChange={e => setTaskPlatform(e.target.value)} style={{ padding:'7px 8px', border:'0.5px solid var(--border2)', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                {['general','youtube','tiktok','instagram'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button onClick={addTask} style={{ padding:'7px 12px', border:'none', borderRadius:7, fontSize:12, cursor:'pointer', background:'var(--text)', color:'var(--bg)', fontFamily:'inherit' }}>+ Agregar</button>
            </div>
            {filteredTasks.length === 0
              ? <div style={{ textAlign:'center', color:'var(--text3)', fontSize:12, padding:'32px 0' }}>Sin tareas. ¡A crear contenido!</div>
              : filteredTasks.map(task => (
                <div key={task.id} draggable onDragStart={() => setDragTaskId(task.id)} onDragOver={e => e.preventDefault()} onDrop={() => dropTask(task.id)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, border:`0.5px solid ${STATUS_COLORS[task.status]}33`, background:STATUS_BG[task.status], marginBottom:6, fontSize:12, cursor:'grab', userSelect:'none', transition:'all .2s', opacity: task.status==='completado' ? .45 : 1 }}>
                  <span style={{ color:'var(--text3)', fontSize:11 }}>⠿</span>
                  <span onClick={() => cycleStatus(task.id)} style={{ width:9, height:9, borderRadius:'50%', background:STATUS_COLORS[task.status], flexShrink:0, cursor:'pointer' }} title="Cambiar estado" />
                  <span style={{ flex:1 }}>{task.text}</span>
                  <span style={{ fontSize:10, padding:'2px 7px', borderRadius:999, border:'0.5px solid var(--border)', color:'var(--text3)' }}>{task.platform}</span>
                  <button onClick={() => deleteTask(task.id)} style={{ background:'none', border:'none', color:'var(--text3)', fontSize:14, opacity:.5, cursor:'pointer' }}>✕</button>
                </div>
              ))
            }
          </div>
        )}

        {/* CALENDARIO */}
        {activeTab === 'calendario' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <button onClick={() => { let m=calMonth-1, y=calYear; if(m<0){m=11;y--;} setCalMonth(m); setCalYear(y) }} style={{ background:'none', border:'0.5px solid var(--border)', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:13, color:'var(--text2)', fontFamily:'inherit' }}>←</button>
              <span style={{ fontSize:14, fontWeight:500 }}>{MONTHS[calMonth]} {calYear}</span>
              <button onClick={() => { let m=calMonth+1, y=calYear; if(m>11){m=0;y++;} setCalMonth(m); setCalYear(y) }} style={{ background:'none', border:'0.5px solid var(--border)', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:13, color:'var(--text2)', fontFamily:'inherit' }}>→</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
              {DAYS.map(d => <div key={d} style={{ textAlign:'center', fontSize:10, color:'var(--text3)', padding:'4px 0', textTransform:'uppercase' }}>{d}</div>)}
              {renderCalendar()}
            </div>
          </div>
        )}

        {/* GUIONES */}
        {activeTab === 'guiones' && (
          <div>
            <button onClick={newScript} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', border:'0.5px dashed var(--border2)', borderRadius:7, background:'none', cursor:'pointer', fontSize:12, color:'var(--text2)', fontFamily:'inherit', width:'100%', marginBottom:14 }}>+ Nuevo guión</button>
            {scripts.filter(s => filterPlatform==='todos' || s.platform===filterPlatform).map(script => (
              <div key={script.id} onClick={() => setSelectedScript(script)} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', border:`0.5px solid ${selectedScript?.id===script.id ? 'var(--text)' : 'var(--border)'}`, borderRadius:8, marginBottom:6, cursor:'pointer', fontSize:12 }}>
                <span style={{ flex:1, fontWeight:500 }}>{script.title}</span>
                <span style={{ fontSize:10, color:'var(--text3)' }}>{script.sched_date || 'Sin fecha'}</span>
                <span style={{ fontSize:10, padding:'2px 7px', borderRadius:999, border:'0.5px solid var(--border)', color:'var(--text3)' }}>{script.platform}</span>
              </div>
            ))}
            {selectedScript && (
              <div style={{ border:'0.5px solid var(--border)', borderRadius:10, overflow:'hidden', marginTop:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderBottom:'0.5px solid var(--border)', background:'var(--bg2)', flexWrap:'wrap' }}>
                  <input value={selectedScript.title} onChange={e => updateScript('title', e.target.value)} style={{ flex:1, border:'none', background:'transparent', fontSize:13, fontWeight:500, fontFamily:'inherit', color:'var(--text)', minWidth:120 }} />
                  {['youtube','tiktok','instagram'].map(p => (
                    <button key={p} onClick={() => updateScript('platform', p)} style={{ padding:'3px 8px', border:'0.5px solid var(--border2)', borderRadius:6, fontSize:11, cursor:'pointer', background: selectedScript.platform===p ? 'var(--text)' : 'none', color: selectedScript.platform===p ? 'var(--bg)' : 'var(--text2)', fontFamily:'inherit' }}>{p}</button>
                  ))}
                  <button onClick={generateScript} disabled={aiLoading} style={{ padding:'4px 10px', background:'var(--text)', color:'var(--bg)', border:'none', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'inherit', opacity: aiLoading ? .5 : 1 }}>
                    {aiLoading ? 'Generando...' : '✦ Generar IA'}
                  </button>
                </div>
                {[['hook','Hook / Gancho',3],['intro','Introducción',3],['desarrollo','Desarrollo',6],['cta','Call to Action',2],['notas','Notas de edición',2]].map(([field, label, rows]) => (
                  <div key={field} style={{ borderBottom:'0.5px solid var(--border)', padding:'12px 14px' }}>
                    <div style={{ fontSize:10, fontWeight:500, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text3)', marginBottom:6 }}>{label}</div>
                    <textarea value={selectedScript[field] || ''} onChange={e => updateScript(field, e.target.value)} rows={rows} style={{ width:'100%', border:'none', background:'transparent', fontFamily:'inherit', fontSize:12, lineHeight:1.6, color:'var(--text)', minHeight:44 }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EDICIÓN */}
        {activeTab === 'edicion' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:500 }}>Panel de edición</div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>Arrastra proyectos entre columnas</div>
              </div>
              <button onClick={addEditProject} style={{ padding:'5px 12px', border:'0.5px solid var(--border2)', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'inherit', background:'none', color:'var(--text2)' }}>+ Proyecto</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              {EDIT_COLS.map(col => (
                <div key={col} onDragOver={e => e.preventDefault()} onDrop={() => dropEditProject(col)} style={{ border:'0.5px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                  <div style={{ padding:'8px 12px', fontSize:11, fontWeight:500, borderBottom:'0.5px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span>{EDIT_LABELS[col]}</span>
                    <span style={{ fontSize:10, color:'var(--text3)' }}>{editProjects.filter(p => p.column_name===col).length}</span>
                  </div>
                  <div>
                    {editProjects.filter(p => p.column_name===col).map(ep => (
                      <div key={ep.id} draggable onDragStart={() => { setDragEpId(ep.id); setDragEpFrom(col) }} style={{ padding:'10px 12px', borderBottom:'0.5px solid var(--border)', fontSize:12, cursor:'grab', userSelect:'none' }}>
                        <div style={{ fontWeight:500, marginBottom:4 }}>{ep.title}</div>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:10, color:'var(--text3)' }}>{ep.platform}</span>
                          <button onClick={() => { const n=prompt('Editor (vacío para quitar):'); if(n!==null) assignEditor(ep.id, n.trim()) }} style={{ fontSize:10, padding:'2px 7px', borderRadius:999, border:'0.5px solid var(--border)', color:'var(--text2)', background:'none', cursor:'pointer', fontFamily:'inherit' }}>
                            {ep.assignee || '+ Asignar'}
                          </button>
                        </div>
                      </div>
                    ))}
                    {editProjects.filter(p => p.column_name===col).length === 0 && (
                      <div style={{ padding:12, fontSize:11, color:'var(--text3)', textAlign:'center' }}>Arrastra aquí</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab.startsWith('ct-') && (
          <div style={{ textAlign:'center', color:'var(--text3)', fontSize:13, paddingTop:40 }}>
            <div style={{ fontWeight:500, marginBottom:8 }}>{allTabs.find(t => t.id===activeTab)?.label}</div>
            <div style={{ fontSize:12 }}>Pestaña personalizada lista para usar.</div>
          </div>
        )}

      </div>
    </div>
  )
}
