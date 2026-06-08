const SCHEMES = [
  { from: '#FF2D78', to: '#BF00FF', bg: '#150010' },
  { from: '#00E5FF', to: '#0066FF', bg: '#001525' },
  { from: '#CCFF00', to: '#00FF88', bg: '#0a1200' },
  { from: '#FF9900', to: '#FF2D78', bg: '#150500' },
  { from: '#BF00FF', to: '#00E5FF', bg: '#0f0020' },
  { from: '#FFFFFF', to: '#C8C8D0', bg: '#111111' },
]

export default function ProductPlaceholder({ id = 0, name = '', imageUrl = null, size = 'md' }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="w-full h-full object-cover"
        onError={e => { e.target.style.display = 'none' }}
      />
    )
  }

  const s = SCHEMES[(id ?? 0) % SCHEMES.length]
  const initial = (name || 'U').charAt(0).toUpperCase()
  const uid = `p${id ?? 0}`

  return (
    <svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id={`g1-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={s.from} />
          <stop offset="100%" stopColor={s.to} />
        </linearGradient>
        <linearGradient id={`g2-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor={s.from} />
          <stop offset="100%" stopColor={s.to} />
        </linearGradient>
        <pattern id={`grid-${uid}`} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="white" strokeWidth="0.4" strokeOpacity="0.04" />
        </pattern>
        <pattern id={`stripe-${uid}`} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="16" fill={s.from} fillOpacity="0.04" />
        </pattern>
        <filter id={`glow-${uid}`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width="400" height="500" fill={s.bg} />
      <rect width="400" height="500" fill={`url(#grid-${uid})`} />
      <rect width="400" height="500" fill={`url(#stripe-${uid})`} />

      {/* Outer diamond frame */}
      <polygon
        points="200,60 360,250 200,440 40,250"
        fill="none" stroke={s.from} strokeWidth="1" opacity="0.15"
      />
      {/* Inner diamond */}
      <polygon
        points="200,100 320,250 200,400 80,250"
        fill={s.from} opacity="0.04"
      />
      {/* Inner glow diamond */}
      <polygon
        points="200,100 320,250 200,400 80,250"
        fill="none" stroke={s.from} strokeWidth="0.5" opacity="0.3"
      />

      {/* Scanlines */}
      {[...Array(25)].map((_, i) => (
        <line
          key={i}
          x1="0" y1={i * 20} x2="400" y2={i * 20}
          stroke="white" strokeOpacity="0.015" strokeWidth="1"
        />
      ))}

      {/* Big letter */}
      <text
        x="200" y="300"
        textAnchor="middle"
        fontSize="200"
        fontWeight="900"
        fontFamily="Orbitron, sans-serif"
        fill={`url(#g2-${uid})`}
        opacity="0.22"
      >
        {initial}
      </text>

      {/* Corner sparkles */}
      <text x="18" y="44" fontSize="22" fill={s.from} opacity="0.8" fontFamily="sans-serif">✦</text>
      <text x="382" y="44" fontSize="22" fill={s.to} opacity="0.8" textAnchor="end" fontFamily="sans-serif">✦</text>
      <text x="18" y="492" fontSize="14" fill={s.from} opacity="0.5" fontFamily="sans-serif">✶</text>
      <text x="382" y="492" fontSize="14" fill={s.to} opacity="0.5" textAnchor="end" fontFamily="sans-serif">✶</text>

      {/* Horizontal accent lines */}
      <line x1="0" y1="80" x2="60" y2="80" stroke={s.from} strokeWidth="1" opacity="0.4" />
      <line x1="340" y1="80" x2="400" y2="80" stroke={s.to} strokeWidth="1" opacity="0.4" />
      <line x1="0" y1="420" x2="60" y2="420" stroke={s.from} strokeWidth="1" opacity="0.4" />
      <line x1="340" y1="420" x2="400" y2="420" stroke={s.to} strokeWidth="1" opacity="0.4" />

      {/* Bottom accent bar */}
      <rect x="0" y="472" width="400" height="28" fill={s.from} opacity="0.12" />
      <rect x="0" y="472" width="400" height="1.5" fill={`url(#g1-${uid})`} opacity="0.7" />

      {/* Small center dot */}
      <circle cx="200" cy="250" r="3" fill={s.from} opacity="0.5" filter={`url(#glow-${uid})`} />
    </svg>
  )
}
