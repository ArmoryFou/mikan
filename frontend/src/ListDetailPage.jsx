import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Heart, LayoutGrid, List, MoreVertical, Pencil, Search, Star, Trash2, Trophy, Users } from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import SiteHeader from './components/SiteHeader'
import { buildSearchParams, didSearchParamsChange, readEnumParam, readTextParam } from './utils/urlFilters'

function stars(rating) {
  const value = Math.max(0, Math.min(10, Number(rating || 0)))
  const full = Math.floor(value / 2)
  return `${'★'.repeat(full)}${'☆'.repeat(5 - full)}`
}

function rankTone(rank) {
  if (rank === 1) return 'border-yellow-300/70 bg-yellow-300/10'
  if (rank === 2) return 'border-stone-200/60 bg-stone-200/10'
  if (rank === 3) return 'border-amber-700/60 bg-amber-700/10'
  return 'border-stone-800 bg-stone-950/60'
}

function ListDetailPage() {
  const navigate = useNavigate()
  const { listId } = useParams()
  const { user, token, logout } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [list, setList] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [items, setItems] = useState([])
  const [comments, setComments] = useState([])
  const [commentDraft, setCommentDraft] = useState('')
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentMenuOpen, setCommentMenuOpen] = useState(null)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingCommentDraft, setEditingCommentDraft] = useState('')
  const [editingCommentBusy, setEditingCommentBusy] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [meta, setMeta] = useState({ rankHighlightEligible: false })
  const [search, setSearch] = useState(() => readTextParam(searchParams, 'q', ''))
  const [readFilter, setReadFilter] = useState(() => readEnumParam(searchParams, 'r', ['all', 'read', 'unread'], 'all'))
  const [status, setStatus] = useState(() => readEnumParam(searchParams, 'f', ['all', 'want-to-play', 'playing', 'completed', 'dropped', 'on-hold'], 'all'))
  const [minStars, setMinStars] = useState(() => readEnumParam(searchParams, 'm', ['all', '1', '2', '3', '4', '5'], 'all'))
  const [sortBy, setSortBy] = useState(() => readEnumParam(searchParams, 's', ['position', 'originalRank', 'title', 'rating', 'status', 'addedAt'], 'position'))
  const [order, setOrder] = useState(() => readEnumParam(searchParams, 'o', ['asc', 'desc'], 'asc'))
  const [viewMode, setViewMode] = useState(() => readEnumParam(searchParams, 'v', ['list', 'grid'], 'list'))

  const fetchList = async () => {
    setLoading(true)
    try {
      const response = await fetch(`http://localhost:3000/api/lists/${listId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load list')
      setList(data.list)
      setIsOwner(Boolean(data.isOwner))
      setError('')
    } catch (err) {
      setError(err.message)
      setList(null)
      setIsOwner(false)
    }
    setLoading(false)
  }

  const fetchItems = async () => {
    try {
      const params = new URLSearchParams({ sortBy, order, limit: '400' })
      if (readFilter !== 'all') params.set('readFilter', readFilter)
      if (status !== 'all') params.set('status', status)
      if (minStars !== 'all') params.set('minStars', minStars)

      const response = await fetch(`http://localhost:3000/api/lists/${listId}/items?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load list items')
      setItems(Array.isArray(data.items) ? data.items : [])
      setMeta(data.meta || { rankHighlightEligible: false })
      if (!list) setList(data.list || null)
    } catch (err) {
      setError(err.message)
      setItems([])
    }
  }

  const fetchComments = async () => {
    try {
      setCommentsLoading(true)
      const response = await fetch(`http://localhost:3000/api/lists/${listId}/comments?limit=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load comments')
      setComments(Array.isArray(data.comments) ? data.comments : [])
    } catch (_err) {
      setComments([])
    }
    setCommentsLoading(false)
  }

  useEffect(() => {
    fetchList()
  }, [listId, token])

  useEffect(() => {
    fetchItems()
  }, [listId, token, readFilter, status, minStars, sortBy, order])

  useEffect(() => {
    fetchComments()
  }, [listId, token])

  useEffect(() => {
    const nextSearch = readTextParam(searchParams, 'q', '')
    const nextRead = readEnumParam(searchParams, 'r', ['all', 'read', 'unread'], 'all')
    const nextStatus = readEnumParam(searchParams, 'f', ['all', 'want-to-play', 'playing', 'completed', 'dropped', 'on-hold'], 'all')
    const nextMinStars = readEnumParam(searchParams, 'm', ['all', '1', '2', '3', '4', '5'], 'all')
    const nextSortBy = readEnumParam(searchParams, 's', ['position', 'originalRank', 'title', 'rating', 'status', 'addedAt'], 'position')
    const nextOrder = readEnumParam(searchParams, 'o', ['asc', 'desc'], 'asc')
    const nextView = readEnumParam(searchParams, 'v', ['list', 'grid'], 'list')

    if (nextSearch !== search) setSearch(nextSearch)
    if (nextRead !== readFilter) setReadFilter(nextRead)
    if (nextStatus !== status) setStatus(nextStatus)
    if (nextMinStars !== minStars) setMinStars(nextMinStars)
    if (nextSortBy !== sortBy) setSortBy(nextSortBy)
    if (nextOrder !== order) setOrder(nextOrder)
    if (nextView !== viewMode) setViewMode(nextView)
  }, [searchParams])

  useEffect(() => {
    const nextParams = buildSearchParams(
      searchParams,
      { q: search, r: readFilter, f: status, m: minStars, s: sortBy, o: order, v: viewMode },
      { q: '', r: 'all', f: 'all', m: 'all', s: 'position', o: 'asc', v: 'list' }
    )
    if (didSearchParamsChange(searchParams, nextParams)) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [search, readFilter, status, minStars, sortBy, order, viewMode, searchParams, setSearchParams])

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((item) => String(item.title || '').toLowerCase().includes(term))
  }, [items, search])

  const isRanking = list?.type === 'ranking'

  const toggleFollow = async () => {
    if (!token || !list) return
    try {
      const method = list.isFollowedByViewer ? 'DELETE' : 'POST'
      const response = await fetch(`http://localhost:3000/api/lists/${list.id}/follow`, {
        method,
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not update follow')
      setList((prev) => prev ? {
        ...prev,
        isFollowedByViewer: !prev.isFollowedByViewer,
        followersCount: Number(data.followersCount || prev.followersCount || 0)
      } : prev)
    } catch (_err) {}
  }

  const toggleLike = async () => {
    if (!token || !list || likeBusy) return
    try {
      setLikeBusy(true)
      const method = list.isLikedByViewer ? 'DELETE' : 'POST'
      const response = await fetch(`http://localhost:3000/api/lists/${list.id}/like`, {
        method,
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not update like')
      setList((prev) => prev ? {
        ...prev,
        isLikedByViewer: !prev.isLikedByViewer,
        likesCount: Number(data.likesCount || 0)
      } : prev)
    } catch (_err) {
    } finally {
      setLikeBusy(false)
    }
  }

  const removeList = async () => {
    if (!token || !list || !isOwner || deleteBusy) return
    const ok = window.confirm('Delete this list permanently?')
    if (!ok) return
    try {
      setDeleteBusy(true)
      const response = await fetch(`http://localhost:3000/api/lists/${list.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not delete list')
      navigate('/lists/explore')
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  const submitComment = async (e) => {
    e.preventDefault()
    if (!token || !list || commentBusy) return
    const content = commentDraft.trim()
    if (!content) return
    try {
      setCommentBusy(true)
      const response = await fetch(`http://localhost:3000/api/lists/${list.id}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not post comment')
      const created = data.comment
      if (created) {
        setComments((prev) => [created, ...prev])
      }
      setList((prev) => prev ? {
        ...prev,
        commentsCount: Number(data.commentsCount || ((prev.commentsCount || 0) + 1))
      } : prev)
      setCommentDraft('')
    } catch (_err) {
    } finally {
      setCommentBusy(false)
    }
  }

  const removeComment = async (commentId) => {
    if (!token || !list || !commentId) return
    setCommentMenuOpen(null)
    try {
      const response = await fetch(`http://localhost:3000/api/lists/${list.id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not delete comment')
      setComments((prev) => prev.filter((item) => item.id !== commentId))
      setList((prev) => prev ? {
        ...prev,
        commentsCount: Number(data.commentsCount || Math.max(0, (prev.commentsCount || 1) - 1))
      } : prev)
    } catch (_err) {}
  }

  const startEditComment = (comment) => {
    setEditingCommentId(comment.id)
    setEditingCommentDraft(comment.content || '')
    setCommentMenuOpen(null)
  }

  const cancelEditComment = () => {
    setEditingCommentId(null)
    setEditingCommentDraft('')
  }

  const saveEditComment = async (commentId) => {
    if (!token || !list || !commentId || editingCommentBusy) return
    const content = editingCommentDraft.trim()
    if (!content) return
    try {
      setEditingCommentBusy(true)
      const response = await fetch(`http://localhost:3000/api/lists/${list.id}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not update comment')
      if (data.comment) {
        setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, content: data.comment.content, updatedAt: data.comment.updatedAt } : c))
      }
      cancelEditComment()
    } catch (_err) {}
    finally {
      setEditingCommentBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <SiteHeader user={user} token={token} onLogout={logout} listsHref="/lists/explore" />

      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6">
        {loading ? <p className="py-16 text-center text-sm text-stone-500">Loading list...</p> : null}
        {error && !loading ? <p className="rounded-xl border border-rose-500/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

        {list && !loading ? (
          <>
            <section className="overflow-hidden rounded-2xl border border-stone-800 bg-gradient-to-br from-stone-900 via-stone-950 to-black p-5 sm:p-6">
              <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isRanking ? 'bg-amber-400/20 text-amber-200' : 'bg-sky-400/20 text-sky-200'}`}>
                      {isRanking ? 'Ranking List' : 'Normal List'}
                    </span>
                    <span className="rounded-full border border-stone-700 px-2.5 py-1 text-xs text-stone-300">{list.visibility}</span>
                  </div>
                  <h1 className="text-3xl font-bold text-white">{list.name}</h1>
                  {list.description ? <p className="mt-2 max-w-3xl text-sm text-stone-300">{list.description}</p> : null}
                  <p className="mt-3 text-xs text-stone-500">by <Link to={`/user/${list.owner?.username}`} className="text-stone-300 hover:text-white">@{list.owner?.username || 'unknown'}</Link></p>
                </div>

                <div className="flex flex-col items-start gap-2 lg:items-end">
                  <div className="inline-flex items-center gap-3 rounded-xl border border-stone-800 bg-black/40 px-3 py-2 text-xs text-stone-300">
                    <span>{list.itemCount} VNs</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {list.followersCount}</span>
                    <span className="inline-flex items-center gap-1"><Heart className={`h-3.5 w-3.5 ${list.isLikedByViewer ? 'fill-rose-400 text-rose-400' : ''}`} /> {list.likesCount || 0}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {user ? (
                      <button onClick={toggleLike} disabled={likeBusy} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${list.isLikedByViewer ? 'border border-rose-500/50 bg-rose-500/15 text-rose-200 hover:border-rose-400' : 'border border-stone-700 bg-stone-900 text-stone-200 hover:border-stone-500'}`}>
                        <Heart className={`h-4 w-4 ${list.isLikedByViewer ? 'fill-current' : ''}`} />
                        {list.isLikedByViewer ? 'Liked' : 'Like'}
                      </button>
                    ) : null}

                    {user && user.username !== list.owner?.username && list.visibility === 'public' ? (
                      <button onClick={toggleFollow} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${list.isFollowedByViewer ? 'border border-stone-700 bg-stone-900 text-stone-200 hover:border-stone-500' : 'bg-white text-stone-950 hover:bg-stone-100'}`}>
                        {list.isFollowedByViewer ? 'Following' : 'Follow list'}
                      </button>
                    ) : null}

                    {user && isOwner ? (
                      <button onClick={removeList} disabled={deleteBusy} className="inline-flex items-center gap-2 rounded-lg border border-rose-600/50 bg-rose-900/20 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-500">
                        <Trash2 className="h-4 w-4" />
                        Delete list
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-3 rounded-2xl border border-stone-800 bg-stone-950/40 p-4 md:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
              <label className="relative block md:col-span-2 lg:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search inside list"
                  className="h-11 w-full rounded-xl border border-stone-700 bg-stone-950 pl-10 pr-4 text-sm text-stone-200 outline-none transition focus:border-white/60"
                />
              </label>

              <select value={readFilter} onChange={(e) => setReadFilter(e.target.value)} className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-200 outline-none focus:border-white/60">
                <option value="all">All entries</option>
                <option value="read">On list</option>
                <option value="unread">Not on list</option>
              </select>

              <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-200 outline-none focus:border-white/60">
                <option value="all">Any status</option>
                <option value="want-to-play">Wishlist</option>
                <option value="playing">Reading</option>
                <option value="completed">Completed</option>
                <option value="dropped">Dropped</option>
                <option value="on-hold">On hold</option>
              </select>

              <select value={minStars} onChange={(e) => setMinStars(e.target.value)} className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-200 outline-none focus:border-white/60">
                <option value="all">Any stars</option>
                <option value="5">5 stars</option>
                <option value="4">4+ stars</option>
                <option value="3">3+ stars</option>
                <option value="2">2+ stars</option>
                <option value="1">1+ stars</option>
              </select>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-200 outline-none focus:border-white/60">
                  <option value="position">List order</option>
                  <option value="originalRank">Original rank</option>
                  <option value="title">Title</option>
                  <option value="rating">My rating</option>
                  <option value="status">Status</option>
                  <option value="addedAt">Date added</option>
                </select>
                <button onClick={() => setOrder((prev) => prev === 'asc' ? 'desc' : 'asc')} className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-700 bg-stone-950 text-stone-300 transition hover:border-stone-500 hover:text-white">
                  {order === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setViewMode('grid')} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${viewMode === 'grid' ? 'border-white/60 bg-white/10 text-stone-200' : 'border-stone-700 bg-stone-950 text-stone-300 hover:border-stone-500 hover:text-white'}`}>
                  <LayoutGrid className="h-4 w-4" />
                  Covers
                </button>
                <button onClick={() => setViewMode('list')} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${viewMode === 'list' ? 'border-white/60 bg-white/10 text-stone-200' : 'border-stone-700 bg-stone-950 text-stone-300 hover:border-stone-500 hover:text-white'}`}>
                  <List className="h-4 w-4" />
                  List
                </button>
              </div>
            </section>

            <section className="mt-6 space-y-3">
              {visibleItems.length && viewMode === 'list' ? visibleItems.map((item) => {
                const rank = Number(item.originalRank || 0)
                const showTopStyle = isRanking && meta.rankHighlightEligible && rank > 0 && rank <= 3
                const unreadClass = item.isRead ? 'bg-stone-950/70' : 'bg-stone-950/90'

                return (
                  <article key={item.id} className={`rounded-2xl border p-3 transition ${showTopStyle ? rankTone(rank) : `border-stone-800 ${unreadClass}`}`}>
                    <div className="grid items-center gap-3 sm:grid-cols-[64px_1fr_auto]">
                      <Link to={`/vn/${item.vnId}`} className="block overflow-hidden rounded-lg border border-stone-800">
                        <img src={item.image || 'https://placehold.co/64x96/100f0e/d6d3d1?text=VN'} alt={item.title} className="aspect-[2/3] w-full object-cover" />
                      </Link>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.originalRank ? (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${showTopStyle ? 'bg-black/35 text-white' : 'bg-stone-900 text-stone-300'}`}>
                              {showTopStyle ? <Trophy className="h-3 w-3" /> : null}
                              #{item.originalRank}
                            </span>
                          ) : null}

                          <Link to={`/vn/${item.vnId}`} className="truncate text-base font-semibold text-white hover:text-stone-200">{item.title}</Link>
                          {!item.isRead ? <span className="rounded-full bg-stone-700/70 px-2 py-0.5 text-[10px] text-stone-300">Unread</span> : null}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400">
                          <span>Status: {item.viewerLog?.status || 'none'}</span>
                          <span>My rating: {item.viewerLog?.rating ? stars(item.viewerLog.rating) : 'none'}</span>
                          <span>Added: {new Date(item.addedAt).toLocaleDateString()}</span>
                          {item.rankScore != null ? <span className="inline-flex items-center gap-1 text-amber-300"><Star className="h-3 w-3 fill-current" /> {item.rankScore.toFixed(1)}</span> : null}
                        </div>

                        {item.notes ? <p className="mt-2 text-sm text-stone-300">{item.notes}</p> : null}
                      </div>
                    </div>
                  </article>
                )
              }) : null}

              {visibleItems.length && viewMode === 'grid' ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {visibleItems.map((item) => {
                    const rank = Number(item.originalRank || 0)
                    const showTopStyle = isRanking && meta.rankHighlightEligible && rank > 0 && rank <= 3
                    return (
                      <article key={item.id} className={`overflow-hidden rounded-2xl border transition ${showTopStyle ? rankTone(rank) : 'border-stone-800 bg-stone-950/70'}`}>
                        <Link to={`/vn/${item.vnId}`} className="block">
                          <img src={item.image || 'https://placehold.co/360x540/100f0e/d6d3d1?text=VN'} alt={item.title} className="aspect-[2/3] w-full object-cover" />
                        </Link>
                        <div className="space-y-1 p-3">
                          <div className="flex items-center gap-2">
                            {item.originalRank ? (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${showTopStyle ? 'bg-black/35 text-white' : 'bg-stone-900 text-stone-300'}`}>
                                {showTopStyle ? <Trophy className="h-3 w-3" /> : null}
                                #{item.originalRank}
                              </span>
                            ) : null}
                            {!item.isRead ? <span className="rounded-full bg-stone-700/70 px-2 py-0.5 text-[10px] text-stone-300">Unread</span> : null}
                          </div>
                          <Link to={`/vn/${item.vnId}`} className="line-clamp-2 text-sm font-semibold text-white hover:text-stone-200">{item.title}</Link>
                          {item.rankScore != null ? <p className="inline-flex items-center gap-1 text-xs text-amber-300"><Star className="h-3 w-3 fill-current" /> {item.rankScore.toFixed(1)}</p> : null}
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : null}

              {!visibleItems.length ? (
                <p className="rounded-xl border border-stone-800 bg-stone-950/60 px-4 py-6 text-sm text-stone-400">No entries match your filters.</p>
              ) : null}
            </section>

            <section className="mt-8 rounded-2xl border border-stone-800/60 bg-gradient-to-b from-stone-900/80 to-stone-950/80 p-5 sm:p-6 backdrop-blur-sm">
              <div className="mb-5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold tracking-tight text-white">Comments</h2>
                  <span className="rounded-full bg-stone-800 px-2.5 py-0.5 text-xs font-semibold text-stone-300">{list.commentsCount || comments.length}</span>
                </div>
              </div>

              {token ? (
                <form onSubmit={submitComment} className="mb-6">
                  <div className="relative">
                    <textarea
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder="Write a comment…"
                      className="w-full resize-none rounded-xl border border-stone-700/80 bg-stone-950/70 px-4 py-3 text-sm text-stone-200 outline-none transition placeholder:text-stone-600 focus:border-white/50 focus:ring-1 focus:ring-white/10"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-stone-600">{commentDraft.length}<span className="text-stone-700">/500</span></span>
                    <button
                      type="submit"
                      disabled={commentBusy || !commentDraft.trim()}
                      className="rounded-lg bg-white px-5 py-1.5 text-sm font-semibold text-stone-950 shadow-[0_2px_12px_rgba(255,255,255,0.08)] transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {commentBusy ? 'Posting…' : 'Post'}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="mb-6 rounded-xl border border-stone-800 bg-stone-900/40 px-4 py-3 text-sm text-stone-500">Sign in to leave a comment.</p>
              )}

              <div className="space-y-3">
                {commentsLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-stone-600">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-700 border-t-white" />
                    Loading…
                  </div>
                ) : null}

                {!commentsLoading && comments.length ? comments.map((comment) => {
                  const name = comment.author?.username || 'unknown'
                  const initial = name.charAt(0).toUpperCase()
                  const isEditing = editingCommentId === comment.id
                  const menuOpen = commentMenuOpen === comment.id

                  return (
                    <article
                      key={comment.id}
                      className="group relative rounded-xl border border-stone-800/60 bg-stone-950/50 p-4 transition hover:border-stone-700/60"
                    >
                      <div className="flex items-start gap-3">
                        {comment.author?.avatarUrl ? (
                          <img
                            src={`http://localhost:3000${comment.author.avatarUrl}`}
                            alt={name}
                            className="mt-0.5 h-8 w-8 shrink-0 rounded-full border border-stone-700/60 object-cover ring-1 ring-stone-700/30"
                          />
                        ) : (
                          <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-stone-700 to-stone-800 text-xs font-bold text-stone-200 ring-1 ring-stone-700/50">
                            {initial}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link to={`/user/${name}`} className="text-sm font-semibold text-stone-100 transition hover:text-stone-200">
                              @{name}
                            </Link>
                            <span className="text-xs text-stone-600">
                              {new Date(comment.updatedAt || comment.createdAt).toLocaleString()}
                              {comment.updatedAt && comment.updatedAt !== comment.createdAt ? <span className="ml-1 text-stone-700">(edited)</span> : null}
                            </span>
                          </div>

                          {isEditing ? (
                            <div className="mt-3 space-y-2">
                              <textarea
                                value={editingCommentDraft}
                                onChange={(e) => setEditingCommentDraft(e.target.value)}
                                maxLength={500}
                                rows={3}
                                autoFocus
                                className="w-full resize-none rounded-lg border border-stone-700 bg-stone-900/80 px-3 py-2 text-sm text-stone-200 outline-none transition focus:border-white/50 focus:ring-1 focus:ring-white/10"
                              />
                              <div className="flex items-center gap-3 text-sm">
                                <button
                                  type="button"
                                  onClick={() => saveEditComment(comment.id)}
                                  disabled={editingCommentBusy || !editingCommentDraft.trim()}
                                  className="font-semibold text-stone-200 transition hover:text-stone-200 disabled:opacity-50"
                                >
                                  {editingCommentBusy ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditComment}
                                  disabled={editingCommentBusy}
                                  className="font-semibold text-stone-500 transition hover:text-stone-300"
                                >
                                  Cancel
                                </button>
                                <span className="ml-auto text-xs text-stone-700">{editingCommentDraft.length}/500</span>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-stone-300">{comment.content}</p>
                          )}
                        </div>

                        {comment.canDelete && !isEditing ? (
                          <div className="relative ml-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setCommentMenuOpen(menuOpen ? null : comment.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-stone-600 opacity-0 transition hover:bg-stone-800 hover:text-stone-300 group-hover:opacity-100"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {menuOpen ? (
                              <div className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-xl border border-stone-700/70 bg-stone-900 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                                <button
                                  type="button"
                                  onClick={() => startEditComment(comment)}
                                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-stone-300 transition hover:bg-stone-800 hover:text-white"
                                >
                                  <Pencil className="h-3.5 w-3.5 text-stone-500" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeComment(comment.id)}
                                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-rose-400 transition hover:bg-rose-950/40 hover:text-rose-300"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  )
                }) : null}

                {!commentsLoading && !comments.length ? (
                  <div className="rounded-xl border border-dashed border-stone-800 px-4 py-8 text-center">
                    <p className="text-sm text-stone-600">No comments yet. Be the first to comment.</p>
                  </div>
                ) : null}
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  )
}

export default ListDetailPage
