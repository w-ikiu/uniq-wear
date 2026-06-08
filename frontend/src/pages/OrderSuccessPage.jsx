import { useSearchParams, Link } from 'react-router-dom'
import { ArrowRight, Home } from 'lucide-react'

const STEPS = [
  { label: 'ZAMÓWIENIE PRZYJĘTE', sub: 'Potwierdzenie wysłane na e-mail', done: true,  color: '#CCFF00' },
  { label: 'PRZYGOTOWANIE',       sub: 'Pakujemy Twoje zamówienie',       done: false, color: '#FF2D78' },
  { label: 'W DRODZE',            sub: 'Paczka jedzie do Ciebie',         done: false, color: '#00E5FF' },
  { label: 'DOSTARCZONO',         sub: 'Zamówienie dostarczone',          done: false, color: '#BF00FF' },
]

export default function OrderSuccessPage() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">

      {/* Glowing icon */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          <div
            className="w-28 h-28 rounded-3xl flex items-center justify-center"
            style={{ background: 'rgba(204,255,0,0.08)', border: '1px solid rgba(204,255,0,0.3)' }}
          >
            <span className="text-5xl">✦</span>
          </div>
          <div
            className="absolute inset-0 rounded-3xl animate-ping"
            style={{ border: '2px solid rgba(204,255,0,0.2)' }}
          />
        </div>
      </div>

      <h1 className="font-display text-4xl font-black uppercase mb-3 tracking-tight chrome-text">
        ORDER PLACED
      </h1>
      <p className="text-zinc-400 font-body text-sm mb-3">
        Dziękujemy za zakupy w UNIQWEAR. Twoje zamówienie zostało przyjęte.
      </p>

      {orderId && (
        <div
          className="inline-flex items-center gap-3 px-5 py-3 rounded-xl mb-10 mt-2"
          style={{ background: 'rgba(255,45,120,0.08)', border: '1px solid rgba(255,45,120,0.25)' }}
        >
          <span className="text-[10px] text-zinc-500 font-body uppercase tracking-widest">NUMER ZAMÓWIENIA</span>
          <span className="font-display font-black text-sm" style={{ color: '#FF2D78' }}>#{orderId}</span>
        </div>
      )}

      {/* Status steps */}
      <div className="rounded-2xl p-6 mb-8 text-left" style={{ background: '#0f0f0f', border: '1px solid rgba(255,45,120,0.15)' }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 font-body mb-6">STATUS ZAMÓWIENIA</p>

        <div className="relative space-y-5">
          <div className="absolute left-4 top-4 bottom-0 w-px" style={{ background: 'rgba(255,45,120,0.1)' }} />

          {STEPS.map((step, i) => (
            <div key={i} className="flex gap-4 items-start relative">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 z-10 text-[10px] font-black font-display"
                style={step.done
                  ? { background: step.color, color: '#000', boxShadow: `0 0 15px ${step.color}55` }
                  : i === 1
                  ? { background: 'transparent', border: `1px solid ${step.color}`, color: step.color }
                  : { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#333' }
                }
              >
                {step.done ? '✓' : i + 1}
              </div>
              <div>
                <p
                  className="text-xs font-bold font-body uppercase tracking-wider"
                  style={{ color: step.done ? step.color : i === 1 ? step.color : '#333' }}
                >
                  {step.label}
                </p>
                <p className="text-[10px] font-body mt-0.5" style={{ color: step.done || i === 1 ? '#666' : '#2a2a2a' }}>
                  {step.sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scrolling marquee */}
      <div
        className="overflow-hidden rounded-xl py-2.5 mb-8"
        style={{ background: 'rgba(255,45,120,0.06)', border: '1px solid rgba(255,45,120,0.15)' }}
      >
        <p className="text-[10px] font-bold font-body uppercase tracking-[0.3em] whitespace-nowrap" style={{ color: '#FF2D78' }}>
          ✦ DZIĘKUJEMY ZA ZAKUPY ✦ UNIQWEAR ✦ STYLE.EXE ✦ YOUR LOOK UPGRADED ✦ BE UNIQUE ✦
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/" className="btn-outline inline-flex items-center justify-center gap-2 text-xs">
          <Home className="w-3.5 h-3.5" /> HOME
        </Link>
        <Link to="/products" className="btn-primary inline-flex items-center justify-center gap-2 text-xs">
          KONTYNUUJ ZAKUPY <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  )
}
