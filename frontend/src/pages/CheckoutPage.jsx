import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, ShoppingBag, MapPin, User, Mail, Phone, Lock, LogIn } from 'lucide-react'
import { useCart } from '../CartContext'
import { useKeycloak } from '../KeycloakContext'
import { api } from '../api'
import ProductPlaceholder from '../components/ProductPlaceholder'

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart()
  const { authenticated, ready, user, keycloak } = useKeycloak()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', street: '', city: '', zip: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name]) setErrors(e => ({ ...e, [name]: '' }))
  }

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = 'Wymagane'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Nieprawidłowy e-mail'
    if (!form.phone.trim()) e.phone = 'Wymagane'
    if (!form.street.trim()) e.street = 'Wymagane'
    if (!form.city.trim()) e.city = 'Wymagane'
    if (!form.zip.trim()) e.zip = 'Wymagane'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true); setServerError('')
    try {
      const result = await api.checkout({
        items: items.map(i => ({ sku: i.sku, quantity: i.quantity })),
      })
      clearCart()
      navigate(`/order-success?orderId=${result.order?.id || 'OK'}`)
    } catch (err) {
      setServerError(err.message || 'Błąd składania zamówienia')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
      <ShoppingBag className="w-8 h-8 mx-auto mb-4" style={{ color: '#FF2D78' }} />
      <p className="font-display text-sm uppercase tracking-widest mb-6" style={{ color: '#FF2D78' }}>KOSZYK PUSTY</p>
      <Link to="/products" className="btn-primary text-xs">DO KOLEKCJI</Link>
    </div>
  )

  // checkout wymaga zalogowania — gateway blokuje niezalogowanych uzytkownikow (401)
  if (ready && !authenticated) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
      <div
        className="inline-flex flex-col items-center gap-6 p-10 rounded-3xl"
        style={{ background: '#0f0f0f', border: '1px solid rgba(255,45,120,0.2)' }}
      >
        <Lock className="w-8 h-8" style={{ color: '#FF2D78' }} />
        <div>
          <p className="font-display text-sm uppercase tracking-widest text-white mb-2">WYMAGANE LOGOWANIE</p>
          <p className="text-xs text-zinc-500 font-body">Zaloguj się żeby złożyć zamówienie</p>
        </div>
        <button
          onClick={() => keycloak.login()}
          className="btn-primary inline-flex items-center gap-2 text-xs"
        >
          <LogIn className="w-4 h-4" /> ZALOGUJ SIĘ
        </button>
      </div>
    </div>
  )

  const fieldStyle = (key) => ({
    ...(!errors[key] ? {} : { borderColor: '#FF2D78', boxShadow: '0 0 0 2px rgba(255,45,120,0.15)' })
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[10px] text-zinc-600 font-body uppercase tracking-wider mb-8">
        <Link to="/" className="hover:text-[#FF2D78] transition-colors">HOME</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-400">KASA</span>
      </nav>

      <div className="flex items-center gap-3 mb-8">
        <span style={{ color: '#FF2D78' }}>✦</span>
        <h1 className="section-title">ZAMÓWIENIE</h1>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-5">

          {/* Personal */}
          <div className="rounded-2xl p-6" style={{ background: '#0f0f0f', border: '1px solid rgba(255,45,120,0.15)' }}>
            <div className="flex items-center gap-2 mb-5">
              <User className="w-4 h-4" style={{ color: '#FF2D78' }} />
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] font-body text-white">DANE OSOBOWE</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-body mb-1.5">IMIĘ I NAZWISKO</label>
                <input name="name" value={form.name} onChange={handleChange} placeholder="Jan Kowalski" className="input" style={fieldStyle('name')} />
                {errors.name && <p className="text-[10px] mt-1 font-body" style={{ color: '#FF2D78' }}>{errors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-body mb-1.5">E-MAIL</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="jan@example.com" className="input" style={fieldStyle('email')} />
                  {errors.email && <p className="text-[10px] mt-1 font-body" style={{ color: '#FF2D78' }}>{errors.email}</p>}
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-body mb-1.5">TELEFON</label>
                  <input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+48 000 000 000" className="input" style={fieldStyle('phone')} />
                  {errors.phone && <p className="text-[10px] mt-1 font-body" style={{ color: '#FF2D78' }}>{errors.phone}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="rounded-2xl p-6" style={{ background: '#0f0f0f', border: '1px solid rgba(255,45,120,0.15)' }}>
            <div className="flex items-center gap-2 mb-5">
              <MapPin className="w-4 h-4" style={{ color: '#00E5FF' }} />
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] font-body text-white">ADRES DOSTAWY</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-body mb-1.5">ULICA I NUMER</label>
                <input name="street" value={form.street} onChange={handleChange} placeholder="ul. Przykładowa 1/2" className="input" style={fieldStyle('street')} />
                {errors.street && <p className="text-[10px] mt-1 font-body" style={{ color: '#FF2D78' }}>{errors.street}</p>}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-body mb-1.5">KOD</label>
                  <input name="zip" value={form.zip} onChange={handleChange} placeholder="00-000" className="input" style={fieldStyle('zip')} />
                  {errors.zip && <p className="text-[10px] mt-1 font-body" style={{ color: '#FF2D78' }}>{errors.zip}</p>}
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-body mb-1.5">MIASTO</label>
                  <input name="city" value={form.city} onChange={handleChange} placeholder="Warszawa" className="input" style={fieldStyle('city')} />
                  {errors.city && <p className="text-[10px] mt-1 font-body" style={{ color: '#FF2D78' }}>{errors.city}</p>}
                </div>
              </div>
            </div>
          </div>

          {serverError && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,45,120,0.08)', border: '1px solid rgba(255,45,120,0.3)' }}>
              <p className="text-xs font-body" style={{ color: '#FF2D78' }}>{serverError}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-5 text-sm">
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                PROCESSING...
              </span>
            ) : (
              <><Lock className="w-4 h-4" /> ZŁÓŻ ZAMÓWIENIE ✦ {total.toFixed(2)} ZŁ</>
            )}
          </button>
        </form>

        {/* Summary */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl p-6 sticky top-24" style={{ background: '#0f0f0f', border: '1px solid rgba(255,45,120,0.15)' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] font-body text-white mb-5">
              TWOJE PRODUKTY ({items.length})
            </p>

            <ul className="space-y-3 mb-6">
              {items.map(item => (
                <li key={item.sku} className="flex gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                    <ProductPlaceholder id={item.productId} name={item.productName} imageUrl={item.imageUrl} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate font-body">{item.productName}</p>
                    {item.size && <p className="text-[10px] text-zinc-500 font-body">/{item.size}</p>}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-zinc-600 font-body">×{item.quantity}</span>
                      <span className="text-sm font-bold font-body" style={{ color: '#FF2D78' }}>
                        {(Number(item.price) * item.quantity).toFixed(2)} zł
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-2 pt-4" style={{ borderTop: '1px solid rgba(255,45,120,0.1)' }}>
              <div className="flex justify-between text-xs text-zinc-500 font-body uppercase tracking-wider">
                <span>PRODUKTY</span><span>{total.toFixed(2)} zł</span>
              </div>
              <div className="flex justify-between text-xs font-body uppercase tracking-wider">
                <span className="text-zinc-500">DOSTAWA</span>
                <span style={{ color: '#CCFF00' }}>GRATIS</span>
              </div>
              <div className="flex justify-between pt-3" style={{ borderTop: '1px solid rgba(255,45,120,0.1)' }}>
                <span className="font-display text-sm font-bold uppercase text-white">ŁĄCZNIE</span>
                <span className="font-display text-xl font-black" style={{ color: '#FF2D78' }}>{total.toFixed(2)} <span className="text-sm">zł</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
