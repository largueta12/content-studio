import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const STATUS_COLORS = { pendiente:'#f59e0b', 'en-proceso':'#7c6deb', completado:'#22c55e' }
const STATUS_BG = { pendiente:'rgba(245,158,11,0.10)', 'en-proceso':'rgba(124,109,235,0.13)', completado:'rgba(34,197,94,0.10)' }
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const EDIT_COLS = ['sin-asignar','en-edicion','revision','listo']
const EDIT_LABELS = {'sin-asignar':'Sin asignar','en-edicion':'En edición','revision':'Revisión','listo':'Listo'}
const PLAT_COLOR = { youtube:'#c00', tiktok:'#666', instagram:'#888', general:'#aaa' }

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
  const [taskDueDate, setTaskDueDate] = useState('')
  const [newTabName, setNewTabName] = useState('')
  const [showAddTab, setShowAddTab] = useState(false)
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [dragTaskId, setDragTaskId] = useState(null)
  const [dragEpId, setDragEpId] = useState(null)
  const [fontSize, setFontSize] = useState(() => parseFloat(localStorage.getItem('fontSize') || '13'))
  const [showFontSlider, setShowFontSlider] = useState(false)
  const [focusActive, setFocusActive] = useState(false)
  const [focusSeconds, setFocusSeconds] = useState(25 * 60)
  const [focusRunning, setFocusRunning] = useState(false)
  const [focusProjectId, setFocusProjectId] = useState(null)
  const [expandedPlatform, setExpandedPlatform] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => { loadData() }, [])
  useEffect(() => {
    document.documentElement.style.fontSize = fontSize + 'px'
    localStorage.setItem('fontSize', fontSize)
  }, [fontSize])
  useEffect(() => {
    if (focusRunning) {
      timerRef.current = setInterval(() => {
        setFocusSeconds(s => { if (s <= 1) { clearInterval(timerRef.current); setFocusRunning(false); return 0 } return s - 1 })
      }, 1000)
    } else { clearInterval(timerRef.current) }
    return () => clearInterval(timerRef.current)
  }, [focusRunning])

  const startFocus = async () => {
    document.querySelectorAll('audio, video').forEach(el => { try { el.pause() } catch(e) {} })
    if ('Notification' in window) await Notification.requestPermission()
    if ('wakeLock' in navigator) { try { await navigator.wakeLock.request('screen') } catch(e) {} }
    setFocusActive(true); setFocusRunning(true)
    setFocusProjectId(selectedScript?.id || null)
    setFocusSeconds(25 * 60)
  }

  const finishFocus = async () => {
    clearInterval(timerRef.current)
    setFocusActive(false); setFocusRunning(false)
    if (focusProjectId) {
      setScripts(p => p.map(s => s.id === focusProjectId ? {...s, status:'listo'} : s))
      if (selectedScript?.id === focusProjectId) setSelectedScript(prev => ({...prev, status:'listo'}))
      await supabase.from('scripts').update({ status:'listo' }).eq('id', focusProjectId)
    }
    setFocusProjectId(null)
  }

  const formatTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

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
    const { data } = await supabase.from('tasks').insert({
      user_id: user.id, text: taskInput.trim(), platform: taskPlatform,
      status: 'pendiente', position: tasks.length,
      due_date: taskDueDate || null
    }).select().single()
    if (data) setTasks(p => [...p, data])
    setTaskInput(''); setTaskDueDate('')
  }

  const cycleStatus = async (id) => {
    const order = ['pendiente','en-proceso','completado']
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const next = order[(order.indexOf(task.status) + 1) % 3]
    setTasks(p => p.map(t => t.id === id ? {...t, status: next} : t))
    await supabase.from('tasks').update({ status: next }).eq('id', id)
    if (next === 'completado') {
      setTimeout(async () => { setTasks(p => p.filter(t => t.id !== id)); await supabase.from('tasks').delete().eq('id', id) }, 800)
    }
  }

  const deleteTask = async (id) => { setTasks(p => p.filter(t => t.id !== id)); await supabase.from('tasks').delete().eq('id', id) }

  const dropTask = async (toId) => {
    if (!dragTaskId || dragTaskId === toId) return
    const from = tasks.findIndex(t => t.id === dragTaskId)
    const to = tasks.findIndex(t => t.id === toId)
    const r = [...tasks]; const [m] = r.splice(from, 1); r.splice(to, 0, m)
    setTasks(r); setDragTaskId(null)
    await Promise.all(r.map((t, i) => supabase.from('tasks').update({ position: i }).eq('id', t.id)))
  }

  const newScript = async (date) => {
    const { data } = await supabase.from('scripts').insert({
      user_id: user.id, title: 'Nuevo guión',
      platform: filterPlatform !== 'todos' ? filterPlatform : 'youtube',
      status: 'idea', hook:'', intro:'', desarrollo:'', cta:'', notas:'',
      sched_date: date || null
    }).select().single()
    if (data) { setScripts(p => [data, ...p]); setSelectedScript(data); setActiveTab('guiones') }
  }

  const deleteScript = async (id) => {
    if (!confirm('¿Borrar este guión?')) return
    setScripts(p => p.filter(s => s.id !== id))
    if (selectedScript?.id === id) setSelectedScript(null)
    await supabase.from('scripts').delete().eq('id', id)
  }

  const updateScript = async (field, value) => {
    if (!selectedScript || selectedScript.status === 'listo') return
    const updated = { ...selectedScript, [field]: value }
    setSelectedScript(updated)
    setScripts(p => p.map(s => s.id === updated.id ? updated : s))
    await supabase.from('scripts').update({ [field]: value }).eq('id', selectedScript.id)
  }

  const generateScript = async () => {
    if (!selectedScript || selectedScript.status === 'listo') return
    setAiLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000,
          system: `Eres experto en contenido de ${selectedScript.platform}. Responde SOLO con JSON válido sin markdown: {"hook":"...","intro":"...","desarrollo":"...","cta":"...","notas":"..."}`,
          messages: [{ role: 'user', content: `Guión para ${selectedScript.platform} sobre: "${selectedScript.title}"` }] })
      })
      const d = await res.json()
      const txt = d.content.map(b => b.text || '').join('')
      const parsed = JSON.parse(txt.replace(/```json|```/g, '').trim())
      const updated = { ...selectedScript, ...parsed, status: 'borrador' }
      setSelectedScript(updated); setScripts(p => p.map(s => s.id === updated.id ? updated : s))
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
    const today = new Date().toISOString().split('T')[0]
    setEditProjects(p => p.map(ep => ep.id === dragEpId ? {...ep, column_name: toCol, assigned_date: today} : ep))
    await supabase.from('edit_projects').update({ column_name: toCol, assigned_date: today }).eq('id', dragEpId)
    setDragEpId(null)
  }

  const addEditProject = async () => {
    const title = prompt('Nombre del proyecto:')
    if (!title) return
    const { data } = await supabase.from('edit_projects').insert({
      user_id: user.id, title, platform: filterPlatform !== 'todos' ? filterPlatform : 'youtube',
      column_name: 'sin-asignar', assignee: ''
    }).select().single()
    if (data) setEditProjects(p => [...p, data])
  }

  const assignEditor = async (epId, name) => {
    const today = new Date().toISOString().split('T')[0]
    setEditProjects(p => p.map(ep => ep.id === epId ? {...ep, assignee: name, assigned_date: today} : ep))
    await supabase.from('edit_projects').update({ assignee: name, assigned_date: today }).eq('id', epId)
  }

  // Calendar helpers
  const dateKey = (y, m, d) => `${y}-${m+1}-${d}`

  const getCalItems = (key) => ({
    scripts: scripts.filter(s => s.sched_date === key),
    tasks: tasks.filter(t => t.due_date === key),
    edits: editProjects.filter(ep => ep.assigned_date === key)
  })

  const filteredTasks = tasks.filter(t => {
    const pOk = filterPlatform === 'todos' || t.platform === filterPlatform || t.platform === 'general'
    const sOk = filterStatus === 'todos' || t.status === filterStatus
    return pOk && sOk
  })

  const platformStats = (platform) => {
    const all = scripts.filter(s => s.platform === platform)
    return { active: all.filter(s => s.status !== 'listo').length, closed: all.filter(s => s.status === 'listo').length, total: all.length }
  }

  const renderCalendar = () => {
    const first = new Date(calYear, calMonth, 1).getDay()
    const days = new Date(calYear, calMonth + 1, 0).getDate()
    const today = new Date()
    const cells = []
    for (let i = 0; i < first; i++) cells.push(<div key={'e'+i} />)
    for (let d = 1; d <= days; d++) {
      const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear()
      const key = dateKey(calYear, calMonth, d)
      const items = getCalItems(key)
      const total = items.scripts.length + items.tasks.length + items.edits.length
      const isSelected = selectedDay === key
      cells.push(
        <div key={d} onClick={() => setSelectedDay(isSelected ? null : key)}
          style={{ aspectRatio:'1', border:`0.5px solid ${isSelected ? 'var(--text)' : isToday ? 'var(--text)' : 'var(--border)'}`, borderRadius:4, padding:5, cursor:'pointer', display:'flex', flexDirection:'column', justifyContent:'space-between', background: isSelected ? 'var(--bg2)' : 'transparent', transition:'all .1s' }}>
          <div style={{ fontSize:'0.72em', color: isToday ? 'var(--text)' : 'var(--text3)', fontWeight: isToday ? 600 : 400 }}>{d}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
            {items.scripts.map(s => <span key={s.id} style={{ width:5, height:5, borderRadius:'50%', background: PLAT_COLOR[s.platform] || '#888', display:'block' }} title={s.title} />)}
            {items.tasks.map(t => <span key={t.id} style={{ width:5, height:5, borderRadius:2, background: STATUS_COLORS[t.status], display:'block' }} title={t.text} />)}
            {items.edits.map(ep => <span key={ep.id} style={{ width:5, height:5, borderRadius:'50%', background:'#7c6deb', display:'block', outline:'1px solid #7c6deb' }} title={ep.title} />)}
          </div>
          {total > 0 && <div style={{ fontSize:'0.65em', color:'var(--text3)' }}>{total}</div>}
        </div>
      )
    }
    return cells
  }

  const allTabs = [
    { id:'pendientes', label:'Pendientes', removable:false },
    { id:'calendario', label:'Calendario', removable:false },
    { id:'guiones', label:'Guiones', removable:false },
    { id:'edicion', label:'Edición', removable:false },
    ...customTabs.map(ct => ({ id:'ct-'+ct.id, label:ct.label, removable:true, dbId:ct.id }))
  ]

  const isLocked = selectedScript?.status === 'listo'

  const sBtn = (label, isActive, onClick, dot, badge) => (
    <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', borderRadius:4, fontSize:'0.82em', border:'none', width:'100%', textAlign:'left', fontFamily:'inherit', cursor:'pointer', background: isActive ? 'var(--text)' : 'transparent', color: isActive ? 'var(--bg)' : 'var(--text3)', transition:'all .1s' }}>
      {dot && <span style={{ width:6, height:6, borderRadius:'50%', background:dot, flexShrink:0 }} />}
      <span style={{ flex:1 }}>{label}</span>
      {badge !== undefined && <span style={{ fontSize:'0.75em', opacity:.6 }}>{badge}</span>}
    </button>
  )

  const PlatformRow = ({ platform, label, dot }) => {
    const stats = platformStats(platform)
    const isExpanded = expandedPlatform === platform
    const isActive = filterPlatform === platform
    return (
      <div>
        <button onClick={() => { setFilterPlatform(platform); setExpandedPlatform(isExpanded ? null : platform) }}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', borderRadius:4, fontSize:'0.82em', border:'none', width:'100%', textAlign:'left', fontFamily:'inherit', cursor:'pointer', background: isActive ? 'var(--text)' : 'transparent', color: isActive ? 'var(--bg)' : 'var(--text3)', transition:'all .1s' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:dot, flexShrink:0 }} />
          <span style={{ flex:1 }}>{label}</span>
          <span style={{ fontSize:'0.75em', opacity:.6 }}>{stats.total}</span>
          <span style={{ fontSize:'0.65em', opacity:.4 }}>{isExpanded ? '▲' : '▼'}</span>
        </button>
        {isExpanded && (
          <div style={{ margin:'3px 0 3px 20px', padding:'6px 8px', background:'var(--bg2)', borderRadius:4, fontSize:'0.76em', color:'var(--text3)', display:'flex', flexDirection:'column', gap:3 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}><span>Activos</span><span style={{ fontWeight:500, color:'var(--text)' }}>{stats.active}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between' }}><span>Cerrados</span><span style={{ fontWeight:500, color:'var(--text)' }}>{stats.closed}</span></div>
          </div>
        )}
      </div>
    )
  }

  // Day detail panel
  const DayPanel = ({ dayKey }) => {
    const items = getCalItems(dayKey)
    const [d, m, y] = dayKey.split('-').reverse().map(Number)
    const label = `${d} de ${MONTHS[m-1]} ${y}`
    const [newTaskText, setNewTaskText] = useState('')

    const addTaskFromCal = async () => {
      if (!newTaskText.trim()) return
      const { data } = await supabase.from('tasks').insert({
        user_id: user.id, text: newTaskText.trim(), platform: 'general',
        status: 'pendiente', position: tasks.length, due_date: dayKey
      }).select().single()
      if (data) { setTasks(p => [...p, data]); setNewTaskText('') }
    }

    return (
      <div style={{ marginTop:14, border:'0.5px solid var(--border2)', borderRadius:8, overflow:'hidden' }}>
        <div style={{ padding:'8px 12px', borderBottom:'0.5px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:'0.85em', fontWeight:500 }}>{label}</span>
          <button onClick={() => newScript(dayKey)} style={{ fontSize:'0.75em', padding:'2px 8px', border:'0.5px solid var(--border2)', borderRadius:4, background:'none', cursor:'pointer', color:'var(--text2)', fontFamily:'inherit' }}>+ Guión</button>
        </div>

        {items.scripts.length > 0 && (
          <div style={{ padding:'8px 12px', borderBottom:'0.5px solid var(--border)' }}>
            <div style={{ fontSize:'0.68em', fontWeight:600, color:'var(--text3)', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:6 }}>Guiones</div>
            {items.scripts.map(s => (
              <div key={s.id} onClick={() => { setSelectedScript(s); setActiveTab('guiones') }}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 0', cursor:'pointer', fontSize:'0.85em' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background: PLAT_COLOR[s.platform], flexShrink:0 }} />
                <span style={{ flex:1 }}>{s.title}</span>
                <span style={{ fontSize:'0.72em', color:'var(--text3)' }}>{s.status}</span>
                {s.status === 'listo' && <span>🔒</span>}
              </div>
            ))}
          </div>
        )}

        {items.tasks.length > 0 && (
          <div style={{ padding:'8px 12px', borderBottom:'0.5px solid var(--border)' }}>
            <div style={{ fontSize:'0.68em', fontWeight:600, color:'var(--text3)', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:6 }}>Pendientes</div>
            {items.tasks.map(t => (
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 0', fontSize:'0.85em' }}>
                <span onClick={() => cycleStatus(t.id)} style={{ width:7, height:7, borderRadius:'50%', background: STATUS_COLORS[t.status], cursor:'pointer', flexShrink:0 }} />
                <span style={{ flex:1 }}>{t.text}</span>
                <span style={{ fontSize:'0.72em', color:'var(--text3)' }}>{t.platform}</span>
              </div>
            ))}
          </div>
        )}

        {items.edits.length > 0 && (
          <div style={{ padding:'8px 12px', borderBottom:'0.5px solid var(--border)' }}>
            <div style={{ fontSize:'0.68em', fontWeight:600, color:'var(--text3)', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:6 }}>Edición</div>
            {items.edits.map(ep => (
              <div key={ep.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 0', fontSize:'0.85em' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:'#7c6deb', flexShrink:0 }} />
                <span style={{ flex:1 }}>{ep.title}</span>
                <span style={{ fontSize:'0.72em', color:'var(--text3)' }}>{ep.assignee || 'Sin asignar'}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding:'8px 12px', display:'flex', gap:6 }}>
          <input value={newTaskText} onChange={e => setNewTaskText(e.target.value)} onKeyDown={e => e.key==='Enter' && addTaskFromCal()}
            placeholder="+ Agregar pendiente para este día..." style={{ flex:1, border:'none', background:'transparent', fontSize:'0.82em', color:'var(--text2)', outline:'none', fontFamily:'inherit' }} />
          {newTaskText && <button onClick={addTaskFromCal} style={{ fontSize:'0.78em', border:'none', background:'var(--text)', color:'var(--bg)', borderRadius:4, padding:'2px 8px', cursor:'pointer', fontFamily:'inherit' }}>+</button>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'180px 1fr', gridTemplateRows: focusActive ? '44px 36px 1fr' : '44px 1fr', height:'100vh', background:'var(--bg)', overflow:'hidden', fontSize: fontSize + 'px' }}>

      {/* TOPBAR */}
      <div style={{ gridColumn:'1/-1', borderBottom:'0.5px solid var(--border)', display:'flex', alignItems:'center', padding:'0 14px', gap:4, background:'var(--bg)' }}>
        <div style={{ fontSize:'0.9em', fontWeight:500, letterSpacing:'.06em', marginRight:10, color:'var(--text2)' }}>Studio</div>
        <div style={{ display:'flex', gap:1, flex:1, overflowX:'auto', alignItems:'center' }}>
          {allTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ background: activeTab===tab.id ? 'var(--text)' : 'none', border:'none', padding:'4px 10px', borderRadius:4, fontSize:'0.82em', cursor:'pointer', color: activeTab===tab.id ? 'var(--bg)' : 'var(--text3)', fontFamily:'inherit', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4 }}>
              {tab.label}
              {tab.removable && <span onClick={e => { e.stopPropagation(); removeCustomTab(tab.dbId) }} style={{ fontSize:'0.7em', opacity:.5, cursor:'pointer' }}>✕</span>}
            </button>
          ))}
          <button onClick={() => setShowAddTab(true)} style={{ background:'none', border:'none', padding:'4px 8px', fontSize:'0.78em', cursor:'pointer', color:'var(--text3)', fontFamily:'inherit' }}>+ tab</button>
        </div>
        {!focusActive && <button onClick={startFocus} style={{ padding:'4px 10px', border:'0.5px solid var(--border2)', borderRadius:4, fontSize:'0.78em', cursor:'pointer', background:'none', color:'var(--text2)', fontFamily:'inherit' }}>◉ Focus</button>}
        <div style={{ position:'relative' }}>
          <button onClick={() => setShowFontSlider(s => !s)} style={{ padding:'4px 8px', border:'0.5px solid var(--border)', borderRadius:4, fontSize:'0.78em', cursor:'pointer', background:'none', color:'var(--text3)', fontFamily:'inherit' }}>Aa</button>
          {showFontSlider && (
            <div style={{ position:'absolute', right:0, top:34, background:'var(--bg)', border:'0.5px solid var(--border2)', borderRadius:8, padding:'10px 14px', zIndex:100, boxShadow:'0 4px 16px rgba(0,0,0,.1)', width:180 }}>
              <div style={{ fontSize:'0.78em', color:'var(--text3)', marginBottom:8 }}>Tamaño: {fontSize}px</div>
              <input type="range" min="11" max="18" step="0.5" value={fontSize} onChange={e => setFontSize(parseFloat(e.target.value))} style={{ width:'100%', cursor:'pointer' }} />
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72em', color:'var(--text3)', marginTop:4 }}><span>A</span><span style={{ fontSize:'1.2em' }}>A</span></div>
            </div>
          )}
        </div>
        <div style={{ position:'relative' }}>
          <button onClick={() => setShowProfile(!showProfile)} style={{ width:26, height:26, borderRadius:'50%', border:'0.5px solid var(--border2)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:'0.78em', fontWeight:500 }}>
            {user.user_metadata?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
          </button>
          {showProfile && (
            <div style={{ position:'absolute', right:0, top:34, background:'var(--bg)', border:'0.5px solid var(--border2)', borderRadius:8, padding:12, zIndex:100, minWidth:180, boxShadow:'0 4px 16px rgba(0,0,0,.08)' }}>
              <div style={{ fontSize:'0.88em', fontWeight:500, marginBottom:2 }}>{user.user_metadata?.full_name || 'Usuario'}</div>
              <div style={{ fontSize:'0.78em', color:'var(--text3)', marginBottom:12 }}>{user.email}</div>
              <button onClick={onLogout} style={{ width:'100%', padding:6, border:'0.5px solid var(--border2)', borderRadius:4, fontSize:'0.82em', background:'none', cursor:'pointer', color:'var(--text2)', fontFamily:'inherit' }}>Cerrar sesión</button>
            </div>
          )}
        </div>
      </div>

      {/* FOCUS BAR */}
      {focusActive && (
        <div style={{ gridColumn:'1/-1', background:'#000', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', borderBottom:'0.5px solid #222' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={() => setFocusRunning(r => !r)} style={{ background:'none', border:'none', cursor:'pointer', color:'#fff', fontSize:'0.9em', padding:'0 4px' }}>{focusRunning ? '⏸' : '▶'}</button>
            <span style={{ fontSize:'0.95em', fontWeight:500, color:'#fff', fontVariantNumeric:'tabular-nums', letterSpacing:'0.05em' }}>{formatTime(focusSeconds)}</span>
            <div style={{ display:'flex', gap:4 }}>
              {[15,25,45,60].map(m => (
                <button key={m} onClick={() => { setFocusSeconds(m*60); setFocusRunning(false) }}
                  style={{ padding:'2px 7px', borderRadius:10, border:'0.5px solid #333', background:'transparent', color:'#555', fontSize:'0.72em', cursor:'pointer', fontFamily:'inherit' }}>{m}m</button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:'0.72em', color:'#444' }}>Notificaciones silenciadas</span>
            <button onClick={finishFocus} style={{ padding:'3px 10px', border:'0.5px solid #333', borderRadius:4, background:'transparent', color:'#888', fontSize:'0.78em', cursor:'pointer', fontFamily:'inherit' }}>Finalizar proyecto</button>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <div style={{ borderRight:'0.5px solid var(--border)', padding:'12px 8px', display:'flex', flexDirection:'column', gap:2, overflowY:'auto', background:'var(--bg)' }}>
        <div style={{ fontSize:'0.68em', fontWeight:600, color:'var(--text3)', letterSpacing:'.1em', textTransform:'uppercase', padding:'6px 8px 3px' }}>Plataforma</div>
        {sBtn('Todo', filterPlatform==='todos', () => { setFilterPlatform('todos'); setExpandedPlatform(null) }, null)}
        <PlatformRow platform="youtube" label="YouTube" dot="#c00" />
        <PlatformRow platform="tiktok" label="TikTok" dot="#555" />
        <PlatformRow platform="instagram" label="Instagram" dot="#888" />
        <div style={{ fontSize:'0.68em', fontWeight:600, color:'var(--text3)', letterSpacing:'.1em', textTransform:'uppercase', padding:'10px 8px 3px' }}>Estado</div>
        {sBtn('Todos', filterStatus==='todos', () => setFilterStatus('todos'), null)}
        {sBtn('Pendiente', filterStatus==='pendiente', () => setFilterStatus('pendiente'), '#f59e0b')}
        {sBtn('En proceso', filterStatus==='en-proceso', () => setFilterStatus('en-proceso'), '#7c6deb')}
        {sBtn('Completado', filterStatus==='completado', () => setFilterStatus('completado'), '#22c55e')}

        {/* Calendar legend */}
        <div style={{ fontSize:'0.68em', fontWeight:600, color:'var(--text3)', letterSpacing:'.1em', textTransform:'uppercase', padding:'10px 8px 3px' }}>Calendario</div>
        <div style={{ padding:'4px 8px', fontSize:'0.75em', color:'var(--text3)', display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:6, height:6, borderRadius:'50%', background:'#c00', display:'block' }} />Guión YouTube</div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:6, height:6, borderRadius:'50%', background:'#666', display:'block' }} />Guión TikTok</div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:6, height:6, borderRadius:2, background:'#f59e0b', display:'block' }} />Pendiente</div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:6, height:6, borderRadius:'50%', background:'#7c6deb', display:'block' }} />Edición</div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ overflowY:'auto', background:'var(--bg)', padding:20 }}>
        {showAddTab && (
          <div style={{ border:'0.5px solid var(--border2)', borderRadius:8, padding:12, marginBottom:12, display:'flex', flexDirection:'column', gap:6 }}>
            <input value={newTabName} onChange={e => setNewTabName(e.target.value)} onKeyDown={e => e.key==='Enter' && addCustomTab()} placeholder="Nombre de la pestaña..." style={{ padding:'6px 10px', border:'0.5px solid var(--border2)', borderRadius:4, fontSize:'0.9em' }} />
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={addCustomTab} style={{ flex:1, padding:6, border:'none', borderRadius:4, fontSize:'0.85em', cursor:'pointer', background:'var(--text)', color:'var(--bg)', fontFamily:'inherit' }}>Agregar</button>
              <button onClick={() => setShowAddTab(false)} style={{ flex:1, padding:6, border:'0.5px solid var(--border2)', borderRadius:4, fontSize:'0.85em', cursor:'pointer', background:'none', color:'var(--text2)', fontFamily:'inherit' }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* PENDIENTES */}
        {activeTab === 'pendientes' && (
          <div>
            <div style={{ fontSize:'1em', fontWeight:500, marginBottom:3 }}>Pendientes</div>
            <div style={{ fontSize:'0.8em', color:'var(--text3)', marginBottom:14 }}>Completada → desaparece sola</div>
            <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
              <input value={taskInput} onChange={e => setTaskInput(e.target.value)} onKeyDown={e => e.key==='Enter' && addTask()} placeholder="Nueva tarea..." style={{ flex:1, minWidth:120, padding:'6px 10px', border:'0.5px solid var(--border2)', borderRadius:4, fontSize:'0.9em' }} />
              <select value={taskPlatform} onChange={e => setTaskPlatform(e.target.value)} style={{ padding:'6px 8px', border:'0.5px solid var(--border2)', borderRadius:4, fontSize:'0.85em', cursor:'pointer' }}>
                {['general','youtube','tiktok','instagram'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} style={{ padding:'6px 8px', border:'0.5px solid var(--border2)', borderRadius:4, fontSize:'0.85em', cursor:'pointer', background:'var(--bg)', color:'var(--text)' }} />
              <button onClick={addTask} style={{ padding:'6px 12px', border:'none', borderRadius:4, fontSize:'0.85em', cursor:'pointer', background:'var(--text)', color:'var(--bg)', fontFamily:'inherit' }}>+</button>
            </div>
            {filteredTasks.length === 0
              ? <div style={{ textAlign:'center', color:'var(--text3)', fontSize:'0.85em', padding:'28px 0' }}>Sin tareas.</div>
              : filteredTasks.map(task => (
                <div key={task.id} draggable onDragStart={() => setDragTaskId(task.id)} onDragOver={e => e.preventDefault()} onDrop={() => dropTask(task.id)}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, border:`0.5px solid ${STATUS_COLORS[task.status]}33`, background:STATUS_BG[task.status], marginBottom:5, fontSize:'0.9em', cursor:'grab', userSelect:'none', transition:'all .2s', opacity: task.status==='completado' ? .4 : 1 }}>
                  <span style={{ color:'var(--text3)', fontSize:'0.8em' }}>⠿</span>
                  <span onClick={() => cycleStatus(task.id)} style={{ width:8, height:8, borderRadius:'50%', background:STATUS_COLORS[task.status], flexShrink:0, cursor:'pointer' }} />
                  <span style={{ flex:1 }}>{task.text}</span>
                  {task.due_date && <span style={{ fontSize:'0.72em', color:'var(--text3)' }}>📅 {task.due_date}</span>}
                  <span style={{ fontSize:'0.75em', padding:'1px 6px', borderRadius:999, border:'0.5px solid var(--border)', color:'var(--text3)' }}>{task.platform}</span>
                  <button onClick={() => deleteTask(task.id)} style={{ background:'none', border:'none', color:'var(--text3)', fontSize:'0.9em', opacity:.4, cursor:'pointer' }}>✕</button>
                </div>
              ))
            }
          </div>
        )}

        {/* CALENDARIO */}
        {activeTab === 'calendario' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <button onClick={() => { let m=calMonth-1,y=calYear; if(m<0){m=11;y--;} setCalMonth(m);setCalYear(y);setSelectedDay(null) }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.1em', color:'var(--text3)', padding:'0 6px' }}>←</button>
              <span style={{ fontSize:'0.95em', fontWeight:500 }}>{MONTHS[calMonth]} {calYear}</span>
              <button onClick={() => { let m=calMonth+1,y=calYear; if(m>11){m=0;y++;} setCalMonth(m);setCalYear(y);setSelectedDay(null) }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.1em', color:'var(--text3)', padding:'0 6px' }}>→</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
              {DAYS.map(d => <div key={d} style={{ textAlign:'center', fontSize:'0.7em', color:'var(--text3)', paddingBottom:4, textTransform:'uppercase', letterSpacing:'.05em' }}>{d}</div>)}
              {renderCalendar()}
            </div>
            {selectedDay && <DayPanel dayKey={selectedDay} />}
          </div>
        )}

        {/* GUIONES */}
        {activeTab === 'guiones' && (
          <div>
            <button onClick={() => newScript(null)} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 12px', border:'0.5px dashed var(--border2)', borderRadius:4, background:'none', cursor:'pointer', fontSize:'0.85em', color:'var(--text3)', fontFamily:'inherit', width:'100%', marginBottom:12 }}>+ Nuevo guión</button>
            {scripts.filter(s => filterPlatform==='todos' || s.platform===filterPlatform).map(script => (
              <div key={script.id} onClick={() => setSelectedScript(script)} onDoubleClick={() => deleteScript(script.id)}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', border:`0.5px solid ${selectedScript?.id===script.id ? 'var(--text)' : 'var(--border)'}`, borderRadius:6, marginBottom:5, cursor:'pointer', fontSize:'0.9em', opacity: script.status==='listo' ? .6 : 1 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background: PLAT_COLOR[script.platform], flexShrink:0 }} />
                <span style={{ flex:1, fontWeight:500 }}>{script.title}</span>
                {script.status === 'listo' && <span style={{ fontSize:'0.7em' }}>🔒</span>}
                <span style={{ fontSize:'0.75em', color:'var(--text3)' }}>{script.sched_date || '—'}</span>
                <span style={{ fontSize:'0.75em', padding:'1px 6px', borderRadius:999, border:'0.5px solid var(--border)', color:'var(--text3)' }}>{script.platform}</span>
              </div>
            ))}
            {selectedScript && (
              <div style={{ border:`0.5px solid ${isLocked ? '#333' : 'var(--border)'}`, borderRadius:8, overflow:'hidden', marginTop:14 }}>
                {isLocked && <div style={{ background:'#111', padding:'6px 12px', fontSize:'0.78em', color:'#555' }}>🔒 Proyecto finalizado — solo lectura</div>}
                <div style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderBottom:'0.5px solid var(--border)', background:'var(--bg2)', flexWrap:'wrap' }}>
                  <input value={selectedScript.title} onChange={e => updateScript('title', e.target.value)} disabled={isLocked}
                    style={{ flex:1, border:'none', background:'transparent', fontSize:'0.95em', fontWeight:500, fontFamily:'inherit', color:'var(--text)', minWidth:100, cursor: isLocked ? 'default' : 'text' }} />
                  <input type="date" value={selectedScript.sched_date || ''} onChange={e => updateScript('sched_date', e.target.value)} disabled={isLocked}
                    style={{ padding:'2px 6px', border:'0.5px solid var(--border2)', borderRadius:4, fontSize:'0.75em', background:'var(--bg)', color:'var(--text)', cursor: isLocked ? 'default' : 'pointer' }} />
                  {['youtube','tiktok','instagram'].map(p => (
                    <button key={p} onClick={() => updateScript('platform', p)} disabled={isLocked}
                      style={{ padding:'2px 7px', border:'0.5px solid var(--border2)', borderRadius:4, fontSize:'0.75em', cursor: isLocked ? 'default' : 'pointer', background: selectedScript.platform===p ? 'var(--text)' : 'none', color: selectedScript.platform===p ? 'var(--bg)' : 'var(--text2)', fontFamily:'inherit' }}>{p}</button>
                  ))}
                  {!isLocked && <button onClick={generateScript} disabled={aiLoading} style={{ padding:'3px 9px', background:'var(--text)', color:'var(--bg)', border:'none', borderRadius:4, fontSize:'0.8em', cursor:'pointer', fontFamily:'inherit', opacity: aiLoading ? .5 : 1 }}>{aiLoading ? '...' : '✦ IA'}</button>}
                </div>
                {[['hook','Hook'],['intro','Introducción'],['desarrollo','Desarrollo'],['cta','Call to Action'],['notas','Notas']].map(([field, label]) => (
                  <div key={field} style={{ borderBottom:'0.5px solid var(--border)', padding:'10px 12px' }}>
                    <div style={{ fontSize:'0.7em', fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:'var(--text3)', marginBottom:5 }}>{label}</div>
                    <textarea value={selectedScript[field] || ''} onChange={e => updateScript(field, e.target.value)} rows={field==='desarrollo' ? 5 : 2} readOnly={isLocked}
                      style={{ width:'100%', border:'none', background:'transparent', fontFamily:'inherit', fontSize:'0.9em', lineHeight:1.6, color:'var(--text)', minHeight:36, cursor: isLocked ? 'default' : 'text' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EDICIÓN */}
        {activeTab === 'edicion' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontSize:'1em', fontWeight:500 }}>Panel de edición</div>
              <button onClick={addEditProject} style={{ padding:'4px 10px', border:'0.5px solid var(--border2)', borderRadius:4, fontSize:'0.8em', cursor:'pointer', fontFamily:'inherit', background:'none', color:'var(--text3)' }}>+ Proyecto</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              {EDIT_COLS.map(col => (
                <div key={col} onDragOver={e => e.preventDefault()} onDrop={() => dropEditProject(col)} style={{ border:'0.5px solid var(--border)', borderRadius:6, overflow:'hidden' }}>
                  <div style={{ padding:'6px 10px', fontSize:'0.72em', fontWeight:600, borderBottom:'0.5px solid var(--border)', background:'var(--bg2)', display:'flex', justifyContent:'space-between', textTransform:'uppercase', letterSpacing:'.06em', color:'var(--text3)' }}>
                    <span>{EDIT_LABELS[col]}</span>
                    <span>{editProjects.filter(p => p.column_name===col).length}</span>
                  </div>
                  <div>
                    {editProjects.filter(p => p.column_name===col).map(ep => (
                      <div key={ep.id} draggable onDragStart={() => setDragEpId(ep.id)} style={{ padding:'8px 10px', borderBottom:'0.5px solid var(--border)', fontSize:'0.85em', cursor:'grab', userSelect:'none' }}>
                        <div style={{ fontWeight:500, marginBottom:3 }}>{ep.title}</div>
                        <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                          <span style={{ fontSize:'0.75em', color:'var(--text3)' }}>{ep.platform}</span>
                          {ep.assigned_date && <span style={{ fontSize:'0.72em', color:'var(--text3)' }}>📅 {ep.assigned_date}</span>}
                          <button onClick={() => { const n=prompt('Editor:'); if(n!==null) assignEditor(ep.id, n.trim()) }}
                            style={{ fontSize:'0.75em', padding:'1px 6px', borderRadius:999, border:'0.5px solid var(--border)', color:'var(--text3)', background:'none', cursor:'pointer', fontFamily:'inherit' }}>
                            {ep.assignee || '+ Asignar'}
                          </button>
                        </div>
                      </div>
                    ))}
                    {editProjects.filter(p => p.column_name===col).length === 0 && <div style={{ padding:10, fontSize:'0.8em', color:'var(--text3)', textAlign:'center' }}>Arrastra aquí</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab.startsWith('ct-') && (
          <div style={{ textAlign:'center', color:'var(--text3)', fontSize:'0.9em', paddingTop:40 }}>
            <div style={{ fontWeight:500, marginBottom:6 }}>{allTabs.find(t => t.id===activeTab)?.label}</div>
          </div>
        )}
      </div>
    </div>
  )
}
