import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState, createContext, useContext, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { addLocalReservationRecords } from '../lib/localReservations'
import Logo from '../assets/logo.jpeg'

export type CartItem = { tourId: string; date: string; pax: number; title: string; price: number }

export type CartContextValue = {
  cart: CartItem[]
  add: (it: CartItem) => void
  remove: (idx: number) => void
  clear: () => void
}

export const CartCtx = createContext<CartContextValue>({ cart: [], add: () => {}, remove: () => {}, clear: () => {} })

export function useCart(){
  return useContext(CartCtx)
}

type ToastTone = 'info' | 'success' | 'error'
type ToastMessage = { id: number; message: string; tone: ToastTone }
type ToastContextValue = { notify: (message: string, tone?: ToastTone) => void }

const ToastCtx = createContext<ToastContextValue>({ notify: () => {} })
export function useToast(){
  return useContext(ToastCtx)
}

export default function App(){
  const [user, setUser] = useState<any>(null)
  type Role = 'customer' | 'admin' | 'local'
  const [role, setRole] = useState<Role>('customer')
  const [cart, setCart] = useState<CartItem[]>(() => JSON.parse(localStorage.getItem('mccoy_cart')||'[]'))
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const nav = useNavigate()

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setUser(sess?.user ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    let cancelled = false
    async function loadRole(){
      if (!user) { setRole('customer'); return }
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (!cancelled) {
        const dbRole = (data?.role ?? 'customer') as Role
        setRole(dbRole)
      }
    }
    loadRole().catch(() => !cancelled && setRole('customer'))
    return () => { cancelled = true }
  }, [user])
  useEffect(() => { localStorage.setItem('mccoy_cart', JSON.stringify(cart)) }, [cart])

  const api = useMemo(() => ({
    cart,
    add: (it: CartItem) => setCart(c => [...c, it]),
    remove: (idx: number) => setCart(c => c.filter((_, i) => i !== idx)),
    clear: () => setCart([])
  }), [cart])

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, tone }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  async function signOut(){ await supabase.auth.signOut(); nav('/') }

  return (
    <ToastCtx.Provider value={{ notify }}>
      <CartCtx.Provider value={api}>
        <div className="app-shell">
          <header className="nav container">
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <img src={Logo} width={44} height={44} style={{borderRadius:10}}/>
            <div>
              <strong>McCoy Adventures</strong>
              <div style={{fontSize:12, color:'var(--muted)'}}>Roatán · Honduras</div>
            </div>
          </div>
          <nav className="nav-links">
            <Link to="/" className="btn btn-outline">Tours</Link>
            <Link to="/contact" className="btn btn-outline">Contacto</Link>
            {user ? (
              <>
                <Link to="/account" className="btn btn-outline">Mi cuenta</Link>
                {role === 'admin' && (
                  <Link to="/admin/reservation" className="btn btn-outline">Admin</Link>
                )}
                <button className="btn btn-gradient" onClick={signOut}>Salir</button>
              </>
            ) : (
              <Link to="/auth" className="btn btn-outline">Ingresar</Link>
            )}
            <CartButton />
          </nav>
        </header>
          <main className="page-shell">
            <Outlet />
          </main>
        </div>
        <div className="toast-stack">
          {toasts.map(toast => (
            <div key={toast.id} className={`toast toast-${toast.tone}`}>
              {toast.message}
            </div>
          ))}
        </div>
      </CartCtx.Provider>
    </ToastCtx.Provider>
  )
}

function CartButton(){
  const { cart, remove, clear } = useCart()
  const [open, setOpen] = useState(false)
  const total = cart.reduce((a,c)=> a + c.price * c.pax, 0)

  return (
    <div>
      <button className="btn btn-gradient" onClick={() => setOpen(true)}>Carrito ({cart.length})</button>
      {open && (
        <div className="modal-backdrop" onClick={()=>setOpen(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3>Tu carrito</h3>
            {cart.length === 0 && <p style={{color:'var(--muted)'}}>Vacío</p>}
            {cart.map((it, i) => (
              <div key={i} style={{background:'rgba(255,255,255,0.04)',padding:10,borderRadius:10,margin:'10px 0'}}>
                <strong>{it.title}</strong>
                <div style={{color:'var(--muted)'}}>{it.date} · Pax {it.pax} · ${it.price}</div>
                <button className="btn" onClick={() => remove(i)}>Eliminar</button>
              </div>
            ))}
            <div style={{display:'flex',gap:8,justifyContent:'space-between',alignItems:'center'}}>
              <div>Total: <strong>${total.toFixed(2)}</strong></div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn" onClick={clear}>Limpiar</button>
                <CheckoutButton onDone={()=>setOpen(false)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CheckoutButton({ onDone }: { onDone: () => void }){
  const { cart, clear } = useCart()
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()
  const { notify } = useToast()

  async function checkout(){
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setLoading(false); nav('/auth'); return }

    // Insert one reservation per cart item
    const payload = cart.map(it => ({
      user_id: auth.user.id,
      user_email: auth.user.email ?? null,
      tour_id: it.tourId,
      date: it.date,
      pax: it.pax,
      status: 'pending' as const,
      comments: null
    }))

    const { data, error } = await supabase
      .from('reservations')
      .insert(payload)
      .select('id')

    setLoading(false)
    if (error) return notify('Error creando reserva: ' + error.message, 'error')
    if (!data || data.length === 0) return notify('No pudimos confirmar la reserva. Intenta nuevamente en unos segundos.', 'error')

    const timestamp = new Date().toISOString()
    const localRecords = cart.map((it, idx) => ({
      id: data[idx]?.id ?? `local-${Date.now()}-${idx}`,
      user_id: auth.user.id,
      tour_id: it.tourId,
      date: it.date,
      pax: it.pax,
      status: 'pending' as const,
      created_at: timestamp,
      user_email: auth.user.email ?? '',
      localOnly: !data[idx]?.id,
      tour: {
        id: it.tourId,
        title: it.title
      }
    }))
    addLocalReservationRecords(localRecords)

    clear()
    notify('¡Reserva creada! (pago simulado)', 'success')
    onDone()
    nav('/account')
  }

  return <button className="btn" onClick={checkout} disabled={loading}>{loading? 'Procesando...' : 'Pagar (simulado)'}</button>
}
