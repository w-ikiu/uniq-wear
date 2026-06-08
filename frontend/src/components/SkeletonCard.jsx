export default function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid rgba(255,45,120,0.1)' }}>
      <div className="aspect-[4/5] animate-pulse" style={{ background: '#1a1a1a' }}>
        <div className="w-full h-full flex items-center justify-center opacity-20">
          <div className="w-16 h-16 rounded-full" style={{ background: 'rgba(255,45,120,0.3)' }} />
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex justify-between">
          <div className="h-2.5 w-16 rounded-full animate-pulse" style={{ background: '#222' }} />
          <div className="h-2.5 w-12 rounded-full animate-pulse" style={{ background: '#222' }} />
        </div>
        <div className="h-4 w-3/4 rounded-lg animate-pulse" style={{ background: '#222' }} />
        <div className="h-3 w-1/2 rounded-lg animate-pulse" style={{ background: '#222' }} />
        <div className="flex justify-between pt-1">
          <div className="h-5 w-20 rounded-full animate-pulse" style={{ background: 'rgba(255,45,120,0.15)' }} />
          <div className="h-3 w-14 rounded-full animate-pulse" style={{ background: '#222' }} />
        </div>
      </div>
    </div>
  )
}
