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
        // Attempt signup
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { 
            data: { full_name: form.name }
          }
        })
        
        // Extract user ID early to avoid TypeScript narrowing issues
        const userId = signUpData?.user?.id
        
        // Log detailed error for debugging
        if (signUpError) {
          console.error('Signup error details:', {
            message: signUpError.message,
            status: signUpError.status,
            user: signUpData?.user
          })
        }
        
        // If signup failed, check if user was still created (sometimes happens with trigger errors)
        if (signUpError) {
          // If we have a user ID despite the error, try to create profile manually
          if (userId) {
            console.log('User was created despite error, attempting to create profile for:', userId)
            const { error: profileError } = await supabase
              .from('profiles')
              .insert({
                id: userId,
                role: 'customer'  // Use 'customer' as default (now allowed by CHECK constraint)
              })
            
            if (!profileError) {
              // Successfully recovered - profile created
              setMessage('Cuenta creada exitosamente. Ya puedes iniciar sesión.')
              return
            } else {
              console.error('Profile creation error:', profileError)
            }
          }
          
          // Show detailed error message
          const errorDetails = signUpError.message || 'Error desconocido'
          throw new Error(
            `Error al crear la cuenta: ${errorDetails}. ` +
            `El trigger de la base de datos está fallando. ` +
            `Ve a Supabase Dashboard → Database → Triggers y desactiva el trigger en auth.users.`
          )
        }
        
        // Signup succeeded - ensure profile is created
        if (signUpData?.user) {
          // Wait a bit for trigger to complete (if it exists)
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Check if profile exists (trigger should have created it)
          const { data: existingProfile, error: checkError } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', signUpData.user.id)
            .maybeSingle()
          
          if (checkError) {
            console.error('Error checking profile:', checkError)
          }
          
          if (!existingProfile) {
            // Profile doesn't exist - trigger might have failed, create it manually
            console.log('Profile does not exist, creating with default role...')
            
            // Try without specifying role first (let database use default 'customer')
            let profileError = null
            let newProfile = null
            
            const { data: profileDefault, error: errorDefault } = await supabase
              .from('profiles')
              .insert({
                id: signUpData.user.id
                // Don't specify role - let database use default 'customer'
              })
              .select()
            
            if (!errorDefault && profileDefault) {
              newProfile = profileDefault
              console.log('Profile created successfully with default role:', newProfile[0])
            } else {
              // If default fails, try 'customer' explicitly
              console.log('Default failed, trying customer role explicitly...')
              const { data: profileCustomer, error: errorCustomer } = await supabase
                .from('profiles')
                .insert({
                  id: signUpData.user.id,
                  role: 'customer'
                })
                .select()
              
              if (!errorCustomer && profileCustomer) {
                newProfile = profileCustomer
                console.log('Profile created successfully with customer role:', newProfile[0])
              } else {
                profileError = errorCustomer || errorDefault
              }
            }
            
            if (profileError) {
              console.error('Profile creation error:', profileError)
              throw new Error(`Error al crear el perfil: ${profileError.message}. Verifica que la restricción CHECK incluya 'customer' en Supabase.`)
            }
            
            if (!newProfile) {
              throw new Error('No se pudo crear el perfil. Por favor contacta al administrador.')
            }
          } else {
            console.log('Profile already exists (created by trigger):', existingProfile)
          }
        }
        
        setMessage('Cuenta creada exitosamente. Ya puedes iniciar sesión.')
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
