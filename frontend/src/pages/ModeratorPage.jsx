import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Check, X, RefreshCw, MessageSquare } from 'lucide-react'
import { useKeycloak } from '../KeycloakContext'
import { api } from '../api'

export default function ModeratorPage() {
  const { authenticated, ready, user } = useKeycloak()
  const navigate = useNavigate()

  const isModerator = user?.roles?.includes('moderator') || user?.roles?.includes('admin')

  const [reviews, setReviews]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  useEffect(() => {
    if (ready && (!authenticated || !isModerator)) navigate('/')
  }, [ready, authenticated, isModerator, navigate])

  useEffect(() => {
    if (!isModerator) return
    fetchReviews()
  }, [isModerator])

  function notify(msg, isError = false) {
    isError ? setError(msg) : setSuccess(msg)
    setTimeout(() => isError ? setError('') : setSuccess(''), 4000)
  }

  function fetchReviews() {
    setLoading(true)
    api.getAllReviews('pending')
      .then(setReviews)
      .catch(() => notify('blad pobierania recenzji', true))
      .finally(() => setLoading(false))
  }

  async function handleApprove(id) {
    try {
      await api.approveReview(id)
      notify('recenzja zatwierdzona')
      fetchReviews()
    } catch (err) { notify(err.message, true) }
  }

  async function handleReject(id) {
    try {
      await api.deleteReview(id)
      notify('recenzja odrzucona i usunieta')
      fetchReviews()
    } catch (err) { notify(err.message, true) }
  }

  if (!ready || !authenticated || !isModerator) return null

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">

      <div className="flex items-center gap-3 mb-2">
        <span style={{ color: '#a78bfa' }}>✦</span>
        <h1 className="font-display font-black text-2xl uppercase tracking-tight text-white">
          PANEL MODERATORA
        </h1>
        <span className="text-[9px] font-black font-body uppercase px-2 py-0.5 rounded-full ml-2"
          style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
          {user?.name}
        </span>
      </div>
      <p className="text-xs text-zinc-600 font-body mb-8">
        Przeglądaj i moderuj recenzje użytkowników oczekujące na zatwierdzenie.
      </p>

      {error   && <div className="mb-4 rounded-xl p-3 text-xs font-body" style={{ background: 'rgba(255,45,120,0.08)',  color: '#FF2D78', border: '1px solid rgba(255,45,120,0.2)' }}>{error}</div>}
      {success && <div className="mb-4 rounded-xl p-3 text-xs font-body" style={{ background: 'rgba(139,92,246,0.08)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>{success}</div>}

      <div className="rounded-2xl p-6" style={{ background: '#0f0f0f', border: '1px solid rgba(139,92,246,0.2)' }}>
        <div className="flex items-center gap-2 mb-5">
          <MessageSquare className="w-4 h-4" style={{ color: '#a78bfa' }} />
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] font-body text-white">
            Recenzje oczekujące
          </p>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full ml-1"
            style={{ background: 'rgba(255,45,120,0.1)', color: '#FF2D78', border: '1px solid rgba(255,45,120,0.2)' }}>
            {reviews.length}
          </span>
          {loading && <RefreshCw className="w-3 h-3 animate-spin ml-auto" style={{ color: '#a78bfa' }} />}
        </div>

        {reviews.length === 0 && !loading ? (
          <div className="text-center py-12">
            <Star className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(139,92,246,0.2)' }} />
            <p className="text-xs text-zinc-600 font-body">Brak recenzji oczekujacych na moderacje</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map(r => (
              <div key={r._id} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* ocena gwiazdkowa i info */}
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} className="w-3.5 h-3.5"
                            style={{ color: i <= r.rating ? '#FF2D78' : '#333', fill: i <= r.rating ? '#FF2D78' : '#333' }} />
                        ))}
                      </div>
                      <span className="text-[10px] text-zinc-600 font-body">produkt #{r.productId}</span>
                      <span className="text-[10px] text-zinc-700 font-body">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString('pl-PL') : ''}
                      </span>
                    </div>
                    {r.title && (
                      <p className="text-sm font-bold text-white font-body mb-1">{r.title}</p>
                    )}
                    {r.body && (
                      <p className="text-xs text-zinc-500 font-body leading-relaxed">{r.body}</p>
                    )}
                  </div>

                  {/* przyciski moderacji */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(r._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                      style={{ background: 'rgba(204,255,0,0.08)', color: '#CCFF00', border: '1px solid rgba(204,255,0,0.25)' }}
                      title="Zatwierdz"
                    >
                      <Check className="w-3 h-3" /> Zatwierdź
                    </button>
                    <button
                      onClick={() => handleReject(r._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                      style={{ background: 'rgba(255,45,120,0.08)', color: '#FF2D78', border: '1px solid rgba(255,45,120,0.25)' }}
                      title="Odrzuc i usun"
                    >
                      <X className="w-3 h-3" /> Odrzuć
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
