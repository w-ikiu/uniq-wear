import { Link } from 'react-router-dom'
import { Plus, Check } from 'lucide-react'
import { useState } from 'react'
import { useCart } from '../CartContext'
import ProductPlaceholder from './ProductPlaceholder'

export default function ProductCard({ product }) {
  const { addItem, openDrawer } = useCart()
  const [added, setAdded] = useState(false)

  const price = product.minPrice ? Number(product.minPrice).toFixed(2) : null

  function handleQuickAdd(e) {
    e.preventDefault()
    e.stopPropagation()
    addItem({
      sku: `product-${product.id}`,
      productId: product.id,
      productName: product.name,
      price: Number(product.minPrice || 0),
      imageUrl: product.imageUrl || null,
      quantity: 1,
    })
    setAdded(true)
    openDrawer()
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <Link
      to={`/products/${product.id}`}
      className="group block rounded-2xl overflow-hidden"
      style={{
        background: '#111',
        border: '1px solid rgba(255,45,120,0.15)',
        transition: 'all 0.25s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(255,45,120,0.55)'
        e.currentTarget.style.boxShadow = '0 0 30px rgba(255,45,120,0.1), 0 8px 32px rgba(0,0,0,0.6)'
        e.currentTarget.style.transform = 'translateY(-3px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,45,120,0.15)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Image area */}
      <div className="relative aspect-[4/5] overflow-hidden" style={{ background: '#0a0a0a' }}>
        <ProductPlaceholder id={product.id} name={product.name} imageUrl={product.imageUrl} />

        {/* Quick add */}
        <button
          onClick={handleQuickAdd}
          className="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0"
          style={added
            ? { background: '#22c55e', boxShadow: '0 0 15px rgba(34,197,94,0.5)' }
            : { background: 'linear-gradient(135deg, #FF2D78, #BF00FF)', boxShadow: '0 0 15px rgba(255,45,120,0.6)' }
          }
          aria-label="Dodaj do koszyka"
        >
          {added
            ? <Check className="w-4 h-4 text-white" />
            : <Plus className="w-4 h-4 text-white" />
          }
        </button>

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, #FF2D78, #BF00FF)', opacity: 0.7 }} />
      </div>

      {/* Info */}
      <div className="p-4">
        {/* Brand / category row */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 font-body">
            {product.brand || product.categoryName || 'UNIQWEAR'}
          </span>
          {product.categoryName && (
            <span className="badge badge-cyan text-[9px]">{product.categoryName}</span>
          )}
        </div>

        <h3 className="text-sm font-semibold text-white mb-3 line-clamp-2 leading-snug font-body">
          {product.name}
        </h3>

        <div className="flex items-center justify-between">
          {price ? (
            <span className="font-display text-base font-bold" style={{ color: '#FF2D78' }}>
              {price}<span className="text-xs ml-0.5 text-zinc-500"> zł</span>
            </span>
          ) : (
            <span className="text-xs text-zinc-600 font-body">Sprawdź cenę</span>
          )}
          <span className="text-[9px] text-zinc-600 font-body uppercase tracking-widest">→ SZCZEGÓŁY</span>
        </div>
      </div>
    </Link>
  )
}
