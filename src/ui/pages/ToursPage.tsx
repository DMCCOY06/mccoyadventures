import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useCart, useToast } from '../App'
import type { CartItem } from '../App'

type Tour = {
  id: string
  slug?: string
  title: string
  type?: string | null
  duration: string
  difficulty: string
  price: number
  image_path?: string | null
  description?: string | null
}

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=60'
const storageBucket = (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET ?? '').replace(/^\/|\/$/g, '')
const storageBase = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public`
  : ''

const fallbackTours: Tour[] = [
  {
    id: 'rafting-extremo',
    slug: 'rafting-extremo',
    title: 'Rafting Extremo',
    type: 'rafting',
    duration: '1 día',
    difficulty: 'Alto',
    price: 55,
    image_path: FALLBACK_IMAGE,
    description: 'Atraviesa los rápidos de La Ceiba con guías certificados.'
  },
  {
    id: 'canopy-sendero',
    slug: 'canopy-sendero',
    title: 'Canopy & Sendero',
    type: 'canopy',
    duration: '1 día',
    difficulty: 'Moderado',
    price: 40,
    image_path: 'https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=900&q=60',
    description: 'Tirolinas entre ceibas centenarias y caminatas interpretativas.'
  },
  {
    id: 'tour-ecologico',
    slug: 'tour-ecologico',
    title: 'Tour Ecológico',
    type: 'ecotour',
    duration: 'Medio día',
    difficulty: 'Bajo',
    price: 30,
    image_path: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=60',
    description: 'Recorre manglares, aviarios y liberación de tortugas.'
  }
]

type FormState = { date: string; pax: number }

function resolveImage(path?: string | null){
  if (!path) return FALLBACK_IMAGE
  if (/^https?:\/\//i.test(path)) return path
  if (!storageBase) return FALLBACK_IMAGE
  const bucketSegment = storageBucket ? `${storageBucket}/` : ''
  return `${storageBase}/${bucketSegment}${path.replace(/^\/+/, '')}`
}

const startCase = (value?: string | null) => value?.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? null

export default function ToursPage() {
  const { add } = useCart()
  const { notify } = useToast()
  const [tours, setTours] = useState<Tour[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formState, setFormState] = useState<Record<string, FormState>>({})

  useEffect(() => {
    let cancelled = false
    async function loadTours(){
      setLoading(true)
      const { data, error: err } = await supabase
        .from('tours')
        .select('id,slug,title,type,duration,difficulty,price,image_path,description')
        .order('title', { ascending: true })
      if (cancelled) return
      if (err) {
        console.warn('Falling back to seeded tours:', err.message)
        setError('No pudimos conectar con Supabase, mostrando tours de ejemplo.')
        setTours(fallbackTours)
      } else if (data && data.length > 0){
        setTours(data as Tour[])
      } else {
        setTours(fallbackTours)
      }
      setLoading(false)
    }
    void loadTours()
    return () => { cancelled = true }
  }, [])

  const hydratedTours = useMemo(() => (tours.length ? tours : fallbackTours), [tours])

  function updateForm(id: string, patch: Partial<FormState>){
    setFormState(prev => ({ ...prev, [id]: { date: prev[id]?.date ?? '', pax: prev[id]?.pax ?? 2, ...patch } }))
  }

  function addToCart(tour: Tour){
    const state = formState[tour.id] ?? { date: '', pax: 2 }
    if (!state.date) return notify('Selecciona una fecha para reservar.', 'error')
    const payload: CartItem = {
      tourId: tour.id,
      title: tour.title,
      price: tour.price,
      date: state.date,
      pax: state.pax
    }
    add(payload)
    notify('Tour añadido al carrito.', 'success')
  }

  return (
    <section className="container" style={{ padding: '32px 0 80px' }}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:16,flexWrap:'wrap'}}>
        <div>
          <p style={{color:'var(--accent)',textTransform:'uppercase',letterSpacing:1,fontSize:12}}>Vive el Caribe</p>
          <h1 style={{margin:'4px 0'}}>Explora nuestros tours</h1>
          <p style={{display: 'flex'}}>Todos los precios estan en USD </p>
        </div>
        {error && <span style={{color:'#f2838f'}}>{error}</span>}
      </header>

      {loading ? (
        <p style={{color:'var(--muted)',marginTop:20}}>Cargando experiencias...</p>
      ) : (
        <div className="grid" style={{marginTop:24}}>
          {hydratedTours.map(tour => {
            const state = formState[tour.id] ?? { date: '', pax: 2 }
            const imageSrc = resolveImage(tour.image_path)
            const subtype = startCase(tour.type)
            return (
              <article key={tour.id} className="card" style={{display:'flex',flexDirection:'column',gap:12}}>
                <img src={imageSrc} alt={tour.title} loading="lazy" />
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  <strong style={{fontSize:18}}>{tour.title}</strong>
                  {subtype && <span style={{fontSize:12,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1}}>{subtype}</span>}
                  <p style={{color:'var(--muted)',fontSize:14}}>
                    {tour.description ?? 'Reserva tu cupo y vive una experiencia guiada en Roatán.'}
                  </p>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:14,color:'var(--muted)'}}>
                  <span>{tour.duration}</span>
                  <span>{tour.difficulty}</span>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <input type="date" className="input" value={state.date} onChange={e=>updateForm(tour.id,{date:e.target.value})} style={{flex:1}} />
                  <select className="input" value={state.pax} onChange={e=>updateForm(tour.id,{pax:Number(e.target.value)})} style={{width:90}}>
                    {[1,2,3,4,5,6].map(p => <option key={p} value={p}>Pax {p}</option>)}
                  </select>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{color:'var(--muted)',fontSize:13}}>Desde</div>
                    <div style={{fontSize:22}}>${tour.price.toFixed(2)}</div>
                  </div>
                  <button className="btn btn-gradient" onClick={()=>addToCart(tour)}>Reservar</button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
