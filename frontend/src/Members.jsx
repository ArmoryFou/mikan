import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import SiteHeader from './components/SiteHeader'
import { buildSearchParams, didSearchParamsChange, readEnumParam, readTextParam } from './utils/urlFilters'

function MemberCard({ member, onFollowToggle, busy }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-3">
        {member.avatarUrl ? (
          <img
            src={`http://localhost:3000${member.avatarUrl}`}
            alt={member.displayName || member.username}
            className="h-12 w-12 rounded-full border border-stone-700 object-cover"
          />
        ) : (
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-stone-700 bg-stone-900 text-lg font-bold text-stone-200">
            {(member.displayName || member.username).charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <Link to={`/user/${member.username}`} className="truncate text-base font-semibold text-white transition hover:text-stone-200">
            {member.displayName || member.username}
          </Link>
          <p className="text-xs text-stone-400">@{member.username}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onFollowToggle(member)}
          disabled={busy}
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
            member.isFollowedByMe
              ? 'border-rose-500/50 text-rose-300 hover:border-rose-400'
              : 'border-white/60 bg-white text-stone-950 hover:bg-stone-100'
          } disabled:cursor-not-allowed disabled:opacity-70`}
        >
          {busy ? 'Working...' : member.isFollowedByMe ? 'Following' : 'Follow'}
        </button>

        <Link to={`/user/${member.username}`} className="rounded-md border border-stone-700 px-3 py-1.5 text-xs font-semibold text-stone-300 transition hover:border-stone-500 hover:text-white">
          View profile
        </Link>
      </div>
    </div>
  )
}

function Members() {
  const { user, token, logout } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(() => readTextParam(searchParams, 'q', ''))
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [loadingNew, setLoadingNew] = useState(false)
  const [loadingSuggested, setLoadingSuggested] = useState(false)
  const [busyMap, setBusyMap] = useState({})
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState(() => readEnumParam(searchParams, 's', ['newest', 'oldest', 'following', 'az', 'za'], 'newest'))
  const [searchResult, setSearchResult] = useState(null)
  const [newMembers, setNewMembers] = useState([])
  const [suggestedMembers, setSuggestedMembers] = useState([])

  useEffect(() => {
    fetchNewMembers()
    if (user && token) {
      fetchSuggestedMembers()
    }
  }, [user?.id, token])

  const fetchNewMembers = async () => {
    setLoadingNew(true)
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const response = await fetch('http://localhost:3000/api/members/new?limit=12', { headers })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load members')
      setNewMembers(Array.isArray(data.members) ? data.members : [])
    } catch (err) {
      setError(err.message)
    }
    setLoadingNew(false)
  }

  const fetchSuggestedMembers = async () => {
    if (!token) return

    setLoadingSuggested(true)
    try {
      const response = await fetch('http://localhost:3000/api/members/suggested?limit=12', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load suggestions')
      setSuggestedMembers(Array.isArray(data.members) ? data.members : [])
    } catch (err) {
      setError(err.message)
    }
    setLoadingSuggested(false)
  }

  const applyFollowState = (username, nextValue) => {
    const updateList = (list) => list.map((item) => (item.username === username ? { ...item, isFollowedByMe: nextValue } : item))
    setNewMembers(updateList)
    setSuggestedMembers(updateList)
    setSearchResult((prev) => {
      if (!prev || prev.user?.username !== username) return prev
      return {
        ...prev,
        user: {
          ...prev.user,
          isFollowedByMe: nextValue
        }
      }
    })
  }

  const handleFollowToggle = async (member) => {
    if (!token) {
      setError('Sign in to follow members.')
      return
    }

    const username = member.username
    setBusyMap((prev) => ({ ...prev, [username]: true }))

    try {
      const response = await fetch(
        `http://localhost:3000/api/users/me/follow${member.isFollowedByMe ? `/${encodeURIComponent(username)}` : ''}`,
        {
          method: member.isFollowedByMe ? 'DELETE' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: member.isFollowedByMe ? undefined : JSON.stringify({ username })
        }
      )

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not update follow state')

      applyFollowState(username, !member.isFollowedByMe)
    } catch (err) {
      setError(err.message)
    }

    setBusyMap((prev) => {
      const next = { ...prev }
      delete next[username]
      return next
    })
  }

  const performSearch = async (term) => {
    if (!term.trim()) {
      setSearchResult(null)
      setError('')
      return
    }

    setLoadingSearch(true)
    setError('')
    setSearchResult(null)

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const response = await fetch(`http://localhost:3000/api/users/${encodeURIComponent(term.trim())}`, { headers })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'User not found')
      setSearchResult(data)
    } catch (err) {
      setError(err.message)
    }

    setLoadingSearch(false)
  }

  const searchMember = async () => {
    await performSearch(query)
  }

  useEffect(() => {
    const id = setTimeout(() => {
      performSearch(query)
    }, 260)
    return () => clearTimeout(id)
  }, [query, token])

  useEffect(() => {
    const nextQuery = readTextParam(searchParams, 'q', '')
    const nextSort = readEnumParam(searchParams, 's', ['newest', 'oldest', 'following', 'az', 'za'], 'newest')
    if (nextQuery !== query) setQuery(nextQuery)
    if (nextSort !== sortBy) setSortBy(nextSort)
  }, [searchParams])

  useEffect(() => {
    const nextParams = buildSearchParams(searchParams, { q: query, s: sortBy }, { q: '', s: 'newest' })
    if (didSearchParamsChange(searchParams, nextParams)) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [query, sortBy, searchParams, setSearchParams])

  const sortMembers = (members) => {
    const next = [...members]
    next.sort((a, b) => {
      if (sortBy === 'az') {
        return String(a.displayName || a.username).localeCompare(String(b.displayName || b.username))
      }
      if (sortBy === 'za') {
        return String(b.displayName || b.username).localeCompare(String(a.displayName || a.username))
      }
      if (sortBy === 'following') {
        if (Boolean(a.isFollowedByMe) === Boolean(b.isFollowedByMe)) {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        }
        return a.isFollowedByMe ? -1 : 1
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      }
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    })
    return next
  }

  const sortedNewMembers = useMemo(() => sortMembers(newMembers), [newMembers, sortBy])
  const sortedSuggestedMembers = useMemo(() => sortMembers(suggestedMembers), [suggestedMembers, sortBy])

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <SiteHeader user={user} token={token} onLogout={logout} listsHref={user ? '/profile/lists' : '/'} />

      <div className="mx-auto w-full max-w-5xl space-y-8 px-4 pb-10 pt-6 sm:px-6">
        <header className="flex flex-col gap-4 border-b border-stone-800/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="top-brand text-3xl">Members</h1>
            <p className="mt-1 text-sm text-stone-400">Discover new readers, suggested follows, and search by username.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (!e.target.value.trim()) {
                    setSearchResult(null)
                    setError('')
                  }
                }}
                placeholder="Search"
                className="h-11 w-full rounded-full border border-stone-800 bg-stone-950/70 pl-10 pr-4 text-sm text-stone-200 outline-none transition placeholder:text-stone-500 focus:border-white/60 sm:w-72"
                onKeyDown={(e) => e.key === 'Enter' && searchMember()}
              />
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </div>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-11 appearance-none rounded-full border border-stone-800 bg-stone-950/70 px-4 pr-9 text-sm font-semibold text-stone-200 outline-none transition focus:border-white/60"
              >
                <option value="newest">Most Active</option>
                <option value="oldest">Oldest</option>
                <option value="following">Following First</option>
                <option value="az">A-Z</option>
                <option value="za">Z-A</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">▾</span>
            </div>

            <button type="button" onClick={searchMember} className="hidden" disabled={loadingSearch} aria-hidden>
              Search
            </button>
          </div>
        </header>

        {loadingSearch ? <p className="text-sm text-stone-400">Searching...</p> : null}

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        {searchResult?.user ? (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">Search Result</h2>
            <MemberCard
              member={{
                username: searchResult.user.username,
                displayName: searchResult.user.displayName,
                avatarUrl: searchResult.user.avatarUrl,
                isFollowedByMe: Boolean(searchResult.user.isFollowedByMe)
              }}
              busy={Boolean(busyMap[searchResult.user.username])}
              onFollowToggle={handleFollowToggle}
            />
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">New Members</h2>
            <button onClick={fetchNewMembers} className="text-xs font-semibold text-stone-300 transition hover:text-white">Refresh</button>
          </div>
          {loadingNew ? (
            <p className="text-sm text-stone-400">Loading new members...</p>
          ) : sortedNewMembers.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedNewMembers.map((member) => (
                <MemberCard
                  key={`new-${member.id}`}
                  member={member}
                  busy={Boolean(busyMap[member.username])}
                  onFollowToggle={handleFollowToggle}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400">No members found.</p>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Suggested Follows</h2>
            <button onClick={fetchSuggestedMembers} className="text-xs font-semibold text-stone-300 transition hover:text-white">Refresh</button>
          </div>
          {!user ? (
            <p className="text-sm text-stone-400">Sign in to get suggested follows.</p>
          ) : loadingSuggested ? (
            <p className="text-sm text-stone-400">Loading suggestions...</p>
          ) : sortedSuggestedMembers.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedSuggestedMembers.map((member) => (
                <MemberCard
                  key={`suggested-${member.id}`}
                  member={member}
                  busy={Boolean(busyMap[member.username])}
                  onFollowToggle={handleFollowToggle}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400">No suggestions right now. Follow more members and check back.</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default Members
