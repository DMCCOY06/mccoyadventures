import type { FormEvent } from 'react'
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(evt: FormEvent){
    evt.preventDefault()
    setLoading(true)
    setStatus(null)
    const { error } = await supabase.from('contact_requests').insert({
      name: form.name,
      email: form.email,
      message: form.message
    })
    setLoading(false)
    if (error) {
      setStatus({ kind: 'error', text: error.message + '. También puedes escribir a hola@mccoy.tours' })
    } else {
      setStatus({ kind: 'success', text: '¡Mensaje enviado! Te contactaremos en menos de 24h.' })
      setForm({ name: '', email: '', message: '' })
    }
  }

  return (
    <section className="container" style={{ padding: '40px 0', display:'grid', gap:24, gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))' }}>
      <div>
        <p style={{color:'var(--accent)',textTransform:'uppercase',letterSpacing:1,fontSize:12}}>Hablemos</p>
        <h2>Planea tu aventura a medida</h2>
        <p style={{color:'var(--muted)',fontSize:15,lineHeight:1.5}}>
          Llena el formulario y nuestro equipo te responderá con un itinerario personalizado.
          También puedes escribirnos directamente a{' '}
          <a href="mailto:hola@mccoy.tours" style={{color:'var(--accent)'}}>hola@mccoy.tours</a>.
        </p>
        <div style={{marginTop:24,display:'flex',flexDirection:'column',gap:8,fontSize:14,color:'var(--muted)'}}>
          <div>📞 +504 9898-0000</div>
          <div>📍 Roatán, Islas de la Bahía</div>
          <div>🕒 Lunes a sábado · 8:00 am - 6:00 pm</div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="card" style={{padding:24,display:'flex',flexDirection:'column',gap:12}}>
        <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:14}}>
          Nombre
          <input className="input" value={form.name} onChange={e=>setForm(f=>({ ...f, name: e.target.value }))} required placeholder="Tu nombre" />
        </label>
        <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:14}}>
          Correo
          <input className="input" type="email" value={form.email} onChange={e=>setForm(f=>({ ...f, email: e.target.value }))} required placeholder="tu@correo.com" />
        </label>
        <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:14}}>
          Mensaje
          <textarea className="input" rows={4} value={form.message} onChange={e=>setForm(f=>({ ...f, message: e.target.value }))} required placeholder="Cuéntanos qué tipo de experiencia buscas" />
        </label>
        {status && (
          <div style={{background:status.kind === 'success' ? 'rgba(7,168,255,0.1)' : 'rgba(255,0,0,0.08)', padding:10, borderRadius:10, fontSize:13, color: status.kind === 'success' ? '#7fd8ff' : '#ff8e8e'}}>
            {status.text}
          </div>
        )}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Enviando…' : 'Enviar mensaje'}
        </button>
      </form>
    </section>
  )
}
