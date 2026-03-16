import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Search, Star } from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import SiteHeader from './components/SiteHeader'
import { buildSearchParams, didSearchParamsChange, readEnumParam, readTextParam } from './utils/urlFilters'

const STATUS_LABELS = {
  'want-to-play': 'Plan to Play',
  playing: 'Playing',
  completed: 'Completed',
  dropped: 'Dropped',
  'on-hold': 'On Hold'
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

function UserProfile() {
  const { user, token, logout, updateUser } = useAuth()
  const { username: usernameParam } = useParams()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [optionsMessage, setOptionsMessage] = useState('')
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [followLoading, setFollowLoading] = useState(false)
  const [socialActivity, setSocialActivity] = useState([])
  const [socialActivityLoading, setSocialActivityLoading] = useState(false)
  const [followList, setFollowList] = useState([])
  const [followListLoading, setFollowListLoading] = useState(false)
  const [libStatusFilter, setLibStatusFilter] = useState(() => readEnumParam(searchParams, 'lf', ['all', 'playing', 'completed', 'want-to-play', 'did-not-finish'], 'all'))
  const [libSearch, setLibSearch] = useState(() => readTextParam(searchParams, 'lq', ''))
  const [libSort, setLibSort] = useState(() => readEnumParam(searchParams, 'ls', ['recently-updated', 'highest-rated', 'title-az'], 'recently-updated'))
  const [libSortDir, setLibSortDir] = useState(() => readEnumParam(searchParams, 'lo', ['asc', 'desc'], 'desc'))
  const [libMinRating, setLibMinRating] = useState(() => readEnumParam(searchParams, 'lm', ['all', '8', '7', '6', '5'], 'all'))
  const [userListsCreated, setUserListsCreated] = useState([])
  const [userListsFollowed, setUserListsFollowed] = useState([])
  const [userListsLoading, setUserListsLoading] = useState(false)
  const [userListsQuery, setUserListsQuery] = useState(() => readTextParam(searchParams, 'uq', ''))
  const [userListsType, setUserListsType] = useState(() => readEnumParam(searchParams, 'ut', ['all', 'normal', 'ranking'], 'all'))
  const [userListsBucket, setUserListsBucket] = useState(() => readEnumParam(searchParams, 'ub', ['all', 'created', 'followed'], 'all'))

  useEffect(() => {
    if (user) fetchUserProfile()
  }, [user, usernameParam])

  const fetchUserProfile = async () => {
    const profileUsername = usernameParam || user.username
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const response = await fetch(`http://localhost:3000/api/users/${profileUsername}`, { headers })
      if (!response.ok) throw new Error('Error loading profile')
      const data = await response.json()
      setUserData(data)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const fetchFollowStatus = async (targetUsername) => {
    if (!token || !targetUsername) return

    try {
      const response = await fetch(`http://localhost:3000/api/users/${encodeURIComponent(targetUsername)}/follow-status`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load follow status')
      setIsFollowing(Boolean(data.isFollowing))
      setFollowerCount(Number(data.followerCount || 0))
      setFollowingCount(Number(data.followingCount || 0))
    } catch (_err) {
      setIsFollowing(false)
    }
  }

  const toggleFollow = async () => {
    if (!token || !profileUsername || isOwnProfile) return

    setFollowLoading(true)
    try {
      const response = await fetch(
        `http://localhost:3000/api/users/me/follow${isFollowing ? `/${encodeURIComponent(profileUsername)}` : ''}`,
        {
          method: isFollowing ? 'DELETE' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: isFollowing ? undefined : JSON.stringify({ username: profileUsername })
        }
      )

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not update follow state')

      const nextFollow = !isFollowing
      setIsFollowing(nextFollow)
      setFollowerCount((prev) => Math.max(0, prev + (nextFollow ? 1 : -1)))
      setOptionsMessage(nextFollow ? 'Now following this profile.' : 'Unfollowed this profile.')
    } catch (err) {
      setOptionsMessage(err.message)
    }
    setFollowLoading(false)
  }

  const fetchSocialActivity = async () => {
    if (!token) return

    setSocialActivityLoading(true)
    try {
      const response = await fetch('http://localhost:3000/api/feed/activity?limit=30', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load activity feed')
      setSocialActivity(Array.isArray(data.activity) ? data.activity : [])
    } catch (_err) {
      setSocialActivity([])
    }
    setSocialActivityLoading(false)
  }

  const fetchFollowList = async (listType) => {
    const endpoint = listType === 'followers' ? 'followers' : 'following'
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    setFollowListLoading(true)
    try {
      const response = await fetch(`http://localhost:3000/api/users/${encodeURIComponent(profileUsername)}/${endpoint}?limit=50`, { headers })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `Could not load ${endpoint}`)
      setFollowList(Array.isArray(data[endpoint]) ? data[endpoint] : [])
    } catch (err) {
      setFollowList([])
      setOptionsMessage(err.message)
    }
    setFollowListLoading(false)
  }

  const fetchUserLists = async () => {
    const params = new URLSearchParams({ bucket: 'all' })
    if (userListsType !== 'all') params.set('type', userListsType)
    if (userListsQuery.trim()) params.set('q', userListsQuery.trim())

    setUserListsLoading(true)
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const response = await fetch(`http://localhost:3000/api/users/${encodeURIComponent(profileUsername)}/lists?${params.toString()}`, { headers })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load lists')
      setUserListsCreated(Array.isArray(data.created) ? data.created : [])
      setUserListsFollowed(Array.isArray(data.followed) ? data.followed : [])
      setOptionsMessage('')
    } catch (err) {
      setUserListsCreated([])
      setUserListsFollowed([])
      setOptionsMessage(err.message)
    }
    setUserListsLoading(false)
  }

  const completedCount = useMemo(
    () => userData?.logs?.filter((log) => log.status === 'completed').length || 0,
    [userData]
  )

  const logs = useMemo(() => userData?.logs || [], [userData])
  const profileUser = userData?.user || null
  const profileName = profileUser?.displayName || profileUser?.username || user.username
  const profileUsername = profileUser?.username || user.username
  const profileAvatar = profileUser?.avatarUrl ? `http://localhost:3000${profileUser.avatarUrl}` : ''
  const favoriteVNs = useMemo(() => profileUser?.favoriteVNs || [], [profileUser])
  const favoriteCharacters = useMemo(() => profileUser?.favoriteCharacters || [], [profileUser])
  const isOwnProfile = profileUsername === user.username
  const baseProfilePath = isOwnProfile ? '/profile' : `/user/${profileUsername}`
  const libraryAllHref = `${baseProfilePath}/library`
  const libraryCompletedHref = `${baseProfilePath}/library?lf=completed`
  const libraryWishlistHref = `${baseProfilePath}/library?lf=want-to-play`

  const wishlistCount = useMemo(
    () => logs.filter((log) => log.status === 'want-to-play').length,
    [logs]
  )

  const recentLogs = useMemo(
    () =>
      [...logs]
        .filter((log) => log.status === 'completed')
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        .slice(0, 4),
    [logs]
  )

  const wishlistPreview = useMemo(() => logs.filter((log) => log.status === 'want-to-play').slice(0, 6), [logs])

  const libStatusCounts = useMemo(() => ({
    all: logs.length,
    playing: logs.filter((l) => l.status === 'playing').length,
    completed: logs.filter((l) => l.status === 'completed').length,
    'want-to-play': logs.filter((l) => l.status === 'want-to-play').length,
    'did-not-finish': logs.filter((l) => l.status === 'dropped' || l.status === 'on-hold').length
  }), [logs])

  const filteredLibLogs = useMemo(() => {
    let result = logs.filter((log) => {
      if (libStatusFilter === 'all') return true
      if (libStatusFilter === 'did-not-finish') return log.status === 'dropped' || log.status === 'on-hold'
      return log.status === libStatusFilter
    })
    const term = libSearch.trim().toLowerCase()
    if (term) result = result.filter((log) => String(log.title || '').toLowerCase().includes(term))
    if (libMinRating !== 'all') {
      const min = Number(libMinRating)
      result = result.filter((log) => log.rating != null && Number(log.rating) >= min)
    }
    const getRating = (log) => (log.rating != null ? Number(log.rating) : -Infinity)
    const dir = libSortDir === 'asc' ? 1 : -1
    const sorted = [...result]
    if (libSort === 'highest-rated') {
      sorted.sort((a, b) => {
        const diff = getRating(a) - getRating(b)
        if (diff !== 0) return diff * dir
        return String(a.title || '').localeCompare(String(b.title || ''))
      })
    } else if (libSort === 'title-az') {
      sorted.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')) * dir)
    } else {
      sorted.sort((a, b) => (new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0)) * dir)
    }
    return sorted
  }, [logs, libStatusFilter, libSearch, libSort, libSortDir, libMinRating])
  const activityLogs = useMemo(
    () => [...logs].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)),
    [logs]
  )

  const logsByStatus = useMemo(() => {
    const groups = {
      'want-to-play': [],
      playing: [],
      completed: [],
      dropped: [],
      'on-hold': []
    }

    logs.forEach((log) => {
      const key = Object.prototype.hasOwnProperty.call(groups, log.status) ? log.status : 'want-to-play'
      groups[key].push(log)
    })

    return groups
  }, [logs])

  const currentTab = useMemo(() => {
    const path = location.pathname.toLowerCase()
    if (path.endsWith('/activity')) return 'activity'
    if (path.endsWith('/library')) return 'library'
    if (path.endsWith('/lists')) return 'lists'
    if (path.endsWith('/followers')) return 'followers'
    if (path.endsWith('/following')) return 'following'
    return 'profile'
  }, [location.pathname])

  useEffect(() => {
    const nextLibStatus = readEnumParam(searchParams, 'lf', ['all', 'playing', 'completed', 'want-to-play', 'did-not-finish'], 'all')
    const nextLibSearch = readTextParam(searchParams, 'lq', '')
    const nextLibSort = readEnumParam(searchParams, 'ls', ['recently-updated', 'highest-rated', 'title-az'], 'recently-updated')
    const nextLibDir = readEnumParam(searchParams, 'lo', ['asc', 'desc'], 'desc')
    const nextLibMin = readEnumParam(searchParams, 'lm', ['all', '8', '7', '6', '5'], 'all')
    const nextListsQuery = readTextParam(searchParams, 'uq', '')
    const nextListsType = readEnumParam(searchParams, 'ut', ['all', 'normal', 'ranking'], 'all')
    const nextListsBucket = readEnumParam(searchParams, 'ub', ['all', 'created', 'followed'], 'all')

    if (nextLibStatus !== libStatusFilter) setLibStatusFilter(nextLibStatus)
    if (nextLibSearch !== libSearch) setLibSearch(nextLibSearch)
    if (nextLibSort !== libSort) setLibSort(nextLibSort)
    if (nextLibDir !== libSortDir) setLibSortDir(nextLibDir)
    if (nextLibMin !== libMinRating) setLibMinRating(nextLibMin)
    if (nextListsQuery !== userListsQuery) setUserListsQuery(nextListsQuery)
    if (nextListsType !== userListsType) setUserListsType(nextListsType)
    if (nextListsBucket !== userListsBucket) setUserListsBucket(nextListsBucket)
  }, [searchParams])

  useEffect(() => {
    const currentLibStatus = readEnumParam(searchParams, 'lf', ['all', 'playing', 'completed', 'want-to-play', 'did-not-finish'], 'all')
    const currentLibSearch = readTextParam(searchParams, 'lq', '')
    const currentLibSort = readEnumParam(searchParams, 'ls', ['recently-updated', 'highest-rated', 'title-az'], 'recently-updated')
    const currentLibDir = readEnumParam(searchParams, 'lo', ['asc', 'desc'], 'desc')
    const currentLibMin = readEnumParam(searchParams, 'lm', ['all', '8', '7', '6', '5'], 'all')
    const currentListsQuery = readTextParam(searchParams, 'uq', '')
    const currentListsType = readEnumParam(searchParams, 'ut', ['all', 'normal', 'ranking'], 'all')
    const currentListsBucket = readEnumParam(searchParams, 'ub', ['all', 'created', 'followed'], 'all')

    // If URL changed first (for example by clicking a deep link), wait for state to hydrate from URL
    // before attempting to write query params back.
    if (
      currentLibStatus !== libStatusFilter ||
      currentLibSearch !== libSearch ||
      currentLibSort !== libSort ||
      currentLibDir !== libSortDir ||
      currentLibMin !== libMinRating ||
      currentListsQuery !== userListsQuery ||
      currentListsType !== userListsType ||
      currentListsBucket !== userListsBucket
    ) {
      return
    }

    const nextParams = buildSearchParams(
      searchParams,
      {
        lf: libStatusFilter,
        lq: libSearch,
        ls: libSort,
        lo: libSortDir,
        lm: libMinRating,
        uq: userListsQuery,
        ut: userListsType,
        ub: userListsBucket
      },
      {
        lf: 'all',
        lq: '',
        ls: 'recently-updated',
        lo: 'desc',
        lm: 'all',
        uq: '',
        ut: 'all',
        ub: 'all'
      }
    )
    if (didSearchParamsChange(searchParams, nextParams)) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [libStatusFilter, libSearch, libSort, libSortDir, libMinRating, userListsQuery, userListsType, userListsBucket, searchParams, setSearchParams])

  useEffect(() => {
    if (!profileUser) return
    setFollowerCount(Number(profileUser.followerCount || 0))
    setFollowingCount(Number(profileUser.followingCount || 0))
  }, [profileUser?.username, profileUser?.followerCount, profileUser?.followingCount])

  useEffect(() => {
    if (!token || !profileUsername || !user) return
    if (profileUsername === user.username) {
      setIsFollowing(false)
      return
    }
    fetchFollowStatus(profileUsername)
  }, [profileUsername, user?.username, token])

  useEffect(() => {
    if (currentTab !== 'activity' || !isOwnProfile || !token) return
    fetchSocialActivity()
  }, [currentTab, isOwnProfile, token])

  useEffect(() => {
    if (currentTab !== 'followers' && currentTab !== 'following') return
    fetchFollowList(currentTab)
  }, [currentTab, profileUsername, token])

  useEffect(() => {
    if (currentTab !== 'lists') return
    const id = setTimeout(fetchUserLists, 220)
    return () => clearTimeout(id)
  }, [currentTab, profileUsername, token, userListsType, userListsQuery])

  const visibleUserLists = useMemo(() => {
    if (userListsBucket === 'created') return userListsCreated
    if (userListsBucket === 'followed') return userListsFollowed
    return [...userListsCreated, ...userListsFollowed]
  }, [userListsCreated, userListsFollowed, userListsBucket])

  const tabClass = (tab) => `pb-3 transition ${currentTab === tab ? 'border-b-2 border-white text-white' : 'text-stone-400 hover:text-stone-200'}`

  const ratingBuckets = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0]
    logs.forEach((log) => {
      if (log.rating === null || log.rating === undefined || log.rating === '') return
      const score = Number(log.rating)
      if (!Number.isFinite(score) || score <= 0) return
      const starBucket = Math.max(1, Math.min(5, Math.round(score / 2)))
      buckets[starBucket - 1] += 1
    })
    return buckets
  }, [logs])

  const maxBucket = useMemo(() => Math.max(...ratingBuckets, 1), [ratingBuckets])

  const averageRating = useMemo(() => {
    const numericRatings = logs
      .map((log) => Number(log.rating))
      .filter((value) => Number.isFinite(value) && value > 0)

    if (!numericRatings.length) return null

    const sum = numericRatings.reduce((acc, value) => acc + value, 0)
    return (sum / numericRatings.length).toFixed(1)
  }, [logs])

  const exportLogs = () => {
    const payload = {
      user: profileUsername,
      exportedAt: new Date().toISOString(),
      logs
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${profileUsername}-vn-logs.json`
    link.click()
    URL.revokeObjectURL(url)
    setOptionsOpen(false)
    setOptionsMessage('Logs exported as JSON.')
  }

  const copyProfileLink = async () => {
    const profileUrl = `${window.location.origin}/user/${profileUsername}`
    try {
      await navigator.clipboard.writeText(profileUrl)
      setOptionsMessage('Profile link copied.')
    } catch (_err) {
      setOptionsMessage('Could not copy link.')
    }
    setOptionsOpen(false)
  }

  const toggleVisibility = async () => {
    if (!isOwnProfile || !token) return

    const nextVisibility = profileUser?.preferences?.profileVisibility === 'private' ? 'public' : 'private'

    try {
      const response = await fetch('http://localhost:3000/api/users/me/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName: profileUser?.displayName || user.displayName || user.username,
          bio: profileUser?.bio || '',
          favoriteVNs,
          preferences: {
            profileVisibility: nextVisibility,
            compactMode: Boolean(profileUser?.preferences?.compactMode)
          }
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not update visibility')

      setUserData((prev) => ({
        ...prev,
        user: {
          ...prev.user,
          preferences: data.settings?.preferences || prev.user?.preferences
        }
      }))
      updateUser({ displayName: data.user?.displayName || user.displayName || '' })
      setOptionsMessage(`Profile is now ${nextVisibility}.`)
    } catch (err) {
      setOptionsMessage(err.message)
    }

    setOptionsOpen(false)
  }

  if (!user) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="panel max-w-md p-8 text-center">
          <p className="mb-3 text-5xl">🔒</p>
          <h2 className="text-2xl font-bold text-white">Sign in required</h2>
          <p className="mt-2 text-stone-400">You need an active session to view this profile.</p>
          <Link to="/" className="btn-primary mt-6 text-stone-950">
            Go to home
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="panel p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-stone-600 border-t-white" />
          <p className="text-stone-300">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="panel max-w-md p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-300" />
          <h2 className="text-2xl font-bold text-white">Profile error</h2>
          <p className="mt-2 text-stone-400">{error}</p>
          <Link to="/" className="btn-secondary mt-6">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <SiteHeader user={user} token={token} onLogout={logout} listsHref={`${baseProfilePath}/lists`} />

      <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-6 sm:px-6">
        <div className="border-b border-stone-800/80 pb-5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              {profileAvatar ? (
                <img
                  src={profileAvatar}
                  alt={profileName}
                  className="h-16 w-16 rounded-full border border-stone-700 object-cover shadow-lg shadow-black/30 sm:h-20 sm:w-20"
                />
              ) : (
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-stone-700 bg-stone-900 text-2xl font-bold text-stone-200 shadow-lg shadow-black/30 sm:h-20 sm:w-20">
                  {profileName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <h1 className="text-2xl font-bold leading-none text-white">{profileName}</h1>
                <p className="mt-1.5 text-sm leading-none text-stone-400">@{profileUsername}</p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {isOwnProfile ? (
                    <Link
                      to="/settings"
                      className="inline-flex rounded-md border border-stone-700 bg-transparent px-3 py-1.5 text-xs font-semibold text-stone-200 transition hover:border-stone-500 hover:text-white"
                    >
                      Edit Profile
                    </Link>
                  ) : null}

                  {!isOwnProfile ? (
                    <button
                      onClick={toggleFollow}
                      disabled={followLoading}
                      className={`inline-flex rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                        isFollowing
                          ? 'border-rose-500/50 text-rose-300 hover:border-rose-400'
                          : 'border-white/60 bg-white text-stone-950 hover:bg-stone-100'
                      } disabled:cursor-not-allowed disabled:opacity-80`}
                    >
                      {followLoading ? 'Working...' : isFollowing ? 'Following' : 'Follow'}
                    </button>
                  ) : null}

                  <div className="relative">
                    <button
                      onClick={() => setOptionsOpen((prev) => !prev)}
                      className="inline-flex rounded-md border border-stone-700 bg-transparent px-3 py-1.5 text-xs font-semibold text-stone-200 transition hover:border-stone-500 hover:text-white"
                    >
                      Options
                    </button>

                    {optionsOpen && (
                      <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-lg border border-stone-700 bg-stone-900 p-1.5 text-sm shadow-xl shadow-black/40">
                        {isOwnProfile ? (
                          <Link
                            to="/settings"
                            onClick={() => setOptionsOpen(false)}
                            className="block rounded-md px-3 py-2 text-stone-200 transition hover:bg-stone-800"
                          >
                            Edit profile settings
                          </Link>
                        ) : null}
                        <button
                          onClick={copyProfileLink}
                          className="w-full rounded-md px-3 py-2 text-left text-stone-200 transition hover:bg-stone-800"
                        >
                          Copy profile link
                        </button>
                        <button
                          onClick={exportLogs}
                          className="w-full rounded-md px-3 py-2 text-left text-stone-200 transition hover:bg-stone-800"
                        >
                          Export VN logs (JSON)
                        </button>
                        {isOwnProfile ? (
                          <button
                            onClick={toggleVisibility}
                            className="w-full rounded-md px-3 py-2 text-left text-stone-200 transition hover:bg-stone-800"
                          >
                            Toggle privacy ({profileUser?.preferences?.profileVisibility || 'public'})
                          </button>
                        ) : null}
                        <Link
                          to={`${baseProfilePath}/activity`}
                          onClick={() => setOptionsOpen(false)}
                          className="block rounded-md px-3 py-2 text-stone-200 transition hover:bg-stone-800"
                        >
                          Open activity
                        </Link>
                        <Link
                          to={`${baseProfilePath}/library`}
                          onClick={() => setOptionsOpen(false)}
                          className="block rounded-md px-3 py-2 text-stone-200 transition hover:bg-stone-800"
                        >
                          Open library
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-stretch gap-y-4 lg:justify-end">
              <div className="flex flex-wrap items-stretch divide-x divide-stone-800/60">
                <Link to={libraryAllHref} className="min-w-[72px] px-4 py-1 text-center transition hover:bg-stone-950/30">
                  <p className="text-2xl font-bold leading-none text-white">{logs.length}</p>
                  <p className="mt-1.5 text-xs text-stone-400">VNs</p>
                </Link>
                <Link to={libraryCompletedHref} className="min-w-[72px] px-4 py-1 text-center transition hover:bg-stone-950/30">
                  <p className="text-2xl font-bold leading-none text-white">{completedCount}</p>
                  <p className="mt-1.5 text-xs text-stone-400">Completed</p>
                </Link>
                <Link to={libraryWishlistHref} className="min-w-[72px] px-4 py-1 text-center transition hover:bg-stone-950/30">
                  <p className="text-2xl font-bold leading-none text-white">{wishlistCount}</p>
                  <p className="mt-1.5 text-xs text-stone-400">Wishlist</p>
                </Link>
                <Link to={`${baseProfilePath}/followers`} className="min-w-[72px] px-4 py-1 text-center transition hover:bg-stone-950/30">
                  <p className="text-2xl font-bold leading-none text-white">{followerCount}</p>
                  <p className="mt-1.5 text-xs text-stone-400">Followers</p>
                </Link>
                <Link to={`${baseProfilePath}/following`} className="min-w-[72px] px-4 py-1 text-center transition hover:bg-stone-950/30">
                  <p className="text-2xl font-bold leading-none text-white">{followingCount}</p>
                  <p className="mt-1.5 text-xs text-stone-400">Following</p>
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-7 border-b border-stone-800/80 text-sm font-medium text-stone-400">
            <Link to={baseProfilePath} className={tabClass('profile')}>Profile</Link>
            <Link to={`${baseProfilePath}/activity`} className={tabClass('activity')}>Activity</Link>
            <Link to={`${baseProfilePath}/library`} className={tabClass('library')}>Library</Link>
            <Link to={`${baseProfilePath}/lists`} className={tabClass('lists')}>Lists</Link>
            <Link to={`${baseProfilePath}/followers`} className={tabClass('followers')}>Followers</Link>
            <Link to={`${baseProfilePath}/following`} className={tabClass('following')}>Following</Link>
          </div>
        </div>

        {optionsMessage ? (
          <p className="mt-3 rounded-md border border-stone-800 bg-stone-900/60 px-3 py-2 text-xs text-stone-300">
            {optionsMessage}
          </p>
        ) : null}

        {currentTab === 'profile' && !logs.length ? (
          <section className="mt-8 rounded-xl border border-stone-800 bg-stone-950/40 p-8 text-center">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full border border-stone-700 bg-stone-900 text-3xl">📭</div>
            <h2 className="mt-4 text-2xl font-semibold text-white">
              {isOwnProfile ? 'Your collection is empty' : `${profileUser?.username ?? 'This user'} hasn't added any VNs yet`}
            </h2>
            <p className="mt-2 text-stone-400">
              {isOwnProfile ? 'Search and add your first visual novel to start your profile.' : 'Check back later.'}
            </p>
            {isOwnProfile ? (
              <Link
                to="/"
                className="mt-5 inline-flex rounded-md border border-white/60 bg-white px-4 py-2 font-semibold text-stone-950 transition hover:bg-stone-100"
              >
                Explore VNs
              </Link>
            ) : null}
          </section>
        ) : currentTab === 'profile' ? (
          <section className="mt-8 grid gap-10 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-10">
              <div>
                <div className="mb-4 flex items-end justify-between border-b border-stone-800/80 pb-2">
                  <h2 className="text-3xl font-semibold text-white">Favorite Visual Novels</h2>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, idx) => {
                    const favorite = favoriteVNs[idx]
                    if (!favorite) {
                      if (isOwnProfile) {
                        return (
                          <Link
                            key={`fav-slot-${idx}`}
                            to="/settings"
                            className="flex aspect-[2/3] items-center justify-center rounded-lg border border-stone-800 bg-stone-950/70 text-4xl text-stone-600 transition hover:border-stone-600 hover:text-stone-400"
                          >
                            +
                          </Link>
                        )
                      }
                      return (
                        <div
                          key={`fav-slot-${idx}`}
                          className="flex aspect-[2/3] items-center justify-center rounded-lg border border-dashed border-stone-800 bg-stone-950/40"
                        />
                      )
                    }

                    return (
                      <Link
                        key={`fav-slot-${favorite.vnId}`}
                        to={`/vn/${favorite.vnId}`}
                        className="group block overflow-hidden rounded-lg border border-stone-800 bg-stone-950/70 transition hover:border-stone-600"
                      >
                        <img
                          src={favorite.image || 'https://placehold.co/220x320/100f0e/d6d3d1?text=VN'}
                          alt={favorite.title}
                          className="aspect-[2/3] w-full object-cover transition duration-200 group-hover:brightness-110"
                        />
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="mb-4 flex items-end justify-between border-b border-stone-800/80 pb-2">
                  <h2 className="text-3xl font-semibold text-white">Recently Read</h2>
                </div>
                {recentLogs.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {recentLogs.map((log) => (
                      <Link key={log.vnId} to={`/vn/${log.vnId}`} className="group block">
                        <img
                          src={log.image || 'https://placehold.co/240x360/100f0e/d6d3d1?text=VN'}
                          alt={log.title}
                          className="aspect-[2/3] w-full rounded-md object-cover transition duration-200 group-hover:brightness-110"
                        />
                        <p className="mt-2 line-clamp-2 text-sm font-medium text-stone-300 transition group-hover:text-white">{log.title}</p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone-400">Aún no hay nada.</p>
                )}
              </div>
            </div>

            <aside className="space-y-8">
              <div>
                <h3 className="border-b border-stone-800/80 pb-2 text-xl font-semibold text-white">Bio</h3>
                <p className="mt-3 text-stone-400">{profileUser?.bio || (isOwnProfile ? 'Tell others about yourself.' : 'No bio yet.')}</p>
              </div>

              <div>
                <div className="flex items-end justify-between border-b border-stone-800/80 pb-2">
                  <h3 className="text-xl font-semibold text-white">Favorite Characters</h3>
                  {isOwnProfile ? (
                    <Link to="/settings" className="text-xs text-stone-400 transition hover:text-white">Edit</Link>
                  ) : null}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, idx) => {
                    const fav = favoriteCharacters[idx]
                    if (!fav) {
                      if (isOwnProfile) {
                        return (
                          <Link
                            key={`char-slot-${idx}`}
                            to="/settings"
                            className="flex aspect-[2/3] items-center justify-center rounded-lg border border-stone-800 bg-stone-950/70 text-4xl text-stone-600 transition hover:border-stone-600 hover:text-stone-400"
                          >
                            +
                          </Link>
                        )
                      }
                      return (
                        <div
                          key={`char-slot-${idx}`}
                          className="flex aspect-[2/3] items-center justify-center rounded-lg border border-dashed border-stone-800 bg-stone-950/40"
                        />
                      )
                    }
                    return (
                      <Link
                        key={fav.charId}
                        to={`/character/${fav.charId}`}
                        className="group block overflow-hidden rounded-lg border border-stone-800 bg-stone-950/70 transition hover:border-stone-600"
                      >
                        <img
                          src={fav.image || 'https://placehold.co/220x320/0f172a/94a3b8?text=?'}
                          alt={fav.name}
                          className="aspect-[2/3] w-full object-cover transition duration-200 group-hover:brightness-110"
                        />
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-end justify-between border-b border-stone-800/80 pb-2">
                  <h3 className="text-xl font-semibold text-white">Ratings</h3>
                  <p className="text-sm font-semibold text-stone-300">{averageRating ? `★ ${averageRating}` : 'No ratings'}</p>
                </div>

                <div className="mt-4 flex h-28 items-end gap-1.5">
                  {ratingBuckets.map((count, index) => (
                    <div key={`rating-bar-${index}`} className="flex flex-1 flex-col items-center justify-end gap-1">
                      <div
                        className="w-full rounded-t-sm bg-stone-400/80"
                        style={{ height: `${Math.max(4, Math.round((count / maxBucket) * 100))}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-stone-500">
                  <span>1★</span>
                  <span>5★</span>
                </div>
              </div>

              <div>
                <h3 className="border-b border-stone-800/80 pb-2 text-xl font-semibold text-white">Wishlist ({wishlistCount})</h3>

                {wishlistPreview.length ? (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {wishlistPreview.map((log) => (
                      <Link key={`wish-${log.vnId}`} to={`/vn/${log.vnId}`} className="block overflow-hidden rounded-md">
                        <img
                          src={log.image || 'https://placehold.co/160x230/100f0e/d6d3d1?text=VN'}
                          alt={log.title}
                          className="aspect-[2/3] w-full object-cover transition duration-200 hover:brightness-110"
                        />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-stone-400">No wishlist titles yet.</p>
                )}
              </div>

              <div className="pt-2">
                <p className="text-sm text-stone-500">Completed: {completedCount}</p>
              </div>
            </aside>
          </section>
        ) : null}

        {currentTab === 'activity' ? (
          <section className="mt-8 space-y-4">
            <h2 className="text-3xl font-semibold text-white">{isOwnProfile ? 'Following Activity' : 'Activity'}</h2>
            {isOwnProfile ? (
              socialActivityLoading ? (
                <p className="text-sm text-stone-400">Loading social feed...</p>
              ) : socialActivity.length ? (
                <div className="divide-y divide-stone-800/80 rounded-lg border border-stone-800/80 bg-stone-950/30">
                  {socialActivity.map((item) => (
                    <article key={item.id} className="flex items-start gap-4 p-4">
                      <img
                        src={item.vn?.image || 'https://placehold.co/90x128/100f0e/d6d3d1?text=VN'}
                        alt={item.vn?.title || 'Visual novel'}
                        className="h-[100px] w-[70px] rounded-md object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                          @{item.actor?.username || 'unknown'} {item.type === 'review' ? 'published a review' : 'updated a log'}
                        </p>
                        <Link to={`/vn/${item.vn?.vnId}`} className="mt-1 block text-lg font-semibold text-white transition hover:text-stone-200">
                          {item.vn?.title || 'Untitled VN'}
                        </Link>
                        <p className="mt-1 text-sm text-stone-400">
                          {item.type === 'review'
                            ? `Review${item.data?.rating ? ` • ${item.data.rating}/10` : ''}`
                            : `${STATUS_LABELS[item.data?.status] || 'Plan to Play'}${item.data?.rating ? ` • ${item.data.rating}/10` : ''}`}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'recently'}
                        </p>
                        {item.data?.review ? <p className="mt-2 line-clamp-2 text-sm text-stone-300">{item.data.review}</p> : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-400">No activity yet from people you follow. Visit Members to start following.</p>
              )
            ) : activityLogs.length ? (
              <div className="divide-y divide-stone-800/80 rounded-lg border border-stone-800/80 bg-stone-950/30">
                {activityLogs.map((log) => (
                  <article key={`activity-${log.vnId}-${log.updatedAt || ''}`} className="flex items-start gap-4 p-4">
                    <img
                      src={log.image || 'https://placehold.co/90x128/100f0e/d6d3d1?text=VN'}
                      alt={log.title}
                      className="h-[100px] w-[70px] rounded-md object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <Link to={`/vn/${log.vnId}`} className="text-lg font-semibold text-white transition hover:text-stone-200">
                        {log.title}
                      </Link>
                      <p className="mt-1 text-sm text-stone-400">
                        {STATUS_LABELS[log.status] || 'Plan to Play'}
                        {log.rating ? ` • ${log.rating}/10` : ''}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        Updated {log.updatedAt ? new Date(log.updatedAt).toLocaleDateString() : 'recently'}
                      </p>
                      {log.review ? <p className="mt-2 line-clamp-2 text-sm text-stone-300">{log.review}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-400">No activity yet.</p>
            )}
          </section>
        ) : null}

        {currentTab === 'library' ? (
          <section className="mt-8 space-y-6">
            <div>
              <h2 className="text-3xl font-semibold text-white">Library</h2>
              <p className="mt-1 text-sm text-stone-400">{logs.length} visual novels logged</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800/80 pb-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'playing', label: 'Reading' },
                  { value: 'completed', label: 'Read' },
                  { value: 'want-to-play', label: 'Wishlist' },
                  { value: 'did-not-finish', label: 'Did Not Finish' }
                ].map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setLibStatusFilter(tab.value)}
                    className={`rounded-sm border px-3 py-2 text-sm font-medium transition ${
                      libStatusFilter === tab.value
                        ? 'border-stone-200 bg-stone-100 text-stone-950'
                        : 'border-stone-800 bg-stone-950/70 text-stone-300 hover:border-stone-600 hover:text-white'
                    }`}
                  >
                    {tab.label}: {libStatusCounts[tab.value] || 0}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-b border-stone-800/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <select
                    value={libSort}
                    onChange={(e) => { setLibSort(e.target.value); setLibSortDir('desc') }}
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
                  onClick={() => setLibSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                  title={libSortDir === 'desc' ? 'Descending — click for ascending' : 'Ascending — click for descending'}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-800 bg-stone-950/70 text-stone-300 transition hover:border-stone-600 hover:text-white"
                >
                  {libSortDir === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                </button>

                <div className="relative">
                  <select
                    value={libMinRating}
                    onChange={(e) => setLibMinRating(e.target.value)}
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
                {(libSearch || libMinRating !== 'all' || libStatusFilter !== 'all') ? (
                  <button
                    onClick={() => { setLibSearch(''); setLibMinRating('all'); setLibStatusFilter('all') }}
                    className="whitespace-nowrap text-xs text-stone-500 transition hover:text-stone-300"
                  >
                    Clear filters
                  </button>
                ) : null}
                <span className="whitespace-nowrap text-xs text-stone-500">{filteredLibLogs.length} / {logs.length}</span>
                <div className="relative w-full lg:w-auto">
                  <input
                    type="text"
                    value={libSearch}
                    onChange={(e) => setLibSearch(e.target.value)}
                    placeholder="Search"
                    className="h-11 w-full rounded-full border border-stone-800 bg-stone-950/70 pl-10 pr-4 text-sm text-stone-200 outline-none transition placeholder:text-stone-500 focus:border-white/60 lg:w-72"
                  />
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-500"><Search className="h-4 w-4" /></span>
                </div>
              </div>
            </div>

            {filteredLibLogs.length ? (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {filteredLibLogs.map((log) => (
                  <div key={`lib-${log.vnId}`} className="group">
                    <Link to={`/vn/${log.vnId}`} className="block">
                      <div className="relative overflow-hidden rounded-[1.4rem] border border-stone-800 bg-stone-950/70 shadow-xl shadow-black/30 transition duration-200 group-hover:border-stone-700 group-hover:shadow-2xl group-hover:shadow-black/50">
                        <img
                          src={log.image || 'https://placehold.co/180x260/100f0e/d6d3d1?text=VN'}
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
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-stone-500">No titles match your filters.</p>
            )}
          </section>
        ) : null}

        {currentTab === 'lists' ? (
          <section className="mt-8 space-y-5">
            <div className="rounded-2xl border border-stone-800 bg-stone-950/40 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <div className="relative">
                  <input
                    type="text"
                    value={userListsQuery}
                    onChange={(e) => setUserListsQuery(e.target.value)}
                    placeholder="Search lists"
                    className="h-11 w-full rounded-xl border border-stone-700 bg-stone-950 pl-10 pr-4 text-sm text-stone-200 outline-none transition placeholder:text-stone-500 focus:border-white/60"
                  />
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-500"><Search className="h-4 w-4" /></span>
                </div>

                <select
                  value={userListsBucket}
                  onChange={(e) => setUserListsBucket(e.target.value)}
                  className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-200 outline-none focus:border-white/60"
                >
                  <option value="all">Created + Followed</option>
                  <option value="created">Created only</option>
                  <option value="followed">Followed only</option>
                </select>

                <select
                  value={userListsType}
                  onChange={(e) => setUserListsType(e.target.value)}
                  className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-200 outline-none focus:border-white/60"
                >
                  <option value="all">All types</option>
                  <option value="normal">Normal</option>
                  <option value="ranking">Ranking</option>
                </select>
              </div>
            </div>

            {userListsLoading ? (
              <p className="py-8 text-center text-sm text-stone-500">Loading lists...</p>
            ) : visibleUserLists.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleUserLists.map((item) => (
                  <Link key={`profile-list-${item.id}`} to={`/lists/${item.id}`} className="group overflow-hidden rounded-2xl border border-stone-800 bg-stone-950/70 transition hover:border-stone-600">
                    <div className="grid grid-cols-4 gap-1 p-1.5">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <div key={`profile-list-cover-${item.id}-${idx}`} className="aspect-[2/3] overflow-hidden rounded bg-stone-900">
                          {item.coverImages?.[idx]
                            ? <img src={item.coverImages[idx]} alt={item.name} className="h-full w-full object-cover" />
                            : <div className="h-full w-full bg-stone-800" />}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1.5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-sm font-semibold text-white transition group-hover:text-stone-200">{item.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.type === 'ranking' ? 'bg-amber-400/15 text-amber-200' : 'bg-sky-400/15 text-sky-200'}`}>
                          {item.type}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500">@{item.owner?.username} · {item.itemCount} VNs · {item.followersCount} followers</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-stone-800 bg-stone-950/60 px-4 py-6 text-sm text-stone-400">No lists found for this filter.</p>
            )}
          </section>
        ) : null}

        {currentTab === 'followers' || currentTab === 'following' ? (
          <section className="mt-8 space-y-4">
            <h2 className="text-3xl font-semibold text-white">{currentTab === 'followers' ? 'Followers' : 'Following'}</h2>

            {followListLoading ? (
              <p className="text-sm text-stone-400">Loading list...</p>
            ) : followList.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {followList.map((item) => (
                  <Link
                    key={`${currentTab}-${item.id}`}
                    to={item.username === user.username ? '/profile' : `/user/${item.username}`}
                    className="panel block p-4 transition hover:border-white/60/60"
                  >
                    <div className="flex items-center gap-3">
                      {item.avatarUrl ? (
                        <img
                          src={`http://localhost:3000${item.avatarUrl}`}
                          alt={item.displayName || item.username}
                          className="h-12 w-12 rounded-full border border-stone-700 object-cover"
                        />
                      ) : (
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-stone-700 bg-stone-900 text-lg font-bold text-stone-200">
                          {(item.displayName || item.username).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-white">{item.displayName || item.username}</p>
                        <p className="text-xs text-stone-400">@{item.username}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-400">No users to show.</p>
            )}
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default UserProfile
