import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'
import { loadLocalReservations, updateLocalReservationRecord, removeLocalReservation, type LocalReservationRecord } from '../../lib/localReservations'
import { useToast } from '../App'

type Reservation = {
  id: string
  date: string
  pax: number
  status: string
  created_at?: string
  user_email?: string | null
  tour?: {
    id: string
    title: string
    cover_image?: string | null
    duration?: string | null
  } | null
  localOnly?: boolean
}

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [remoteReservations, setRemoteReservations] = useState<Reservation[]>([])
  const [localRecords, setLocalRecords] = useState<LocalReservationRecord[]>(() => loadLocalReservations())
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<Reservation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { notify } = useToast()

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setUser(data.user ?? null)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!user) return
    void fetchReservations()
  }, [user])

  useEffect(() => {
    if (!user) return
    const merged = mergeReservations(remoteReservations, localRecords, user.id)
    setReservations(merged)
  }, [user, remoteReservations, localRecords])

  async function fetchReservations(){
    if (!user) return
    setSyncing(true)
    setError(null)
    const latestLocals = loadLocalReservations()
    setLocalRecords(latestLocals)
    const { data, error: err } = await supabase
      .from('reservations')
      .select('id,date,pax,status,created_at,user_email,tour:tours(id,title,image_path,duration)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setSyncing(false)
    if (err) {
      setError('No pudimos obtener tus reservas desde Supabase. Mostramos las simulaciones guardadas.')
      setRemoteReservations([])
    } else {
      const normalized: Reservation[] = (data ?? []).map(normalizeReservation)
      setRemoteReservations(normalized)
    }
  }

  async function cancelReservation(reservation: Reservation){
    if (!user) return
    setDeletingId(reservation.id)
    setConfirming(null)

    if (reservation.localOnly) {
      const updatedLocals = removeLocalReservation(reservation.id)
      setLocalRecords(updatedLocals)
      setReservations(prev => prev.filter(r => r.id !== reservation.id))
      setDeletingId(null)
      notify('Reserva cancelada.', 'info')
      return
    }

    const { error: err } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservation.id)
      .eq('user_id', user.id)

    if (err) {
      setError('No pudimos cancelar la reserva: ' + err.message)
      setDeletingId(null)
      return
    }

    updateLocalReservationRecord(reservation.id, { status: 'cancelled' })
    setLocalRecords(loadLocalReservations())
    setRemoteReservations(prev => prev.filter(r => r.id !== reservation.id))
    setReservations(prev => prev.filter(r => r.id !== reservation.id))
    setDeletingId(null)
    notify('Reserva cancelada.', 'info')
  }

  if (loading) {
    return (
      <section className="container" style={{ padding: '60px 0' }}>
        <p style={{color:'var(--muted)'}}>Cargando tu perfil...</p>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="container" style={{ padding: '60px 0' }}>
        <div className="card" style={{padding:24,maxWidth:480}}>
          <h2>Inicia sesión</h2>
          <p style={{color:'var(--muted)'}}>Necesitas una cuenta para revisar tus reservas y estado de pago.</p>
          <Link className="btn" to="/auth" style={{marginTop:12,display:'inline-flex',justifyContent:'center'}}>
            Ir a autenticación
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="container" style={{ padding: '40px 0 80px', display:'flex', flexDirection:'column', gap:24 }}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
        <div>
          <p style={{color:'var(--muted)',margin:0}}>Sesión iniciada como</p>
          <h2 style={{margin:'4px 0'}}>{user.email}</h2>
        </div>
        <button className="btn" onClick={fetchReservations} disabled={syncing}>
          {syncing ? 'Actualizando...' : 'Actualizar reservas'}
        </button>
      </header>

      {error && <div style={{background:'rgba(255,0,0,0.1)',padding:12,borderRadius:10,color:'#ffa6b0'}}>{error}</div>}

      {reservations.length === 0 ? (
        <div className="card" style={{padding:24}}>
          <h3>Sin reservas todavía</h3>
          <p style={{color:'var(--muted)'}}>Explora un tour y completa el checkout para verlo aquí.</p>
          <Link to="/" className="btn" style={{marginTop:12,display:'inline-flex',justifyContent:'center'}}>Buscar tours</Link>
        </div>
      ) : (
        <div className="grid reservations-grid">
          {reservations.map(res => (
            <article key={res.id} className="card" style={{padding:18,display:'flex',flexDirection:'column',gap:10}}>
              {res.tour?.cover_image && (
                <img src={res.tour.cover_image} alt={res.tour.title} style={{width:'100%',height:140,objectFit:'cover',borderRadius:10}} />
              )}
              <div>
                <strong>{res.tour?.title ?? res.tour?.id ?? 'Tour personalizado'}</strong>
                <p style={{color:'var(--muted)',fontSize:14}}>
                  {res.date
                    ? new Date(res.date).toLocaleDateString('es-HN', { weekday:'long', day:'numeric', month:'long' })
                    : 'Fecha por confirmar'}
                </p>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:14}}>
                <span>Pax {res.pax}</span>
                <StatusBadge status={res.status} />
              </div>
              {res.status !== 'cancelled' && (
                <button
                  className="btn btn-outline"
                  style={{marginTop:8,width:'100%'}}
                  disabled={deletingId === res.id}
                  onClick={() => setConfirming(res)}
                >
                  {deletingId === res.id ? 'Eliminando...' : 'Cancelar reserva'}
                </button>
              )}
              <div style={{fontSize:12,color:'var(--muted)'}}>Creada el {res.created_at ? new Date(res.created_at).toLocaleDateString() : '—'}</div>
            </article>
          ))}
        </div>
      )}

      {confirming && (
        <div className="modal-backdrop" onClick={()=>setConfirming(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:420}}>
            <h3>Cancelar reserva</h3>
            <p style={{color:'var(--muted)'}}>
              ¿Seguro que deseas cancelar <strong>{confirming.tour?.title ?? 'esta reserva'}</strong> para el{' '}
              {new Date(confirming.date).toLocaleDateString('es-HN', { weekday:'long', day:'numeric', month:'long' })}? Esta acción no se puede deshacer.
            </p>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn btn-outline" onClick={()=>setConfirming(null)}>Volver</button>
              <button className="btn btn-gradient" onClick={()=>cancelReservation(confirming)}>Sí, cancelar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function StatusBadge({ status }: { status: string }){
  const palette: Record<string, string> = {
    confirmed: '#34d399',
    pending: '#fbbf24',
    cancelled: '#f87171'
  }
  const color = palette[status] ?? 'var(--accent)'
  return (
    <span
      style={{
        padding:'4px 12px',
        borderRadius:999,
        background:`${color}20`,
        color,
        border:'none',
        cursor:'default',
        fontWeight:600
      }}
    >
      {status}
    </span>
  )
}

function normalizeReservation(row: any): Reservation {
  const tour = Array.isArray(row.tour) ? row.tour[0] : row.tour
  return {
    id: row.id,
    date: row.date,
    pax: row.pax,
    status: row.status,
    created_at: row.created_at,
    user_email: row.user_email,
    tour: tour
      ? {
        id: tour.id,
        title: tour.title,
        cover_image: tour.image_path,
          duration: tour.duration
        }
      : null,
    localOnly: false
  }
}

function mergeReservations(remote: Reservation[], locals: LocalReservationRecord[], userId: string){
  const relevantLocal = locals.filter(r => r.user_id === userId && r.status !== 'cancelled')
  const map = new Map<string, Reservation>()
  remote
    .filter(res => res.status !== 'cancelled')
    .forEach(res => map.set(res.id, res))
  relevantLocal.forEach(record => {
    if (!map.has(record.id)) {
      map.set(record.id, {
        id: record.id,
        date: record.date,
        pax: record.pax,
        status: record.status,
        created_at: record.created_at,
        user_email: record.user_email,
        tour: record.tour ?? null,
        localOnly: record.localOnly ?? true
      })
    }
  })
  return [...map.values()].sort((a,b) => {
    const aDate = a.created_at ?? a.date
    const bDate = b.created_at ?? b.date
    return new Date(bDate).getTime() - new Date(aDate).getTime()
  })
}
