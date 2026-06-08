import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Zap, Shield, RotateCcw, Star } from 'lucide-react'
import { api } from '../api'
import ProductCard from '../components/ProductCard'
import SkeletonCard from '../components/SkeletonCard'

const PERKS = [
  { icon: Zap,        label: 'EKSPRESOWA DOSTAWA', sub: '24h' },
  { icon: Shield,     label: 'GWARANCJA JAKOŚCI',  sub: '100%' },
  { icon: RotateCcw,  label: 'ZWROTY',             sub: '30 DNI' },
  { icon: Star,       label: 'NOWE KOLEKCJE',      sub: 'CO TYDZIEŃ' },
]

const DECOR_STARS = [
  { top: '18%', left:  '8%',  size: 18, color: '#FF2D78', anim: 'float',  delay: '0s'    },
  { top: '12%', right: '10%', size: 22, color: '#00E5FF', anim: 'float2', delay: '1s'    },
  { top: '60%', left:  '4%',  size: 14, color: '#CCFF00', anim: 'float',  delay: '2s'    },
  { top: '70%', right: '6%',  size: 16, color: '#BF00FF', anim: 'float2', delay: '0.5s'  },
  { top: '35%', right: '3%',  size: 10, color: '#FF2D78', anim: 'float',  delay: '1.5s'  },
]

export default function HomePage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getProducts(), api.getCategories()])
      .then(([prods, cats]) => {
        setProducts(prods.slice(0, 8))
        setCategories(cats.slice(0, 6))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>

      {/* hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(191,0,255,0.08) 0%, rgba(255,45,120,0.06) 40%, transparent 70%)',
        }} />

        {/* Horizontal scan lines */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.012) 2px, rgba(255,255,255,0.012) 4px)',
        }} />

        {/* Floating decorations */}
        {DECOR_STARS.map((s, i) => (
          <span
            key={i}
            className={`absolute select-none pointer-events-none animate-${s.anim}`}
            style={{ top: s.top, left: s.left, right: s.right, fontSize: s.size, color: s.color, animationDelay: s.delay, opacity: 0.6 }}
          >
            ✦
          </span>
        ))}

        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="max-w-2xl">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs font-bold uppercase tracking-widest font-body"
              style={{ border: '1px solid rgba(255,45,120,0.4)', background: 'rgba(255,45,120,0.08)', color: '#FF2D78' }}
            >
              <span style={{ color: '#CCFF00' }}>✦</span>
              NOWA KOLEKCJA DOSTĘPNA
              <span style={{ color: '#CCFF00' }}>✦</span>
            </div>

            {/* Headline */}
            <h1 className="font-display font-black uppercase mb-2 leading-none" style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', letterSpacing: '-0.02em' }}>
              <span className="chrome-text block">UNIQLOOK</span>
              <span className="block mt-1" style={{ color: '#FF2D78', textShadow: '0 0 40px rgba(255,45,120,0.5)' }}>
                UPGRADE
              </span>
            </h1>

            {/* Tagline */}
            <p
              className="font-display text-sm uppercase tracking-[0.3em] mb-4 mt-4"
              style={{ color: '#00E5FF', textShadow: '0 0 15px rgba(0,229,255,0.4)' }}
            >
              STYLE.EXE — YOUR LOOK UPGRADED
            </p>

            <p className="text-zinc-400 text-base leading-relaxed mb-10 max-w-lg font-body">
              Odkryj kolekcję dla tych, którzy odważają się wyróżnić.
              Moda, która definiuje, a nie podąża.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link to="/products" className="btn-primary text-sm">
                ODKRYJ KOLEKCJĘ
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/products?available=true" className="btn-cyan text-sm">
                DOSTĘPNE TERAZ
              </Link>
            </div>

            {/* Stats */}
            <div className="flex gap-8 mt-12">
              {[['500+', 'PRODUKTÓW'], ['12K+', 'KLIENTÓW'], ['4.9★', 'OCENA']].map(([num, lbl]) => (
                <div key={lbl}>
                  <p className="font-display text-2xl font-black" style={{ color: '#FF2D78' }}>{num}</p>
                  <p className="text-[9px] text-zinc-500 font-body uppercase tracking-widest mt-0.5">{lbl}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-24" style={{ background: 'linear-gradient(transparent, #080808)' }} />
      </section>

      {/* perks */}
      <section style={{ borderTop: '1px solid rgba(255,45,120,0.1)', borderBottom: '1px solid rgba(255,45,120,0.1)', background: '#0c0c0c' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {PERKS.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,45,120,0.08)', border: '1px solid rgba(255,45,120,0.2)' }}
                >
                  <Icon className="w-4 h-4" style={{ color: '#FF2D78' }} />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white font-body">{label}</p>
                  <p className="text-[9px] font-body mt-0.5" style={{ color: '#FF2D78' }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* categories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <span style={{ color: '#FF2D78' }}>✦</span>
              <h2 className="section-title">KATEGORIE</h2>
            </div>
            <Link to="/products" className="text-[10px] text-zinc-500 font-body uppercase tracking-widest hover:text-[#FF2D78] transition-colors flex items-center gap-1">
              WSZYSTKIE <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex flex-wrap gap-3">
            {categories.map(cat => (
              <Link
                key={cat.id}
                to={`/products?category=${encodeURIComponent(cat.name)}`}
                className="px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest font-body transition-all duration-200"
                style={{ border: '1px solid rgba(255,45,120,0.2)', color: '#aaa', background: 'rgba(255,45,120,0.04)' }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#FF2D78'
                  e.currentTarget.style.borderColor = 'rgba(255,45,120,0.6)'
                  e.currentTarget.style.background = 'rgba(255,45,120,0.1)'
                  e.currentTarget.style.boxShadow = '0 0 12px rgba(255,45,120,0.2)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = '#aaa'
                  e.currentTarget.style.borderColor = 'rgba(255,45,120,0.2)'
                  e.currentTarget.style.background = 'rgba(255,45,120,0.04)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* featured products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span style={{ color: '#FF2D78' }}>✦</span>
            <h2 className="section-title">POLECANE</h2>
          </div>
          <Link to="/products" className="text-[10px] text-zinc-500 font-body uppercase tracking-widest hover:text-[#FF2D78] transition-colors flex items-center gap-1">
            WIĘCEJ <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : products.map(p => <ProductCard key={p.id} product={p} />)
          }
        </div>

        {!loading && products.length === 0 && (
          <div className="text-center py-16">
            <p
              className="font-display text-sm uppercase tracking-widest mb-2"
              style={{ color: '#FF2D78' }}
            >
              BRAK PRODUKTÓW
            </p>
            <p className="text-xs text-zinc-600 font-body">Upewnij się że backend jest uruchomiony</p>
          </div>
        )}
      </section>

      {/* footer banner */}
      <div
        className="py-8 text-center overflow-hidden"
        style={{ borderTop: '1px solid rgba(255,45,120,0.15)', background: '#0a0a0a' }}
      >
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-600">
          ✦ UNIQWEAR ✦ STYLE.EXE ✦ YOUR LOOK UPGRADED ✦ Y2K FASHION ✦ BE UNIQUE ✦ UNIQWEAR ✦ STYLE.EXE ✦
        </p>
      </div>
    </div>
  )
}
