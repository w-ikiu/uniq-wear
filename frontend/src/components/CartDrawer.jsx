import { X, Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react'
import { useCart } from '../CartContext'
import { useNavigate } from 'react-router-dom'
import ProductPlaceholder from './ProductPlaceholder'

export default function CartDrawer() {
  const { items, drawerOpen, closeDrawer, removeItem, setQty, total, itemCount } = useCart()
  const navigate = useNavigate()

  function goToCheckout() {
    closeDrawer()
    navigate('/checkout')
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        onClick={closeDrawer}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 z-50 flex flex-col transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: '#0e0e0e', borderLeft: '1px solid rgba(255,45,120,0.2)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,45,120,0.12)' }}>
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5" style={{ color: '#FF2D78' }} />
            <span className="font-display text-sm font-bold uppercase tracking-widest text-white">KOSZYK</span>
            {itemCount > 0 && (
              <span className="badge badge-pink">{itemCount}</span>
            )}
          </div>
          <button
            onClick={closeDrawer}
            className="p-2 rounded-lg text-zinc-500 hover:text-[#FF2D78] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(255,45,120,0.08)', border: '1px solid rgba(255,45,120,0.2)' }}
              >
                <ShoppingBag className="w-8 h-8" style={{ color: '#FF2D78' }} />
              </div>
              <div>
                <p className="font-display text-sm font-bold uppercase tracking-widest text-white mb-1">KOSZYK PUSTY</p>
                <p className="text-xs text-zinc-500 font-body">Dodaj produkty i zacznij shopping</p>
              </div>
              <button onClick={closeDrawer} className="btn-outline text-xs">
                PRZEGLĄDAJ KOLEKCJĘ
              </button>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map(item => (
                <li
                  key={item.sku}
                  className="flex gap-4 p-3 rounded-xl"
                  style={{ background: '#161616', border: '1px solid rgba(255,45,120,0.1)' }}
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                    <ProductPlaceholder id={item.productId} name={item.productName} imageUrl={item.imageUrl} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate font-body">{item.productName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.size && <span className="text-[10px] text-zinc-500">/{item.size}</span>}
                      {item.color && <span className="text-[10px] text-zinc-500">{item.color}</span>}
                    </div>
                    <p className="text-sm font-bold mt-1" style={{ color: '#FF2D78' }}>
                      {(Number(item.price) * item.quantity).toFixed(2)} zł
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => removeItem(item.sku)}
                      className="p-1 rounded text-zinc-600 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div
                      className="flex items-center rounded-lg overflow-hidden"
                      style={{ border: '1px solid rgba(255,45,120,0.2)' }}
                    >
                      <button
                        onClick={() => setQty(item.sku, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-white">{item.quantity}</span>
                      <button
                        onClick={() => setQty(item.sku, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-5 space-y-4" style={{ borderTop: '1px solid rgba(255,45,120,0.12)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500 font-body uppercase tracking-widest">RAZEM</span>
              <span className="font-display text-2xl font-bold text-white">{total.toFixed(2)}<span className="text-sm ml-1" style={{ color: '#FF2D78' }}>zł</span></span>
            </div>
            <button onClick={goToCheckout} className="btn-primary w-full text-sm py-4">
              DO KASY
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[10px] text-zinc-600 text-center font-body tracking-wider">
              ✦ BEZPIECZNA PŁATNOŚĆ ✦ SZYBKA DOSTAWA ✦
            </p>
          </div>
        )}
      </div>
    </>
  )
}
