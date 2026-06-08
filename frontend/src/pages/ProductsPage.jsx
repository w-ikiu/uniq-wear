import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { api } from '../api'
import ProductCard from '../components/ProductCard'
import SkeletonCard from '../components/SkeletonCard'

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const activeCategory = searchParams.get('category') || ''
  const minPrice      = searchParams.get('minPrice') || ''
  const maxPrice      = searchParams.get('maxPrice') || ''
  const availableOnly = searchParams.get('available') === 'true'
  const searchQuery   = searchParams.get('search') || ''

  const [minInput, setMinInput] = useState(minPrice)
  const [maxInput, setMaxInput] = useState(maxPrice)

  useEffect(() => { api.getCategories().then(setCategories).catch(console.error) }, [])

  const fetchProducts = useCallback(() => {
    setLoading(true)
    api.getProducts({
      category:  activeCategory || undefined,
      minPrice:  minPrice || undefined,
      maxPrice:  maxPrice || undefined,
      available: availableOnly ? 'true' : undefined,
    })
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [activeCategory, minPrice, maxPrice, availableOnly])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const displayed = searchQuery
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.brand || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products

  function setParam(key, value) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      value ? next.set(key, value) : next.delete(key)
      return next
    })
  }

  function applyPrice() {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      minInput ? next.set('minPrice', minInput) : next.delete('minPrice')
      maxInput ? next.set('maxPrice', maxInput) : next.delete('maxPrice')
      return next
    })
  }

  function clearAll() {
    setMinInput(''); setMaxInput('')
    setSearchParams({})
  }

  const hasFilters = activeCategory || minPrice || maxPrice || availableOnly || searchQuery

  const filterPanel = (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500 font-body mb-3">KATEGORIA</p>
        <div className="space-y-1">
          {[{ id: 0, name: 'WSZYSTKIE' }, ...categories].map(cat => {
            const val = cat.id === 0 ? '' : cat.name
            const active = activeCategory === val
            return (
              <button
                key={cat.id}
                onClick={() => setParam('category', val)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider font-body transition-all duration-150"
                style={active
                  ? { color: '#FF2D78', background: 'rgba(255,45,120,0.1)', border: '1px solid rgba(255,45,120,0.3)' }
                  : { color: '#666', background: 'transparent', border: '1px solid transparent' }
                }
              >
                {cat.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Price */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500 font-body mb-3">CENA (ZŁ)</p>
        <div className="flex gap-2 items-center">
          <input
            type="number" placeholder="OD" value={minInput}
            onChange={e => setMinInput(e.target.value)}
            className="input py-2 px-3 text-xs uppercase tracking-wider"
            min="0"
          />
          <span className="text-zinc-600">—</span>
          <input
            type="number" placeholder="DO" value={maxInput}
            onChange={e => setMaxInput(e.target.value)}
            className="input py-2 px-3 text-xs uppercase tracking-wider"
            min="0"
          />
        </div>
        <button onClick={applyPrice} className="mt-3 w-full btn-outline text-[10px] py-2 uppercase tracking-widest">
          ZASTOSUJ
        </button>
      </div>

      {/* Availability */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500 font-body mb-3">DOSTĘPNOŚĆ</p>
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            onClick={() => setParam('available', availableOnly ? '' : 'true')}
            className="relative w-10 h-5 rounded-full transition-all duration-200 flex-shrink-0"
            style={{ background: availableOnly ? 'linear-gradient(135deg, #FF2D78, #BF00FF)' : '#222', border: '1px solid rgba(255,45,120,0.2)' }}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${availableOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <span className="text-xs text-zinc-400 font-body uppercase tracking-wider">TYLKO DOSTĘPNE</span>
        </label>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span style={{ color: '#FF2D78' }}>✦</span>
            <h1 className="section-title">
              {searchQuery ? `"${searchQuery}"` : 'KOLEKCJA'}
            </h1>
          </div>
          <p className="text-[10px] text-zinc-600 font-body uppercase tracking-widest ml-7">
            {loading ? 'ŁADOWANIE...' : `${displayed.length} PRODUKTÓW`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasFilters && (
            <button onClick={clearAll} className="btn-ghost text-[10px] uppercase tracking-widest" style={{ color: '#FF2D78' }}>
              <X className="w-3.5 h-3.5" /> WYCZYŚĆ
            </button>
          )}
          <button
            onClick={() => setFiltersOpen(v => !v)}
            className="md:hidden btn-outline text-[10px] uppercase tracking-widest"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> FILTRY
          </button>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <aside
          className={`w-52 flex-shrink-0 ${filtersOpen ? 'block' : 'hidden'} md:block sticky top-24 self-start`}
        >
          <div
            className="rounded-2xl p-5"
            style={{ background: '#0f0f0f', border: '1px solid rgba(255,45,120,0.15)' }}
          >
            {filterPanel}
          </div>
        </aside>

        {/* Grid */}
        <div className="flex-1 min-w-0">
          {/* Active tags */}
          {hasFilters && (
            <div className="flex flex-wrap gap-2 mb-5">
              {activeCategory && (
                <span className="badge badge-pink flex items-center gap-1.5">
                  {activeCategory}
                  <button onClick={() => setParam('category', '')}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {(minPrice || maxPrice) && (
                <span className="badge badge-pink flex items-center gap-1.5">
                  {minPrice && maxPrice ? `${minPrice}–${maxPrice} zł` : minPrice ? `od ${minPrice}` : `do ${maxPrice}`}
                  <button onClick={() => {
                    setMinInput(''); setMaxInput('')
                    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('minPrice'); n.delete('maxPrice'); return n })
                  }}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {availableOnly && (
                <span className="badge badge-cyan flex items-center gap-1.5">
                  DOSTĘPNE <button onClick={() => setParam('available', '')}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {searchQuery && (
                <span className="badge badge-lime flex items-center gap-1.5">
                  "{searchQuery}" <button onClick={() => setParam('search', '')}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : displayed.map(p => <ProductCard key={p.id} product={p} />)
            }
          </div>

          {!loading && displayed.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="font-display text-sm uppercase tracking-widest mb-2" style={{ color: '#FF2D78' }}>
                ✦ BRAK WYNIKÓW ✦
              </p>
              <p className="text-xs text-zinc-600 font-body mb-6">Zmień filtry lub wyczyść wyszukiwanie</p>
              <button onClick={clearAll} className="btn-outline text-xs">WYCZYŚĆ FILTRY</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
