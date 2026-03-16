import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Check, Grip, ListPlus, Plus, Search, X } from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import SiteHeader from './components/SiteHeader'

async function readApiResponse(response, fallbackMessage) {
  const raw = await response.text()
  let data = null

  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch (_error) {
      throw new Error(fallbackMessage)
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || fallbackMessage)
  }

  return data || {}
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-950/45 px-6 py-16 text-center">
      <p className="text-3xl font-semibold text-white">Your list is empty.</p>
      <p className="mt-3 text-sm text-stone-400">Add visual novels using the search field above, or from any VN page.</p>
    </div>
  )
}

function rankAccent(index) {
  if (index === 0) {
    return {
      card: 'border-yellow-300/24 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.09),transparent_28%),rgba(16,15,14,0.92)] shadow-[0_0_0_1px_rgba(250,204,21,0.08),0_12px_28px_rgba(250,204,21,0.06)]',
      badge: 'border-yellow-200/90 bg-yellow-300 text-stone-950 shadow-[0_6px_18px_rgba(250,204,21,0.20)]',
      pill: 'border-yellow-300/40 bg-yellow-300/14 text-yellow-100'
    }
  }

  if (index === 1) {
    return {
      card: 'border-stone-300/18 bg-[radial-gradient(circle_at_top_left,rgba(214,211,209,0.07),transparent_28%),rgba(16,15,14,0.92)] shadow-[0_0_0_1px_rgba(214,211,209,0.05),0_12px_28px_rgba(168,162,158,0.06)]',
      badge: 'border-stone-100/90 bg-stone-200 text-stone-950 shadow-[0_6px_18px_rgba(226,232,240,0.16)]',
      pill: 'border-stone-300/30 bg-stone-200/10 text-stone-100'
    }
  }

  if (index === 2) {
    return {
      card: 'border-amber-600/24 bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.08),transparent_28%),rgba(16,15,14,0.92)] shadow-[0_0_0_1px_rgba(217,119,6,0.08),0_12px_28px_rgba(180,83,9,0.06)]',
      badge: 'border-amber-500/90 bg-amber-600 text-white shadow-[0_6px_18px_rgba(217,119,6,0.20)]',
      pill: 'border-amber-600/35 bg-amber-600/10 text-amber-100'
    }
  }

  return {
    card: 'border-stone-800 bg-stone-950/80',
    badge: 'border-stone-700 bg-stone-900 text-stone-200 shadow-none',
    pill: 'border-stone-800 bg-stone-900 text-stone-400'
  }
}

