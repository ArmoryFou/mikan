import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AlertTriangle, Heart, HeartOff, UserX } from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import SiteHeader from './components/SiteHeader'

function cleanText(text = '') {
  return text.replace(/\[.*?\]/g, '').trim()
}

function StatPill({ label, value }) {
  if (!value) return null
  return (
    <div className="rounded-md border border-stone-800 bg-stone-900/50 px-3 py-1.5 text-sm">
      <span className="text-stone-400">{label}</span>
      <span className="ml-2 font-semibold text-white">{value}</span>
    </div>
  )
}

function FavoriteUserRow({ item, subtitle }) {
  const avatarUrl = item.avatarUrl ? `http://localhost:3000${item.avatarUrl}` : ''
  const display = item.displayName || item.username
  return (
    <Link
      to={`/user/${item.username}`}
      className="flex items-center gap-2 rounded-lg border border-stone-800 bg-stone-950/60 px-2.5 py-2 transition hover:border-stone-600"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={display} className="h-9 w-9 rounded-full border border-stone-700 object-cover" />
      ) : (
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-700 bg-stone-900 text-xs font-bold text-stone-200">
          {display.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{display}</p>
        <p className="truncate text-xs text-stone-400">{subtitle || `@${item.username}`}</p>
      </div>
    </Link>
  )
}

const ROLE_STYLES = {
  main: 'bg-white/15 text-stone-200 border-white/25',
  primary: 'bg-white/15 text-stone-200 border-white/25',
  side: 'bg-stone-600/40 text-stone-300 border-stone-600',
  appears: 'bg-stone-800/60 text-stone-400 border-stone-700'
}

const ROLE_LABELS = { main: 'Main', primary: 'Main', side: 'Side', appears: 'Appears' }

const SEX_LABELS = { m: 'Male', f: 'Female', b: 'Both', n: 'Unknown' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function CharacterDetail() {
  const { id } = useParams()
  const { user, token } = useAuth()
  const [char, setChar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showSpoilerTraits, setShowSpoilerTraits] = useState(false)
  const [favChars, setFavChars] = useState([])
  const [favActing, setFavActing] = useState(false)
  const [favoriteStats, setFavoriteStats] = useState({
    public: { total: 0, users: [], hasMore: false },
    friends: null
  })
  const [favoriteStatsLoading, setFavoriteStatsLoading] = useState(true)
  const [favoriteStatsError, setFavoriteStatsError] = useState('')

  useEffect(() => {
    setShowSpoilerTraits(false)
    setChar(null)
    setLoading(true)
    setError(null)

    const fetchChar = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/character/${id}`)
        if (!res.ok) throw new Error('Character not found')
        const data = await res.json()
        setChar(data)
      } catch (err) {
        setError(err.message)
      }
      setLoading(false)
    }

    fetchChar()
  }, [id])

  useEffect(() => {
    setFavoriteStatsLoading(true)
    setFavoriteStatsError('')

    const fetchFavoriteStats = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined
        const res = await fetch(`http://localhost:3000/api/character/${id}/favorites?limit=10`, { headers })
        const raw = await res.text()
        let data = {}
        if (raw) {
          try {
            data = JSON.parse(raw)
          } catch (_err) {
            data = {}
          }
        }
        if (!res.ok) throw new Error(data.error || 'Could not load favorite stats')
        setFavoriteStats({
          public: {
            total: Number(data.public?.total || 0),
            users: Array.isArray(data.public?.users) ? data.public.users : [],
            hasMore: Boolean(data.public?.hasMore)
          },
          friends: data.friends
            ? {
                followingCount: Number(data.friends.followingCount || 0),
                total: Number(data.friends.total || 0),
                users: Array.isArray(data.friends.users) ? data.friends.users : [],
                hasMore: Boolean(data.friends.hasMore)
              }
            : null
        })
      } catch (err) {
        setFavoriteStatsError(err.message)
        setFavoriteStats({ public: { total: 0, users: [], hasMore: false }, friends: null })
      }
      setFavoriteStatsLoading(false)
    }

    fetchFavoriteStats()
  }, [id, token])

  useEffect(() => {
    if (!user || !token) return
    const fetchFavs = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/users/me/settings', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        setFavChars(data.settings?.favoriteCharacters || [])
      } catch (_) {}
    }
    fetchFavs()
  }, [user?.id, token])

  const isFavorited = favChars.some((f) => String(f.charId) === String(id))

  const toggleFavorite = async () => {
    if (!user || !token || !char || favActing) return
    if (!isFavorited && favChars.length >= 4) return

    setFavActing(true)
    try {
      const newFavs = isFavorited
        ? favChars.filter((f) => String(f.charId) !== String(id))
        : [...favChars, { charId: String(id), name: char.name, image: char.image?.url || '' }]

      const res = await fetch('http://localhost:3000/api/users/me/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ favoriteCharacters: newFavs })
      })
      if (res.ok) setFavChars(newFavs)
    } catch (_) {}
    setFavActing(false)
  }

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="panel p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-stone-600 border-t-white" />
          <p className="text-stone-300">Loading character...</p>
        </div>
      </div>
    )
  }

  if (error || !char) {
    return (
      <div className="min-h-screen bg-stone-950 text-white">
        <SiteHeader user={user} token={token} listsHref="/profile/lists" />
        <div className="mx-auto max-w-5xl px-4 pt-20 text-center sm:px-6">
          <UserX className="mx-auto h-10 w-10 text-stone-400" />
          <h2 className="mt-4 text-2xl font-bold text-white">Character not found</h2>
          <p className="mt-2 text-stone-400">{error || 'This character could not be loaded.'}</p>
          <Link to="/" className="mt-6 inline-flex rounded-md border border-stone-700 px-4 py-2 text-sm font-semibold text-stone-300 transition hover:border-stone-500 hover:text-white">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  // Derived values
  const aliases = Array.isArray(char.aliases) ? char.aliases.filter(Boolean) : []
  const bio = cleanText(char.description || '')

  const genderLabel = SEX_LABELS[char.sex] || null
  const ageLabel = char.age ? String(char.age) : null
  const bloodLabel = char.blood_type ? char.blood_type.toUpperCase() : null

  let birthdayLabel = null
  if (Array.isArray(char.birthday) && char.birthday.length >= 2) {
    const day = char.birthday[0]
    const month = char.birthday[1]
    if (month >= 1 && month <= 12) birthdayLabel = `${MONTHS[month - 1]} ${day}`
  }

  const hasPhysical = char.height || char.weight || char.bust || char.waist || char.hips || char.cup

  // Traits — split visible / spoiler, then group
  const allTraits = Array.isArray(char.traits) ? char.traits : []
  const visibleTraits = allTraits.filter((t) => !t.spoiler)
  const spoilerTraits = allTraits.filter((t) => t.spoiler)

  const groupTraits = (traits) => {
    const groups = {}
    traits.forEach((t) => {
      const g = t.group_name || 'Other'
      if (!groups[g]) groups[g] = []
      groups[g].push(t.name)
    })
    return groups
  }

  const visibleGroups = groupTraits(visibleTraits)
  const spoilerGroups = groupTraits(spoilerTraits)

  // Appears in
  const appearsIn = Array.isArray(char.vns)
    ? char.vns.map((v) => ({ vnId: v.id, title: v.title || v.id, image: v.image?.url || '', role: v.role || 'appears' }))
    : []

  const favAtCapacity = !isFavorited && favChars.length >= 4

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <SiteHeader user={user} token={token} listsHref="/profile/lists" />

      <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6">

        {/* Header */}
        <div className="flex flex-col gap-8 sm:flex-row">
          <div className="flex-shrink-0">
            <img
              src={char.image?.url || 'https://placehold.co/220x320/0f172a/94a3b8?text=?'}
              alt={char.name}
              className="h-[320px] w-[220px] rounded-xl border border-stone-800 object-cover shadow-xl shadow-black/60"
            />
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <h1 className="text-4xl font-bold tracking-tight text-white">{char.name}</h1>
            {char.original ? (
              <p className="mt-1 text-lg text-stone-400">{char.original}</p>
            ) : null}

            {aliases.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {aliases.map((a, i) => (
                  <span key={i} className="rounded-full border border-stone-700 bg-stone-900 px-3 py-0.5 text-xs font-medium text-stone-300">
                    {a}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Stat pills */}
            <div className="mt-4 flex flex-wrap gap-2">
              <StatPill label="Gender" value={genderLabel} />
              <StatPill label="Age" value={ageLabel} />
              <StatPill label="Birthday" value={birthdayLabel} />
              <StatPill label="Blood type" value={bloodLabel} />
            </div>

            {/* Physical measurements */}
            {hasPhysical ? (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-stone-800/80 pt-3 text-sm text-stone-400">
                {char.height ? <span><span className="text-stone-500">Height</span> {char.height} cm</span> : null}
                {char.weight ? <span><span className="text-stone-500">Weight</span> {char.weight} kg</span> : null}
                {char.bust ? <span><span className="text-stone-500">Bust</span> {char.bust}</span> : null}
                {char.waist ? <span><span className="text-stone-500">Waist</span> {char.waist}</span> : null}
                {char.hips ? <span><span className="text-stone-500">Hips</span> {char.hips}</span> : null}
                {char.cup ? <span><span className="text-stone-500">Cup</span> {char.cup}</span> : null}
              </div>
            ) : null}

            {/* Favorite button */}
            {user ? (
              <button
                onClick={toggleFavorite}
                disabled={favActing || favAtCapacity}
                className={`mt-6 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isFavorited
                    ? 'border-rose-500/50 bg-rose-950/30 text-rose-300 hover:border-rose-400 hover:text-rose-200'
                    : favAtCapacity
                      ? 'border-stone-700 text-stone-500'
                      : 'border-white/60 bg-white text-stone-950 hover:bg-stone-100'
                }`}
              >
                {favActing ? (
                  '...'
                ) : isFavorited ? (
                  <>
                    <Heart className="h-4 w-4 fill-current" /> In favorites
                  </>
                ) : favAtCapacity ? (
                  <>
                    <HeartOff className="h-4 w-4" /> Favorites full (4/4)
                  </>
                ) : (
                  <>
                    <Heart className="h-4 w-4" /> Add to favorites
                  </>
                )}
              </button>
            ) : (
              <Link
                to="/"
                className="mt-6 inline-flex items-center gap-2 rounded-md border border-stone-700 px-4 py-2 text-sm font-semibold text-stone-300 transition hover:border-stone-500 hover:text-white"
              >
                Sign in to add to favorites
              </Link>
            )}
          </div>
        </div>

        {/* Bio */}
        {bio ? (
          <section className="mt-10 border-t border-stone-800/80 pt-8">
            <h2 className="text-xl font-semibold text-white">Bio</h2>
            <p className="mt-3 whitespace-pre-wrap leading-8 text-stone-300">{bio}</p>
          </section>
        ) : null}

        <section className="mt-8 border-t border-stone-800/80 pt-8">
            <p className="text-sm text-stone-300">
              <span className="font-semibold text-white">{favoriteStats.public.total}</span> people have this as favorite
              {user ? (
                <>
                  {' '}•{' '}
                  <span className="font-semibold text-white">{favoriteStats.friends?.total || 0}</span> friends have this as favorite
                </>
              ) : null}
            </p>

          {favoriteStatsLoading ? (
            <p className="mt-3 text-sm text-stone-400">Loading favorite users...</p>
          ) : favoriteStatsError ? (
            <p className="mt-3 text-sm text-rose-300">{favoriteStatsError}</p>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-stone-800 bg-stone-950/45 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">People who favorited this</p>
                  <span className="rounded-full border border-stone-700 px-2 py-0.5 text-xs font-semibold text-stone-300">
                    {favoriteStats.public.total}
                  </span>
                </div>

                {favoriteStats.public.users.length ? (
                  <div className="mt-3 space-y-2">
                    {favoriteStats.public.users.map((item) => (
                      <FavoriteUserRow
                        key={item.id}
                        item={item}
                        subtitle={item.isFollowedByMe ? 'You follow this user' : `@${item.username}`}
                      />
                    ))}
                    {favoriteStats.public.hasMore ? <p className="text-xs text-stone-500">More users also have this character as favorite.</p> : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-stone-400">No one has marked this character as favorite yet.</p>
                )}
              </div>

              <div className="rounded-xl border border-stone-800 bg-stone-950/45 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">Friends who favorited this</p>
                  <span className="rounded-full border border-stone-700 px-2 py-0.5 text-xs font-semibold text-stone-300">
                    {favoriteStats.friends?.total || 0}
                  </span>
                </div>

                {user ? (
                  favoriteStats.friends?.users?.length ? (
                    <div className="mt-3 space-y-2">
                      {favoriteStats.friends.users.map((item) => (
                        <FavoriteUserRow key={item.id} item={item} subtitle="Follows this character" />
                      ))}
                      {favoriteStats.friends.hasMore ? <p className="text-xs text-stone-500">More followed users also match this character.</p> : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-stone-400">
                      {favoriteStats.friends?.followingCount
                        ? 'Nobody you follow has this character in favorites yet.'
                        : 'Follow more members to see friend favorites here.'}
                    </p>
                  )
                ) : (
                  <p className="mt-3 text-sm text-stone-400">Sign in to see which people you follow have this character as favorite.</p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Traits */}
        {(Object.keys(visibleGroups).length > 0 || spoilerTraits.length > 0) ? (
          <section className="mt-8 border-t border-stone-800/80 pt-8">
            <h2 className="text-xl font-semibold text-white">Traits</h2>

            {Object.keys(visibleGroups).length > 0 ? (
              <div className="mt-4 space-y-5">
                {Object.entries(visibleGroups).map(([group, traits]) => (
                  <div key={group}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{group}</p>
                    <div className="flex flex-wrap gap-2">
                      {traits.map((t, i) => (
                        <span key={i} className="rounded-full border border-stone-700 bg-stone-900/60 px-3 py-1 text-sm text-stone-300">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {spoilerTraits.length > 0 ? (
              <div className="mt-5">
                <button
                  onClick={() => setShowSpoilerTraits((p) => !p)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-400 transition hover:text-amber-300"
                >
                  <AlertTriangle className="h-4 w-4" />
                  {showSpoilerTraits ? 'Hide spoiler traits' : `Show ${spoilerTraits.length} spoiler trait${spoilerTraits.length === 1 ? '' : 's'}`}
                </button>

                {showSpoilerTraits ? (
                  <div className="mt-4 space-y-5">
                    {Object.entries(spoilerGroups).map(([group, traits]) => (
                      <div key={group}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{group}</p>
                        <div className="flex flex-wrap gap-2">
                          {traits.map((t, i) => (
                            <span key={i} className="rounded-full border border-amber-600/40 bg-amber-950/30 px-3 py-1 text-sm text-amber-200">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Appears in */}
        {appearsIn.length > 0 ? (
          <section className="mt-8 border-t border-stone-800/80 pt-8">
            <h2 className="text-xl font-semibold text-white">Appears in</h2>
            <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {appearsIn.map((vn) => {
                const roleStyle = ROLE_STYLES[vn.role] || ROLE_STYLES.appears
                const roleLabel = ROLE_LABELS[vn.role] || vn.role
                return (
                  <Link key={vn.vnId} to={`/vn/${vn.vnId}`} className="group block">
                    <div className="relative overflow-hidden rounded-lg">
                      <img
                        src={vn.image || 'https://placehold.co/160x240/100f0e/d6d3d1?text=VN'}
                        alt={vn.title}
                        className="aspect-[2/3] w-full object-cover transition duration-200 group-hover:brightness-75"
                      />
                      <span className={`absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border px-2 py-0.5 text-[10px] font-bold ${roleStyle}`}>
                        {roleLabel}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-center text-xs font-semibold text-white transition group-hover:text-stone-200">
                      {vn.title}
                    </p>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : null}

      </div>
    </div>
  )
}

export default CharacterDetail
