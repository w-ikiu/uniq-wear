import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Plus, RefreshCw, Package, Tag, BarChart2, Star, Check, Search, Boxes } from 'lucide-react'
import { useKeycloak } from '../KeycloakContext'
import { api } from '../api'

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

  const [categories, setCategories]         = useState([])
  const [orders, setOrders]                 = useState([])
  const [stats, setStats]                   = useState([])
  const [pendingReviews, setPendingReviews] = useState([])
  const [analytics, setAnalytics]           = useState([])
  const [searchResults, setSearchResults]   = useState([])

  const [newCat, setNewCat]           = useState('')
  const [searchKw, setSearchKw]       = useState('')
  const [searchWt, setSearchWt]       = useState('')
  const [productForm, setProductForm] = useState({
    name: '', description: '', categoryId: '', price: '', sku: '', longDescription: '', stock: '0'
  })

  const [loadingCats, setLoadingCats]         = useState(false)
  const [loadingOrders, setLoadingOrders]     = useState(false)
  const [loadingStats, setLoadingStats]       = useState(false)
  const [loadingReviews, setLoadingReviews]   = useState(false)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [loadingSearch, setLoadingSearch]     = useState(false)
  const [loadingProduct, setLoadingProduct]   = useState(false)

  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (ready && (!authenticated || !isAdmin)) navigate('/')
  }, [ready, authenticated, isAdmin, navigate])

  useEffect(() => {
    if (!isAdmin) return
    fetchCategories(); fetchOrders(); fetchStats(); fetchPendingReviews(); fetchAnalytics()
  }, [isAdmin])

  function notify(msg, isError = false) {
    isError ? setError(msg) : setSuccess(msg)
    setTimeout(() => isError ? setError('') : setSuccess(''), 4000)
  }

  function fetchCategories() {
    setLoadingCats(true)
    api.getCategories().then(setCategories).catch(() => notify('blad pobierania kategorii', true)).finally(() => setLoadingCats(false))
  }
  function fetchOrders() {
    setLoadingOrders(true)
    api.getOrders().then(setOrders).catch(() => {}).finally(() => setLoadingOrders(false))
  }
  function fetchStats() {
    setLoadingStats(true)
    api.getInventoryStats().then(setStats).catch(() => {}).finally(() => setLoadingStats(false))
  }
  function fetchPendingReviews() {
    setLoadingReviews(true)
    api.getAllReviews('pending').then(setPendingReviews).catch(() => {}).finally(() => setLoadingReviews(false))
  }
  function fetchAnalytics() {
    setLoadingAnalytics(true)
    api.getAnalyticsRatings().then(setAnalytics).catch(() => {}).finally(() => setLoadingAnalytics(false))
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCat.trim()) return
    try {
      await api.createCategory(newCat.trim())
      setNewCat('')
      notify('kategoria dodana')
      fetchCategories()
    } catch (err) { notify(err.message, true) }
  }

  async function handleApproveReview(reviewId) {
    try {
      await api.approveReview(reviewId)
      notify('recenzja zatwierdzona')
      fetchPendingReviews()
      fetchAnalytics()
    } catch (err) { notify(err.message, true) }
  }

  async function handleCreateProduct(e) {
    e.preventDefault()
    setLoadingProduct(true)
    try {
      await api.createProductHybrid({
        ...productForm,
        categoryId: parseInt(productForm.categoryId),
        price:      parseFloat(productForm.price),
        stock:      parseInt(productForm.stock),
      })
      notify('produkt utworzony w postgres i mongodb')
      setProductForm({ name: '', description: '', categoryId: '', price: '', sku: '', longDescription: '', stock: '0' })
    } catch (err) { notify(err.message, true) }
    finally { setLoadingProduct(false) }
  }

  async function handleSearch(e) {
    e.preventDefault()
    setLoadingSearch(true)
    try {
      const results = await api.searchProductDetails(searchKw, searchWt || undefined)
      setSearchResults(results)
    } catch (err) { notify(err.message, true) }
    finally { setLoadingSearch(false) }
  }

  if (!ready || !authenticated || !isAdmin) return null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">

      <div className="flex items-center gap-3 mb-8">
        <span style={{ color: '#CCFF00' }}>✦</span>
        <h1 className="font-display font-black text-2xl uppercase tracking-tight text-white">PANEL ADMINA</h1>
        <span className="text-[9px] font-black font-body uppercase px-2 py-0.5 rounded-full ml-2"
          style={{ background: 'rgba(204,255,0,0.1)', color: '#CCFF00', border: '1px solid rgba(204,255,0,0.3)' }}>
          {user?.name}
        </span>
      </div>

      {error && <div className="mb-4 rounded-xl p-3 text-xs font-body" style={{ background: 'rgba(255,45,120,0.08)', color: '#FF2D78', border: '1px solid rgba(255,45,120,0.2)' }}>{error}</div>}
      {success && <div className="mb-4 rounded-xl p-3 text-xs font-body" style={{ background: 'rgba(204,255,0,0.08)', color: '#CCFF00', border: '1px solid rgba(204,255,0,0.2)' }}>{success}</div>}

      {/* row 1: kategorie, stany, zamowienia */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">

        <Section title="Kategorie" icon={Tag} loading={loadingCats}>
          <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
            <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nowa kategoria..." className="input flex-1 text-xs" />
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

        <Section title="Stany magazynowe" icon={BarChart2} loading={loadingStats}>
          {stats.length === 0 ? <p className="text-xs text-zinc-600 font-body">brak danych</p> : (
            <ul className="space-y-2">
              {stats.map(s => (
                <li key={s.categoryId} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span className="text-[10px] text-zinc-500 font-body uppercase">kat. {s.categoryId}</span>
                  <span className="text-sm font-black font-display" style={{ color: s.totalStock > 0 ? '#CCFF00' : '#FF2D78' }}>{s.totalStock} szt.</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Zamówienia (${orders.length})`} icon={Package} loading={loadingOrders}>
          {orders.length === 0 ? <p className="text-xs text-zinc-600 font-body">brak zamowien</p> : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {orders.slice(0, 20).map(o => (
                <li key={o.id} className="py-2 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-display font-black" style={{ color: '#FF2D78' }}>#{o.id}</span>
                    <span className="text-[9px] font-bold font-body uppercase px-2 py-0.5 rounded-full"
                      style={o.status === 'paid' ? { background: 'rgba(204,255,0,0.1)', color: '#CCFF00' } : { background: 'rgba(255,45,120,0.1)', color: '#FF2D78' }}>
                      {o.status}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-zinc-600 font-body">{new Date(o.createdAt).toLocaleDateString('pl-PL')}</span>
                    <span className="text-xs font-bold font-body text-zinc-300">{Number(o.totalAmount).toFixed(2)} zł</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* row 2: oczekujace recenzje, analityki */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">

        <Section title={`Recenzje oczekujące (${pendingReviews.length})`} icon={Star} loading={loadingReviews}>
          {pendingReviews.length === 0 ? <p className="text-xs text-zinc-600 font-body">brak oczekujacych recenzji</p> : (
            <ul className="space-y-3 max-h-64 overflow-y-auto">
              {pendingReviews.map(r => (
                <li key={r._id} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} className="w-3 h-3" style={{ color: i <= r.rating ? '#FF2D78' : '#333', fill: i <= r.rating ? '#FF2D78' : '#333' }} />
                          ))}
                        </div>
                        <span className="text-[10px] text-zinc-600 font-body">produkt #{r.productId}</span>
                      </div>
                      {r.title && <p className="text-xs font-bold text-white font-body truncate">{r.title}</p>}
                      {r.body  && <p className="text-[10px] text-zinc-500 font-body mt-0.5 line-clamp-2">{r.body}</p>}
                    </div>
                    {/* zatwierdzenie recenzji — wymaga roli admin, inkrementuje licznik w pg */}
                    <button onClick={() => handleApproveReview(r._id)}
                      className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
                      style={{ background: 'rgba(204,255,0,0.1)', border: '1px solid rgba(204,255,0,0.3)', color: '#CCFF00' }}
                      title="Zatwierdz">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Analityki ocen (MongoDB agregacja)" icon={BarChart2} loading={loadingAnalytics}>
          {analytics.length === 0 ? <p className="text-xs text-zinc-600 font-body">brak danych — zatwierdz recenzje</p> : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {analytics.map(a => (
                <li key={a.productId} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div>
                    <span className="text-[10px] text-zinc-500 font-body">produkt #{a.productId}</span>
                    {a.description && <p className="text-[10px] text-zinc-600 font-body truncate max-w-[160px]">{a.description}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black font-display" style={{ color: '#FF2D78' }}>★ {a.averageRating}</p>
                    <p className="text-[10px] text-zinc-600 font-body">{a.reviewCount} recenzji</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* row 3: nowy produkt (hybrid), wyszukiwanie mongodb */}
      <div className="grid lg:grid-cols-2 gap-6">

        <Section title="Nowy produkt (zapis hybryda PG + MongoDB)" icon={Boxes} loading={loadingProduct}>
          <form onSubmit={handleCreateProduct} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-zinc-500 font-body mb-1">NAZWA</label>
                <input value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} className="input text-xs" required />
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-zinc-500 font-body mb-1">SKU</label>
                <input value={productForm.sku} onChange={e => setProductForm(f => ({ ...f, sku: e.target.value }))} placeholder="np. PROD-001" className="input text-xs" required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-zinc-500 font-body mb-1">CENA (ZŁ)</label>
                <input type="number" value={productForm.price} onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))} className="input text-xs" required />
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-zinc-500 font-body mb-1">STOCK</label>
                <input type="number" value={productForm.stock} onChange={e => setProductForm(f => ({ ...f, stock: e.target.value }))} className="input text-xs" />
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-zinc-500 font-body mb-1">KAT. ID</label>
                <select value={productForm.categoryId} onChange={e => setProductForm(f => ({ ...f, categoryId: e.target.value }))} className="input text-xs" required>
                  <option value="">wybierz</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[9px] uppercase tracking-widest text-zinc-500 font-body mb-1">OPIS KRÓTKI (PostgreSQL)</label>
              <input value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} className="input text-xs" required />
            </div>
            <div>
              <label className="block text-[9px] uppercase tracking-widest text-zinc-500 font-body mb-1">OPIS DŁUGI (MongoDB)</label>
              <textarea value={productForm.longDescription} onChange={e => setProductForm(f => ({ ...f, longDescription: e.target.value }))} className="input text-xs resize-none" rows={2} />
            </div>
            <button type="submit" disabled={loadingProduct} className="btn-primary text-xs w-full">
              {loadingProduct ? 'ZAPISUJĘ...' : 'UTWÓRZ PRODUKT ✦'}
            </button>
          </form>
        </Section>

        <Section title="Wyszukiwanie szczegółów (MongoDB $text + $gte)" icon={Search} loading={loadingSearch}>
          <form onSubmit={handleSearch} className="space-y-3 mb-4">
            <div>
              <label className="block text-[9px] uppercase tracking-widest text-zinc-500 font-body mb-1">SŁOWO KLUCZOWE</label>
              <input value={searchKw} onChange={e => setSearchKw(e.target.value)} placeholder="np. biegowy" className="input text-xs" />
            </div>
            <div>
              <label className="block text-[9px] uppercase tracking-widest text-zinc-500 font-body mb-1">MIN. WAGA (g)</label>
              <input type="number" value={searchWt} onChange={e => setSearchWt(e.target.value)} placeholder="np. 300" className="input text-xs" />
            </div>
            <button type="submit" className="btn-primary text-xs w-full">SZUKAJ W MONGODB</button>
          </form>
          {searchResults.length === 0 && !loadingSearch && searchKw && (
            <p className="text-xs text-zinc-600 font-body">brak wynikow</p>
          )}
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {searchResults.map(r => (
              <li key={r._id} className="py-2 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-xs font-bold text-white font-body">produkt #{r.productId}</p>
                {r.long_description && <p className="text-[10px] text-zinc-500 font-body mt-0.5 line-clamp-2">{r.long_description}</p>}
              </li>
            ))}
          </ul>
        </Section>

      </div>
    </div>
  )
}
