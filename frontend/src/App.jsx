import { useEffect, useMemo, useRef, useState } from 'react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, Heart, MessageCircle, Search, Star, Users } from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import VNDetail from './VNDetail'
import UserProfile from './UserProfile'
import Settings from './Settings'
import Members from './Members'
import CharacterDetail from './CharacterDetail'
import ListEntryDetail from './ListEntryDetail'
import SiteHeader from './components/SiteHeader'
import ListsBrowse from './ListsBrowse'
import ListDetailPage from './ListDetailPage'
import ListCreatePage from './ListCreatePage'
import { buildSearchParams, didSearchParamsChange, readEnumParam, readTextParam } from './utils/urlFilters'

const STATUS_LABELS = {
  'want-to-play': 'Plan to Play',
  playing: 'Playing',
  completed: 'Completed',
  dropped: 'Dropped',
  'on-hold': 'On Hold'
}

const LIST_STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'playing', label: 'Reading' },
  { value: 'completed', label: 'Read' },
  { value: 'want-to-play', label: 'Wishlist' },
  { value: 'did-not-finish', label: 'Did Not Finish' }
]

function matchesStatusFilter(log, filter) {
  if (filter === 'all') return true
  if (filter === 'did-not-finish') return log.status === 'dropped' || log.status === 'on-hold'
  return log.status === filter
}

function statusDot(status) {
  return {
    completed:     'bg-emerald-500',
    playing:       'bg-sky-400',
    'want-to-play':'bg-violet-500',
    dropped:       'bg-rose-500',
    'on-hold':     'bg-orange-400',
  }[status] || 'bg-stone-600'
}

function statusShortLabel(status) {
  return {
    completed:     'Completed',
    playing:       'Reading',
    'want-to-play':'Wishlist',
    dropped:       'Dropped',
    'on-hold':     'On Hold',
  }[status] || status
}

function renderStars(score) {
  const amount = Math.max(0, Math.min(5, Math.floor((score || 0) / 20)))
  return `${'★'.repeat(amount)}${'☆'.repeat(5 - amount)}`
}

function renderStarRating(rating) {
  const value = Math.max(0, Math.min(10, Number(rating)))
  const normalized = value / 2
  const full = Math.floor(normalized)
  const hasHalf = normalized - full >= 0.5
  const empty = Math.max(0, 5 - full - (hasHalf ? 1 : 0))
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
      ))}
      {hasHalf && (
        <div className="relative h-3 w-3 shrink-0">
          <Star className="absolute inset-0 h-3 w-3 text-stone-600" />
          <div className="absolute inset-0 w-1/2 overflow-hidden">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          </div>
        </div>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} className="h-3 w-3 shrink-0 text-stone-600" />
      ))}
      <span className="ml-1.5 text-[10px] font-semibold text-amber-300/80">
        {value % 1 === 0 ? String(value) : value.toFixed(1)}
      </span>
    </div>
  )
}

