import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Trophy, Users } from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import SiteHeader from './components/SiteHeader'
import { buildSearchParams, didSearchParamsChange, readEnumParam, readTextParam } from './utils/urlFilters'

function ListCard({ item }) {
  const isRanking = item.type === 'ranking'
  return (
    <article className="group overflow-hidden rounded-2xl border border-stone-800 bg-stone-950/60 shadow-lg shadow-black/30 transition hover:border-white/50 hover:shadow-black/40">
      <Link to={`/lists/${item.id}`} className="block">
        <div className="grid grid-cols-4 gap-1 bg-stone-900/70 p-1.5">
          {Array.from({ length: 4 }).map((_, idx) => {
            const cover = item.coverImages?.[idx]
            return (
              <div key={`${item.id}-cover-${idx}`} className="aspect-[2/3] overflow-hidden rounded-md bg-stone-800">
                {cover ? (
                  <img src={cover} alt={item.name} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-stone-800 to-stone-900" />
                )}
              </div>
            )
          })}
        </div>
      </Link>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link to={`/lists/${item.id}`} className="line-clamp-2 text-lg font-semibold text-white transition hover:text-stone-200">
              {item.name}
            </Link>
            <p className="mt-1 text-xs text-stone-400">by @{item.owner?.username || 'unknown'}</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${isRanking ? 'bg-amber-400/20 text-amber-200' : 'bg-sky-400/20 text-sky-200'}`}>
            {isRanking ? 'Ranking' : 'Normal'}
          </span>
        </div>

        {item.description ? <p className="line-clamp-2 text-sm text-stone-400">{item.description}</p> : null}

        <div className="flex items-center gap-4 text-xs text-stone-400">
          <span>{item.itemCount} VNs</span>
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {item.followersCount}</span>
        </div>
      </div>
    </article>
  )
}

function ListsBrowse() {
  const { user, token, logout } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(() => readTextParam(searchParams, 'q', ''))
  const [type, setType] = useState(() => readEnumParam(searchParams, 't', ['all', 'normal', 'ranking'], 'all'))
  const [sort, setSort] = useState(() => readEnumParam(searchParams, 's', ['popular', 'recent', 'items', 'name'], 'popular'))
  const [loading, setLoading] = useState(false)
  const [lists, setLists] = useState([])

  const fetchLists = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort, limit: '48' })
      if (query.trim()) params.set('q', query.trim())
      if (type !== 'all') params.set('type', type)

      const response = await fetch(`http://localhost:3000/api/lists/public?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load lists')
      setLists(Array.isArray(data.lists) ? data.lists : [])
    } catch (_error) {
      setLists([])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchLists()
  }, [type, sort, token])

  useEffect(() => {
    const id = setTimeout(fetchLists, 280)
    return () => clearTimeout(id)
  }, [query])

  useEffect(() => {
    const nextQuery = readTextParam(searchParams, 'q', '')
    const nextType = readEnumParam(searchParams, 't', ['all', 'normal', 'ranking'], 'all')
    const nextSort = readEnumParam(searchParams, 's', ['popular', 'recent', 'items', 'name'], 'popular')
    if (nextQuery !== query) setQuery(nextQuery)
    if (nextType !== type) setType(nextType)
    if (nextSort !== sort) setSort(nextSort)
  }, [searchParams])

  useEffect(() => {
    const nextParams = buildSearchParams(
      searchParams,
      { q: query, t: type, s: sort },
      { q: '', t: 'all', s: 'popular' }
    )
    if (didSearchParamsChange(searchParams, nextParams)) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [query, type, sort, searchParams, setSearchParams])

  const rankingCount = useMemo(() => lists.filter((item) => item.type === 'ranking').length, [lists])

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <SiteHeader user={user} token={token} onLogout={logout} listsHref="/lists/explore" />

      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6">
        <div className="mb-8 rounded-2xl border border-white/15 bg-gradient-to-r from-white/5 via-stone-900/80 to-stone-950 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-white">Explore Lists</h1>
              <p className="mt-1 text-sm text-stone-300">Popular VN collections from the community.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
                <Trophy className="h-3.5 w-3.5" /> {rankingCount} ranking lists in this result
              </div>
              {user ? (
                <Link to="/lists/new" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-stone-100">
                  Create List
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-3 rounded-2xl border border-stone-800 bg-stone-950/45 p-4 md:grid-cols-[1fr_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search list by name"
              className="h-11 w-full rounded-xl border border-stone-700 bg-stone-950 pl-10 pr-4 text-sm text-stone-200 outline-none transition focus:border-white/60"
            />
          </label>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-200 outline-none focus:border-white/60"
          >
            <option value="all">All types</option>
            <option value="normal">Normal</option>
            <option value="ranking">Ranking</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-200 outline-none focus:border-white/60"
          >
            <option value="popular">Most followed</option>
            <option value="recent">Recently updated</option>
            <option value="items">Most items</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-stone-500">Loading lists...</p>
        ) : lists.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {lists.map((item) => <ListCard key={item.id} item={item} />)}
          </div>
        ) : (
          <p className="rounded-xl border border-stone-800 bg-stone-950/50 px-4 py-5 text-sm text-stone-400">No lists match this search.</p>
        )}
      </main>
    </div>
  )
}

export default ListsBrowse
