import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingBag, Star, ChevronRight, Check, Package } from 'lucide-react'
import { api } from '../api'
import { useCart } from '../CartContext'
import ProductPlaceholder from '../components/ProductPlaceholder'

function Stars({ rating, count }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className="w-4 h-4"
            style={{ color: i <= Math.round(rating) ? '#FF2D78' : '#333', fill: i <= Math.round(rating) ? '#FF2D78' : '#333' }}
          />
        ))}
      </div>
      {count !== undefined && (
        <span className="text-xs text-zinc-500 font-body">{count} recenzji</span>
      )}
    </div>
  )
}

export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addItem, openDrawer } = useCart()

  const [product, setProduct] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    setLoading(true); setError(null)
    Promise.all([api.getProduct(id), api.getReviews(id).catch(() => [])])
      .then(([prod, revs]) => {
        setProduct(prod); setReviews(revs)
        const inStock = prod.variants?.find(v => v.stock > 0)
        setSelectedVariant(inStock || prod.variants?.[0] || null)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  function handleAdd() {
    if (!selectedVariant) return
    addItem({
      sku: selectedVariant.sku,
      productId: product.id,
      productName: product.name,
      price: Number(selectedVariant.price),
      size: selectedVariant.size,
      color: selectedVariant.color,
      imageUrl: product.imageUrl || null,
    })
    setAdded(true)
    openDrawer()
    setTimeout(() => setAdded(false), 3000)
  }

  const sizes  = product?.variants ? [...new Set(product.variants.filter(v => v.size).map(v => v.size))] : []
  const colors = product?.variants ? [...new Set(product.variants.filter(v => v.color).map(v => v.color))] : []
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid md:grid-cols-2 gap-12">
        <div className="aspect-square rounded-3xl animate-pulse" style={{ background: '#111' }} />
        <div className="space-y-5 pt-4">
          {[24, 48, 24, '80%', '60%'].map((w, i) => (
            <div key={i} className="rounded-lg animate-pulse h-6" style={{ background: '#1a1a1a', width: typeof w === 'number' ? `${w}%` : w }} />
          ))}
        </div>
      </div>
    </div>
  )

  if (error || !product) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
      <Package className="w-8 h-8 mx-auto mb-4" style={{ color: '#FF2D78' }} />
      <p className="font-display text-sm uppercase tracking-widest mb-4" style={{ color: '#FF2D78' }}>
        {error || 'PRODUKT NIE ISTNIEJE'}
      </p>
      <button onClick={() => navigate('/products')} className="btn-outline text-xs">
        WRÓĆ DO KOLEKCJI
      </button>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[10px] text-zinc-600 font-body uppercase tracking-wider mb-8">
        <Link to="/" className="hover:text-[#FF2D78] transition-colors">HOME</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to="/products" className="hover:text-[#FF2D78] transition-colors">KOLEKCJA</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-400 truncate max-w-[180px]">{product.name.toUpperCase()}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
        {/* Image */}
        <div>
          <div className="aspect-square rounded-3xl overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid rgba(255,45,120,0.15)' }}>
            <ProductPlaceholder id={product.id} name={product.name} imageUrl={product.imageUrl} size="lg" />
          </div>
        </div>

        {/* Info */}
        <div className="space-y-6">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {product.brand && <span className="badge badge-cyan text-[10px] uppercase">{product.brand}</span>}
            {product.category?.name && (
              <Link to={`/products?category=${encodeURIComponent(product.category.name)}`} className="badge badge-pink text-[10px] uppercase hover:opacity-80">
                {product.category.name}
              </Link>
            )}
          </div>

          {/* Name */}
          <h1 className="font-display font-black text-3xl uppercase leading-tight text-white" style={{ letterSpacing: '-0.01em' }}>
            {product.name}
          </h1>

          {reviews.length > 0 && <Stars rating={avgRating} count={reviews.length} />}

          {/* Price */}
          {selectedVariant && (
            <div>
              <p className="font-display text-4xl font-black" style={{ color: '#FF2D78' }}>
                {Number(selectedVariant.price).toFixed(2)}
                <span className="text-xl ml-1 text-zinc-500">zł</span>
              </p>
              <p className={`text-xs font-bold font-body uppercase tracking-widest mt-2 ${selectedVariant.stock > 0 ? '' : ''}`}
                style={{ color: selectedVariant.stock > 0 ? '#CCFF00' : '#FF4444' }}>
                {selectedVariant.stock > 0 ? `✓ DOSTĘPNE — ${selectedVariant.stock} SZT.` : '✗ BRAK W MAGAZYNIE'}
              </p>
            </div>
          )}

          {/* Sizes */}
          {sizes.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500 font-body mb-3">
                ROZMIAR {selectedVariant?.size && <span style={{ color: '#FF2D78' }}>/ {selectedVariant.size}</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {sizes.map(size => {
                  const v = product.variants.find(v => v.size === size)
                  const ok = v?.stock > 0
                  const sel = selectedVariant?.size === size
                  return (
                    <button
                      key={size}
                      onClick={() => v && setSelectedVariant(v)}
                      disabled={!ok}
                      className="w-12 h-12 rounded-xl text-xs font-bold font-body uppercase transition-all duration-150"
                      style={sel
                        ? { background: 'linear-gradient(135deg,#FF2D78,#BF00FF)', color: '#fff', border: 'none', boxShadow: '0 0 15px rgba(255,45,120,0.5)' }
                        : ok
                        ? { background: 'transparent', color: '#aaa', border: '1px solid rgba(255,45,120,0.3)' }
                        : { background: 'transparent', color: '#333', border: '1px solid #1a1a1a', textDecoration: 'line-through', cursor: 'not-allowed' }
                      }
                    >
                      {size}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Colors */}
          {colors.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500 font-body mb-3">
                KOLOR {selectedVariant?.color && <span style={{ color: '#FF2D78' }}>/ {selectedVariant.color}</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {colors.map(color => {
                  const v = product.variants.find(v => v.color === color)
                  const sel = selectedVariant?.color === color
                  return (
                    <button
                      key={color}
                      onClick={() => v && setSelectedVariant(v)}
                      className="px-4 py-2 rounded-full text-xs font-bold font-body uppercase tracking-wider transition-all duration-150"
                      style={sel
                        ? { color: '#FF2D78', border: '1px solid #FF2D78', background: 'rgba(255,45,120,0.1)' }
                        : { color: '#666', border: '1px solid rgba(255,45,120,0.2)', background: 'transparent' }
                      }
                    >
                      {color}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleAdd}
            disabled={!selectedVariant || selectedVariant.stock === 0}
            className="w-full py-4 rounded-2xl font-display text-sm font-bold uppercase tracking-widest text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            style={added
              ? { background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 0 25px rgba(34,197,94,0.4)' }
              : { background: 'linear-gradient(135deg,#FF2D78,#BF00FF)', boxShadow: '0 0 25px rgba(255,45,120,0.35)' }
            }
          >
            {added ? <><Check className="w-5 h-5" /> DODANO ✦</> : <><ShoppingBag className="w-5 h-5" /> DODAJ DO KOSZYKA</>}
          </button>

          {/* Description */}
          {product.description && (
            <div className="pt-6" style={{ borderTop: '1px solid rgba(255,45,120,0.1)' }}>
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500 font-body mb-3">OPIS</p>
              <p className="text-sm text-zinc-400 font-body leading-relaxed">{product.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Reviews */}
      <div className="mt-16 pt-12" style={{ borderTop: '1px solid rgba(255,45,120,0.12)' }}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span style={{ color: '#FF2D78' }}>✦</span>
            <h2 className="section-title">RECENZJE</h2>
            {reviews.length > 0 && (
              <span className="badge badge-pink">{reviews.length}</span>
            )}
          </div>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2">
              <Stars rating={avgRating} />
              <span className="font-display font-bold text-white">{avgRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {reviews.length === 0 ? (
          <div className="text-center py-12 rounded-2xl" style={{ background: '#0f0f0f', border: '1px solid rgba(255,45,120,0.1)' }}>
            <Star className="w-7 h-7 mx-auto mb-3" style={{ color: 'rgba(255,45,120,0.3)' }} />
            <p className="text-xs text-zinc-600 font-body uppercase tracking-widest">BRAK RECENZJI</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviews.map((r, i) => (
              <div key={r._id || i} className="p-5 rounded-2xl" style={{ background: '#0f0f0f', border: '1px solid rgba(255,45,120,0.12)' }}>
                <div className="flex items-center justify-between mb-3">
                  <Stars rating={r.rating} />
                  <span className="text-[10px] text-zinc-600 font-body">
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString('pl-PL') : ''}
                  </span>
                </div>
                {r.title && <p className="font-display text-xs font-bold uppercase tracking-wider text-white mb-1">{r.title}</p>}
                {r.body  && <p className="text-xs text-zinc-500 font-body leading-relaxed">{r.body}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
