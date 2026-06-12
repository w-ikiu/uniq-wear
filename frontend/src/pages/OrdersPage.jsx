import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, X, RefreshCw, LogIn } from 'lucide-react'
import { useKeycloak } from '../KeycloakContext'
import { api } from '../api'

const STATUS_COLORS = {
  paid:      { bg: 'rgba(204,255,0,0.08)',    color: '#CCFF00',  border: 'rgba(204,255,0,0.2)' },
  cancelled: { bg: 'rgba(255,45,120,0.08)',   color: '#FF2D78',  border: 'rgba(255,45,120,0.2)' },
  pending:   { bg: 'rgba(255,255,255,0.04)',  color: '#aaa',     border: 'rgba(255,255,255,0.1)' },
}

export default function OrdersPage() {
  const { authenticated, ready, user, keycloak } = useKeycloak()
  const navigate = useNavigate()

  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(false)
  const [cancelling, setCancelling] = useState(null)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  useEffect(() => {
    if (!ready) return
    if (!authenticated) return
    fetchOrders()
  }, [ready, authenticated, user])

  function fetchOrders() {
    setLoading(true)
    setError('')
    api.getOrders()
      .then(setOrders)
      .catch(() => setError('nie udalo sie pobrac zamowien'))
      .finally(() => setLoading(false))
  }

  async function handleCancel(orderId) {
    setCancelling(orderId)
    try {
      await api.cancelOrder(orderId)
      setSuccess('zamowienie anulowane')
      setTimeout(() => setSuccess(''), 3000)
      fetchOrders()
    } catch (err) {
      setError(err.message)
      setTimeout(() => setError(''), 4000)
    } finally {
      setCancelling(null)
    }
  }

  if (!ready) return null

  // jesli uzytkownik niezalogowany — pokaz zachete zamiast przekierowywac
  if (!authenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <div className="rounded-2xl p-10 text-center max-w-sm w-full" style={{ background: '#0f0f0f', border: '1px solid rgba(255,45,120,0.15)' }}>
          <Package className="w-10 h-10 mx-auto mb-4 text-zinc-700" />
          <h2 className="font-display font-black text-xl uppercase tracking-tight text-white mb-2">MOJE ZAMÓWIENIA</h2>
          <p className="text-xs text-zinc-500 font-body mb-6">Zaloguj sie, zeby zobaczyc swoje zamowienia i historię zakupow.</p>
          <button
            onClick={() => keycloak.login()}
            className="btn-primary w-full flex items-center justify-center gap-2 text-xs"
          >
            <LogIn className="w-4 h-4" /> ZALOGUJ SIĘ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <span style={{ color: '#FF2D78' }}>✦</span>
          <h1 className="font-display font-black text-2xl uppercase tracking-tight text-white">MOJE ZAMÓWIENIA</h1>
        </div>
        <button onClick={fetchOrders} className="p-2 rounded-xl text-zinc-600 hover:text-zinc-300 transition-colors" title="Odswierz">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl p-3 text-xs font-body" style={{ background: 'rgba(255,45,120,0.08)', color: '#FF2D78', border: '1px solid rgba(255,45,120,0.2)' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl p-3 text-xs font-body" style={{ background: 'rgba(204,255,0,0.08)', color: '#CCFF00', border: '1px solid rgba(204,255,0,0.2)' }}>
          {success}
        </div>
      )}

      {loading && orders.length === 0 && (
        <div className="text-center py-16 text-zinc-600 font-body text-xs">ładowanie...</div>
      )}

      {!loading && orders.length === 0 && (
        <div className="text-center py-16">
          <Package className="w-12 h-12 mx-auto mb-4 text-zinc-800" />
          <p className="text-zinc-600 font-body text-sm">Brak zamowien — czas na zakupy!</p>
          <button onClick={() => navigate('/products')} className="mt-6 btn-primary text-xs">PRZEGLĄDAJ KOLEKCJĘ</button>
        </div>
      )}

      <div className="space-y-4">
        {orders.map(order => {
          const style = STATUS_COLORS[order.status] || STATUS_COLORS.pending
          const canCancel = order.status === 'paid'

          return (
            <div key={order.id} className="rounded-2xl overflow-hidden" style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.05)' }}>
              {/* naglowek zamowienia */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-3">
                  <span className="font-display font-black text-sm" style={{ color: '#FF2D78' }}>#{order.id}</span>
                  <span className="text-[10px] font-bold font-body uppercase px-2 py-0.5 rounded-full"
                    style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                    {order.status}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-600 font-body">{new Date(order.createdAt).toLocaleDateString('pl-PL')}</p>
                    <p className="text-base font-black font-display text-white">{Number(order.totalAmount).toFixed(2)} <span className="text-xs text-zinc-500">zł</span></p>
                  </div>
                  {/* anulowanie mozliwe tylko dla zamowien oplaconych — po anulowaniu status sie zmienia */}
                  {canCancel && (
                    <button
                      onClick={() => handleCancel(order.id)}
                      disabled={cancelling === order.id}
                      className="p-2 rounded-xl transition-colors"
                      style={{ background: 'rgba(255,45,120,0.08)', border: '1px solid rgba(255,45,120,0.2)', color: '#FF2D78' }}
                      title="Anuluj zamowienie"
                    >
                      {cancelling === order.id
                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                        : <X className="w-4 h-4" />
                      }
                    </button>
                  )}
                </div>
              </div>

              {/* pozycje zamowienia — orderline zawiera sku, quantity, price */}
              {order.lines && order.lines.length > 0 && (
                <ul>
                  {order.lines.map((line, i) => (
                    <li key={i} className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                      <p className="text-xs font-bold text-white font-body font-mono">{line.sku}</p>
                      <p className="text-xs font-bold font-body text-zinc-300 flex-shrink-0 ml-4">
                        {line.quantity} × {Number(line.price).toFixed(2)} zł
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
