import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Plus, Trash2, RefreshCw, Package, Tag, BarChart2 } from 'lucide-react'
import { useKeycloak } from '../KeycloakContext'
import { api } from '../api'

// sekcja z naglowkiem i opcjonalnym ladowaniem
function Section({ title, icon: Icon, children, loading }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: '#0f0f0f', border: '1px solid rgba(204,255,0,0.15)' }}>
      <div className="flex items-center gap-2 mb-5">
        <Icon className="w-4 h-4" style={{ color: '#CCFF00' }} />
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] font-body text-white">{title}</p>
        {loading && <RefreshCw className="w-3 h-3 animate-spin ml-auto" style={{ color: '#CCFF00' }} />}
      </div>
      {children}
    </div>
  )
}

export default function AdminPage() {
  const { authenticated, ready, user } = useKeycloak()
  const navigate = useNavigate()
  const isAdmin = user?.roles?.includes('admin')

  const [categories, setCategories] = useState([])
  const [orders, setOrders]         = useState([])
  const [stats, setStats]           = useState([])
  const [newCat, setNewCat]         = useState('')
  const [loadingCats, setLoadingCats]     = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [loadingStats, setLoadingStats]   = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')

  // przekierowanie jesli nie admin — strona sama pilnuje dostepu
  useEffect(() => {
    if (ready && (!authenticated || !isAdmin)) {
      navigate('/')
    }
  }, [ready, authenticated, isAdmin, navigate])

  useEffect(() => {
    if (!isAdmin) return
    fetchAll()
  }, [isAdmin])

  function fetchAll() {
    fetchCategories()
    fetchOrders()
    fetchStats()
  }

  function fetchCategories() {
    setLoadingCats(true)
    api.getCategories()
      .then(setCategories)
      .catch(() => setError('nie udalo sie pobrac kategorii'))
      .finally(() => setLoadingCats(false))
  }

  function fetchOrders() {
    setLoadingOrders(true)
    api.getOrders()
      .then(setOrders)
      .catch(() => setError('nie udalo sie pobrac zamowien'))
      .finally(() => setLoadingOrders(false))
  }

  function fetchStats() {
    setLoadingStats(true)
    api.getInventoryStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoadingStats(false))
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCat.trim()) return
    try {
      await api.createCategory(newCat.trim())
      setNewCat('')
      setSuccess('kategoria dodana')
      setTimeout(() => setSuccess(''), 3000)
      fetchCategories()
    } catch (err) {
      setError(err.message)
    }
  }

  // jesli keycloak jeszcze sie inicjalizuje — nie renderujemy nic
  if (!ready) return null

  // jesli uzytkownik nie jest adminem — przekierowanie obsluzy useEffect
  if (!authenticated || !isAdmin) return null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">

      <div className="flex items-center gap-3 mb-8">
        <span style={{ color: '#CCFF00' }}>✦</span>
        <h1 className="font-display font-black text-2xl uppercase tracking-tight text-white">
          PANEL ADMINA
        </h1>
        <span
          className="text-[9px] font-black font-body uppercase px-2 py-0.5 rounded-full ml-2"
          style={{ background: 'rgba(204,255,0,0.1)', color: '#CCFF00', border: '1px solid rgba(204,255,0,0.3)' }}
        >
          {user?.name}
        </span>
      </div>

      {/* komunikaty */}
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

      <div className="grid lg:grid-cols-3 gap-6">

        {/* kategorie */}
        <Section title="Kategorie" icon={Tag} loading={loadingCats}>
          <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
            <input
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              placeholder="Nowa kategoria..."
              className="input flex-1 text-xs"
            />
            <button type="submit" className="p-2 rounded-xl flex-shrink-0" style={{ background: 'rgba(204,255,0,0.1)', border: '1px solid rgba(204,255,0,0.3)', color: '#CCFF00' }}>
              <Plus className="w-4 h-4" />
            </button>
          </form>
          <ul className="space-y-2">
            {categories.map(cat => (
              <li key={cat.id} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-xs font-body text-zinc-300">{cat.name}</span>
                <span className="text-[10px] text-zinc-600 font-body">#{cat.id}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* stany magazynowe */}
        <Section title="Stany magazynowe" icon={BarChart2} loading={loadingStats}>
          {stats.length === 0 ? (
            <p className="text-xs text-zinc-600 font-body">brak danych</p>
          ) : (
            <ul className="space-y-2">
              {stats.map(s => (
                <li key={s.categoryId} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span className="text-[10px] text-zinc-500 font-body uppercase">kat. {s.categoryId}</span>
                  <span className="text-sm font-black font-display" style={{ color: s.totalStock > 0 ? '#CCFF00' : '#FF2D78' }}>
                    {s.totalStock} szt.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ostatnie zamowienia */}
        <Section title={`Zamówienia (${orders.length})`} icon={Package} loading={loadingOrders}>
          {orders.length === 0 ? (
            <p className="text-xs text-zinc-600 font-body">brak zamowien</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {orders.slice(0, 20).map(o => (
                <li key={o.id} className="py-2 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-display font-black" style={{ color: '#FF2D78' }}>#{o.id}</span>
                    <span
                      className="text-[9px] font-bold font-body uppercase px-2 py-0.5 rounded-full"
                      style={o.status === 'paid'
                        ? { background: 'rgba(204,255,0,0.1)', color: '#CCFF00' }
                        : { background: 'rgba(255,45,120,0.1)', color: '#FF2D78' }
                      }
                    >
                      {o.status}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-zinc-600 font-body">
                      {new Date(o.createdAt).toLocaleDateString('pl-PL')}
                    </span>
                    <span className="text-xs font-bold font-body text-zinc-300">
                      {Number(o.totalAmount).toFixed(2)} zł
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

      </div>
    </div>
  )
}
