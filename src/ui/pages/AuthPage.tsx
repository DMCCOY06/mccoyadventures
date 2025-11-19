import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

type Mode = 'login' | 'register'

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  async function handleSubmit(evt: FormEvent){
    evt.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    const email = form.email.trim()
    const password = form.password.trim()
    if (!email) {
      setLoading(false)
      setError('Ingresa un correo válido (sin espacios vacíos).')
      return
    }
    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (signInError) throw new Error(signInError.message)
        setMessage('Sesión iniciada. Redirigiendo…')
        setTimeout(() => nav('/account'), 400)
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: form.name } }
        })
        if (signUpError) throw new Error(signUpError.message)
        setMessage('Revisa tu bandeja para confirmar el correo.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.')
    } finally {
      setLoading(false)
    }
  }

  function switchMode(next: Mode){
    setMode(next)
    setMessage(null)
    setError(null)
  }

  return (
    <section className="container" style={{ padding: '60px 0', display:'grid', placeItems:'center' }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: 28 }}>
        <p style={{color:'var(--accent)',textTransform:'uppercase',fontSize:12,letterSpacing:1}}>
          {mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}
        </p>
        <h2 style={{margin:'4px 0 20px'}}>
          {mode === 'login' ? 'Inicia sesión' : 'Regístrate'}
        </h2>
        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:12}}>
          {mode === 'register' && (
            <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:14}}>
              Nombre completo
              <input
                className="input"
                type="text"
                value={form.name}
                onChange={e=>setForm(f=>({ ...f, name: e.target.value }))}
                placeholder="Ej. John Doe"
                required
              />
            </label>
          )}
          <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:14}}>
            Correo electrónico
            <input
              className="input"
              type="text"
              value={form.email}
              onChange={e=>setForm(f=>({ ...f, email: e.target.value }))}
              placeholder="tu@correo.com"
              required
            />
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:14}}>
            Contraseña
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={e=>setForm(f=>({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </label>
          {error && <div style={{background:'rgba(255,0,0,0.08)',color:'#ff8e8e',padding:10,borderRadius:10,fontSize:13}}>{error}</div>}
          {message && <div style={{background:'rgba(7,168,255,0.1)',color:'#7fd8ff',padding:10,borderRadius:10,fontSize:13}}>{message}</div>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>
        <div style={{marginTop:16,fontSize:14,color:'var(--muted)'}}>
          {mode === 'login' ? (
            <>
              ¿No tienes cuenta?{' '}
              <button type="button" style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer'}} onClick={()=>switchMode('register')}>
                Regístrate aquí
              </button>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta?{' '}
              <button type="button" style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer'}} onClick={()=>switchMode('login')}>
                Inicia sesión
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