function ListCreatePage() {
  const navigate = useNavigate()
  const { user, token, logout } = useAuth()
  const [form, setForm] = useState({
    name: '',
    description: '',
    visibility: 'public',
    type: 'normal'
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [items, setItems] = useState([])
  const [sortMode, setSortMode] = useState('manual')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      return
    }

    const id = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch('http://localhost:3000/api/vn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filters: ['search', '=', searchTerm.trim()],
            fields: 'title,image.url,rating',
            results: 10
          })
        })
        const data = await res.json()
        setSearchResults(Array.isArray(data.results) ? data.results : [])
      } catch (_error) {
        setSearchResults([])
      }
      setSearchLoading(false)
    }, 280)

    return () => clearTimeout(id)
  }, [searchTerm])

  const addResultToDraft = (vn) => {
    const vnId = String(vn.id || '').trim()
    if (!vnId) return
    if (items.some((item) => item.vnId === vnId)) {
      setMessage('This VN is already in the list.')
      return
    }

    setItems((prev) => ([
      ...prev,
      {
        vnId,
        title: vn.title,
        image: vn.image?.url || '',
        rankScore: '',
        notes: ''
      }
    ]))
    setSearchTerm('')
    setSearchResults([])
    setMessage('')
  }

  const updateItem = (vnId, patch) => {
    setItems((prev) => prev.map((item) => item.vnId === vnId ? { ...item, ...patch } : item))
  }

  const removeItem = (vnId) => {
    setItems((prev) => prev.filter((item) => item.vnId !== vnId))
  }

  const moveItem = (vnId, direction) => {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.vnId === vnId)
      if (index < 0) return prev
      const nextIndex = direction === 'up' ? index - 1 : index + 1
      if (nextIndex < 0 || nextIndex >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      next.splice(nextIndex, 0, moved)
      return next
    })
  }

  const sortedPreviewItems = useMemo(() => {
    const next = [...items]
    if (sortMode === 'title') {
      next.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')))
    }
    return next
  }, [items, sortMode])

  const saveList = async () => {
    if (!token) return
    const name = form.name.trim()
    if (!name) {
      setMessage('List name is required.')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const createResponse = await fetch('http://localhost:3000/api/lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          description: form.description,
          visibility: form.visibility,
          type: form.type
        })
      })
      const createData = await readApiResponse(createResponse, 'Could not create list')

      const listId = createData.list?.id
      if (!listId) throw new Error('List created without id')

      for (const item of items) {
        const body = {
          vnId: item.vnId,
          title: item.title,
          image: item.image,
          notes: item.notes
        }
        if (form.type === 'ranking' && item.rankScore !== '') {
          body.rankScore = Number(item.rankScore)
        }

        const itemResponse = await fetch(`http://localhost:3000/api/lists/${listId}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(body)
        })
        await readApiResponse(itemResponse, `Could not add ${item.title}`)
      }

      navigate(`/lists/${listId}`)
    } catch (error) {
      setMessage(error.message || 'Could not save list')
      setSaving(false)
      return
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <SiteHeader user={user} token={token} onLogout={logout} listsHref="/lists/explore" createListHref="/lists/new" />

      <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-6 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-light tracking-tight text-white">New List</h1>
            <p className="mt-2 text-sm text-stone-400">Build a VN list with a cleaner, more editorial layout.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/lists/explore" className="rounded-xl border border-stone-700 bg-stone-900/60 px-4 py-2.5 text-sm font-semibold text-stone-200 transition hover:border-stone-500 hover:text-white">Cancel</Link>
            <button onClick={saveList} disabled={saving} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving...' : 'Save list'}</button>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
              <div className="rounded-2xl border border-stone-800 bg-stone-950/50 p-5">
                <label className="mb-2 block text-sm font-semibold text-white">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-stone-700 bg-stone-900 px-3 text-sm text-stone-100 outline-none transition focus:border-white/60"
                />

                <div className="mt-6">
                  <label className="mb-2 block text-sm font-semibold text-white">Who can view</label>
                  <select
                    value={form.visibility}
                    onChange={(e) => setForm((prev) => ({ ...prev, visibility: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-stone-700 bg-stone-900 px-3 text-sm text-stone-200 outline-none transition focus:border-white/60"
                  >
                    <option value="public">Anyone — Public list</option>
                    <option value="unlisted">Anyone with link — Unlisted</option>
                    <option value="private">Only you — Private list</option>
                  </select>
                </div>

                <label className="mt-6 flex items-center gap-3 rounded-xl border border-stone-800 bg-stone-900/65 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.type === 'ranking'}
                    onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.checked ? 'ranking' : 'normal' }))}
                    className="h-5 w-5 rounded border-stone-600 bg-stone-950 text-stone-200 focus:ring-white/30"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">Ranked list</p>
                    <p className="text-xs text-stone-500">Show a fixed position number for every VN.</p>
                  </div>
                </label>
              </div>

              <div className="rounded-2xl border border-stone-800 bg-stone-950/50 p-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="block text-sm font-semibold text-white">Description</label>
                  <span className="text-xs text-stone-600">Editorial intro for your list</span>
                </div>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={10}
                  className="w-full rounded-xl border border-stone-700 bg-stone-900 px-3 py-3 text-sm text-stone-100 outline-none transition focus:border-white/60"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-stone-800 bg-stone-950/50 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-xl border border-white/35 bg-white/5 px-3 py-2 text-sm font-semibold text-stone-200">
                  <Plus className="mr-2 h-4 w-4" /> Add a VN
                </div>
                <div className="relative min-w-[280px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Enter name of VN..."
                    className="h-11 w-full rounded-xl border border-stone-700 bg-stone-900 pl-10 pr-4 text-sm text-stone-100 outline-none transition focus:border-white/60"
                  />
                </div>
                <div className="ml-auto inline-flex items-center gap-2 text-xs text-stone-500">
                  <span>Sort by</span>
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value)}
                    className="h-10 rounded-xl border border-stone-700 bg-stone-900 px-3 text-xs text-stone-200 outline-none focus:border-white/60"
                  >
                    <option value="manual">Manual</option>
                    <option value="title">Title</option>
                  </select>
                </div>
              </div>

              {(searchLoading || searchResults.length > 0) ? (
                <div className="mt-4 grid gap-2 rounded-2xl border border-stone-800 bg-black/30 p-3">
                  {searchLoading ? (
                    <p className="text-sm text-stone-400">Searching VNs...</p>
                  ) : (
                    searchResults.map((vn) => (
                      <button
                        key={vn.id}
                        type="button"
                        onClick={() => addResultToDraft(vn)}
                        className="flex items-center gap-3 rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-2 text-left transition hover:border-stone-600"
                      >
                        <img src={vn.image?.url || 'https://placehold.co/44x64/100f0e/d6d3d1?text=VN'} alt={vn.title} className="h-16 w-11 rounded-md object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{vn.title}</p>
                          <p className="text-xs text-stone-500">{vn.rating ? `${(vn.rating / 10).toFixed(1)}/10` : 'No rating yet'}</p>
                        </div>
                        <span className="rounded-lg border border-white/25 bg-white/5 px-2 py-1 text-xs font-semibold text-stone-200">Add</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            {sortedPreviewItems.length ? (
              <div className="space-y-3 rounded-2xl border border-stone-800 bg-stone-950/50 p-4">
                {sortedPreviewItems.map((item, index) => (
                  <article key={item.vnId} className={`rounded-2xl border p-3 transition ${form.type === 'ranking' ? rankAccent(index).card : 'border-stone-800 bg-stone-950/80'}`}>
                    <div className="grid gap-3 lg:grid-cols-[auto_72px_1fr_auto]">
                      <div className="flex items-start gap-2 text-stone-500">
                        <Grip className="mt-2 h-4 w-4" />
                        <div className="flex flex-col gap-1 pt-1">
                          <button type="button" onClick={() => moveItem(item.vnId, 'up')} className="rounded-md border border-stone-800 p-1 transition hover:border-stone-600 hover:text-white"><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => moveItem(item.vnId, 'down')} className="rounded-md border border-stone-800 p-1 transition hover:border-stone-600 hover:text-white"><ArrowDown className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>

                      <div className="relative">
                        {form.type === 'ranking' ? (
                          <div className={`absolute -left-2 -top-2 z-10 flex h-8 min-w-8 items-center justify-center rounded-xl border text-[11px] font-black tracking-tight px-1.5 ${rankAccent(index).badge}`}>
                            #{index + 1}
                          </div>
                        ) : null}
                        <img src={item.image || 'https://placehold.co/72x108/100f0e/d6d3d1?text=VN'} alt={item.title} className={`h-[108px] w-[72px] rounded-lg border object-cover ${form.type === 'ranking' && index < 3 ? 'border-white/12 shadow-md shadow-black/25' : 'border-stone-800'}`} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                          <button type="button" onClick={() => removeItem(item.vnId)} className="rounded-full border border-stone-800 p-1.5 text-stone-500 transition hover:border-rose-400/60 hover:text-rose-300"><X className="h-3.5 w-3.5" /></button>
                        </div>
                        <textarea
                          value={item.notes}
                          onChange={(e) => updateItem(item.vnId, { notes: e.target.value })}
                          rows={2}
                          placeholder="Optional note for this entry"
                          className="mt-2 w-full rounded-xl border border-stone-800 bg-stone-900 px-3 py-2 text-sm text-stone-200 outline-none transition focus:border-white/60"
                        />
                        {form.type === 'ranking' ? (
                          <div className="mt-2 max-w-[180px]">
                            <input
                              type="number"
                              min="1"
                              max="10"
                              step="0.5"
                              value={item.rankScore}
                              onChange={(e) => updateItem(item.vnId, { rankScore: e.target.value })}
                              placeholder="Rank score"
                              className="h-10 w-full rounded-xl border border-stone-800 bg-stone-900 px-3 text-sm text-stone-200 outline-none transition focus:border-white/60"
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="hidden lg:flex lg:items-start">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${form.type === 'ranking' ? rankAccent(index).pill : 'border-stone-800 bg-stone-900 text-stone-400'}`}>
                          {form.type === 'ranking' ? `Rank ${index + 1}` : `Item ${index + 1}`}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </section>

        {message ? (
          <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-stone-800 bg-stone-950/60 px-4 py-3 text-sm text-stone-300">
            <Check className="h-4 w-4 text-stone-200" />
            {message}
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default ListCreatePage
