import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, BookOpen, Eye, EyeOff, Heart, ListPlus, MoreVertical, Pencil, Send, ShieldAlert, ShieldOff, Star, Trash2, Users, X } from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import SiteHeader from './components/SiteHeader'

const STATUS_OPTIONS = [
  { value: 'want-to-play', label: 'Wishlist' },
  { value: 'playing', label: 'Reading' },
  { value: 'completed', label: 'Read' }
]

const STATUS_LABELS = {
  'want-to-play': 'Wishlist',
  playing: 'Reading',
  completed: 'Read',
  dropped: 'Dropped',
  'on-hold': 'On Hold'
}

function cleanDescription(text = '') {
  return text.replace(/\[.*?\]/g, '').trim()
}

function formatAverageRating(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 'N/A'
  return `${numeric.toFixed(1)}/10`
}

function renderStars(ratingOutOfTen) {
  const score = Number(ratingOutOfTen)
  if (!Number.isFinite(score) || score <= 0) {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={`empty-${i}`} className="h-4 w-4 text-stone-600" />
        ))}
      </div>
    )
  }

  const normalized = Math.max(0, Math.min(5, score / 2))
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.max(0, Math.min(1, normalized - i))
        return (
          <div key={i} className="relative h-4 w-4">
            <Star className="absolute inset-0 h-4 w-4 text-stone-600" />
            {fill > 0 ? (
              <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className="h-4 w-4 fill-rose-400 text-rose-400" />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function formatCoverType(type) {
  const labels = {
    main: 'Main Cover',
    pkgfront: 'Package Front',
    pkgback: 'Package Back',
    pkgcontent: 'Package Content',
    pkgside: 'Package Side',
    pkgmed: 'Media',
    dig: 'Digital'
  }
  return labels[type] || 'Cover'
}

function VNDetail() {
  const { id } = useParams()
  const { user, token } = useAuth()
  const [vn, setVn] = useState(null)
  const [userLog, setUserLog] = useState(null)
  const [reviews, setReviews] = useState([])
  const [characters, setCharacters] = useState([])
  const [relatedCovers, setRelatedCovers] = useState({})
  const [heroLayout, setHeroLayout] = useState({
    height: 'clamp(360px, 38vw, 500px)',
    position: 'center 22%'
  })
  const [charsLoading, setCharsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [publishingReview, setPublishingReview] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [draftRating, setDraftRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [draftReview, setDraftReview] = useState('')
  const [canAddAnotherReview, setCanAddAnotherReview] = useState(false)
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [editingReviewText, setEditingReviewText] = useState('')
  const [editingReviewRating, setEditingReviewRating] = useState(0)
  const [hoverEditRating, setHoverEditRating] = useState(0)
  const [editingActionLoading, setEditingActionLoading] = useState(false)
  const [reviewMenuOpen, setReviewMenuOpen] = useState(null)
  const [error, setError] = useState(null)
  const [releases, setReleases] = useState([])
  const [releasesLoading, setReleasesLoading] = useState(false)
  const [covers, setCovers] = useState([])
  const [coversLoading, setCoversLoading] = useState(false)
  const [coverLightboxIndex, setCoverLightboxIndex] = useState(null)
  const [selectedCoverUrl, setSelectedCoverUrl] = useState('')
  const [savingCoverChoice, setSavingCoverChoice] = useState(false)
  const [quotes, setQuotes] = useState([])
  const [quotesLoading, setQuotesLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('tags')
  const [vnStats, setVnStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [showSpoilerTags, setShowSpoilerTags] = useState(false)
  const [showEroTags, setShowEroTags] = useState(false)
  const [showExplicitScreenshots, setShowExplicitScreenshots] = useState(false)
  const [showViolentScreenshots, setShowViolentScreenshots] = useState(false)
  const [recommendOpen, setRecommendOpen] = useState(false)
  const [recommendQuery, setRecommendQuery] = useState('')
  const [recommendMessage, setRecommendMessage] = useState('')
  const [recommendSending, setRecommendSending] = useState(false)
  const [followingOptions, setFollowingOptions] = useState([])
  const [followingLoading, setFollowingLoading] = useState(false)
  const [selectedRecipients, setSelectedRecipients] = useState([])
  const [customListOpen, setCustomListOpen] = useState(false)
  const [customLists, setCustomLists] = useState([])
  const [customListsLoading, setCustomListsLoading] = useState(false)
  const [customListMessage, setCustomListMessage] = useState('')
  const [customListAddingId, setCustomListAddingId] = useState('')
  const [createListBusy, setCreateListBusy] = useState(false)
  const [createListForm, setCreateListForm] = useState({
    name: '',
    description: '',
    type: 'normal',
    visibility: 'public'
  })

  useEffect(() => {
    setActionMessage('')
    setLightboxIndex(null)
    setCoverLightboxIndex(null)
    setSelectedCoverUrl('')
    setShowSpoilerTags(false)
    setShowEroTags(false)
    setShowExplicitScreenshots(false)
    setShowViolentScreenshots(false)
    setRecommendOpen(false)
    setCustomListOpen(false)
    setActiveTab('tags')
    setRecommendQuery('')
    setRecommendMessage('')
    setSelectedRecipients([])
    setCustomLists([])
    setCustomListMessage('')
    setCustomListAddingId('')
    setCreateListBusy(false)
    setCreateListForm({ name: '', description: '', type: 'normal', visibility: 'public' })
    fetchVN()
    fetchSiteReviews()
    fetchCharacters()
    fetchReleases()
    fetchCovers()
    fetchQuotes()
    fetchVnStats()
  }, [id])

  useEffect(() => {
    if (user && token) {
      fetchUserLog()
      fetchCoverPreference()
    } else {
      setUserLog(null)
      setSelectedCoverUrl('')
    }
  }, [id, user?.id, token])

  useEffect(() => {
    setDraftRating(userLog?.rating ? Number(userLog.rating) : 0)
    setDraftReview(userLog?.review || '')
  }, [userLog, id])

  useEffect(() => {
    if (!vn?.relations?.length) {
      setRelatedCovers({})
      return
    }
    fetchRelatedCovers(vn.relations)
  }, [vn?.id])

  useEffect(() => {
    if (!vn?.screenshots?.[0]?.url && !vn?.image?.url) {
      setHeroLayout({
        height: 'clamp(360px, 38vw, 500px)',
        position: 'center 22%'
      })
      return
    }

    const image = new Image()
    const src = vn.screenshots?.[0]?.url || selectedCoverUrl || vn.image?.url
    let cancelled = false

    image.onload = () => {
      if (cancelled) return

      const ratio = image.width / Math.max(1, image.height)

      if (ratio >= 2.2) {
        setHeroLayout({
          height: 'clamp(440px, 48vw, 640px)',
          position: 'center 16%'
        })
        return
      }

      if (ratio >= 1.75) {
        setHeroLayout({
          height: 'clamp(400px, 43vw, 560px)',
          position: 'center 19%'
        })
        return
      }

      setHeroLayout({
        height: 'clamp(360px, 38vw, 500px)',
        position: 'center 22%'
      })
    }

    image.onerror = () => {
      if (cancelled) return
      setHeroLayout({
        height: 'clamp(360px, 38vw, 500px)',
        position: 'center 22%'
      })
    }

    image.src = src

    return () => {
      cancelled = true
    }
  }, [vn?.id, vn?.screenshots, vn?.image?.url, selectedCoverUrl])

  const visibleShots = useMemo(() => {
    if (!vn?.screenshots?.length) return []
    return vn.screenshots
      .map((shot, i) => ({ ...shot, origIndex: i }))
      .filter((shot) => {
        const isExplicit = (shot.sexual ?? 0) >= 2
        const isViolent = (shot.violence ?? 0) >= 2
        const explicitAllowed = showExplicitScreenshots || !isExplicit
        const violentAllowed = showViolentScreenshots || !isViolent
        return explicitAllowed && violentAllowed
      })
  }, [vn?.screenshots, showExplicitScreenshots, showViolentScreenshots])

  useEffect(() => {
    if (lightboxIndex === null) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowLeft' && lightboxIndex > 0) setLightboxIndex((prev) => prev - 1)
      if (e.key === 'ArrowRight' && lightboxIndex < visibleShots.length - 1) setLightboxIndex((prev) => prev + 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxIndex, visibleShots.length])

  useEffect(() => {
    if (coverLightboxIndex === null) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setCoverLightboxIndex(null)
      if (e.key === 'ArrowLeft' && coverLightboxIndex > 0) setCoverLightboxIndex((prev) => prev - 1)
      if (e.key === 'ArrowRight' && coverLightboxIndex < covers.length - 1) setCoverLightboxIndex((prev) => prev + 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [coverLightboxIndex, covers.length])

  const fetchVN = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`http://localhost:3000/api/vn/${id}`)
      if (!response.ok) throw new Error('VN not found')
      const data = await response.json()
      setVn(data)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const fetchSiteReviews = async () => {
    setReviewsLoading(true)
    try {
      const response = await fetch(`http://localhost:3000/api/vn/${id}/reviews`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load reviews')
      setReviews(Array.isArray(data) ? data : [])
    } catch (_err) {
      setReviews([])
    }
    setReviewsLoading(false)
  }

  const fetchCharacters = async () => {
    setCharsLoading(true)
    try {
      const res = await fetch(`http://localhost:3000/api/vn/${id}/characters`)
      const data = await res.json()
      setCharacters(Array.isArray(data) ? data : [])
    } catch (_) {
      setCharacters([])
    }
    setCharsLoading(false)
  }

  const fetchRelatedCovers = async (relations) => {
    const ids = [...new Set(relations.map((item) => String(item?.id || '').trim()).filter(Boolean))].slice(0, 18)
    if (!ids.length) {
      setRelatedCovers({})
      return
    }

    const next = {}
    const chunkSize = 5

    for (let index = 0; index < ids.length; index += chunkSize) {
      const chunk = ids.slice(index, index + chunkSize)
      const rows = await Promise.all(
        chunk.map(async (vnId) => {
          try {
            const response = await fetch(`http://localhost:3000/api/vn/${vnId}`)
            if (!response.ok) return { vnId, image: '' }
            const data = await response.json()
            return { vnId, image: data.image?.url || '' }
          } catch (_error) {
            return { vnId, image: '' }
          }
        })
      )

      rows.forEach((item) => {
        if (item.image) next[item.vnId] = item.image
      })
    }

    setRelatedCovers(next)
  }

  const fetchReleases = async () => {
    setReleasesLoading(true)
    try {
      const res = await fetch(`http://localhost:3000/api/vn/${id}/releases`)
      const data = await res.json()
      setReleases(Array.isArray(data) ? data : [])
    } catch (_) {
      setReleases([])
    }
    setReleasesLoading(false)
  }

  const fetchCovers = async () => {
    setCoversLoading(true)
    try {
      const res = await fetch(`http://localhost:3000/api/vn/${id}/covers`)
      const data = await res.json()
      setCovers(Array.isArray(data) ? data : [])
    } catch (_) {
      setCovers([])
    }
    setCoversLoading(false)
  }

  const fetchCoverPreference = async () => {
    if (!token) return

    try {
      const response = await fetch('http://localhost:3000/api/users/me/settings', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load settings')
      const preferred = Array.isArray(data.settings?.preferredVnCovers) ? data.settings.preferredVnCovers : []
      const current = preferred.find((item) => String(item.vnId) === String(id))
      setSelectedCoverUrl(current?.image || '')
    } catch (_error) {
      setSelectedCoverUrl('')
    }
  }

  const fetchQuotes = async () => {
    setQuotesLoading(true)
    try {
      const res = await fetch(`http://localhost:3000/api/vn/${id}/quotes`)
      const data = await res.json()
      setQuotes(Array.isArray(data) ? data : [])
    } catch (_) {
      setQuotes([])
    }
    setQuotesLoading(false)
  }

  const fetchVnStats = async () => {
    setStatsLoading(true)
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const response = await fetch(`http://localhost:3000/api/vn/${id}/stats`, { headers })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load VN stats')
      setVnStats(data)
    } catch (_error) {
      setVnStats(null)
    }
    setStatsLoading(false)
  }

  const fetchFollowingOptions = async () => {
    if (!token) return

    setFollowingLoading(true)
    try {
      const response = await fetch('http://localhost:3000/api/users/me/following-options?limit=200', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load followed users')
      setFollowingOptions(Array.isArray(data.following) ? data.following : [])
    } catch (_error) {
      setFollowingOptions([])
    }
    setFollowingLoading(false)
  }

  const fetchMyCustomLists = async () => {
    if (!token || !user?.username) return

    setCustomListsLoading(true)
    try {
      const response = await fetch(`http://localhost:3000/api/users/${encodeURIComponent(user.username)}/lists?bucket=created`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load your custom lists')
      setCustomLists(Array.isArray(data.created) ? data.created : [])
    } catch (_error) {
      setCustomLists([])
    }
    setCustomListsLoading(false)
  }

  const fetchUserLog = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/logs', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const logs = await response.json()
      if (!response.ok || !Array.isArray(logs)) {
        setUserLog(null)
        return
      }

      const found = logs.find((log) => String(log.vnId) === String(id)) || null
      setUserLog(found)
    } catch (_err) {
      setUserLog(null)
    }
  }

  const markCoverAsPreferred = async (cover) => {
    if (!user || !token) {
      setActionMessage('Sign in to save a preferred cover.')
      return
    }

    const imageUrl = String(cover?.url || '').trim()
    if (!imageUrl) return

    setSavingCoverChoice(true)
    try {
      const response = await fetch('http://localhost:3000/api/users/me/vn-cover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          vnId: String(vn?.id || id),
          image: imageUrl,
          title: vn?.title || ''
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save preferred cover')

      setSelectedCoverUrl(imageUrl)
      setActionMessage('Preferred cover updated for this VN.')
    } catch (error) {
      setActionMessage(error.message || 'Could not save preferred cover')
    } finally {
      setSavingCoverChoice(false)
    }
  }

  const upsertLog = async (updates) => {
    if (!user || !token || !vn) return false

    setActionLoading(true)
    try {
      const response = await fetch('http://localhost:3000/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          vnId: vn.id || id,
          title: vn.title,
          image: selectedCoverUrl || vn.image?.url,
          ...updates
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error updating list')
      setUserLog(data)
      fetchSiteReviews()
      fetchVnStats()
      return true
    } catch (err) {
      setActionMessage(err.message || 'Could not update your list')
      return false
    } finally {
      setActionLoading(false)
    }
  }

  const addToList = async () => {
    const ok = await upsertLog({ status: 'want-to-play' })
    if (ok) setActionMessage('Added to your list.')
  }

  const updateStatus = async (status) => {
    const ok = await upsertLog({ status })
    if (ok) setActionMessage(`Status updated to ${STATUS_LABELS[status]}.`)
  }

  const removeFromList = async () => {
    if (!user || !token) return

    setActionLoading(true)
    try {
      const response = await fetch(`http://localhost:3000/api/logs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not remove from list')
      setUserLog(null)
      setDraftRating(0)
      setDraftReview('')
      setActionMessage('Removed from your list.')
      fetchVnStats()
    } catch (err) {
      setActionMessage(err.message || 'Could not remove from list')
    } finally {
      setActionLoading(false)
    }
  }

  const openRecommendModal = async () => {
    if (!user || !token) return

    setRecommendOpen(true)
    setRecommendMessage('')

    if (!followingOptions.length && !followingLoading) {
      await fetchFollowingOptions()
    }
  }

  const openCustomListModal = async () => {
    if (!user || !token) return
    setCustomListOpen(true)
    setCustomListMessage('')
    if (!customLists.length && !customListsLoading) {
      await fetchMyCustomLists()
    }
  }

  const addVnToCustomList = async (listId) => {
    if (!token || !vn || !listId) return
    setCustomListAddingId(String(listId))
    setCustomListMessage('')

    try {
      const response = await fetch(`http://localhost:3000/api/lists/${listId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          vnId: String(vn.id || id),
          title: String(vn.title || '').trim(),
          image: selectedCoverUrl || vn.image?.url || ''
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not add VN to list')
      setCustomListMessage('VN added to custom list.')
    } catch (error) {
      setCustomListMessage(error.message || 'Could not add VN to list')
    } finally {
      setCustomListAddingId('')
    }
  }

  const createListFromModal = async (e) => {
    e.preventDefault()
    if (!token) return

    setCreateListBusy(true)
    setCustomListMessage('')
    try {
      const response = await fetch('http://localhost:3000/api/lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(createListForm)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not create list')

      setCreateListForm({ name: '', description: '', type: 'normal', visibility: 'public' })
      setCustomListMessage('Custom list created. You can add this VN now.')
      await fetchMyCustomLists()
    } catch (error) {
      setCustomListMessage(error.message || 'Could not create list')
    } finally {
      setCreateListBusy(false)
    }
  }

  const toggleRecipient = (username) => {
    setSelectedRecipients((prev) => (
      prev.includes(username)
        ? prev.filter((item) => item !== username)
        : [...prev, username]
    ))
  }

  const sendRecommendations = async () => {
    if (!token || !vn || !selectedRecipients.length) return

    setRecommendSending(true)
    setRecommendMessage('')
    try {
      const response = await fetch(`http://localhost:3000/api/vn/${id}/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          recipients: selectedRecipients,
          title: vn.title
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not send recommendation')

      const sent = Number(data.sentCount || 0)
      const skipped = Number(data.skippedCount || 0)
      setRecommendMessage(skipped > 0 ? `Sent ${sent} recommendation${sent === 1 ? '' : 's'}. Skipped ${skipped}.` : `Sent ${sent} recommendation${sent === 1 ? '' : 's'}.`)
      setSelectedRecipients([])
    } catch (err) {
      setRecommendMessage(err.message || 'Could not send recommendation')
    } finally {
      setRecommendSending(false)
    }
  }

  const saveInlineLog = async () => {
    const payload = {
      status: userLog?.status || 'want-to-play',
      review: draftReview.trim()
    }

    if (draftRating > 0) payload.rating = draftRating

    const ok = await upsertLog(payload)
    if (ok) {
      setActionMessage('Your rating/review has been saved.')
    }
  }

  const publishReview = async () => {
    if (!user || !token || !vn) return

    const text = draftReview.trim()
    if (!text) {
      setActionMessage('Write a review before publishing.')
      return
    }

    setPublishingReview(true)
    try {
      const response = await fetch(`http://localhost:3000/api/vn/${id}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: vn.title,
          image: selectedCoverUrl || vn.image?.url,
          rating: draftRating || null,
          review: text
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not publish review')

      const created = data.review
      if (created) {
        setReviews((prev) => [created, ...prev])
      } else {
        fetchSiteReviews()
      }

      setCanAddAnotherReview(true)
      setActionMessage('Review published. It now appears below.')
    } catch (err) {
      setActionMessage(err.message || 'Could not publish review')
    } finally {
      setPublishingReview(false)
    }
  }

  const resetReviewDraft = () => {
    setDraftRating(0)
    setDraftReview('')
    setCanAddAnotherReview(false)
    setActionMessage('Ready to add another review.')
  }

  const startEditingReview = (review) => {
    setEditingReviewId(review.id)
    setEditingReviewText(review.review || '')
    setEditingReviewRating(review.rating ? Number(review.rating) : 0)
    setReviewMenuOpen(null)
  }

  const cancelEditingReview = () => {
    setEditingReviewId(null)
    setEditingReviewText('')
    setEditingReviewRating(0)
  }

  const saveEditedReview = async () => {
    if (!editingReviewId || !token) return

    const text = editingReviewText.trim()
    if (!text) {
      setActionMessage('Review text is required.')
      return
    }

    setEditingActionLoading(true)
    try {
      const response = await fetch(`http://localhost:3000/api/vn/reviews/${editingReviewId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          review: text,
          rating: editingReviewRating || null
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not update review')

      if (data.review) {
        setReviews((prev) => prev.map((item) => (item.id === data.review.id ? data.review : item)))
      }
      cancelEditingReview()
      setActionMessage('Review updated.')
    } catch (err) {
      setActionMessage(err.message || 'Could not update review')
    } finally {
      setEditingActionLoading(false)
    }
  }

  const removeReview = async (reviewId) => {
    if (!token) return
    setReviewMenuOpen(null)
    setEditingActionLoading(true)
    try {
      const response = await fetch(`http://localhost:3000/api/vn/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not remove review')

      setReviews((prev) => prev.filter((item) => item.id !== reviewId))
      if (editingReviewId === reviewId) cancelEditingReview()
      setActionMessage('Review removed.')
    } catch (err) {
      setActionMessage(err.message || 'Could not remove review')
    } finally {
      setEditingActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="panel p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-stone-600 border-t-white" />
          <p className="text-stone-300">Loading visual novel...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="panel max-w-md p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-300" />
          <h2 className="text-2xl font-bold text-white">Error</h2>
          <p className="mt-2 text-stone-300">{error}</p>
          <Link to="/" className="btn-secondary mt-6">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  if (!vn) return null

  const heroImage = vn.screenshots?.[0]?.url || selectedCoverUrl || vn.image?.url || 'https://placehold.co/1400x500/100f0e/d6d3d1?text=VN'
  const publicStats = vnStats?.public || null
  const friendStats = vnStats?.friends || null
  const filteredFollowingOptions = followingOptions.filter((member) => {
    const term = recommendQuery.trim().toLowerCase()
    if (!term) return true
    const haystack = `${member.displayName || ''} ${member.username || ''}`.toLowerCase()
    return haystack.includes(term)
  })
  const related = vn.relations || []
  const relatedGroups = related.reduce((acc, item) => {
    const raw = String(item?.relation || 'related')
    const label = raw
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase())

    if (!acc[label]) acc[label] = []
    acc[label].push(item)
    return acc
  }, {})
  const aliases = vn.titles?.map((t) => t.title).filter(Boolean).slice(0, 4) || []
  const tabItems = [
    { key: 'tags', label: 'Tags', count: vn.tags?.length || 0 },
    { key: 'covers', label: 'Covers', count: covers.length },
    { key: 'releases', label: 'Releases', count: releases.length },
    { key: 'quotes', label: 'Quotes', count: quotes.length }
  ]

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <SiteHeader user={user} token={token} listsHref={user ? '/lists/explore' : '/'} createListHref="/lists/new" />

      <div
        className="relative bg-cover bg-top"
        style={{ backgroundImage: `url(${heroImage})`, backgroundPosition: heroLayout.position, height: heroLayout.height }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/58 to-black/80" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-b from-transparent via-black/80 to-black" />
      </div>

      <div className="relative mx-auto -mt-12 w-full max-w-6xl px-4 pb-12 sm:px-6">
        <Link to="/" className="btn-secondary mb-5 inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to search
        </Link>

        <section className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-4">
            <img
              src={selectedCoverUrl || vn.image?.url || 'https://placehold.co/350x500/111827/e5e7eb?text=VN'}
              alt={vn.title}
              className="w-full rounded-xl border border-stone-700 object-cover shadow-2xl shadow-black/50"
            />

            <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-3">
              {user ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => updateStatus(option.value)}
                        disabled={actionLoading}
                        className={`rounded-md border px-2 py-2 text-xs font-semibold transition ${
                          userLog?.status === option.value
                            ? 'border-white/60 bg-white/15 text-stone-200'
                            : 'border-stone-700 text-stone-300 hover:border-stone-500 hover:text-white'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3">
                    {userLog ? (
                      <button
                        onClick={removeFromList}
                        disabled={actionLoading}
                        className="w-full rounded-md border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-300 transition hover:border-rose-400 hover:text-rose-200"
                      >
                        Remove from my list
                      </button>
                    ) : (
                      <button
                        onClick={addToList}
                        disabled={actionLoading}
                        className="w-full rounded-md border border-white/60 bg-white px-3 py-2 text-sm font-semibold text-stone-950 transition hover:bg-stone-100"
                      >
                        Add to my list
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={openCustomListModal}
                      disabled={actionLoading}
                      className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-sky-500/60 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200 transition hover:border-sky-400 hover:bg-sky-500/20"
                    >
                      <ListPlus className="h-4 w-4" />
                      Add to custom list
                    </button>
                  </div>

                  <div className="mt-4 rounded-xl border border-stone-800 bg-gradient-to-b from-stone-900/70 to-black/50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-500">Your rating</p>
                      {draftRating > 0 ? (
                        <button
                          type="button"
                          onClick={() => { setDraftRating(0); setHoverRating(0) }}
                          disabled={actionLoading}
                          className="text-[11px] font-semibold text-stone-600 transition hover:text-rose-400"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div
                        className="flex items-center gap-1"
                        onMouseLeave={() => setHoverRating(0)}
                      >
                        {[1, 2, 3, 4, 5].map((star) => {
                          const display = hoverRating || draftRating
                          const leftValue = star * 2 - 1
                          const rightValue = star * 2
                          const fill = Math.max(0, Math.min(1, (display - (star - 1) * 2) / 2))
                          return (
                            <div key={`rate-star-${star}`} className="relative h-7 w-7 shrink-0">
                              <Star className="absolute inset-0 h-7 w-7 fill-stone-800 text-stone-700" />
                              {fill > 0 ? (
                                <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                                  <Star className="h-7 w-7 fill-rose-400 text-rose-400" />
                                </div>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => setDraftRating(leftValue)}
                                onMouseEnter={() => setHoverRating(leftValue)}
                                disabled={actionLoading}
                                className="absolute left-0 top-0 h-full w-1/2 cursor-pointer"
                                aria-label={`${leftValue}/10`}
                              />
                              <button
                                type="button"
                                onClick={() => setDraftRating(rightValue)}
                                onMouseEnter={() => setHoverRating(rightValue)}
                                disabled={actionLoading}
                                className="absolute right-0 top-0 h-full w-1/2 cursor-pointer"
                                aria-label={`${rightValue}/10`}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <textarea
                      value={draftReview}
                      onChange={(e) => setDraftReview(e.target.value)}
                      rows={4}
                      placeholder="Write a short review or personal log..."
                      className="mt-3 w-full rounded-md border border-stone-700 bg-stone-900/70 px-3 py-2 text-sm text-stone-200 outline-none transition focus:border-white/60"
                    />

                    <button
                      type="button"
                      onClick={saveInlineLog}
                      disabled={actionLoading || publishingReview}
                      className="mt-3 w-full rounded-md border border-stone-700 px-3 py-2 text-sm font-semibold text-stone-200 transition hover:border-white/60 hover:text-stone-200"
                    >
                      {userLog ? 'Update review' : 'Save to my log'}
                    </button>

                    <button
                      type="button"
                      onClick={publishReview}
                      disabled={publishingReview || actionLoading}
                      className="mt-2 w-full rounded-md border border-white/50 px-3 py-2 text-sm font-semibold text-stone-200 transition hover:border-white/70 hover:text-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {publishingReview ? 'Publishing...' : 'Publish review'}
                    </button>

                    {canAddAnotherReview ? (
                      <button
                        type="button"
                        onClick={resetReviewDraft}
                        disabled={publishingReview || actionLoading}
                        className="mt-2 w-full rounded-md border border-stone-700 px-3 py-2 text-sm font-semibold text-stone-300 transition hover:border-stone-500 hover:text-white"
                      >
                        Add another review
                      </button>
                    ) : null}
                  </div>

                  {actionMessage ? <p className="mt-3 text-xs text-stone-400">{actionMessage}</p> : null}
                </>
              ) : (
                <p className="text-sm text-stone-400">Sign in to add this VN to your list.</p>
              )}
            </div>

            <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-stone-200" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-300">VN stats</h2>
              </div>

              {statsLoading ? (
                <p className="mt-3 text-sm text-stone-400">Loading stats...</p>
              ) : publicStats ? (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg border border-stone-800 bg-black/40 p-3">
                      <p className="text-xl font-bold text-white">{publicStats.favoriteCount || 0}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-stone-500">Favorited</p>
                    </div>
                    <div className="rounded-lg border border-stone-800 bg-black/40 p-3">
                      <p className="text-xl font-bold text-white">{publicStats.loggedCount || 0}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-stone-500">In lists</p>
                    </div>
                    <div className="rounded-lg border border-stone-800 bg-black/40 p-3">
                      <p className="text-xl font-bold text-white">{publicStats.statusCounts?.completed || 0}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-stone-500">Read</p>
                    </div>
                    <div className="rounded-lg border border-stone-800 bg-black/40 p-3">
                      <p className="text-xl font-bold text-white">{publicStats.statusCounts?.playing || 0}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-stone-500">Reading</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-stone-800 bg-black/40 p-3 text-sm text-stone-300">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5 text-stone-400" />Site average</span>
                      <span className="font-semibold text-white">{formatAverageRating(publicStats.averageRating)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5"><Heart className="h-3.5 w-3.5 text-stone-400" />Wishlist</span>
                      <span className="font-semibold text-white">{publicStats.statusCounts?.['want-to-play'] || 0}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span>Dropped / On hold</span>
                      <span className="font-semibold text-white">{(publicStats.statusCounts?.dropped || 0) + (publicStats.statusCounts?.['on-hold'] || 0)}</span>
                    </div>
                  </div>

                  {user ? (
                    <div className="rounded-lg border border-stone-800 bg-black/40 p-3">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">People you follow</p>
                          <p className="mt-1 text-sm leading-6 text-stone-300">Stats for this VN among the users you follow.</p>
                        </div>
                        <button
                          type="button"
                          onClick={openRecommendModal}
                          disabled={!friendStats?.followingCount}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-white/50 px-3 py-2 text-sm font-semibold text-stone-200 transition hover:border-white/70 hover:text-stone-200 disabled:cursor-not-allowed disabled:border-stone-700 disabled:text-stone-500"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Recommend this VN
                        </button>
                      </div>

                      {friendStats ? (
                        <>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                            <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-2.5">
                              <p className="text-lg font-bold text-white">{friendStats.statusCounts?.completed || 0}</p>
                              <p className="mt-1 text-[11px] uppercase tracking-wide text-stone-500">Read</p>
                            </div>
                            <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-2.5">
                              <p className="text-lg font-bold text-white">{friendStats.statusCounts?.playing || 0}</p>
                              <p className="mt-1 text-[11px] uppercase tracking-wide text-stone-500">Reading</p>
                            </div>
                            <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-2.5">
                              <p className="text-lg font-bold text-white">{friendStats.statusCounts?.['want-to-play'] || 0}</p>
                              <p className="mt-1 text-[11px] uppercase tracking-wide text-stone-500">Wishlist</p>
                            </div>
                            <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-2.5">
                              <p className="text-lg font-bold text-white">{friendStats.favoriteCount || 0}</p>
                              <p className="mt-1 text-[11px] uppercase tracking-wide text-stone-500">Favorites</p>
                            </div>
                          </div>

                          {friendStats.users?.length ? (
                            <div className="mt-3 space-y-2">
                              {friendStats.users.map((item) => {
                                const avatarUrl = item.avatarUrl ? `http://localhost:3000${item.avatarUrl}` : ''
                                return (
                                  <Link
                                    key={item.id}
                                    to={`/user/${item.username}`}
                                    className="flex items-center gap-2 rounded-lg border border-stone-800 bg-stone-950/60 px-2.5 py-2 transition hover:border-stone-600"
                                  >
                                    {avatarUrl ? (
                                      <img src={avatarUrl} alt={item.displayName || item.username} className="h-9 w-9 rounded-full border border-stone-700 object-cover" />
                                    ) : (
                                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-700 bg-stone-900 text-xs font-bold text-stone-200">
                                        {(item.displayName || item.username || '?').charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-white">{item.displayName || item.username}</p>
                                      <p className="truncate text-xs text-stone-400">
                                        {item.status ? STATUS_LABELS[item.status] || item.status : 'Favorited this VN'}
                                        {item.rating ? ` • ${item.rating}/10` : ''}
                                      </p>
                                    </div>
                                    {item.isFavorite ? <Heart className="h-3.5 w-3.5 text-rose-300" /> : null}
                                  </Link>
                                )
                              })}
                              {friendStats.hasMoreMatches ? <p className="text-xs text-stone-500">More followed users also match this VN.</p> : null}
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-stone-400">
                              {friendStats.followingCount ? 'Nobody you follow has added this VN yet.' : 'Follow more members to get friend-specific VN stats and recommendations.'}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="mt-3 text-sm text-stone-400">Sign in to see how the people you follow feel about this VN.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-stone-400">Stats are unavailable right now.</p>
              )}
            </div>
          </aside>

          <div className="space-y-7 rounded-xl border border-stone-800 bg-black/70 p-5 md:p-7">
            <div>
              <div className="flex flex-wrap items-end gap-3">
                <h1 className="text-4xl font-bold tracking-tight text-white">{vn.title}</h1>
                {vn.released ? <span className="text-2xl text-stone-400">{String(vn.released).slice(0, 4)}</span> : null}
              </div>
              {vn.alttitle ? <p className="mt-1 text-lg text-stone-400">{vn.alttitle}</p> : null}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-stone-400">
                {vn.developers?.length ? <span>{vn.developers.map((dev) => dev.name).join(', ')}</span> : null}
                {vn.languages?.length ? <span>• {vn.languages.join(', ')}</span> : null}
                {vn.platforms?.length ? <span>• {vn.platforms.join(', ')}</span> : null}
                {vn.length_minutes ? <span>• ~{Math.round(vn.length_minutes / 60)}h</span> : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {vn.rating ? (
                  <>
                    <span className="text-amber-300">{renderStars(vn.rating / 10)}</span>
                    <span className="text-lg font-semibold text-white">{(vn.rating / 10).toFixed(1)}/10</span>
                    <span className="text-sm text-stone-500">{vn.votecount || 0} votes</span>
                  </>
                ) : (
                  <span className="text-sm text-stone-500">No community rating yet</span>
                )}

                <a
                  href={`https://vndb.org/${vn.id || id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-stone-700 px-2.5 py-1 text-xs font-semibold text-stone-300 transition hover:border-stone-500 hover:text-white"
                >
                  VNDB
                </a>
              </div>
            </div>

            {vn.description ? (
              <section className="border-t border-stone-800/80 pt-6">
                <h2 className="text-xl font-semibold text-white">Overview</h2>
                <p className="mt-3 whitespace-pre-wrap leading-8 text-stone-300">{cleanDescription(vn.description)}</p>
              </section>
            ) : null}

            <section className="border-t border-stone-800/80 pt-6">
              <div className="border-b border-stone-800/80">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {tabItems.map((tab) => {
                    const isActive = activeTab === tab.key
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold uppercase tracking-wide transition ${
                          isActive
                            ? 'border-white text-white'
                            : 'border-transparent text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        {tab.label}
                        <span className="ml-2 text-xs text-stone-500">{tab.count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="pt-5">
                {activeTab === 'covers' ? (
                  <div>
                    {coversLoading ? (
                      <p className="text-sm text-stone-400">Loading covers...</p>
                    ) : covers.length ? (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {covers.map((cover, index) => {
                          const isSelected = Boolean(selectedCoverUrl && selectedCoverUrl === cover.url)
                          return (
                          <div
                            key={cover.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setCoverLightboxIndex(index)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setCoverLightboxIndex(index)
                              }
                            }}
                            className="group block cursor-pointer text-left"
                          >
                            <div className={`relative overflow-hidden rounded-md border bg-stone-950/70 shadow-[0_16px_38px_rgba(0,0,0,0.45)] transition duration-200 group-hover:-translate-y-0.5 ${isSelected ? 'border-white/60/90' : 'border-stone-800 group-hover:border-stone-600'}`}>
                              <img
                                src={cover.thumbnail || cover.url}
                                alt={formatCoverType(cover.type)}
                                className="aspect-[2/3] w-full object-cover transition duration-200 group-hover:scale-[1.01] group-hover:brightness-90"
                              />
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                              {user && token ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    markCoverAsPreferred(cover)
                                  }}
                                  disabled={savingCoverChoice}
                                  className="absolute bottom-2 left-2 right-2 rounded-md border border-white/70 bg-white/90 px-2 py-1.5 text-xs font-semibold text-stone-950 opacity-0 transition group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  {savingCoverChoice ? 'Saving...' : 'Mark as cover'}
                                </button>
                              ) : null}
                            </div>

                            <p className="mt-2 truncate text-sm font-semibold text-stone-100 transition group-hover:text-white">
                              {Array.isArray(cover.languages) && cover.languages.length
                                ? `${cover.languages[0].toUpperCase()} · ${cover.release?.released ? String(cover.release.released).slice(0, 4) : (vn.released ? String(vn.released).slice(0, 4) : 'N/A')}`
                                : `${vn.olang ? String(vn.olang).toUpperCase() : 'VN'} · ${cover.release?.released ? String(cover.release.released).slice(0, 4) : (vn.released ? String(vn.released).slice(0, 4) : 'N/A')}`}
                            </p>
                          </div>
                        )})}
                      </div>
                    ) : (
                      <p className="text-sm text-stone-400">No additional covers found on VNDB for this VN.</p>
                    )}
                  </div>
                ) : null}

                {activeTab === 'tags' ? (
                  <div>
                    {vn.tags?.length ? (() => {
                      const TAG_CATEGORY_LABELS = { cont: 'Content', ero: 'Sexual Content', tech: 'Technical' }
                      const visibleTags = vn.tags.filter((t) => t.spoiler !== 2)
                      const spoilerTags = vn.tags.filter((t) => t.spoiler === 2)
                      const groups = {}
                      for (const tag of visibleTags) {
                        const key = TAG_CATEGORY_LABELS[tag.category] || 'Other'
                        if (!groups[key]) groups[key] = []
                        groups[key].push(tag)
                      }
                      const eroTags = groups['Sexual Content'] || []
                      delete groups['Sexual Content']
                      const categoryOrder = ['Content', 'Technical', 'Other']
                      const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
                        const ai = categoryOrder.indexOf(a)
                        const bi = categoryOrder.indexOf(b)
                        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
                      })
                      return (
                        <div className="space-y-4">
                          {sortedGroups.map(([label, tags]) => (
                            <div key={label}>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
                              <div className="flex flex-wrap gap-2">
                                {tags.sort((a, b) => (b.rating || 0) - (a.rating || 0)).map((tag, i) => (
                                  <span
                                    key={`${label}-${i}`}
                                    title={tag.rating ? `Rating: ${tag.rating}%` : undefined}
                                    className="rounded-full border border-stone-700 bg-stone-900/70 px-3 py-1 text-xs font-semibold text-stone-300 transition hover:border-stone-500 hover:text-white"
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                          {eroTags.length > 0 ? (
                            <div className="space-y-3">
                              <button
                                type="button"
                                onClick={() => setShowEroTags((v) => !v)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-rose-800/60 bg-rose-950/20 px-3 py-1 text-xs font-semibold text-rose-400/80 transition hover:border-rose-600 hover:text-rose-300"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {eroTags.length} sexual content tag{eroTags.length > 1 ? 's' : ''} - {showEroTags ? 'hide' : 'show'}
                              </button>
                              {showEroTags ? (
                                <div>
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-500/70">Sexual Content</p>
                                  <div className="flex flex-wrap gap-2">
                                    {eroTags.sort((a, b) => (b.rating || 0) - (a.rating || 0)).map((tag, i) => (
                                      <span
                                        key={`ero-${i}`}
                                        title={tag.rating ? `Rating: ${tag.rating}%` : undefined}
                                        className="rounded-full border border-rose-700/50 bg-rose-950/30 px-3 py-1 text-xs font-semibold text-rose-300/80"
                                      >
                                        {tag.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {spoilerTags.length > 0 ? (
                            <div>
                              <button
                                type="button"
                                onClick={() => setShowSpoilerTags((v) => !v)}
                                className="text-xs font-semibold uppercase tracking-wide text-stone-500 transition hover:text-stone-300"
                              >
                                {showSpoilerTags ? '▼' : '▶'} {spoilerTags.length} spoiler tag{spoilerTags.length > 1 ? 's' : ''} - {showSpoilerTags ? 'hide' : 'reveal'}
                              </button>
                              {showSpoilerTags ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {spoilerTags.sort((a, b) => (b.rating || 0) - (a.rating || 0)).map((tag, i) => (
                                    <span
                                      key={`spoiler-${i}`}
                                      title={tag.rating ? `Rating: ${tag.rating}%` : undefined}
                                      className="rounded-full border border-amber-700/50 bg-amber-950/30 px-3 py-1 text-xs font-semibold text-amber-300/80"
                                    >
                                      {tag.name}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      )
                    })() : (
                      <p className="text-sm text-stone-400">No tags available for this VN.</p>
                    )}
                  </div>
                ) : null}

                {activeTab === 'releases' ? (
                  <div>
                    {releasesLoading ? (
                      <p className="text-sm text-stone-400">Loading releases...</p>
                    ) : releases.length ? (
                      <div className="space-y-2">
                        {releases.map((release) => {
                          const ageLabel = release.minage === 18 ? '18+' : release.minage === 17 ? '17+' : release.minage === 15 ? '15+' : release.minage === 12 ? '12+' : 'All ages'
                          const ageColor = release.minage >= 18 ? 'border-rose-700/60 bg-rose-950/30 text-rose-300' : release.minage >= 15 ? 'border-amber-700/60 bg-amber-950/30 text-amber-300' : 'border-stone-700 bg-stone-900/50 text-stone-400'
                          const publishers = (release.producers || []).filter((p) => p.publisher).map((p) => p.name)
                          const developers = (release.producers || []).filter((p) => p.developer).map((p) => p.name)
                          const langs = (release.languages || []).map((l) => l.lang).join(', ')
                          return (
                            <div key={release.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-stone-800 bg-stone-950/50 px-4 py-3 text-sm">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-white">{release.title}</p>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-400">
                                  {release.released ? <span>{release.released}</span> : null}
                                  {langs ? <span>{langs.toUpperCase()}</span> : null}
                                  {release.platforms?.length ? <span>{release.platforms.join(', ')}</span> : null}
                                  {publishers.length ? <span>by {publishers.join(', ')}</span> : null}
                                  {developers.length > 0 && developers.join(',') !== publishers.join(',') ? <span>dev: {developers.join(', ')}</span> : null}
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-wrap gap-1.5">
                                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${ageColor}`}>{ageLabel}</span>
                                {release.freeware ? <span className="rounded-full border border-stone-500/50 bg-stone-900/50 px-2 py-0.5 text-xs font-semibold text-stone-200">Free</span> : null}
                                {release.patch ? <span className="rounded-full border border-blue-700/60 bg-blue-950/30 px-2 py-0.5 text-xs font-semibold text-blue-300">Patch</span> : null}
                                {release.official === false ? <span className="rounded-full border border-stone-600 bg-stone-900/60 px-2 py-0.5 text-xs font-semibold text-stone-400">Unofficial</span> : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-stone-400">No releases found for this VN.</p>
                    )}
                  </div>
                ) : null}

                {activeTab === 'quotes' ? (
                  <div>
                    {quotesLoading ? (
                      <p className="text-sm text-stone-400">Loading quotes...</p>
                    ) : quotes.length ? (
                      <div className="space-y-3">
                        {quotes.map((quote) => (
                          <article key={quote.id} className="rounded-lg border border-stone-800 bg-stone-950/40 p-4">
                            <p className="leading-7 text-stone-200">"{quote.quote}"</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-400">
                              {quote.character?.name ? <span>{quote.character.name}</span> : <span>Unknown character</span>}
                              <span>• Score {quote.score ?? 0}</span>
                              <a
                                href={`https://vndb.org/${quote.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-stone-700 px-2 py-0.5 font-semibold text-stone-300 transition hover:border-stone-500 hover:text-white"
                              >
                                VNDB
                              </a>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-stone-400">No quotes available for this VN on VNDB.</p>
                    )}
                  </div>
                ) : null}
              </div>
            </section>

            {related.length ? (
              <section className="border-t border-stone-800/80 pt-6">
                <h2 className="text-xl font-semibold text-white">Related</h2>
                <div className="mt-5 space-y-6">
                  {Object.entries(relatedGroups).map(([groupLabel, groupItems]) => (
                    <div key={groupLabel}>
                      <div className="mb-3 flex items-center justify-between border-b border-stone-800/70 pb-2">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-400">{groupLabel}</h3>
                        <span className="text-xs text-stone-500">{groupItems.length}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                        {groupItems.slice(0, 12).map((item, index) => (
                          <Link key={`${item.id || index}-${groupLabel}`} to={`/vn/${item.id}`} className="group block">
                            <div className="relative overflow-hidden rounded-lg border border-stone-800 bg-stone-950/70 transition group-hover:border-stone-600">
                              <img
                                src={relatedCovers[item.id] || `https://placehold.co/200x300/100f0e/d6d3d1?text=${encodeURIComponent(String(item.id || '?'))}`}
                                alt={item.title || item.id}
                                className="aspect-[2/3] w-full object-cover transition duration-200 group-hover:brightness-90"
                              />
                            </div>
                            <p className="mt-1.5 line-clamp-2 text-xs font-semibold text-white transition group-hover:text-stone-200">
                              {item.title || item.id}
                            </p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {(charsLoading || characters.length > 0) ? (
              <section className="border-t border-stone-800/80 pt-6">
                <h2 className="text-xl font-semibold text-white">Characters</h2>
                {charsLoading ? (
                  <p className="mt-3 text-sm text-stone-400">Loading characters...</p>
                ) : (
                  <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                    {characters.map((char) => {
                      const roleStyle =
                        char.vnRole === 'main' || char.vnRole === 'primary'
                          ? 'border-white/80 bg-black/72 text-stone-200'
                          : char.vnRole === 'side'
                            ? 'border-stone-200/70 bg-black/72 text-stone-100'
                            : 'border-stone-400/70 bg-black/72 text-stone-200'
                      const roleLabel =
                        char.vnRole === 'main' || char.vnRole === 'primary'
                          ? 'Main'
                          : char.vnRole === 'side'
                            ? 'Side'
                            : 'Appears'
                      return (
                        <Link key={char.id} to={`/character/${char.id}`} className="group block">
                          <div className="relative overflow-hidden rounded-lg">
                            <img
                              src={char.image || 'https://placehold.co/160x240/0f172a/94a3b8?text=?'}
                              alt={char.name}
                              className="aspect-[2/3] w-full object-cover transition duration-200 group-hover:brightness-75"
                            />
                            <span className={`absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide shadow-[0_6px_18px_rgba(0,0,0,0.65)] backdrop-blur-sm ${roleStyle}`}>
                              {roleLabel}
                            </span>
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-center text-xs font-semibold text-white transition group-hover:text-stone-200">
                            {char.name}
                          </p>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </section>
            ) : null}

            <section className="border-t border-stone-800/80 pt-6">
              <div className="mb-5 flex items-center gap-3">
                <h2 className="text-xl font-bold tracking-tight text-white">Reviews from this site</h2>
                {!reviewsLoading && reviews.length ? (
                  <span className="rounded-full bg-stone-800 px-2.5 py-0.5 text-xs font-semibold text-stone-300">{reviews.length}</span>
                ) : null}
              </div>

              {reviewsLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-stone-600">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-700 border-t-white" />
                  Loading reviews…
                </div>
              ) : reviews.length ? (
                <div className="space-y-3">
                  {reviews.map((review) => {
                    const reviewerName = review.user?.displayName || review.user?.username || 'Unknown user'
                    const avatarUrl = review.user?.avatarUrl ? `http://localhost:3000${review.user.avatarUrl}` : ''
                    const isOwner = Boolean(user && (String(review.user?.id || '') === String(user.id || '')))
                    const isEditing = editingReviewId === review.id
                    const menuOpen = reviewMenuOpen === review.id

                    return (
                      <article key={review.id} className="group relative rounded-xl border border-stone-800/60 bg-stone-950/50 p-4 transition hover:border-stone-700/60">
                        <div className="flex items-start gap-3">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={reviewerName} className="mt-0.5 h-9 w-9 shrink-0 rounded-full border border-stone-700/60 object-cover ring-1 ring-stone-700/30" />
                          ) : (
                            <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-stone-700 to-stone-800 text-xs font-bold text-stone-200 ring-1 ring-stone-700/50">
                              {reviewerName.charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link to={`/user/${review.user?.username}`} className="text-sm font-semibold text-stone-100 transition hover:text-stone-200">
                                {reviewerName}
                              </Link>
                              {review.rating ? <span className="text-rose-300">{renderStars(review.rating)}</span> : null}
                              {review.rating ? <span className="text-sm font-semibold text-rose-300/80">{review.rating}/10</span> : null}
                              <span className="text-xs text-stone-600">
                                {review.updatedAt ? new Date(review.updatedAt).toLocaleDateString() : ''}
                              </span>
                            </div>

                            {isEditing ? (
                              <div className="mt-3 space-y-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="flex items-center gap-1"
                                    onMouseLeave={() => setHoverEditRating(0)}
                                  >
                                    {[1, 2, 3, 4, 5].map((star) => {
                                      const display = hoverEditRating || editingReviewRating
                                      const leftValue = star * 2 - 1
                                      const rightValue = star * 2
                                      const fill = Math.max(0, Math.min(1, (display - (star - 1) * 2) / 2))
                                      return (
                                        <div key={`edit-star-${review.id}-${star}`} className="relative h-6 w-6 shrink-0">
                                          <Star className="absolute inset-0 h-6 w-6 fill-stone-800 text-stone-700" />
                                          {fill > 0 ? (
                                            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                                              <Star className="h-6 w-6 fill-rose-400 text-rose-400" />
                                            </div>
                                          ) : null}
                                          <button type="button" onClick={() => setEditingReviewRating(leftValue)} onMouseEnter={() => setHoverEditRating(leftValue)} disabled={editingActionLoading} className="absolute left-0 top-0 h-full w-1/2 cursor-pointer" aria-label={`${leftValue}/10`} />
                                          <button type="button" onClick={() => setEditingReviewRating(rightValue)} onMouseEnter={() => setHoverEditRating(rightValue)} disabled={editingActionLoading} className="absolute right-0 top-0 h-full w-1/2 cursor-pointer" aria-label={`${rightValue}/10`} />
                                        </div>
                                      )
                                    })}
                                  </div>
                                  {editingReviewRating > 0 ? (
                                    <button type="button" onClick={() => { setEditingReviewRating(0); setHoverEditRating(0) }} disabled={editingActionLoading} className="text-[11px] font-semibold text-stone-600 transition hover:text-rose-400">
                                      Clear
                                    </button>
                                  ) : null}
                                </div>

                                <textarea
                                  value={editingReviewText}
                                  onChange={(e) => setEditingReviewText(e.target.value)}
                                  rows={4}
                                  autoFocus
                                  className="w-full resize-none rounded-lg border border-stone-700 bg-stone-900/80 px-3 py-2 text-sm text-stone-200 outline-none transition focus:border-white/50 focus:ring-1 focus:ring-white/10"
                                />

                                <div className="flex items-center gap-3 text-sm">
                                  <button type="button" onClick={saveEditedReview} disabled={editingActionLoading} className="font-semibold text-stone-200 transition hover:text-stone-200 disabled:opacity-50">
                                    {editingActionLoading ? 'Saving…' : 'Save'}
                                  </button>
                                  <button type="button" onClick={cancelEditingReview} disabled={editingActionLoading} className="font-semibold text-stone-500 transition hover:text-stone-300">
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-1.5 leading-relaxed text-stone-300">{review.review}</p>
                            )}
                          </div>

                          {isOwner && !isEditing ? (
                            <div className="relative ml-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setReviewMenuOpen(menuOpen ? null : review.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-stone-600 opacity-0 transition hover:bg-stone-800 hover:text-stone-300 group-hover:opacity-100"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>

                              {menuOpen ? (
                                <div className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-xl border border-stone-700/70 bg-stone-900 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                                  <button
                                    type="button"
                                    onClick={() => startEditingReview(review)}
                                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-stone-300 transition hover:bg-stone-800 hover:text-white"
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-stone-500" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeReview(review.id)}
                                    disabled={editingActionLoading}
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
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-stone-800 px-4 py-8 text-center">
                  <p className="text-sm text-stone-600">No user reviews yet. Be the first to leave one from your list entry.</p>
                </div>
              )}
            </section>

            {aliases.length ? (
              <section className="border-t border-stone-800/80 pt-6">
                <h2 className="text-xl font-semibold text-white">Also known as</h2>
                <p className="mt-3 text-sm text-stone-400">{aliases.join(' • ')}</p>
              </section>
            ) : null}
          </div>
        </section>

        {vn.screenshots?.length > 0 ? (() => {
          const explicitCount = vn.screenshots.filter((s) => (s.sexual ?? 0) >= 2).length
          const violentCount = vn.screenshots.filter((s) => (s.violence ?? 0) >= 2).length
          return (
            <section className="mt-8">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold text-white">Screenshots</h2>
                {explicitCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => { setShowExplicitScreenshots((v) => !v); setLightboxIndex(null) }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-800/60 bg-rose-950/20 px-3 py-1 text-xs font-semibold text-rose-400/80 transition hover:border-rose-600 hover:text-rose-300"
                  >
                    {showExplicitScreenshots ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {explicitCount} explicit image{explicitCount > 1 ? 's' : ''} — {showExplicitScreenshots ? 'hide' : 'show'}
                  </button>
                ) : null}
                {violentCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => { setShowViolentScreenshots((v) => !v); setLightboxIndex(null) }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-800/60 bg-amber-950/20 px-3 py-1 text-xs font-semibold text-amber-400/90 transition hover:border-amber-600 hover:text-amber-300"
                  >
                    {showViolentScreenshots ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                    {violentCount} violent image{violentCount > 1 ? 's' : ''} — {showViolentScreenshots ? 'hide' : 'show'}
                  </button>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {visibleShots.map((shot, vi) => (
                  <button
                    key={shot.origIndex}
                    type="button"
                    onClick={() => setLightboxIndex(vi)}
                    className="group relative overflow-hidden rounded-lg border border-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <img
                      src={shot.url}
                      alt={`Screenshot ${vi + 1}`}
                      className="aspect-video w-full object-cover transition duration-200 group-hover:brightness-75"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-200 group-hover:opacity-100">
                      <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">View</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )
        })() : null}

      </div>

      {lightboxIndex !== null && visibleShots.length > 0 ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-5 top-5 z-10 rounded-full bg-black/50 p-2 text-xl leading-none text-white hover:bg-black/70"
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null) }}
          >
            <X className="h-5 w-5" />
          </button>
          {lightboxIndex > 0 ? (
            <button
              type="button"
              aria-label="Previous"
              className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 px-4 py-3 text-3xl leading-none text-white hover:bg-black/70"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1) }}
            >
              ‹
            </button>
          ) : null}
          {lightboxIndex < visibleShots.length - 1 ? (
            <button
              type="button"
              aria-label="Next"
              className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 px-4 py-3 text-3xl leading-none text-white hover:bg-black/70"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1) }}
            >
              ›
            </button>
          ) : null}
          <img
            src={visibleShots[lightboxIndex]?.url}
            alt={`Screenshot ${lightboxIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-stone-300 backdrop-blur-sm">
            {lightboxIndex + 1} / {visibleShots.length}
          </p>
        </div>
      ) : null}

      {coverLightboxIndex !== null && covers.length > 0 ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setCoverLightboxIndex(null)}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-5 top-5 z-10 rounded-full bg-black/50 p-2 text-xl leading-none text-white hover:bg-black/70"
            onClick={(e) => { e.stopPropagation(); setCoverLightboxIndex(null) }}
          >
            <X className="h-5 w-5" />
          </button>
          {coverLightboxIndex > 0 ? (
            <button
              type="button"
              aria-label="Previous"
              className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 px-4 py-3 text-3xl leading-none text-white hover:bg-black/70"
              onClick={(e) => { e.stopPropagation(); setCoverLightboxIndex(coverLightboxIndex - 1) }}
            >
              ‹
            </button>
          ) : null}
          {coverLightboxIndex < covers.length - 1 ? (
            <button
              type="button"
              aria-label="Next"
              className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 px-4 py-3 text-3xl leading-none text-white hover:bg-black/70"
              onClick={(e) => { e.stopPropagation(); setCoverLightboxIndex(coverLightboxIndex + 1) }}
            >
              ›
            </button>
          ) : null}
          <img
            src={covers[coverLightboxIndex]?.url}
            alt={formatCoverType(covers[coverLightboxIndex]?.type)}
            className="max-h-[88vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {user && token ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                markCoverAsPreferred(covers[coverLightboxIndex])
              }}
              disabled={savingCoverChoice}
              className="absolute bottom-14 left-1/2 -translate-x-1/2 rounded-md border border-white bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingCoverChoice ? 'Saving...' : 'Mark as cover'}
            </button>
          ) : null}
          <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-stone-300 backdrop-blur-sm">
            {coverLightboxIndex + 1} / {covers.length}
          </p>
        </div>
      ) : null}

      {recommendOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={() => setRecommendOpen(false)}>
          <div className="w-full max-w-2xl rounded-xl border border-stone-800 bg-stone-950 p-5 shadow-2xl shadow-black/60" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Recommend this VN</h2>
                <p className="mt-1 text-sm text-stone-400">Pick one or more people you follow to send them a recommendation.</p>
              </div>
              <button
                type="button"
                aria-label="Close recommend dialog"
                onClick={() => setRecommendOpen(false)}
                className="rounded-full border border-stone-700 p-2 text-stone-400 transition hover:border-stone-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              type="text"
              value={recommendQuery}
              onChange={(e) => setRecommendQuery(e.target.value)}
              placeholder="Search by username or display name"
              className="mt-4 w-full rounded-md border border-stone-700 bg-stone-900/70 px-3 py-2 text-sm text-stone-200 outline-none transition focus:border-white/60"
            />

            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {followingLoading ? (
                <p className="text-sm text-stone-400">Loading followed users...</p>
              ) : filteredFollowingOptions.length ? (
                filteredFollowingOptions.map((member) => {
                  const selected = selectedRecipients.includes(member.username)
                  const avatarUrl = member.avatarUrl ? `http://localhost:3000${member.avatarUrl}` : ''
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleRecipient(member.username)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                        selected
                          ? 'border-white/60 bg-white/5 text-white'
                          : 'border-stone-800 bg-stone-900/50 text-stone-300 hover:border-stone-600'
                      }`}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={member.displayName || member.username} className="h-10 w-10 rounded-full border border-stone-700 object-cover" />
                      ) : (
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-700 bg-stone-950 text-sm font-bold text-stone-200">
                          {(member.displayName || member.username || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{member.displayName || member.username}</p>
                        <p className="truncate text-xs text-stone-400">@{member.username}</p>
                      </div>
                      <div className={`h-4 w-4 rounded-full border ${selected ? 'border-white bg-white' : 'border-stone-600'}`} />
                    </button>
                  )
                })
              ) : (
                <p className="text-sm text-stone-400">{followingOptions.length ? 'No followed users match that search.' : 'You are not following anyone yet.'}</p>
              )}
            </div>

            {selectedRecipients.length ? (
              <p className="mt-3 text-sm text-stone-400">Selected: {selectedRecipients.join(', ')}</p>
            ) : null}
            {recommendMessage ? <p className="mt-3 text-sm text-stone-300">{recommendMessage}</p> : null}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRecommendOpen(false)}
                className="rounded-md border border-stone-700 px-3 py-2 text-sm font-semibold text-stone-300 transition hover:border-stone-500 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendRecommendations}
                disabled={recommendSending || !selectedRecipients.length}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/60 bg-white px-3 py-2 text-sm font-semibold text-stone-950 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {recommendSending ? 'Sending...' : 'Send recommendation'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {customListOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={() => setCustomListOpen(false)}>
          <div className="w-full max-w-3xl rounded-xl border border-stone-800 bg-stone-950 p-5 shadow-2xl shadow-black/60" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Add to custom list</h2>
                <p className="mt-1 text-sm text-stone-400">Pick one of your lists or create a new one here.</p>
              </div>
              <button
                type="button"
                aria-label="Close custom list dialog"
                onClick={() => setCustomListOpen(false)}
                className="rounded-full border border-stone-700 p-2 text-stone-400 transition hover:border-stone-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
              <form onSubmit={createListFromModal} className="space-y-3 rounded-xl border border-stone-800 bg-stone-900/40 p-4">
                <h3 className="text-sm font-semibold text-white">Create list</h3>
                <input
                  type="text"
                  value={createListForm.name}
                  onChange={(e) => setCreateListForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="List name"
                  maxLength={90}
                  required
                  className="h-10 w-full rounded-md border border-stone-700 bg-stone-950 px-3 text-sm text-stone-200 outline-none transition focus:border-white/60"
                />
                <textarea
                  value={createListForm.description}
                  onChange={(e) => setCreateListForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Description"
                  maxLength={1200}
                  rows={3}
                  className="w-full rounded-md border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-200 outline-none transition focus:border-white/60"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={createListForm.type}
                    onChange={(e) => setCreateListForm((prev) => ({ ...prev, type: e.target.value }))}
                    className="h-10 rounded-md border border-stone-700 bg-stone-950 px-3 text-sm text-stone-200 outline-none focus:border-white/60"
                  >
                    <option value="normal">Normal</option>
                    <option value="ranking">Ranking</option>
                  </select>
                  <select
                    value={createListForm.visibility}
                    onChange={(e) => setCreateListForm((prev) => ({ ...prev, visibility: e.target.value }))}
                    className="h-10 rounded-md border border-stone-700 bg-stone-950 px-3 text-sm text-stone-200 outline-none focus:border-white/60"
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="unlisted">Unlisted</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={createListBusy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/60 bg-white px-3 py-2 text-sm font-semibold text-stone-950 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ListPlus className="h-4 w-4" />
                  {createListBusy ? 'Creating...' : 'Create list'}
                </button>
              </form>

              <div className="rounded-xl border border-stone-800 bg-stone-900/40 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">Your custom lists</h3>
                  <button
                    type="button"
                    onClick={fetchMyCustomLists}
                    className="text-xs font-semibold text-stone-400 transition hover:text-white"
                  >
                    Refresh
                  </button>
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {customListsLoading ? (
                    <p className="text-sm text-stone-400">Loading your lists...</p>
                  ) : customLists.length ? (
                    customLists.map((list) => (
                      <div key={list.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-800 bg-stone-950/70 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{list.name}</p>
                          <p className="text-xs text-stone-500">{list.type} · {list.visibility} · {list.itemCount} VNs</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addVnToCustomList(list.id)}
                          disabled={customListAddingId === String(list.id)}
                          className="rounded-md border border-sky-400/70 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-200 transition hover:border-sky-300 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {customListAddingId === String(list.id) ? 'Adding...' : 'Add VN'}
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-stone-400">No custom lists yet.</p>
                  )}
                </div>
              </div>
            </div>

            {customListMessage ? <p className="mt-4 text-sm text-stone-300">{customListMessage}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default VNDetail
