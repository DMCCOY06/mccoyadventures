import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabaseClient'

type AdminReservation = {
  id: string
  date: string
  pax: number
  status: string
  created_at?: string
  user_id: string
  user_email?: string | null
  tour?: {
    id: string
    title: string
  } | null
}

const statusOptions = ['pending', 'confirmed', 'cancelled'] as const
type Role = 'customer' | 'local' | 'admin'

export default function ReservationsAdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role>('customer')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reservations, setReservations] = useState<AdminReservation[]>([])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled) return
      const authUser = data.user ?? null
      setUser(authUser)
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authUser.id)
          .maybeSingle()
        setRole((profile?.role ?? 'customer') as Role)
      } else {
        setRole('customer')
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const fetchReservations = useCallback(async () => {
    setError(null)
    const { data, error: err } = await supabase
      .from('reservations')
      .select('id,date,pax,status,created_at,user_id,user_email,tour:tours(id,title,image_path)')
      .order('date', { ascending: true })

    if (err) {
      setError('No pudimos cargar las reservas: ' + err.message)
      setReservations([])
    } else {
      setReservations(
        (data ?? []).map(row => ({
          id: row.id,
          date: row.date,
          pax: row.pax,
          status: row.status,
          user_id: row.user_id,
          user_email: row.user_email,
          created_at: row.created_at,
          tour: Array.isArray(row.tour) ? row.tour[0] : row.tour
        }))
      )
    }
  }, [])

  useEffect(() => {
    if (role !== 'admin') return
    void fetchReservations()
  }, [role, fetchReservations])

  useEffect(() => {
    if (role !== 'admin') return
    const channel = supabase
      .channel('admin-reservations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => { void fetchReservations() }
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [role, fetchReservations])

  const groupedByStatus = useMemo(() => {
    const groups: Record<string, AdminReservation[]> = {}
    reservations.forEach(res => {
      groups[res.status] = groups[res.status] ? [...groups[res.status], res] : [res]
    })
    return groups
  }, [reservations])

  async function updateStatus(id: string, nextStatus: (typeof statusOptions)[number]){
    setUpdating(id + nextStatus)
    const { error: err } = await supabase
      .from('reservations')
      .update({ status: nextStatus })
      .eq('id', id)
    setUpdating(null)
    if (err) {
      setError('No pudimos actualizar la reserva: ' + err.message)
    } else {
      setReservations(prev => prev.map(res => res.id === id ? { ...res, status: nextStatus } : res))
    }
  }

  if (loading) {
    return (
      <section className="container" style={{ padding:'60px 0' }}>
        <p style={{color:'var(--muted)'}}>Cargando panel administrativo...</p>
      </section>
    )
  }

  const authorized = role === 'admin'

  if (!authorized) {
    return (
      <section className="container" style={{ padding:'60px 0', maxWidth:540 }}>
        <div className="card" style={{padding:24}}>
          <h2>Acceso restringido</h2>
          {user ? (
            <>
              <p style={{color:'var(--muted)'}}>Tu cuenta <strong>{user.email}</strong> no tiene permisos de administrador.</p>
              <p style={{color:'var(--muted)',fontSize:14}}>
                Cambia el campo <code>role</code> de este usuario a <strong>admin</strong> en la tabla <code>profiles</code> para habilitar este panel.
              </p>
            </>
          ) : (
            <>
              <p style={{color:'var(--muted)'}}>Debes iniciar sesión como administrador para entrar aquí.</p>
              <Link to="/auth" className="btn" style={{marginTop:12,display:'inline-flex',justifyContent:'center'}}>Ir a autenticación</Link>
            </>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="container" style={{ padding:'32px 0 80px', display:'flex', flexDirection:'column', gap:20 }}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16}}>
        <div>
          <p style={{color:'var(--muted)',margin:0,fontSize:13}}>Panel administrativo</p>
          <h1 style={{margin:'4px 0'}}>Reservas</h1>
        </div>
        <button className="btn" onClick={fetchReservations}>Actualizar</button>
      </header>

      {error && <div style={{background:'rgba(255,0,0,0.1)',padding:12,borderRadius:12,color:'#ffa6b0'}}>{error}</div>}

      <p style={{color:'var(--muted)',fontSize:14}}>
        Define la disponibilidad diaria: al confirmar una reserva, puedes bloquear esa fecha para nuevos cupos de ese tour.
      </p>

      <p style={{color:'var(--muted)',fontSize:14, fontWeight:'bold'}}>
        PENDING - CONFIRMED - CANCELLED
      </p>
      

      {statusOptions.map(status => (
        <div key={status}>
          <h3 style={{textTransform:'capitalize'}}>{status}</h3>
          <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))'}}>
            {groupedByStatus[status]?.length ? (
              groupedByStatus[status].map(res => (
                <article key={res.id} className="card" style={{padding:18,display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                    <strong>{res.tour?.title ?? 'Tour sin nombre'}</strong>
                    <span style={{fontSize:12,color:'var(--muted)'}}>ID {String(res.id).slice(0,6)}…</span>
                  </div>
                  <div style={{color:'var(--muted)',fontSize:14}}>
                    {new Date(res.date).toLocaleDateString('es-HN', { weekday:'long', day:'numeric', month:'long' })}
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:14}}>
                    <span>Pax {res.pax}</span>
                    <span>{res.user_email ?? String(res.user_id)}</span>
                  </div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {statusOptions.map(option => (
                    <button
                      key={option}
                      className={`btn ${option === status ? 'btn-gradient' : 'btn-outline'}`}
                      disabled={option === status || updating !== null}
                      onClick={()=>updateStatus(res.id, option)}
                      style={{flex: option === status ? '1 1 120px' : '0 1 120px'}}
                    >
                      {option === status ? 'Actual' : `Marcar ${option}`}
                    </button>
                  ))}
                  </div>
                </article>
              ))
            ) : (
              <div className="card" style={{padding:18}}>
                <p style={{color:'var(--muted)',margin:0}}>Sin reservas en este estado.</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}