function shortText(text, max = 140) {
  if (!text) return ''
  const plain = text.replace(/\[.*?\]/g, '').trim()
  if (plain.length <= max) return plain
  return `${plain.slice(0, max)}...`
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function statusActionLabel(status) {
  return (
    { 'want-to-play': 'wishlisted', playing: 'started reading', completed: 'finished reading', dropped: 'dropped', 'on-hold': 'put on hold' }[status] || 'updated'
  )
}

function FeedStars({ rating }) {
  if (!rating) return null
  const n = Number(rating)
  const full = Math.floor(n / 2)
  const hasHalf = n % 2 >= 1
  const empty = Math.max(0, 5 - full - (hasHalf ? 1 : 0))
  return (
    <span className="text-sm">
      <span className="text-amber-400">{'★'.repeat(full)}{hasHalf ? '½' : ''}</span>
      <span className="text-stone-700">{'☆'.repeat(empty)}</span>
    </span>
  )
}

function CompactFeedItem({ item }) {
  const ago = timeAgo(item.timestamp)
  const action = item.type === 'review' ? 'reviewed' : statusActionLabel(item.data?.status)
  const initial = (item.actor.username?.[0] || '?').toUpperCase()
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5">
      <div className="mt-0.5 h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-stone-700">
        {item.actor.avatarUrl ? (
          <img src={`http://localhost:3000${item.actor.avatarUrl}`} alt={item.actor.username} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-stone-200">{initial}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-snug text-stone-300">
          <Link to={`/user/${item.actor.username}`} className="font-semibold text-white hover:text-stone-200">
            {item.actor.username}
          </Link>{' '}
          {action}{' '}
          <Link to={`/vn/${item.vn.vnId}`} className="hover:text-stone-200">
            {item.vn.title.length > 24 ? `${item.vn.title.slice(0, 24)}\u2026` : item.vn.title}
          </Link>
        </p>
        <p className="mt-0.5 text-[11px] text-stone-600">{ago}</p>
      </div>
    </div>
  )
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const initialParams = new URLSearchParams(location.search)
  const { user, token, login, logout } = useAuth()
  const [activeTab, setActiveTab] = useState(() => (location.pathname === '/mylist' ? 'list' : 'search'))
  const [myLogs, setMyLogs] = useState([])
  const [logsLoaded, setLogsLoaded] = useState(false)
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '' })
  const [isRegistering, setIsRegistering] = useState(false)
  const [statusFilter, setStatusFilter] = useState(() => readEnumParam(initialParams, 'f', ['all', 'playing', 'completed', 'want-to-play', 'did-not-finish'], 'all'))
  const [listSearch, setListSearch] = useState(() => readTextParam(initialParams, 'q', ''))
  const [listSort, setListSort] = useState(() => readEnumParam(initialParams, 's', ['recently-updated', 'highest-rated', 'title-az'], 'recently-updated'))
  const [listSortDir, setListSortDir] = useState(() => readEnumParam(initialParams, 'o', ['asc', 'desc'], 'desc'))
  const [listMinRating, setListMinRating] = useState(() => readEnumParam(initialParams, 'm', ['all', '8', '7', '6', '5'], 'all'))
  const [listShowLabels, setListShowLabels] = useState(false)
  const [menuLogId, setMenuLogId] = useState(null)
  const [favoriteVnIds, setFavoriteVnIds] = useState(new Set())
  const [favoriteBusyId, setFavoriteBusyId] = useState('')
  const [listFeedback, setListFeedback] = useState('')
  const [friendsFeed, setFriendsFeed] = useState([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedSidebarTab, setFeedSidebarTab] = useState('friends')
  const [globalFeed, setGlobalFeed] = useState([])
  const [globalFeedLoading, setGlobalFeedLoading] = useState(false)
  const [globalFeedFetched, setGlobalFeedFetched] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (user) {
      setLogsLoaded(false)
      fetchLogs()
      fetchFriendsFeed()
      fetchFavoriteVNs()
    }
  }, [user, token])

  useEffect(() => {
    if (location.pathname !== '/' && location.pathname !== '/mylist') return
    const params = new URLSearchParams(location.search)
    const nextTab = location.pathname === '/mylist' ? 'list' : 'search'
    const nextStatus = readEnumParam(params, 'f', ['all', 'playing', 'completed', 'want-to-play', 'did-not-finish'], 'all')
    const nextSearch = readTextParam(params, 'q', '')
    const nextSort = readEnumParam(params, 's', ['recently-updated', 'highest-rated', 'title-az'], 'recently-updated')
    const nextSortDir = readEnumParam(params, 'o', ['asc', 'desc'], 'desc')
    const nextMin = readEnumParam(params, 'm', ['all', '8', '7', '6', '5'], 'all')

    if (nextTab !== activeTab) setActiveTab(nextTab)
    if (nextStatus !== statusFilter) setStatusFilter(nextStatus)
    if (nextSearch !== listSearch) setListSearch(nextSearch)
    if (nextSort !== listSort) setListSort(nextSort)
    if (nextSortDir !== listSortDir) setListSortDir(nextSortDir)
    if (nextMin !== listMinRating) setListMinRating(nextMin)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (location.pathname !== '/mylist') return
    const current = new URLSearchParams(location.search)
    const next = buildSearchParams(
      current,
      { f: statusFilter, q: listSearch, s: listSort, o: listSortDir, m: listMinRating },
      { f: 'all', q: '', s: 'recently-updated', o: 'desc', m: 'all' }
    )

    if (didSearchParamsChange(current, next)) {
      const query = next.toString()
      navigate({ pathname: '/mylist', search: query ? `?${query}` : '' }, { replace: true })
    }
  }, [location.pathname, location.search, statusFilter, listSearch, listSort, listSortDir, listMinRating, navigate])

  useEffect(() => {
    if (!menuLogId) return

    const handlePointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuLogId(null)
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenuLogId(null)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuLogId])

  useEffect(() => {
    if (feedSidebarTab === 'global' && !globalFeedFetched) {
      fetchGlobalFeed()
    }
  }, [feedSidebarTab, globalFeedFetched])

  const fetchFriendsFeed = async () => {
    setFeedLoading(true)
    try {
      const res = await fetch('http://localhost:3000/api/feed/activity?limit=20', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setFriendsFeed(Array.isArray(data.activity) ? data.activity : [])
    } catch (_) {}
    setFeedLoading(false)
  }

  const fetchGlobalFeed = async () => {
    setGlobalFeedLoading(true)
    try {
      const res = await fetch('http://localhost:3000/api/feed/global?limit=20')
      const data = await res.json()
      setGlobalFeed(Array.isArray(data.activity) ? data.activity : [])
    } catch (_) {}
    setGlobalFeedLoading(false)
    setGlobalFeedFetched(true)
  }


  const fetchLogs = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/logs', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const logs = await response.json()
      setMyLogs(logs)
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLogsLoaded(true)
    }
  }

  const fetchFavoriteVNs = async () => {
    if (!token) {
      setFavoriteVnIds(new Set())
      return
    }

    try {
      const response = await fetch('http://localhost:3000/api/users/me/settings', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load favorites')
      setFavoriteVnIds(new Set((data.settings?.favoriteVNs || []).map((item) => String(item.vnId))))
    } catch (error) {
      console.error('Error fetching favorites:', error)
    }
  }

  const addToList = async (vn) => {
    try {
      const response = await fetch('http://localhost:3000/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          vnId: vn.id,
          title: vn.title,
          image: vn.image?.url,
          status: 'want-to-play'
        })
      })
      if (response.ok) {
        await fetchLogs()
        return true
      }
      return false
    } catch (error) {
      console.error('Error adding to list:', error)
      return false
    }
  }

  const updateVNLog = async (vnId, updates) => {
    try {
      const response = await fetch('http://localhost:3000/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          vnId,
          ...updates
        })
      })
      if (response.ok) {
        await fetchLogs()
        return true
      }
      return false
    } catch (error) {
      console.error('Error updating log:', error)
      return false
    }
  }

  const deleteVNLog = async (vnId, shouldConfirm = true) => {
    if (shouldConfirm && !confirm('Are you sure you want to remove this entry?')) return false

    try {
      const response = await fetch(`http://localhost:3000/api/logs/${vnId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        await fetchLogs()
        return true
      }
      return false
    } catch (error) {
      console.error('Error deleting log:', error)
      return false
    }
  }

  const toggleFavoriteVN = async (log) => {
    if (!token) {
      setListFeedback('Sign in to update favorites.')
      return false
    }

    const currentId = String(log.vnId)
    setFavoriteBusyId(currentId)
    setListFeedback('')

    try {
      const settingsResponse = await fetch('http://localhost:3000/api/users/me/settings', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const settingsData = await settingsResponse.json()
      if (!settingsResponse.ok) throw new Error(settingsData.error || 'Could not load favorites')

      const currentFavorites = Array.isArray(settingsData.settings?.favoriteVNs) ? settingsData.settings.favoriteVNs : []
      const preferredCovers = Array.isArray(settingsData.settings?.preferredVnCovers) ? settingsData.settings.preferredVnCovers : []
      const alreadyFavorite = currentFavorites.some((item) => String(item.vnId) === currentId)

      let nextFavorites
      if (alreadyFavorite) {
        nextFavorites = currentFavorites.filter((item) => String(item.vnId) !== currentId)
      } else {
        if (currentFavorites.length >= 4) {
          throw new Error('You can only keep 4 favorite visual novels.')
        }
        const preferredCover = preferredCovers.find((item) => String(item.vnId) === currentId)
        nextFavorites = [
          ...currentFavorites,
          {
            vnId: currentId,
            title: log.title,
            image: preferredCover?.image || log.image || ''
          }
        ]
      }

      const updateResponse = await fetch('http://localhost:3000/api/users/me/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ favoriteVNs: nextFavorites })
      })

      const updateData = await updateResponse.json()
      if (!updateResponse.ok) throw new Error(updateData.error || 'Could not update favorites')

      const resolvedFavorites = Array.isArray(updateData.settings?.favoriteVNs) ? updateData.settings.favoriteVNs : nextFavorites
      setFavoriteVnIds(new Set(resolvedFavorites.map((item) => String(item.vnId))))
      setListFeedback(alreadyFavorite ? 'Removed from favorites.' : 'Added to favorites.')
      return true
    } catch (error) {
      console.error('Favorite update error:', error)
      setListFeedback(error.message || 'Could not update favorites.')
      return false
    } finally {
      setFavoriteBusyId('')
    }
  }

  const listStatusCounts = useMemo(() => {
    return {
      all: myLogs.length,
      playing: myLogs.filter((log) => log.status === 'playing').length,
      completed: myLogs.filter((log) => log.status === 'completed').length,
      'want-to-play': myLogs.filter((log) => log.status === 'want-to-play').length,
      'did-not-finish': myLogs.filter((log) => log.status === 'dropped' || log.status === 'on-hold').length
    }
  }, [myLogs])

  const filteredLogs = useMemo(() => {
    let logs = myLogs.filter((log) => matchesStatusFilter(log, statusFilter))

    const searchTerm = listSearch.trim().toLowerCase()
    if (searchTerm) {
      logs = logs.filter((log) => {
        const title = String(log.title || '').toLowerCase()
        const review = String(log.review || '').toLowerCase()
        return title.includes(searchTerm) || review.includes(searchTerm)
      })
    }

    if (listMinRating !== 'all') {
      const min = Number(listMinRating)
      logs = logs.filter((log) => log.rating != null && Number(log.rating) >= min)
    }

    const getRating = (log) => (log.rating != null ? Number(log.rating) : -Infinity)
    const dir = listSortDir === 'asc' ? 1 : -1
    const sorted = [...logs]
    if (listSort === 'highest-rated') {
      sorted.sort((a, b) => {
        const diff = getRating(a) - getRating(b)
        if (diff !== 0) return diff * dir
        return String(a.title || '').localeCompare(String(b.title || ''))
      })
    } else if (listSort === 'title-az') {
      sorted.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')) * dir)
    } else {
      sorted.sort((a, b) => (new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0)) * dir)
    }

    return sorted
  }, [myLogs, statusFilter, listSearch, listSort, listSortDir, listMinRating])

  const listGridClassName = 'grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'

  const handleAuth = async (e) => {
    e.preventDefault()
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login'
    const data = isRegistering ? registerData : loginData

    try {
      const response = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (response.ok) {
        login(result.user, result.token)
      } else {
        alert(result.error)
      }
    } catch (error) {
      console.error('Auth error:', error)
    }
  }

  if (!user) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="page-container grid max-w-5xl gap-6 lg:grid-cols-[1.2fr_1fr]">
          <section className="panel p-8 md:p-10">
            <p className="mb-3 inline-flex rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-stone-200">
              Visual Novel Journal
            </p>
            <h1 className="top-brand text-4xl md:text-5xl">Track every story you finish.</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-stone-300 md:text-lg">
              Mikan keeps your reading history, ratings, and short reviews in one place with a clean, cinema-inspired dashboard.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 text-sm text-stone-300">
              <div className="panel-soft p-4">
                <p className="text-2xl font-bold text-white">10+</p>
                <p className="mt-1 text-stone-400">results per search</p>
              </div>
              <div className="panel-soft p-4">
                <p className="text-2xl font-bold text-white">5</p>
                <p className="mt-1 text-stone-400">track statuses</p>
              </div>
            </div>
          </section>

          <section className="panel p-8 md:p-10">
            <h2 className="text-2xl font-bold text-white">{isRegistering ? 'Create account' : 'Welcome back'}</h2>
            <p className="mt-2 text-sm text-stone-400">
              {isRegistering ? 'Start your personal VN journal.' : 'Sign in to continue your watchlist.'}
            </p>

            <form onSubmit={handleAuth} className="mt-7 space-y-4">
              {isRegistering && (
                <div>
                  <label className="field-label">Username</label>
                  <input
                    type="text"
                    placeholder="your username"
                    value={registerData.username}
                    onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                    className="field-input"
                    required
                  />
                </div>
              )}

              <div>
                <label className="field-label">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={isRegistering ? registerData.email : loginData.email}
                  onChange={(e) =>
                    isRegistering
                      ? setRegisterData({ ...registerData, email: e.target.value })
                      : setLoginData({ ...loginData, email: e.target.value })
                  }
                  className="field-input"
                  required
                />
              </div>

              <div>
                <label className="field-label">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={isRegistering ? registerData.password : loginData.password}
                  onChange={(e) =>
                    isRegistering
                      ? setRegisterData({ ...registerData, password: e.target.value })
                      : setLoginData({ ...loginData, password: e.target.value })
                  }
                  className="field-input"
                  required
                />
              </div>

              <button type="submit" className="btn-primary w-full py-3 text-stone-950">
                {isRegistering ? 'Create account' : 'Sign in'}
              </button>
            </form>

            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="mt-5 text-sm font-semibold text-stone-300 transition hover:text-white"
            >
              {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </section>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="min-h-screen bg-stone-950 text-white">
            <SiteHeader user={user} token={token} onLogout={logout} listsHref="/lists/explore" />

            <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6 sm:px-6">
              <div className="mb-6 border-b border-stone-800/80 pb-5">
                <h1 className="text-4xl font-bold tracking-tight text-white">Mikan</h1>
                <p className="mt-1 text-sm text-stone-400">A curated journal for visual novel tracking.</p>
              </div>

              <div className="mb-8 rounded-xl border border-stone-800 bg-stone-900/40 p-1.5">
                <div className="grid w-full grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate('/')}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold tracking-wide transition ${
                      activeTab === 'search'
                        ? 'bg-white text-stone-950'
                        : 'text-stone-300 hover:bg-stone-800/80 hover:text-white'
                    }`}
                  >
                    Discover
                  </button>
                  <button
                    onClick={() => navigate('/mylist')}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold tracking-wide transition ${
                      activeTab === 'list'
                        ? 'bg-white text-stone-950'
                        : 'text-stone-300 hover:bg-stone-800/80 hover:text-white'
                    }`}
                  >
                    My List ({myLogs.length})
                  </button>
                </div>
              </div>

              {activeTab === 'search' && (
                <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
                  {/* Main feed */}
                  <div className="divide-y divide-stone-800/60">
                    {feedLoading ? (
                      <p className="py-12 text-center text-sm text-stone-500">Loading feed…</p>
                    ) : friendsFeed.length === 0 ? (
                      <div className="rounded-xl border border-stone-800 bg-stone-950/40 p-10 text-center">
                        <Users className="mx-auto h-10 w-10 text-stone-500" />
                        <h3 className="mt-3 text-lg font-semibold text-white">Your feed is empty</h3>
                        <p className="mt-2 text-sm text-stone-400">Follow other readers to see their activity here.</p>
                        <Link
                          to="/members"
                          className="mt-5 inline-flex rounded-md border border-white/60 bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-stone-100"
                        >
                          Find readers
                        </Link>
                      </div>
                    ) : (
                      friendsFeed.map((item) => {
                        const actorHref = `/user/${item.actor.username}`
                        const vnHref = `/vn/${item.vn.vnId}`
                        const ago = timeAgo(item.timestamp)
                        const avatarSrc = item.actor.avatarUrl ? `http://localhost:3000${item.actor.avatarUrl}` : null
                        const initial = (item.actor.username?.[0] || '?').toUpperCase()

                        if (item.type === 'review') {
                          return (
                            <article key={item.id} className="flex gap-4 py-6">
                              <Link to={vnHref} className="flex-shrink-0">
                                <img
                                  src={item.vn.image || 'https://placehold.co/72x108/100f0e/d6d3d1?text=VN'}
                                  alt={item.vn.title}
                                  className="h-[108px] w-[72px] rounded-md object-cover"
                                />
                              </Link>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm text-stone-400">
                                    <Link to={actorHref} className="font-bold text-white hover:text-stone-200">
                                      {item.actor.username}
                                    </Link>{' '}reviewed
                                  </p>
                                  <span className="flex-shrink-0 text-xs text-stone-500">{ago}</span>
                                </div>
                                <Link to={vnHref} className="mt-0.5 block text-lg font-bold leading-tight text-white hover:text-stone-200">
                                  {item.vn.title}
                                </Link>
                                {item.data.rating ? (
                                  <div className="mt-1"><FeedStars rating={item.data.rating} /></div>
                                ) : null}
                                {item.data.review ? (
                                  <p className="mt-2 text-sm italic leading-relaxed text-stone-400">
                                    {item.data.review.length > 200
                                      ? <>This review may contain spoilers.{' '}<Link to={vnHref} className="font-semibold not-italic text-stone-200 hover:text-stone-200">Show review</Link></>
                                      : shortText(item.data.review, 200)}
                                  </p>
                                ) : null}
                                <div className="mt-3 flex items-center gap-4 text-xs text-stone-600">
                                  <button className="inline-flex items-center gap-1 transition hover:text-stone-300">
                                    <Heart className="h-3.5 w-3.5" /> Like
                                  </button>
                                  <button className="inline-flex items-center gap-1 transition hover:text-stone-300">
                                    <MessageCircle className="h-3.5 w-3.5" /> 0
                                  </button>
                                </div>
                              </div>
                            </article>
                          )
                        }

                        const action = statusActionLabel(item.data.status)
                        return (
                          <article key={item.id} className="flex items-center gap-3 py-4">
                            <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-stone-700">
                              {avatarSrc ? (
                                <img src={avatarSrc} alt={item.actor.username} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-stone-200">{initial}</div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 text-sm">
                              <Link to={actorHref} className="font-bold text-white hover:text-stone-200">{item.actor.username}</Link>{' '}
                              <span className="text-stone-400">{action}</span>{' '}
                              <Link to={vnHref} className="font-semibold text-white hover:text-stone-200">{item.vn.title}</Link>
                              {item.data.rating ? (
                                <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-400">
                                  <Star className="h-3 w-3 fill-current" /> {(item.data.rating / 2).toFixed(1)}
                                </span>
                              ) : null}
                            </div>
                            <span className="flex-shrink-0 text-xs text-stone-500">{ago}</span>
                          </article>
                        )
                      })
                    )}
                  </div>

                  {/* Right sidebar */}
                  <div className="hidden lg:block">
                    <div className="sticky top-4 overflow-hidden rounded-xl border border-stone-800 bg-stone-950/40">
                      <div className="flex border-b border-stone-800">
                        {['friends', 'global'].map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setFeedSidebarTab(tab)}
                            className={`flex-1 py-2.5 text-sm font-semibold capitalize transition ${
                              feedSidebarTab === tab ? 'bg-stone-800/80 text-white' : 'text-stone-400 hover:text-white'
                            }`}
                          >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                          </button>
                        ))}
                      </div>
                      <div className="max-h-[70vh] divide-y divide-stone-800/60 overflow-y-auto">
                        {feedSidebarTab === 'friends' ? (
                          feedLoading ? (
                            <p className="p-4 text-xs text-stone-500">Loading…</p>
                          ) : friendsFeed.length === 0 ? (
                            <p className="p-4 text-xs text-stone-500">Follow users to see their activity here.</p>
                          ) : (
                            friendsFeed.slice(0, 20).map((item) => <CompactFeedItem key={item.id} item={item} />)
                          )
                        ) : globalFeedLoading ? (
                          <p className="p-4 text-xs text-stone-500">Loading…</p>
                        ) : globalFeed.length === 0 ? (
                          <p className="p-4 text-xs text-stone-500">No global activity yet.</p>
                        ) : (
                          globalFeed.slice(0, 20).map((item) => <CompactFeedItem key={item.id} item={item} />)
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'list' && (
                <section className="mx-auto max-w-6xl space-y-6">
                  <div>
                    <h2 className="text-3xl font-semibold text-white">My VN List</h2>
                    <p className="mt-1 text-sm text-stone-400">{myLogs.length} visual novels logged</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800/80 pb-4">
                    <div className="flex flex-wrap gap-2">
                    {LIST_STATUS_TABS.map((tab) => (
                      <button
                        key={tab.value}
                        onClick={() => setStatusFilter(tab.value)}
                        className={`rounded-sm border px-3 py-2 text-sm font-medium transition ${
                          statusFilter === tab.value
                            ? 'border-stone-200 bg-stone-100 text-stone-950'
                            : 'border-stone-800 bg-stone-950/70 text-stone-300 hover:border-stone-600 hover:text-white'
                        }`}
                      >
                        {tab.label}: {listStatusCounts[tab.value] || 0}
                      </button>
                    ))}
                    </div>

                    <button
                      onClick={() => setListShowLabels((prev) => !prev)}
                      className="rounded-full border border-stone-800 bg-stone-950/70 px-4 py-2 text-sm font-medium text-stone-300 transition hover:border-stone-600 hover:text-white"
                    >
                      Labels {listShowLabels ? 'On' : 'Off'}
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 border-b border-stone-800/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <select
                          value={listSort}
                          onChange={(e) => { setListSort(e.target.value); setListSortDir('desc') }}
                          className="h-11 appearance-none rounded-full border border-stone-800 bg-stone-950/70 px-4 pl-10 pr-9 text-sm text-stone-200 outline-none transition focus:border-white/60"
                        >
                          <option value="recently-updated">Recent</option>
                          <option value="highest-rated">Rating</option>
                          <option value="title-az">Title</option>
                        </select>
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"><ArrowUpDown className="h-4 w-4" /></span>
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">▾</span>
                      </div>

                      <button
                        onClick={() => setListSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                        title={listSortDir === 'desc' ? 'Descending — click for ascending' : 'Ascending — click for descending'}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-800 bg-stone-950/70 text-stone-300 transition hover:border-stone-600 hover:text-white"
                      >
                        {listSortDir === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                      </button>

                      <div className="relative">
                        <select
                          value={listMinRating}
                          onChange={(e) => setListMinRating(e.target.value)}
                          className="h-11 appearance-none rounded-full border border-stone-800 bg-stone-950/70 px-4 pl-10 pr-9 text-sm text-stone-200 outline-none transition focus:border-white/60"
                        >
                          <option value="all">Rating</option>
                          <option value="8">8+</option>
                          <option value="7">7+</option>
                          <option value="6">6+</option>
                          <option value="5">5+</option>
                        </select>
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"><Star className="h-4 w-4" /></span>
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">▾</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {(listSearch || listMinRating !== 'all' || statusFilter !== 'all') ? (
                        <button
                          onClick={() => { setListSearch(''); setListMinRating('all'); setStatusFilter('all') }}
                          className="whitespace-nowrap text-xs text-stone-500 transition hover:text-stone-300"
                        >
                          Clear filters
                        </button>
                      ) : null}
                      <span className="whitespace-nowrap text-xs text-stone-500">{filteredLogs.length} / {myLogs.length}</span>
                      <div className="relative w-full lg:w-auto">
                        <input
                          type="text"
                          value={listSearch}
                          onChange={(e) => setListSearch(e.target.value)}
                          placeholder="Search"
                          className="h-11 w-full rounded-full border border-stone-800 bg-stone-950/70 pl-10 pr-4 text-sm text-stone-200 outline-none transition placeholder:text-stone-500 focus:border-white/60 lg:w-72"
                        />
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-500"><Search className="h-4 w-4" /></span>
                      </div>
                    </div>
                  </div>

                  {listFeedback ? (
                    <p className="rounded-xl border border-stone-800 bg-stone-950/60 px-4 py-3 text-sm text-stone-300">{listFeedback}</p>
                  ) : null}

                  {filteredLogs.length ? (
                    <div className={listGridClassName}>
                      {filteredLogs.map((log) => (
                        <article key={log.vnId} className="group relative">
                          <Link to={`/vn/${log.vnId}`} className="block">
                            <div className="relative overflow-hidden rounded-[1.4rem] border border-stone-800 bg-stone-950/70 shadow-xl shadow-black/30 transition duration-200 group-hover:border-stone-700 group-hover:shadow-2xl group-hover:shadow-black/50">
                              <img
                                src={log.image || 'https://placehold.co/400x600/100f0e/d6d3d1?text=VN'}
                                alt={log.title}
                                className="aspect-[2/3] w-full object-cover transition duration-200 group-hover:scale-[1.02] group-hover:brightness-75"
                              />
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/28 to-black/10 opacity-0 transition duration-200 group-hover:opacity-100" />
                              <div className="pointer-events-none absolute inset-x-4 bottom-4 translate-y-3 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                                <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 backdrop-blur-sm">
                                  <p className="line-clamp-3 text-sm font-semibold leading-snug text-white drop-shadow-[0_1px_10px_rgba(0,0,0,0.5)]">
                                    {log.title}
                                  </p>
                                </div>
                              </div>
                              {favoriteVnIds.has(String(log.vnId)) ? (
                                <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-rose-400/30 bg-black/60 px-2 py-1 text-[11px] font-semibold text-rose-200 backdrop-blur-sm">
                                  Favorite
                                </span>
                              ) : null}
                            </div>
                          </Link>
                          {log.rating ? (
                            <div className="mt-2 px-1">
                              {renderStarRating(log.rating)}
                            </div>
                          ) : null}
                          <div className="mt-1.5 flex items-center gap-1.5 px-1">
                            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${statusDot(log.status)}`} />
                            <span className="truncate text-[10px] font-medium text-stone-500">{statusShortLabel(log.status)}</span>
                          </div>

                          <div className="absolute right-3 top-3 z-20 opacity-0 transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                            <div ref={menuLogId === log.vnId ? menuRef : null} className="relative">
                              <button
                                type="button"
                                aria-label={`Open actions for ${log.title}`}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setMenuLogId((prev) => (prev === log.vnId ? null : log.vnId))
                                }}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-700 bg-black/65 text-lg font-bold text-white backdrop-blur-sm transition hover:border-stone-500 hover:bg-black/80"
                              >
                                ⋯
                              </button>

                              {menuLogId === log.vnId ? (
                                <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-2xl border border-stone-700 bg-stone-950/95 p-1.5 shadow-2xl shadow-black/60">
                                  <Link
                                    to={`/list/${log.vnId}?edit=1&from=${encodeURIComponent(`${location.pathname}${location.search}` || '/mylist')}`}
                                    onClick={() => setMenuLogId(null)}
                                    className="block rounded-xl px-3 py-2 text-sm font-medium text-stone-200 transition hover:bg-stone-900 hover:text-white"
                                  >
                                    Edit entry
                                  </Link>
                                  <Link
                                    to={`/vn/${log.vnId}`}
                                    onClick={() => setMenuLogId(null)}
                                    className="block rounded-xl px-3 py-2 text-sm font-medium text-stone-200 transition hover:bg-stone-900 hover:text-white"
                                  >
                                    Open VN page
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      await toggleFavoriteVN(log)
                                      setMenuLogId(null)
                                    }}
                                    disabled={favoriteBusyId === String(log.vnId)}
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-stone-200 transition hover:bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {favoriteBusyId === String(log.vnId)
                                      ? 'Updating...'
                                      : favoriteVnIds.has(String(log.vnId))
                                        ? 'Remove favorite'
                                        : 'Mark as favorite'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const removed = await deleteVNLog(log.vnId, true)
                                      if (removed) setMenuLogId(null)
                                    }}
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200"
                                  >
                                    Remove from list
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {listShowLabels ? (
                            <div className="mt-3 space-y-1 px-1">
                              <Link to={`/vn/${log.vnId}`} className="block">
                                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white transition hover:text-stone-200">
                                  {log.title}
                                </h3>
                              </Link>
                              <p className="text-xs text-stone-400">{STATUS_LABELS[log.status] || 'Plan to Play'}</p>
                              {log.rating ? renderStarRating(log.rating) : null}
                              {log.review ? <p className="line-clamp-2 text-xs text-stone-500">{shortText(log.review, 64)}</p> : null}
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-stone-800 bg-stone-950/50 px-4 py-3 text-sm text-stone-400">
                      No visual novels match these filters.
                    </p>
                  )}
                </section>
              )}

            </div>
          </div>
        }
      />
      <Route
        path="/mylist"
        element={
          <div className="min-h-screen bg-stone-950 text-white">
            <SiteHeader user={user} token={token} onLogout={logout} listsHref="/lists/explore" />

            <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6 sm:px-6">
              <div className="mb-6 border-b border-stone-800/80 pb-5">
                <h1 className="text-4xl font-bold tracking-tight text-white">Mikan</h1>
                <p className="mt-1 text-sm text-stone-400">A curated journal for visual novel tracking.</p>
              </div>

              <div className="mb-8 rounded-xl border border-stone-800 bg-stone-900/40 p-1.5">
                <div className="grid w-full grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate('/')}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold tracking-wide transition ${
                      activeTab === 'search'
                        ? 'bg-white text-stone-950'
                        : 'text-stone-300 hover:bg-stone-800/80 hover:text-white'
                    }`}
                  >
                    Discover
                  </button>
                  <button
                    onClick={() => navigate('/mylist')}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold tracking-wide transition ${
                      activeTab === 'list'
                        ? 'bg-white text-stone-950'
                        : 'text-stone-300 hover:bg-stone-800/80 hover:text-white'
                    }`}
                  >
                    My List ({myLogs.length})
                  </button>
                </div>
              </div>

              {activeTab === 'list' && (
                <section className="mx-auto max-w-6xl space-y-6">
                  <div>
                    <h2 className="text-3xl font-semibold text-white">My VN List</h2>
                    <p className="mt-1 text-sm text-stone-400">{myLogs.length} visual novels logged</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800/80 pb-4">
                    <div className="flex flex-wrap gap-2">
                    {LIST_STATUS_TABS.map((tab) => (
                      <button
                        key={tab.value}
                        onClick={() => setStatusFilter(tab.value)}
                        className={`rounded-sm border px-3 py-2 text-sm font-medium transition ${
                          statusFilter === tab.value
                            ? 'border-stone-200 bg-stone-100 text-stone-950'
                            : 'border-stone-800 bg-stone-950/70 text-stone-300 hover:border-stone-600 hover:text-white'
                        }`}
                      >
                        {tab.label}: {listStatusCounts[tab.value] || 0}
                      </button>
                    ))}
                    </div>

                    <button
                      onClick={() => setListShowLabels((prev) => !prev)}
                      className="rounded-full border border-stone-800 bg-stone-950/70 px-4 py-2 text-sm font-medium text-stone-300 transition hover:border-stone-600 hover:text-white"
                    >
                      Labels {listShowLabels ? 'On' : 'Off'}
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 border-b border-stone-800/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <select
                          value={listSort}
                          onChange={(e) => { setListSort(e.target.value); setListSortDir('desc') }}
                          className="h-11 appearance-none rounded-full border border-stone-800 bg-stone-950/70 px-4 pl-10 pr-9 text-sm text-stone-200 outline-none transition focus:border-white/60"
                        >
                          <option value="recently-updated">Recent</option>
                          <option value="highest-rated">Rating</option>
                          <option value="title-az">Title</option>
                        </select>
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"><ArrowUpDown className="h-4 w-4" /></span>
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">▾</span>
                      </div>

                      <button
                        onClick={() => setListSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                        title={listSortDir === 'desc' ? 'Descending — click for ascending' : 'Ascending — click for descending'}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-800 bg-stone-950/70 text-stone-300 transition hover:border-stone-600 hover:text-white"
                      >
                        {listSortDir === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                      </button>

                      <div className="relative">
                        <select
                          value={listMinRating}
                          onChange={(e) => setListMinRating(e.target.value)}
                          className="h-11 appearance-none rounded-full border border-stone-800 bg-stone-950/70 px-4 pl-10 pr-9 text-sm text-stone-200 outline-none transition focus:border-white/60"
                        >
                          <option value="all">Rating</option>
                          <option value="8">8+</option>
                          <option value="7">7+</option>
                          <option value="6">6+</option>
                          <option value="5">5+</option>
                        </select>
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"><Star className="h-4 w-4" /></span>
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">▾</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {(listSearch || listMinRating !== 'all' || statusFilter !== 'all') ? (
                        <button
                          onClick={() => { setListSearch(''); setListMinRating('all'); setStatusFilter('all') }}
                          className="whitespace-nowrap text-xs text-stone-500 transition hover:text-stone-300"
                        >
                          Clear filters
                        </button>
                      ) : null}
                      <span className="whitespace-nowrap text-xs text-stone-500">{filteredLogs.length} / {myLogs.length}</span>
                      <div className="relative w-full lg:w-auto">
                        <input
                          type="text"
                          value={listSearch}
                          onChange={(e) => setListSearch(e.target.value)}
                          placeholder="Search"
                          className="h-11 w-full rounded-full border border-stone-800 bg-stone-950/70 pl-10 pr-4 text-sm text-stone-200 outline-none transition placeholder:text-stone-500 focus:border-white/60 lg:w-72"
                        />
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-500"><Search className="h-4 w-4" /></span>
                      </div>
                    </div>
                  </div>

                  {listFeedback ? (
                    <p className="rounded-xl border border-stone-800 bg-stone-950/60 px-4 py-3 text-sm text-stone-300">{listFeedback}</p>
                  ) : null}

                  {filteredLogs.length ? (
                    <div className={listGridClassName}>
                      {filteredLogs.map((log) => (
                        <article key={log.vnId} className="group relative">
                          <Link to={`/vn/${log.vnId}`} className="block">
                            <div className="relative overflow-hidden rounded-[1.4rem] border border-stone-800 bg-stone-950/70 shadow-xl shadow-black/30 transition duration-200 group-hover:border-stone-700 group-hover:shadow-2xl group-hover:shadow-black/50">
                              <img
                                src={log.image || 'https://placehold.co/400x600/100f0e/d6d3d1?text=VN'}
                                alt={log.title}
                                className="aspect-[2/3] w-full object-cover transition duration-200 group-hover:scale-[1.02] group-hover:brightness-75"
                              />
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/28 to-black/10 opacity-0 transition duration-200 group-hover:opacity-100" />
                              <div className="pointer-events-none absolute inset-x-4 bottom-4 translate-y-3 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                                <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 backdrop-blur-sm">
                                  <p className="line-clamp-3 text-sm font-semibold leading-snug text-white drop-shadow-[0_1px_10px_rgba(0,0,0,0.5)]">
                                    {log.title}
                                  </p>
                                </div>
                              </div>
                              {favoriteVnIds.has(String(log.vnId)) ? (
                                <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-rose-400/30 bg-black/60 px-2 py-1 text-[11px] font-semibold text-rose-200 backdrop-blur-sm">
                                  Favorite
                                </span>
                              ) : null}
                            </div>
                          </Link>
                          {log.rating ? (
                            <div className="mt-2 px-1">
                              {renderStarRating(log.rating)}
                            </div>
                          ) : null}
                          <div className="mt-1.5 flex items-center gap-1.5 px-1">
                            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${statusDot(log.status)}`} />
                            <span className="truncate text-[10px] font-medium text-stone-500">{statusShortLabel(log.status)}</span>
                          </div>

                          <div className="absolute right-3 top-3 z-20 opacity-0 transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                            <div ref={menuLogId === log.vnId ? menuRef : null} className="relative">
                              <button
                                type="button"
                                aria-label={`Open actions for ${log.title}`}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setMenuLogId((prev) => (prev === log.vnId ? null : log.vnId))
                                }}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-700 bg-black/65 text-lg font-bold text-white backdrop-blur-sm transition hover:border-stone-500 hover:bg-black/80"
                              >
                                ⋯
                              </button>

                              {menuLogId === log.vnId ? (
                                <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-2xl border border-stone-700 bg-stone-950/95 p-1.5 shadow-2xl shadow-black/60">
                                  <Link
                                    to={`/list/${log.vnId}?edit=1&from=${encodeURIComponent(`${location.pathname}${location.search}` || '/mylist')}`}
                                    onClick={() => setMenuLogId(null)}
                                    className="block rounded-xl px-3 py-2 text-sm font-medium text-stone-200 transition hover:bg-stone-900 hover:text-white"
                                  >
                                    Edit entry
                                  </Link>
                                  <Link
                                    to={`/vn/${log.vnId}`}
                                    onClick={() => setMenuLogId(null)}
                                    className="block rounded-xl px-3 py-2 text-sm font-medium text-stone-200 transition hover:bg-stone-900 hover:text-white"
                                  >
                                    Open VN page
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      await toggleFavoriteVN(log)
                                      setMenuLogId(null)
                                    }}
                                    disabled={favoriteBusyId === String(log.vnId)}
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-stone-200 transition hover:bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {favoriteBusyId === String(log.vnId)
                                      ? 'Updating...'
                                      : favoriteVnIds.has(String(log.vnId))
                                        ? 'Remove favorite'
                                        : 'Mark as favorite'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const removed = await deleteVNLog(log.vnId, true)
                                      if (removed) setMenuLogId(null)
                                    }}
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200"
                                  >
                                    Remove from list
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {listShowLabels ? (
                            <div className="mt-3 space-y-1 px-1">
                              <Link to={`/vn/${log.vnId}`} className="block">
                                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white transition hover:text-stone-200">
                                  {log.title}
                                </h3>
                              </Link>
                              <p className="text-xs text-stone-400">{STATUS_LABELS[log.status] || 'Plan to Play'}</p>
                              {log.rating ? renderStarRating(log.rating) : null}
                              {log.review ? <p className="line-clamp-2 text-xs text-stone-500">{shortText(log.review, 64)}</p> : null}
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-stone-800 bg-stone-950/50 px-4 py-3 text-sm text-stone-400">
                      No visual novels match these filters.
                    </p>
                  )}
                </section>
              )}

            </div>
          </div>
        }
      />
      <Route path="/vn/:id" element={<VNDetail />} />
      <Route path="/character/:id" element={<CharacterDetail />} />
      <Route path="/lists/explore" element={<ListsBrowse />} />
      <Route path="/lists/new" element={<ListCreatePage />} />
      <Route path="/lists/:listId" element={<ListDetailPage />} />
      <Route
        path="/list/:vnId"
        element={
          <ListEntryDetail
            user={user}
            token={token}
            logout={logout}
            logs={myLogs}
            logsLoaded={logsLoaded}
            onSaveLog={updateVNLog}
            onDeleteLog={deleteVNLog}
            onToggleFavorite={toggleFavoriteVN}
            favoriteVnIds={favoriteVnIds}
            favoriteBusyId={favoriteBusyId}
          />
        }
      />
      <Route path="/profile/*" element={<UserProfile />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/members" element={<Members />} />
      <Route path="/user/:username/*" element={<UserProfile />} />
    </Routes>
  )
}

export default App
