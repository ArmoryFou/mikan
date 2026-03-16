import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Gamepad2, PenSquare, Send, Star, UserRound } from 'lucide-react'

function SiteHeader({ user, token, onLogout, listsHref = '/profile/lists', createListHref = '/lists/new', showSearch = true }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [scrollY, setScrollY] = useState(0)
  const [navSearch, setNavSearch] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!user || !token) return
    fetchNotifications()
  }, [user?.id, token])

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const term = navSearch.trim()
    if (!term) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch('http://localhost:3000/api/vn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters: ['search', '=', term], fields: 'title,image.url,rating', results: 8 })
        })
        const data = await res.json()
        setSearchResults(Array.isArray(data.results) ? data.results : [])
        setSearchOpen(true)
      } catch (_) {
        setSearchResults([])
      }
      setSearchLoading(false)
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [navSearch])

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY || 0)

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const fetchNotifications = async () => {
    if (!token) return

    setNotifLoading(true)
    try {
      const response = await fetch('http://localhost:3000/api/notifications?limit=10', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load notifications')
      setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
      setUnreadCount(Number(data.unreadCount || 0))
    } catch (_error) {
      setNotifications([])
      setUnreadCount(0)
    }
    setNotifLoading(false)
  }

  const markNotificationRead = async (notificationId) => {
    if (!token) return
    try {
      const response = await fetch(`http://localhost:3000/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.ok) return

      setNotifications((prev) => prev.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (_error) {
      // Ignore transient notification errors in header.
    }
  }

  const markAllRead = async () => {
    if (!token) return

    try {
      const response = await fetch('http://localhost:3000/api/notifications/mark-all-read', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.ok) return

      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))
      setUnreadCount(0)
    } catch (_error) {
      // Ignore transient notification errors in header.
    }
  }

  const submitSearch = (e) => {
    e.preventDefault()
    if (searchResults.length) {
      navigate(`/vn/${searchResults[0].id}`)
      setSearchOpen(false)
      setNavSearch('')
    }
  }

  const isScrolled = scrollY > 18
  const isCondensed = scrollY > 28
  const isElevated = scrollY > 96
  const controlClass = `rounded-md border text-stone-300 transition hover:border-stone-500 hover:text-white ${
    isCondensed ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-1.5 text-xs font-semibold'
  }`

  return (
    <header className="relative">
      <div className="h-5 bg-black" />
      <div className={`${isCondensed ? 'h-[65px]' : 'h-[73px]'} transition-all duration-300`} />
      <div
        className={`fixed inset-x-0 top-0 z-40 border-b transition-all duration-300 ${
          isScrolled
            ? `border-stone-800/55 bg-stone-950/40 backdrop-blur-lg supports-[backdrop-filter]:bg-stone-950/28 ${
                isElevated ? 'shadow-[0_10px_28px_rgba(0,0,0,0.18)]' : 'shadow-none'
              }`
            : 'border-stone-800/40 bg-black/88 supports-[backdrop-filter]:bg-black/72'
        }`}
      >
        <div className={`mx-auto flex w-full max-w-6xl items-center gap-4 px-4 transition-all duration-300 sm:px-6 ${isCondensed ? 'py-2' : 'py-3'}`}>
          <Link to="/" className={`font-bold tracking-tight text-white transition-all duration-300 ${isCondensed ? 'text-[1.7rem]' : 'text-3xl'}`}>
            Mikan
          </Link>

          <nav className={`ml-4 hidden items-center text-sm font-semibold text-stone-300 transition-all duration-300 md:flex ${isCondensed ? 'gap-5' : 'gap-6'}`}>
            <Link to="/" className="transition hover:text-white">Browse</Link>
            <Link to={listsHref} className="transition hover:text-white">Lists</Link>
            <Link to="/members" className="transition hover:text-white">Members</Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {showSearch ? (
              <div ref={searchRef} className="relative hidden lg:block">
                <input
                  type="text"
                  value={navSearch}
                  onChange={(e) => setNavSearch(e.target.value)}
                  onFocus={() => navSearch.trim() && searchResults.length && setSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setSearchOpen(false); e.currentTarget.blur() }
                    if (e.key === 'Enter') submitSearch(e)
                  }}
                  placeholder="Search visual novels"
                  className={`rounded-full border px-5 text-sm text-stone-200 outline-none transition-all duration-300 placeholder:text-stone-500 focus:border-white/60 ${
                    isScrolled
                      ? `${isCondensed ? 'h-10 w-72' : 'h-11 w-80'} border-stone-700/60 bg-stone-900/35 backdrop-blur-md`
                      : 'h-11 w-80 border-stone-800 bg-stone-950/70'
                  }`}
                />
                {searchOpen && (searchLoading || searchResults.length > 0) ? (
                  <div className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-stone-700 bg-stone-950 shadow-2xl shadow-black/70">
                    {searchLoading ? (
                      <p className="px-4 py-3 text-sm text-stone-500">Searching…</p>
                    ) : (
                      searchResults.map((vn) => (
                        <button
                          key={vn.id}
                          onClick={() => { navigate(`/vn/${vn.id}`); setSearchOpen(false); setNavSearch('') }}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-stone-800/80"
                        >
                          <img
                            src={vn.image?.url || 'https://placehold.co/32x48/100f0e/d6d3d1?text=VN'}
                            alt={vn.title}
                            className="h-12 w-8 flex-shrink-0 rounded object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">{vn.title}</p>
                            {vn.rating ? (
                              <p className="inline-flex items-center gap-1 text-xs text-amber-400">
                                <Star className="h-3 w-3 fill-current" />
                                {(vn.rating / 10).toFixed(1)}
                              </p>
                            ) : (
                              <p className="text-xs text-stone-600">No rating</p>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {user ? (
              <>
                <Link
                  to={createListHref}
                  className={`hidden border border-white/40 bg-white/5 text-stone-200 hover:bg-white/10 sm:inline-flex ${controlClass}`}
                >
                  + Create List
                </Link>

                <div className="relative">
                  <button
                    onClick={() => {
                      const next = !notifOpen
                      setNotifOpen(next)
                      if (next) fetchNotifications()
                    }}
                    aria-label="Notifications"
                    title="Notifications"
                    className={`relative inline-flex items-center justify-center border border-stone-700 ${controlClass}`}
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 ? (
                      <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-stone-950">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    ) : null}
                  </button>

                  {notifOpen ? (
                    <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-lg border border-stone-700 bg-stone-950 p-2 shadow-2xl shadow-black/50">
                      <div className="mb-2 flex items-center justify-between px-2 py-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Notifications</p>
                        <button
                          onClick={markAllRead}
                          className="text-[11px] font-semibold text-stone-200 transition hover:text-stone-200"
                        >
                          Mark all read
                        </button>
                      </div>

                      {notifLoading ? (
                        <p className="px-2 py-3 text-xs text-stone-400">Loading...</p>
                      ) : notifications.length ? (
                        <div className="max-h-80 space-y-1 overflow-y-auto">
                          {notifications.map((item) => {
                            const icon = item.type === 'follow'
                              ? <UserRound className="h-3.5 w-3.5" />
                              : item.type === 'recommend'
                                ? <Send className="h-3.5 w-3.5" />
                              : item.type === 'review'
                                ? <PenSquare className="h-3.5 w-3.5" />
                                : <Gamepad2 className="h-3.5 w-3.5" />
                            const vnLink = item.targetId ? `/vn/${item.targetId}` : null
                            const actorLink = item.actor?.username ? `/user/${item.actor.username}` : null

                            return (
                              <div
                                key={item.id}
                                onClick={() => !item.isRead && markNotificationRead(item.id)}
                                className={`rounded-md border px-2 py-2 transition ${
                                  item.isRead
                                    ? 'border-stone-800 bg-stone-900/50 text-stone-400'
                                    : 'cursor-pointer border-stone-700 bg-stone-900 text-stone-200 hover:border-stone-600'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <span className="mt-0.5 text-stone-400">{icon}</span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold">
                                      {actorLink ? (
                                        <Link to={actorLink} className="hover:text-stone-200" onClick={(e) => e.stopPropagation()}>
                                          @{item.actor.username}
                                        </Link>
                                      ) : (
                                        <span>@{item.actor?.username || 'unknown'}</span>
                                      )}{' '}
                                      {item.message || 'sent an update'}
                                    </p>
                                    {vnLink ? (
                                      <Link
                                        to={vnLink}
                                        className="mt-0.5 block truncate text-[11px] text-stone-200/80 hover:text-stone-200"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {item.targetTitle || item.targetId}
                                      </Link>
                                    ) : null}
                                    <p className="mt-0.5 text-[11px] text-stone-500">
                                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'recently'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="px-2 py-3 text-xs text-stone-400">No notifications yet.</p>
                      )}
                    </div>
                  ) : null}
                </div>

                <Link
                  to="/profile"
                  className={`hidden border border-stone-700 sm:inline-flex ${controlClass}`}
                >
                  @{user.username}
                </Link>
                {onLogout ? (
                  <button
                    onClick={onLogout}
                    className={`border border-stone-700 transition ${isCondensed ? 'rounded-md px-2.5 py-1.5 text-[11px]' : 'rounded-md px-3 py-1.5 text-xs font-semibold'} text-stone-300 hover:border-rose-400 hover:text-rose-300`}
                  >
                    Log out
                  </button>
                ) : null}
              </>
            ) : (
              <Link
                to="/"
                className={`border border-stone-700 ${controlClass}`}
              >
                Home
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default SiteHeader
