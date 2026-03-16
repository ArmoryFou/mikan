import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Star } from 'lucide-react'
import SiteHeader from './components/SiteHeader'

const STATUS_OPTIONS = [
  { value: 'want-to-play', label: 'Plan to Play' },
  { value: 'playing', label: 'Playing' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'on-hold', label: 'On Hold' }
]

const STATUS_STYLES = {
  'want-to-play': 'chip chip-muted',
  playing: 'chip chip-playing',
  completed: 'chip chip-completed',
  dropped: 'chip chip-dropped',
  'on-hold': 'chip chip-hold'
}

function renderStarRating(rating, iconSize = 'h-3.5 w-3.5') {
  const value = Math.max(0, Math.min(10, Number(rating)))
  const normalized = value / 2
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.max(0, Math.min(1, normalized - i))
        return (
          <div key={i} className={`relative ${iconSize} shrink-0`}>
            <Star className={`absolute inset-0 ${iconSize} text-stone-600`} />
            {fill > 0 ? (
              <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={`${iconSize} fill-amber-400 text-amber-400`} />
              </div>
            ) : null}
          </div>
        )
      })}
      <span className="ml-1.5 text-xs font-semibold tabular-nums text-amber-300/80">
        {value % 1 === 0 ? String(value) : value.toFixed(1)}
      </span>
    </div>
  )
}

function StarRatingInput({ value, onChange }) {
  const [hoverVal, setHoverVal] = useState(null)
  const display = hoverVal ?? (value === '' ? 0 : Number(value))

  return (
    <div
      className="flex items-center gap-1"
      onMouseLeave={() => setHoverVal(null)}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const normalized = Math.max(0, Math.min(5, display / 2))
        const fill = Math.max(0, Math.min(1, normalized - i))
        return (
          <div key={i} className="relative h-8 w-8 cursor-pointer">
            <Star className="absolute inset-0 h-8 w-8 text-stone-700" />
            {fill > 0 ? (
              <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className="h-8 w-8 fill-amber-400 text-amber-400" />
              </div>
            ) : null}
            {Array.from({ length: 4 }).map((_, seg) => {
              const segVal = i * 2 + (seg + 1) * 0.5
              const currentVal = value === '' ? '' : Number(value)
              return (
                <div
                  key={seg}
                  className="absolute top-0 h-full"
                  style={{ left: `${seg * 25}%`, width: '25%' }}
                  onMouseEnter={() => setHoverVal(segVal)}
                  onClick={() => onChange(currentVal === segVal ? '' : String(segVal))}
                />
              )
            })}
          </div>
        )
      })}
      {display > 0 ? (
        <span className="ml-2 min-w-[2rem] text-base font-bold tabular-nums text-amber-300">
          {display}/10
        </span>
      ) : (
        <span className="ml-2 text-sm text-stone-500">Sin calificación</span>
      )}
    </div>
  )
}

function formatUpdatedAt(value) {
  if (!value) return 'No update timestamp'
  return new Date(value).toLocaleString()
}

