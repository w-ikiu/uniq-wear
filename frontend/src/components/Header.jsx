import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ShoppingBag, Menu, X, Search, LogIn, LogOut, Shield, Package } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useCart } from '../CartContext'
import { useKeycloak } from '../KeycloakContext'

export default function Header() {
  const { itemCount, openDrawer, clearCart } = useCart()
  const { authenticated, user, keycloak, ready } = useKeycloak()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()

  const isAdmin     = user?.roles?.includes('admin')
  const isModerator = user?.roles?.includes('moderator') && !isAdmin

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
      setMenuOpen(false)
    }
  }

  return (
    <header
      className="sticky top-0 z-40 transition-all duration-300"
      style={{
        background: scrolled
          ? 'rgba(8,8,8,0.95)'
          : 'rgba(8,8,8,0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,45,120,0.15)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 flex-shrink-0 group">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #FF2D78, #BF00FF)', boxShadow: '0 0 12px rgba(255,45,120,0.5)' }}
            >
              <span className="font-display text-white text-[10px] font-black tracking-wider">UW</span>
            </div>
            <span className="font-display font-black text-base uppercase tracking-[0.15em] text-white">
              UNIQ<span style={{ color: '#FF2D78' }}>WEAR</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {[['/', 'Home', true], ['/products', 'Kolekcja', false]].map(([to, label, end]) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all duration-150 font-body ${
                    isActive
                      ? 'text-[#FF2D78]'
                      : 'text-zinc-400 hover:text-white'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            {/* link do zamowien widoczny tylko dla zalogowanych uzytkownikow */}
            {authenticated && (
              <NavLink
                to="/orders"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all duration-150 font-body flex items-center gap-1.5 ${
                    isActive ? 'text-[#FF2D78]' : 'text-zinc-400 hover:text-white'
                  }`
                }
              >
                <Package className="w-3 h-3" /> Zamówienia
              </NavLink>
            )}
            {/* link do panelu admina widoczny tylko dla uzytkownikow z rola admin */}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all duration-150 font-body flex items-center gap-1.5 ${
                    isActive ? 'text-[#CCFF00]' : 'text-zinc-400 hover:text-[#CCFF00]'
                  }`
                }
              >
                <Shield className="w-3 h-3" /> Admin
              </NavLink>
            )}
            {/* link do panelu moderatora — tylko dla uzytkownikow z rola moderator (bez admina) */}
            {isModerator && (
              <NavLink
                to="/moderator"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all duration-150 font-body flex items-center gap-1.5 ${
                    isActive ? 'text-[#a78bfa]' : 'text-zinc-400 hover:text-[#a78bfa]'
                  }`
                }
              >
                <Shield className="w-3 h-3" /> Moderacja
              </NavLink>
            )}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Desktop search */}
            <form onSubmit={handleSearch} className="hidden md:flex">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#FF2D78' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="SZUKAJ..."
                  className="pl-9 pr-4 py-2 text-xs font-semibold uppercase tracking-widest text-white placeholder-zinc-600 outline-none w-44 transition-all"
                  style={{
                    background: 'rgba(255,45,120,0.06)',
                    border: '1px solid rgba(255,45,120,0.2)',
                    borderRadius: '8px',
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,45,120,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,45,120,0.2)'}
                />
              </div>
            </form>

            {/* login / logout — widoczne po zaladowaniu keycloaka */}
            {ready && (
              authenticated ? (
                <div className="hidden md:flex items-center gap-2">
                  {/* avatar google — widoczny gdy uzytkownik zalogowal sie przez google */}
                  {user?.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-7 h-7 rounded-full object-cover"
                      style={{ border: '1px solid rgba(255,45,120,0.3)' }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-[10px] text-zinc-500 font-body uppercase tracking-widest">
                      {user?.name}
                    </span>
                  )}
                  {isAdmin && (
                    <span className="text-[9px] font-black font-body uppercase px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(204,255,0,0.1)', color: '#CCFF00', border: '1px solid rgba(204,255,0,0.3)' }}>
                      ADMIN
                    </span>
                  )}
                  {isModerator && (
                    <span className="text-[9px] font-black font-body uppercase px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                      MOD
                    </span>
                  )}
                  <button
                    onClick={() => { clearCart(); keycloak.logout({ redirectUri: window.location.origin }) }}
                    className="p-2 rounded-xl text-zinc-500 hover:text-[#FF2D78] transition-colors"
                    aria-label="Wyloguj"
                    title="Wyloguj"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => keycloak.login({ prompt: 'select_account' })}
                  className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold font-body uppercase tracking-widest transition-all duration-150"
                  style={{ border: '1px solid rgba(255,45,120,0.3)', color: '#FF2D78' }}
                >
                  <LogIn className="w-3.5 h-3.5" /> Zaloguj
                </button>
              )
            )}

            {/* Cart */}
            <button
              onClick={openDrawer}
              className="relative p-2.5 rounded-xl transition-all duration-200 group"
              style={{ border: '1px solid rgba(255,45,120,0.15)' }}
              aria-label="Koszyk"
            >
              <ShoppingBag className="w-4.5 h-4.5 text-zinc-300 group-hover:text-[#FF2D78] transition-colors" style={{ width: 18, height: 18 }} />
              {itemCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-5 h-5 text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none font-display"
                  style={{ background: 'linear-gradient(135deg, #FF2D78, #BF00FF)', boxShadow: '0 0 8px rgba(255,45,120,0.6)' }}
                >
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </button>

            {/* Mobile menu */}
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="md:hidden p-2.5 rounded-xl transition-colors text-zinc-400 hover:text-[#FF2D78]"
              aria-label="Menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden py-4 space-y-1" style={{ borderTop: '1px solid rgba(255,45,120,0.1)' }}>
            <form onSubmit={handleSearch} className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="SZUKAJ PRODUKTÓW..."
                className="input text-xs uppercase tracking-widest"
              />
            </form>
            {[['/', 'HOME'], ['/products', 'KOLEKCJA']].map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest font-body transition-colors ${
                    isActive ? 'text-[#FF2D78] bg-[rgba(255,45,120,0.08)]' : 'text-zinc-400'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            {authenticated && (
              <NavLink
                to="/orders"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest font-body transition-colors flex items-center gap-2 ${
                    isActive ? 'text-[#FF2D78] bg-[rgba(255,45,120,0.08)]' : 'text-zinc-400'
                  }`
                }
              >
                <Package className="w-3 h-3" /> MOJE ZAMÓWIENIA
              </NavLink>
            )}
            {isAdmin && (
              <NavLink
                to="/admin"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest font-body transition-colors flex items-center gap-2 ${
                    isActive ? 'text-[#CCFF00] bg-[rgba(204,255,0,0.08)]' : 'text-zinc-400'
                  }`
                }
              >
                <Shield className="w-3 h-3" /> ADMIN
              </NavLink>
            )}
            {isModerator && (
              <NavLink
                to="/moderator"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest font-body transition-colors flex items-center gap-2 ${
                    isActive ? 'text-[#a78bfa] bg-[rgba(139,92,246,0.08)]' : 'text-zinc-400'
                  }`
                }
              >
                <Shield className="w-3 h-3" /> MODERACJA
              </NavLink>
            )}
            {/* login / logout w menu mobilnym */}
            <div className="pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,45,120,0.1)' }}>
              {ready && (authenticated ? (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[10px] text-zinc-500 font-body uppercase">{user?.name}</span>
                  <button
                    onClick={() => { clearCart(); keycloak.logout({ redirectUri: window.location.origin }); setMenuOpen(false) }}
                    className="text-xs font-bold font-body uppercase tracking-widest flex items-center gap-1.5"
                    style={{ color: '#FF2D78' }}
                  >
                    <LogOut className="w-3.5 h-3.5" /> Wyloguj
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { keycloak.login({ prompt: 'select_account' }); setMenuOpen(false) }}
                  className="w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest font-body text-left flex items-center gap-2"
                  style={{ color: '#FF2D78' }}
                >
                  <LogIn className="w-3.5 h-3.5" /> ZALOGUJ SIĘ
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
