import { useState } from 'react'
import { supabase } from './supabase'

export default function Login() {
  const [loading, setLoading] = useState(null)

  const signIn = async (provider) => {
    setLoading(provider)
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/dashboard' }
    })
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', padding:24, background:'var(--bg)' }}>
      <div style={{ textAlign:'center', maxWidth:360, width:'100%' }}>
        <div style={{ fontSize:11, letterSpacing:'0.15em', color:'var(--text3)', marginBottom:8 }}>CONTENT</div>
        <div style={{ fontSize:36, fontWeight:500, marginBottom:8 }}>Studio</div>
        <div style={{ fontSize:13, color:'var(--text2)', marginBottom:48 }}>Tu espacio para crear sin distracciones</div>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <button onClick={() => signIn('google')} disabled={!!loading}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'12px 20px', border:'0.5px solid var(--border2)', borderRadius:'var(--r)', background:'var(--bg)', color:'var(--text)', fontSize:13 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading === 'google' ? 'Iniciando...' : 'Continuar con Google'}
          </button>

          <button onClick={() => signIn('apple')} disabled={!!loading}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'12px 20px', border:'0.5px solid var(--border2)', borderRadius:'var(--r)', background:'var(--text)', color:'var(--bg)', fontSize:13 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.16 1.26-2.14 3.76.03 2.99 2.62 3.99 2.65 4l-.06.16zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            {loading === 'apple' ? 'Iniciando...' : 'Continuar con Apple'}
          </button>
        </div>

        <div style={{ marginTop:24, fontSize:11, color:'var(--text3)' }}>
          Al continuar aceptas nuestros términos de uso.
        </div>

        <div style={{ marginTop:32, display:'flex', justifyContent:'center', gap:16 }}>
          <span style={{ fontSize:11, color:'var(--text3)' }}>ES</span>
          <span style={{ fontSize:11, color:'var(--text3)' }}>EN</span>
        </div>
      </div>
    </div>
  )
}
