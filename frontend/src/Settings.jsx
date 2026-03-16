import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import SiteHeader from './components/SiteHeader'

const VNDB_IMPORT_STATUS_MAP = {
  playing: 'playing',
  reading: 'playing',
  finished: 'completed',
  completed: 'completed',
  read: 'completed',
  stalled: 'on-hold',
  'on hold': 'on-hold',
  hold: 'on-hold',
  dropped: 'dropped',
  'did not finish': 'dropped',
  wishlist: 'want-to-play',
  wished: 'want-to-play',
  'plan to read': 'want-to-play',
  'plan to play': 'want-to-play'
}

function normalizeImportLabel(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function resolveImportStatus(labels) {
  const resolved = labels
    .map((label) => VNDB_IMPORT_STATUS_MAP[normalizeImportLabel(label)] || '')
    .filter(Boolean)

  if (resolved.includes('playing')) return 'playing'
  if (resolved.includes('completed')) return 'completed'
  if (resolved.includes('on-hold')) return 'on-hold'
  if (resolved.includes('dropped')) return 'dropped'
  if (resolved.includes('want-to-play')) return 'want-to-play'
  return ''
}

function parseVndbXmlExport(xmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')
  const parserError = doc.querySelector('parsererror')

  if (parserError) {
    throw new Error('Could not parse the VNDB XML file.')
  }

  const vnNodes = Array.from(doc.getElementsByTagName('vn'))
  const deduped = new Map()
  let skipped = 0

  vnNodes.forEach((node) => {
    const vnId = String(node.getAttribute('id') || '').trim()
    const title = String(node.getElementsByTagName('title')[0]?.textContent || '').trim()
    const labels = Array.from(node.getElementsByTagName('label')).map((labelNode) => String(labelNode.getAttribute('label') || labelNode.textContent || '').trim())
    const status = resolveImportStatus(labels)

    if (!vnId || !title || !status) {
      skipped += 1
      return
    }

    const voteValue = Number(node.getElementsByTagName('vote')[0]?.textContent || '')
    deduped.set(vnId, {
      vnId,
      title,
      status,
      rating: Number.isFinite(voteValue) && voteValue > 0 ? voteValue : null
    })
  })

  return { entries: [...deduped.values()], skipped }
}

function Settings() {
  const { user, token, updateUser, logout } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [clearingVnData, setClearingVnData] = useState(false)
  const [importingLogs, setImportingLogs] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const importInputRef = useRef(null)
  const vnSearchRef = useRef(null)
  const vnSearchDebounceRef = useRef(null)

  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    preferences: {
      profileVisibility: 'public',
      compactMode: false
    }
  })

  const [favoriteVNs, setFavoriteVNs] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [favoriteCharacters, setFavoriteCharacters] = useState([])
  const [charSearchQuery, setCharSearchQuery] = useState('')
  const [charSearchResults, setCharSearchResults] = useState([])
  const [charSearching, setCharSearching] = useState(false)

  useEffect(() => {
    if (!user || !token) {
      setLoading(false)
      return
    }

    const fetchSettings = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch('http://localhost:3000/api/users/me/settings', {
          headers: { Authorization: `Bearer ${token}` }
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load settings')

        setForm({
          displayName: data.user?.displayName || user.username,
          bio: data.settings?.bio || '',
          preferences: {
            profileVisibility: data.settings?.preferences?.profileVisibility || 'public',
            compactMode: Boolean(data.settings?.preferences?.compactMode)
          }
        })
        setFavoriteVNs(data.settings?.favoriteVNs || [])
        setFavoriteCharacters(data.settings?.favoriteCharacters || [])
        const nextUser = {
          avatarUrl: data.user?.avatarUrl || '',
          displayName: data.user?.displayName || '',
          email: data.user?.email || user.email,
          username: data.user?.username || user.username,
          id: data.user?.id || user.id
        }

        if (
          nextUser.avatarUrl !== (user.avatarUrl || '') ||
          nextUser.displayName !== (user.displayName || '') ||
          nextUser.email !== user.email ||
          nextUser.username !== user.username ||
          nextUser.id !== user.id
        ) {
          updateUser(nextUser)
        }
      } catch (err) {
        setError(err.message)
      }
      setLoading(false)
    }

    fetchSettings()
  }, [token, user?.id])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (vnSearchRef.current && !vnSearchRef.current.contains(event.target)) {
        setSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (vnSearchDebounceRef.current) clearTimeout(vnSearchDebounceRef.current)

    const term = searchQuery.trim()
    if (!term) {
      setSearchResults([])
      setSearchOpen(false)
      setSearching(false)
      return
    }

    vnSearchDebounceRef.current = setTimeout(() => {
      searchVN(term)
    }, 300)

    return () => {
      if (vnSearchDebounceRef.current) clearTimeout(vnSearchDebounceRef.current)
    }
  }, [searchQuery])

  const favoriteIds = useMemo(() => new Set(favoriteVNs.map((item) => String(item.vnId))), [favoriteVNs])
  const favoriteCharIds = useMemo(() => new Set(favoriteCharacters.map((item) => String(item.charId))), [favoriteCharacters])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!token) return

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('http://localhost:3000/api/users/me/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName: form.displayName,
          bio: form.bio,
          favoriteVNs,
          favoriteCharacters,
          preferences: form.preferences
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save settings')

      updateUser({
        displayName: data.user?.displayName || '',
        avatarUrl: data.user?.avatarUrl || '',
        username: data.user?.username || user.username,
        email: data.user?.email || user.email,
        id: data.user?.id || user.id
      })
      setMessage('Settings saved successfully.')
    } catch (err) {
      setError(err.message)
    }

    setSaving(false)
  }

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !token) return

    setUploading(true)
    setError('')
    setMessage('')

    try {
      const body = new FormData()
      body.append('avatar', file)

      const response = await fetch('http://localhost:3000/api/users/me/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not upload avatar')

      updateUser({
        avatarUrl: data.avatarUrl || '',
        displayName: data.user?.displayName || user.displayName || '',
        username: data.user?.username || user.username,
        email: data.user?.email || user.email,
        id: data.user?.id || user.id
      })

      setMessage('Profile photo updated.')
    } catch (err) {
      setError(err.message)
    }

    event.target.value = ''
    setUploading(false)
  }

  const searchVN = async (termOverride = '') => {
    const term = String(termOverride || searchQuery).trim()
    if (!term) return

    setSearching(true)
    setError('')

    try {
      const response = await fetch('http://localhost:3000/api/vn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: ['search', '=', term],
          fields: 'id,title,image.url,rating',
          results: 8
        })
      })

      const data = await response.json()
      const nextResults = Array.isArray(data.results) ? data.results : []
      setSearchResults(nextResults)
      setSearchOpen(true)
    } catch (err) {
      setError('Failed to search visual novels')
      setSearchResults([])
      setSearchOpen(false)
    }

    setSearching(false)
  }

  const addFavorite = (vn) => {
    const id = String(vn.id)
    if (favoriteIds.has(id) || favoriteVNs.length >= 4) return

    setFavoriteVNs((prev) => [
      ...prev,
      {
        vnId: id,
        title: vn.title,
        image: vn.image?.url || ''
      }
    ])
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
  }

  const removeFavorite = (vnId) => {
    setFavoriteVNs((prev) => prev.filter((item) => String(item.vnId) !== String(vnId)))
  }

  const searchChar = async () => {
    if (!charSearchQuery.trim()) return
    setCharSearching(true)
    setError('')
    try {
      const response = await fetch('http://localhost:3000/api/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: ['search', '=', charSearchQuery],
          fields: 'id,name,image.url',
          results: 12
        })
      })
      const data = await response.json()
      setCharSearchResults(data.results || [])
    } catch (_err) {
      setError('Failed to search characters')
    }
    setCharSearching(false)
  }

  const addFavoriteChar = (char) => {
    const id = String(char.id)
    if (favoriteCharIds.has(id) || favoriteCharacters.length >= 4) return
    setFavoriteCharacters((prev) => [
      ...prev,
      { charId: id, name: char.name, image: char.image?.url || '' }
    ])
  }

  const removeFavoriteChar = (charId) => {
    setFavoriteCharacters((prev) => prev.filter((item) => String(item.charId) !== String(charId)))
  }

  const clearVnData = async () => {
    if (!token || clearingVnData) return

    const confirmed = confirm(
      'This will permanently delete your VN logs, VN reviews, favorite visual novels, and favorite characters. It will not delete your name, avatar, bio, or preferences. Continue?'
    )

    if (!confirmed) return

    setClearingVnData(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('http://localhost:3000/api/users/me/vn-data', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not clear VN data')

      setFavoriteVNs([])
      setFavoriteCharacters([])
      setSearchResults([])
      setSearchQuery('')
      setCharSearchResults([])
      setCharSearchQuery('')
      setMessage(
        `Removed ${Number(data.removed?.logs || 0)} logs, ${Number(data.removed?.reviews || 0)} reviews, ${Number(data.removed?.favoriteVNs || 0)} favorite visual novels, and ${Number(data.removed?.favoriteCharacters || 0)} favorite characters.`
      )
    } catch (err) {
      setError(err.message)
    }

    setClearingVnData(false)
  }

  const enrichImportedEntries = async (entries) => {
    const results = []
    const chunkSize = 6

    for (let index = 0; index < entries.length; index += chunkSize) {
      const chunk = entries.slice(index, index + chunkSize)
      const chunkResults = await Promise.all(
        chunk.map(async (entry) => {
          try {
            const response = await fetch(`http://localhost:3000/api/vn/${entry.vnId}`)
            if (!response.ok) throw new Error('Metadata unavailable')
            const data = await response.json()
            return {
              ...entry,
              title: data.title || entry.title,
              image: data.image?.url || ''
            }
          } catch (_error) {
            return { ...entry, image: '' }
          }
        })
      )

      results.push(...chunkResults)
    }

    return results
  }

  const importVndbXmlFile = async (file) => {
    if (!file || !token) {
      setError('Sign in before importing VNDB data.')
      return
    }

    setImportingLogs(true)
    setError('')
    setMessage('')

    try {
      const text = await file.text()
      const { entries, skipped } = parseVndbXmlExport(text)

      if (!entries.length) {
        throw new Error('No supported VN entries were found in that XML export.')
      }

      const enrichedEntries = await enrichImportedEntries(entries)
      const chunkSize = 6
      let importedCount = 0

      for (let index = 0; index < enrichedEntries.length; index += chunkSize) {
        const chunk = enrichedEntries.slice(index, index + chunkSize)
        const responses = await Promise.all(
          chunk.map(async (entry) => {
            const response = await fetch('http://localhost:3000/api/logs', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                vnId: entry.vnId,
                title: entry.title,
                image: entry.image || '',
                status: entry.status,
                rating: entry.rating,
                review: '',
                silent: true
              })
            })

            if (!response.ok) {
              const data = await response.json().catch(() => ({}))
              throw new Error(data.error || `Could not import ${entry.title}`)
            }
            return true
          })
        )

        importedCount += responses.length
      }

      setMessage(`Imported ${importedCount} VNDB entries.${skipped ? ` Skipped ${skipped} unsupported entries.` : ''}`)
      navigate('/mylist')
    } catch (err) {
      setError(err.message || 'Could not import VNDB XML.')
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = ''
      }
      setImportingLogs(false)
    }
  }

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    await importVndbXmlFile(file)
  }

  if (!user) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="panel max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold text-white">Sign in required</h2>
          <p className="mt-2 text-stone-400">You need an active session to open settings.</p>
          <Link to="/" className="btn-primary mt-6 text-stone-950">Go to home</Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="panel p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-stone-600 border-t-white" />
          <p className="text-stone-300">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <SiteHeader user={user} token={token} onLogout={logout} listsHref="/profile/lists" showSearch={false} />

      <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="top-brand text-3xl">Settings</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="btn-secondary"
            >
              Back to profile
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <section className="panel p-6">
            <h2 className="text-xl font-semibold text-white">Profile photo</h2>
            <p className="mt-1 text-sm text-stone-400">Upload a square image (max 2MB).</p>
            <div className="mt-4 flex items-center gap-4">
              <img
                src={user.avatarUrl ? `http://localhost:3000${user.avatarUrl}` : 'https://placehold.co/96x96/100f0e/d6d3d1?text=VN'}
                alt="Avatar"
                className="h-24 w-24 rounded-full border border-stone-700 object-cover"
              />
              <label className="btn-secondary cursor-pointer">
                {uploading ? 'Uploading...' : 'Upload image'}
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploading} />
              </label>
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="text-xl font-semibold text-white">Basic profile</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">Display name</label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                  className="field-input"
                  maxLength={60}
                />
              </div>

              <div>
                <label className="field-label">Profile visibility</label>
                <select
                  value={form.preferences.profileVisibility}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    preferences: { ...prev.preferences, profileVisibility: e.target.value }
                  }))}
                  className="field-input"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="field-label">Bio</label>
              <textarea
                rows={4}
                value={form.bio}
                onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
                className="field-input"
                maxLength={240}
                placeholder="Tell others about yourself"
              />
            </div>

            <label className="mt-4 inline-flex items-center gap-2 text-sm text-stone-300">
              <input
                type="checkbox"
                checked={form.preferences.compactMode}
                onChange={(e) => setForm((prev) => ({
                  ...prev,
                  preferences: { ...prev.preferences, compactMode: e.target.checked }
                }))}
              />
              Enable compact profile cards
            </label>
          </section>

          <section className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">4 Favorite visual novels</h2>
                <p className="mt-1 text-sm text-stone-400">Search and pick up to 4 titles.</p>
              </div>
              <p className="text-sm text-stone-300">{favoriteVNs.length}/4 selected</p>
            </div>

            <div ref={vnSearchRef} className="relative mt-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim() && searchResults.length && setSearchOpen(true)}
                placeholder="Search VN for favorites..."
                className="field-input"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchOpen(false)
                    e.currentTarget.blur()
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (searchResults.length > 0) addFavorite(searchResults[0])
                  }
                }}
              />

              {searchOpen && (searching || searchResults.length > 0) ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-stone-700 bg-stone-950 shadow-2xl shadow-black/70">
                  {searching ? (
                    <p className="px-4 py-3 text-sm text-stone-500">Searching...</p>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      {searchResults.map((vn) => {
                        const id = String(vn.id)
                        const selected = favoriteIds.has(id)
                        const disabled = selected || favoriteVNs.length >= 4
                        return (
                          <button
                            key={vn.id}
                            type="button"
                            onClick={() => addFavorite(vn)}
                            disabled={disabled}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-stone-800/80 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <img
                              src={vn.image?.url || 'https://placehold.co/32x48/100f0e/d6d3d1?text=VN'}
                              alt={vn.title}
                              className="h-12 w-8 flex-shrink-0 rounded object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-white">{vn.title}</p>
                              {vn.rating ? <p className="text-xs text-amber-400">{(vn.rating / 10).toFixed(1)} / 10</p> : <p className="text-xs text-stone-600">No rating</p>}
                            </div>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${selected ? 'border-white/40 text-stone-200' : 'border-stone-700 text-stone-400'}`}>
                              {selected ? 'Selected' : 'Add'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => {
                const favorite = favoriteVNs[index]

                return (
                  <div key={`favorite-slot-${index}`} className="rounded-lg border border-stone-700 bg-stone-950/50 p-2">
                    {favorite ? (
                      <>
                        <img
                          src={favorite.image || 'https://placehold.co/180x260/100f0e/d6d3d1?text=VN'}
                          alt={favorite.title}
                          className="aspect-[2/3] w-full rounded-md object-cover"
                        />
                        <p className="mt-2 line-clamp-2 text-xs font-semibold text-stone-200">{favorite.title}</p>
                        <button
                          type="button"
                          onClick={() => removeFavorite(favorite.vnId)}
                          className="mt-2 w-full rounded-md border border-rose-500/50 px-2 py-1 text-xs font-semibold text-rose-300 transition hover:border-rose-400 hover:text-rose-200"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <div className="flex aspect-[2/3] items-center justify-center rounded-md border border-dashed border-stone-700 text-4xl text-stone-600">+</div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">4 Favorite characters</h2>
                <p className="mt-1 text-sm text-stone-400">Search and pick up to 4 characters.</p>
              </div>
              <p className="text-sm text-stone-300">{favoriteCharacters.length}/4 selected</p>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={charSearchQuery}
                onChange={(e) => setCharSearchQuery(e.target.value)}
                placeholder="Search characters..."
                className="field-input sm:flex-1"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchChar())}
              />
              <button type="button" onClick={searchChar} disabled={charSearching} className="btn-primary min-w-28 text-stone-950">
                {charSearching ? 'Searching...' : 'Search'}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {charSearchResults.map((char) => {
                const cid = String(char.id)
                const selected = favoriteCharIds.has(cid)
                const disabled = selected || favoriteCharacters.length >= 4
                return (
                  <div key={char.id} className="rounded-lg border border-stone-700 bg-stone-900/70 p-2">
                    <img
                      src={char.image?.url || 'https://placehold.co/180x260/0f172a/94a3b8?text=?'}
                      alt={char.name}
                      className="aspect-[2/3] w-full rounded-md object-cover"
                    />
                    <p className="mt-2 line-clamp-2 text-xs font-semibold text-stone-200">{char.name}</p>
                    <button
                      type="button"
                      onClick={() => addFavoriteChar(char)}
                      disabled={disabled}
                      className="mt-2 w-full rounded-md border border-stone-700 px-2 py-1 text-xs font-semibold text-stone-200 transition hover:border-white/60 hover:text-stone-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {selected ? 'Selected' : 'Add to favorites'}
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => {
                const fav = favoriteCharacters[index]
                return (
                  <div key={`char-slot-${index}`} className="rounded-lg border border-stone-700 bg-stone-950/50 p-2">
                    {fav ? (
                      <>
                        <img
                          src={fav.image || 'https://placehold.co/180x260/0f172a/94a3b8?text=?'}
                          alt={fav.name}
                          className="aspect-[2/3] w-full rounded-md object-cover"
                        />
                        <p className="mt-2 line-clamp-2 text-xs font-semibold text-stone-200">{fav.name}</p>
                        <button
                          type="button"
                          onClick={() => removeFavoriteChar(fav.charId)}
                          className="mt-2 w-full rounded-md border border-rose-500/50 px-2 py-1 text-xs font-semibold text-rose-300 transition hover:border-rose-400 hover:text-rose-200"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <div className="flex aspect-[2/3] items-center justify-center rounded-md border border-dashed border-stone-700 text-4xl text-stone-600">+</div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="text-xl font-semibold text-white">Quick actions</h2>
            <p className="mt-1 text-sm text-stone-400">Useful actions available from your profile options menu.</p>
            <div className="mt-4 grid gap-2 text-sm text-stone-300 md:grid-cols-2">
              <p>Copy profile link</p>
              <p>Export list as JSON</p>
              <p>Quick privacy toggle</p>
              <p>Open activity and library tabs</p>
            </div>

            <input
              ref={importInputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              onChange={handleImportFileChange}
              className="hidden"
            />

            <div className="mt-6 rounded-2xl border border-white/12 bg-stone-900/40 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Import VNDB XML</h3>
                  <p className="mt-1 text-sm text-stone-300">
                    Import your VNDB export file into this account using the same status and vote data from the XML.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  disabled={importingLogs}
                  className="btn-primary min-w-44 text-stone-950"
                >
                  {importingLogs ? 'Importing...' : 'Import VNDB XML'}
                </button>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-950/20 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Clear VN data</h3>
                  <p className="mt-1 text-sm text-stone-300">
                    Deletes your VN logs, VN reviews, favorite visual novels, and favorite characters so you can re-import into a clean library.
                  </p>
                  <p className="mt-1 text-xs text-stone-400">
                    Your username, avatar, bio, and preferences stay unchanged.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearVnData}
                  disabled={clearingVnData}
                  className="btn-danger min-w-44"
                >
                  {clearingVnData ? 'Clearing...' : 'Delete my VN data'}
                </button>
              </div>
            </div>
          </section>

          {(message || error) && (
            <div className={`rounded-lg border p-3 text-sm ${error ? 'border-rose-500/50 bg-rose-950/30 text-rose-200' : 'border-white/35 bg-stone-900/50 text-stone-200'}`}>
              {error || message}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary text-stone-950">
              {saving ? 'Saving...' : 'Save settings'}
            </button>
            <Link to="/profile" className="btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Settings