function ListEntryDetail({ user, token, logout, logs, logsLoaded, onSaveLog, onDeleteLog, onToggleFavorite, favoriteVnIds, favoriteBusyId }) {
  const { vnId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    status: 'want-to-play',
    rating: '',
    review: ''
  })

  const editMode = useMemo(() => new URLSearchParams(location.search).get('edit') === '1', [location.search])
  const fromParam = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('from')
    if (!raw) return '/mylist'
    if (raw.startsWith('/')) return raw
    return '/mylist'
  }, [location.search])
  const returnTo = useMemo(() => fromParam, [fromParam])
  const editHref = useMemo(() => `?edit=1&from=${encodeURIComponent(fromParam)}`, [fromParam])
  const entry = useMemo(() => logs.find((item) => String(item.vnId) === String(vnId)) || null, [logs, vnId])
  const isFavorite = favoriteVnIds.has(String(vnId))
  const favoriteBusy = favoriteBusyId === String(vnId)

  useEffect(() => {
    if (!entry) return
    setForm({
      status: entry.status || 'want-to-play',
      rating: entry.rating ?? '',
      review: entry.review || ''
    })
    setMessage('')
    setError('')
  }, [entry])

  if (!user) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="panel max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold text-white">Sign in required</h2>
          <p className="mt-2 text-stone-400">You need an active session to open list details.</p>
          <Link to="/" className="btn-primary mt-6 text-stone-950">Go to home</Link>
        </div>
      </div>
    )
  }

  if (!logsLoaded) {
    return (
      <div className="min-h-screen bg-stone-950 text-white">
        <SiteHeader user={user} token={token} onLogout={logout} listsHref="/profile/lists" />
        <div className="page-shell flex items-center justify-center">
          <div className="panel p-8 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-stone-600 border-t-white" />
            <p className="text-stone-300">Loading entry...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-stone-950 text-white">
        <SiteHeader user={user} token={token} onLogout={logout} listsHref="/profile/lists" />
        <div className="page-shell flex items-center justify-center">
          <div className="panel max-w-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-white">Entry not found</h2>
            <p className="mt-2 text-stone-400">This visual novel is not in your list anymore, or the page was opened before your list finished loading.</p>
            <Link to={returnTo} className="btn-secondary mt-6">Back to My List</Link>
          </div>
        </div>
      </div>
    )
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    const success = await onSaveLog(entry.vnId, {
      status: form.status,
      rating: form.rating === '' ? null : Number(form.rating),
      review: String(form.review || '').trim()
    })

    if (success) {
      setMessage('Entry updated.')
      if (editMode) {
        navigate(`/list/${entry.vnId}`, { replace: true })
      }
    } else {
      setError('Could not update entry.')
    }

    setSaving(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    setMessage('')
    setError('')
    const success = await onDeleteLog(entry.vnId, true)
    setDeleting(false)
    if (success) {
      navigate(returnTo)
    } else {
      setError('Could not remove this entry.')
    }
  }

  const handleToggleFavorite = async () => {
    setMessage('')
    setError('')
    const success = await onToggleFavorite(entry)
    if (!success) {
      setError('Could not update favorites.')
      return
    }
    setMessage(isFavorite ? 'Removed from favorites.' : 'Added to favorites.')
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <SiteHeader user={user} token={token} onLogout={logout} listsHref="/profile/lists" />

      <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-stone-400">
          <Link to={returnTo} className="transition hover:text-white">My List</Link>
          <span>/</span>
          <span className="text-stone-200">{entry.title}</span>
        </div>

        <section className="grid gap-8 lg:grid-cols-[320px_1fr]">
          <div>
            <div className="overflow-hidden rounded-[1.5rem] border border-stone-800 bg-stone-950/70 shadow-2xl shadow-black/40">
              <img
                src={entry.image || 'https://placehold.co/600x900/100f0e/d6d3d1?text=VN'}
                alt={entry.title}
                className="aspect-[2/3] w-full object-cover"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={STATUS_STYLES[entry.status] || 'chip chip-muted'}>{STATUS_OPTIONS.find((item) => item.value === entry.status)?.label || 'Plan to Play'}</span>
              {entry.rating ? (
                <div className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-amber-200">
                  {renderStarRating(entry.rating)}
                </div>
              ) : null}
              {isFavorite ? <span className="chip border border-rose-400/30 bg-rose-400/10 text-rose-200">Favorite</span> : null}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col gap-4 border-b border-stone-800/80 pb-6 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-white">{entry.title}</h1>
                <p className="mt-2 text-sm text-stone-500">Last updated {formatUpdatedAt(entry.updatedAt)}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  disabled={favoriteBusy}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    isFavorite
                      ? 'border-rose-400/40 bg-rose-400/10 text-rose-200 hover:border-rose-300'
                      : 'border-stone-700 bg-stone-950/60 text-stone-200 hover:border-white/60 hover:text-stone-200'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {favoriteBusy ? 'Updating...' : isFavorite ? 'Remove favorite' : 'Add to favorites'}
                </button>
                <Link to={`/vn/${entry.vnId}`} className="btn-secondary">Open VN page</Link>
                {!editMode ? (
                  <Link to={`/list/${entry.vnId}${editHref}`} className="btn-primary text-stone-950">Edit entry</Link>
                ) : null}
              </div>
            </div>

            {message ? <p className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-stone-200">{message}</p> : null}
            {error ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

            {!editMode ? (
              <section className="panel p-6">
                <div className="flex items-center justify-between gap-3 border-b border-stone-800/70 pb-4">
                  <h2 className="text-xl font-semibold text-white">Your notes</h2>
                  <Link to={`/list/${entry.vnId}${editHref}`} className="text-sm font-semibold text-stone-200 transition hover:text-stone-200">Edit</Link>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-stone-800 bg-stone-950/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Status</p>
                    <p className="mt-2 text-lg font-semibold text-white">{STATUS_OPTIONS.find((item) => item.value === entry.status)?.label || 'Plan to Play'}</p>
                  </div>
                  <div className="rounded-2xl border border-stone-800 bg-stone-950/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Rating</p>
                    {entry.rating ? (
                      <div className="mt-3">{renderStarRating(entry.rating, 'h-5 w-5')}</div>
                    ) : (
                      <p className="mt-2 text-sm text-stone-500">Not rated yet</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-stone-800 bg-stone-950/60 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Review</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-300">
                    {entry.review?.trim() ? entry.review : 'No review yet. Use Edit entry to add your thoughts.'}
                  </p>
                </div>
              </section>
            ) : (
              <section className="panel p-6">
                <div className="flex items-center justify-between gap-3 border-b border-stone-800/70 pb-4">
                  <h2 className="text-xl font-semibold text-white">Edit entry</h2>
                  <Link to={`/list/${entry.vnId}`} className="text-sm font-semibold text-stone-400 transition hover:text-white">Close editor</Link>
                </div>

                <form onSubmit={handleSave} className="mt-5 space-y-4">
                  <div>
                    <label className="field-label">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                      className="field-input"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label">Rating</label>
                    <div className="mt-2">
                      <StarRatingInput
                        value={form.rating}
                        onChange={(val) => setForm((prev) => ({ ...prev, rating: val }))}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-stone-500">Click a star to rate · click the same star to clear</p>
                  </div>

                  <div>
                    <label className="field-label">Review</label>
                    <textarea
                      value={form.review}
                      onChange={(e) => setForm((prev) => ({ ...prev, review: e.target.value }))}
                      rows={8}
                      placeholder="Write your thoughts about this visual novel"
                      className="field-input min-h-52 resize-y"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={saving} className="btn-primary min-w-32 text-stone-950">
                      {saving ? 'Saving...' : 'Save changes'}
                    </button>
                    <button type="button" onClick={handleDelete} disabled={deleting} className="btn-danger min-w-32">
                      {deleting ? 'Removing...' : 'Remove entry'}
                    </button>
                    <Link to={`/list/${entry.vnId}`} className="btn-secondary">Cancel</Link>
                  </div>
                </form>
              </section>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default ListEntryDetail
