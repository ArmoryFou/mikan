import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import multer from 'multer'
import User from './models/User.js'
import VNLog from './models/VNLog.js'
import VNCache from './models/VNCache.js'
import CharacterCache from './models/CharacterCache.js'
import VNReview from './models/VNReview.js'
import Follow from './models/Follow.js'
import Notification from './models/Notification.js'
import VNList from './models/VNList.js'
import VNListItem from './models/VNListItem.js'
import ListFollow from './models/ListFollow.js'
import ListLike from './models/ListLike.js'
import ListComment from './models/ListComment.js'

dotenv.config()

const app = express()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.join(__dirname, 'uploads', 'avatars')

fs.mkdirSync(uploadsDir, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg'
      cb(null, `${req.userId}-${Date.now()}${extension}`)
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
      return
    }
    cb(new Error('Only image uploads are allowed'))
  }
})

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err))

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Auth middleware
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token provided' })
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = decoded.userId
    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' })
  }
}

const authOptional = (req, _res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '')
  if (!token) {
    next()
    return
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = decoded.userId
  } catch (_error) {
    req.userId = undefined
  }

  next()
}

app.get('/', (req, res) => res.send('Hello VN Logger API!'))

const buildClientUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  displayName: user.displayName || '',
  avatarUrl: user.avatarUrl || ''
})

const sanitizeFavoriteVNs = (favorites = []) => {
  if (!Array.isArray(favorites)) return []

  return favorites
    .slice(0, 4)
    .map((item) => ({
      vnId: String(item?.vnId || '').trim(),
      title: String(item?.title || '').trim().slice(0, 180),
      image: String(item?.image || '').trim()
    }))
    .filter((item) => item.vnId && item.title)
}

const sanitizeFavoriteCharacters = (favorites = []) => {
  if (!Array.isArray(favorites)) return []

  return favorites
    .slice(0, 4)
    .map((item) => ({
      charId: String(item?.charId || '').trim(),
      name: String(item?.name || '').trim().slice(0, 120),
      image: String(item?.image || '').trim()
    }))
    .filter((item) => item.charId && item.name)
}

const sanitizePreferredVnCovers = (items = []) => {
  if (!Array.isArray(items)) return []

  const seen = new Set()
  const normalized = []

  for (const item of items) {
    const vnId = String(item?.vnId || '').trim()
    const image = String(item?.image || '').trim()
    if (!vnId || !image) continue
    if (seen.has(vnId)) continue
    seen.add(vnId)
    normalized.push({ vnId, image })
    if (normalized.length >= 200) break
  }

  return normalized
}

const parsePagination = (req, defaults = { skip: 0, limit: 20, maxLimit: 50 }) => {
  const safeSkip = Math.max(0, Number.parseInt(req.query.skip, 10) || defaults.skip)
  const requestedLimit = Number.parseInt(req.query.limit, 10) || defaults.limit
  const safeLimit = Math.max(1, Math.min(defaults.maxLimit, requestedLimit))
  return { skip: safeSkip, limit: safeLimit }
}

const LIST_TYPES = ['normal', 'ranking']
const LIST_VISIBILITY = ['public', 'private', 'unlisted']
const LIST_ITEM_SORT_FIELDS = new Set(['position', 'title', 'rating', 'status', 'addedAt', 'originalRank'])

const normalizeListType = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  return LIST_TYPES.includes(normalized) ? normalized : 'normal'
}

const normalizeListVisibility = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  return LIST_VISIBILITY.includes(normalized) ? normalized : 'public'
}

const sanitizeListInput = (payload = {}, { partial = false } = {}) => {
  const next = {}

  if (partial || payload.name !== undefined) {
    const name = String(payload.name || '').trim().slice(0, 90)
    if (!partial && !name) {
      throw new Error('List name is required')
    }
    if (name) next.name = name
  }

  if (partial || payload.description !== undefined) {
    next.description = String(payload.description || '').trim().slice(0, 1200)
  }

  if (partial || payload.type !== undefined) {
    const type = normalizeListType(payload.type)
    if (payload.type !== undefined && !LIST_TYPES.includes(String(payload.type || '').trim().toLowerCase())) {
      throw new Error('Invalid list type')
    }
    next.type = type
  }

  if (partial || payload.visibility !== undefined) {
    const visibility = normalizeListVisibility(payload.visibility)
    if (payload.visibility !== undefined && !LIST_VISIBILITY.includes(String(payload.visibility || '').trim().toLowerCase())) {
      throw new Error('Invalid list visibility')
    }
    next.visibility = visibility
  }

  return next
}

const canViewList = (list, viewerId, { allowUnlisted = true } = {}) => {
  const isOwner = viewerId && String(list.owner) === String(viewerId)
  if (isOwner) return true
  if (list.visibility === 'public') return true
  if (allowUnlisted && list.visibility === 'unlisted') return true
  return false
}

const listSortSpec = (sortValue = 'popular') => {
  const sort = String(sortValue || '').trim().toLowerCase()
  if (sort === 'recent') return { updatedAt: -1 }
  if (sort === 'name') return { name: 1 }
  if (sort === 'items') return { itemCount: -1, updatedAt: -1 }
  return { followersCount: -1, updatedAt: -1 }
}

const compactUser = (userDoc) => ({
  id: userDoc?._id || '',
  username: userDoc?.username || '',
  displayName: userDoc?.displayName || '',
  avatarUrl: userDoc?.avatarUrl || ''
})

const formatListCard = ({ list, owner, isFollowedByViewer = false, isLikedByViewer = false }) => ({
  id: list._id,
  name: list.name,
  description: list.description || '',
  type: list.type,
  visibility: list.visibility,
  itemCount: Number(list.itemCount || 0),
  followersCount: Number(list.followersCount || 0),
  likesCount: Number(list.likesCount || 0),
  commentsCount: Number(list.commentsCount || 0),
  coverImages: Array.isArray(list.coverImages) ? list.coverImages : [],
  owner: compactUser(owner),
  isFollowedByViewer,
  isLikedByViewer,
  createdAt: list.createdAt,
  updatedAt: list.updatedAt
})

const mapLogForListFilters = (logs = []) => {
  const map = new Map()
  logs.forEach((log) => {
    map.set(String(log.vnId), {
      status: String(log.status || ''),
      rating: log.rating == null ? null : Number(log.rating),
      updatedAt: log.updatedAt || null
    })
  })
  return map
}

const normalizeDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

const normalizeListItemSort = (value) => {
  const key = String(value || 'position').trim()
  return LIST_ITEM_SORT_FIELDS.has(key) ? key : 'position'
}

const compareListItems = ({ a, b, sortBy, direction }) => {
  const dir = direction === 'asc' ? 1 : -1

  if (sortBy === 'title') {
    return String(a.title || '').localeCompare(String(b.title || '')) * dir
  }

  if (sortBy === 'rating') {
    const aRating = a.viewerLog?.rating == null ? -Infinity : Number(a.viewerLog.rating)
    const bRating = b.viewerLog?.rating == null ? -Infinity : Number(b.viewerLog.rating)
    if (aRating !== bRating) return (aRating - bRating) * dir
    return (a.position - b.position) * (direction === 'asc' ? 1 : -1)
  }

  if (sortBy === 'status') {
    return String(a.viewerLog?.status || '').localeCompare(String(b.viewerLog?.status || '')) * dir
  }

  if (sortBy === 'addedAt') {
    const aDate = new Date(a.addedAt || 0).getTime()
    const bDate = new Date(b.addedAt || 0).getTime()
    return (aDate - bDate) * dir
  }

  if (sortBy === 'originalRank') {
    const aRank = a.originalRank == null ? Number.MAX_SAFE_INTEGER : Number(a.originalRank)
    const bRank = b.originalRank == null ? Number.MAX_SAFE_INTEGER : Number(b.originalRank)
    return (aRank - bRank) * dir
  }

  return (Number(a.position || 0) - Number(b.position || 0)) * dir
}

const refreshListDerivedFields = async (listId) => {
  const [topItems, itemCount] = await Promise.all([
    VNListItem.find({ list: listId }).sort({ position: 1 }).limit(4).select('image').lean(),
    VNListItem.countDocuments({ list: listId })
  ])

  const coverImages = topItems
    .map((item) => String(item.image || '').trim())
    .filter(Boolean)
    .slice(0, 4)

  await VNList.findByIdAndUpdate(listId, {
    $set: {
      itemCount,
      coverImages,
      updatedAt: new Date()
    }
  })
}

const getFollowCounts = async (userId) => {
  const [followers, following] = await Promise.all([
    Follow.countDocuments({ following: userId }),
    Follow.countDocuments({ follower: userId })
  ])
  return { followers, following }
}

const makePublicUserCard = (targetUser) => ({
  id: targetUser._id,
  username: targetUser.username,
  displayName: targetUser.displayName || '',
  avatarUrl: targetUser.avatarUrl || '',
  createdAt: targetUser.createdAt
})

const createFollowNotification = async ({ recipientId, actorId }) => {
  if (!recipientId || !actorId) return
  if (String(recipientId) === String(actorId)) return

  await Notification.create({
    recipient: recipientId,
    actor: actorId,
    type: 'follow',
    message: 'started following you'
  })
}

const notifyFollowers = async ({ actorId, type, message, targetId = '', targetTitle = '' }) => {
  if (!actorId) return

  const rows = await Follow.find({ following: actorId }).select('follower').lean()
  if (!rows.length) return

  const docs = rows.map(({ follower }) => ({
    recipient: follower,
    actor: actorId,
    type,
    message,
    targetId: String(targetId),
    targetTitle: String(targetTitle).slice(0, 180)
  }))

  await Notification.insertMany(docs, { ordered: false })
}

const STATUS_KEYS = ['want-to-play', 'playing', 'completed', 'dropped', 'on-hold']

const createEmptyStatusCounts = () => ({
  'want-to-play': 0,
  playing: 0,
  completed: 0,
  dropped: 0,
  'on-hold': 0
})

const buildStatusCounts = (rows = []) => {
  const counts = createEmptyStatusCounts()

  rows.forEach((row) => {
    const key = String(row?._id || '')
    if (STATUS_KEYS.includes(key)) {
      counts[key] = Number(row?.count || 0)
    }
  })

  return counts
}

const averageRatingFromRows = (rows = []) => {
  const values = rows
    .map((row) => Number(row?.rating))
    .filter((rating) => Number.isFinite(rating) && rating > 0)

  if (!values.length) {
    return { averageRating: null, ratingsCount: 0 }
  }

  const total = values.reduce((sum, value) => sum + value, 0)
  return {
    averageRating: Number((total / values.length).toFixed(1)),
    ratingsCount: values.length
  }
}

const buildVnStats = async ({ vnId, viewerId }) => {
  const [publicStatusRows, publicRatingRows, favoriteCount] = await Promise.all([
    VNLog.aggregate([
      { $match: { vnId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    VNLog.find({ vnId }).select('rating').lean(),
    User.countDocuments({ 'favoriteVNs.vnId': vnId })
  ])

  const publicStatusCounts = buildStatusCounts(publicStatusRows)
  const publicStats = {
    favoriteCount,
    loggedCount: Object.values(publicStatusCounts).reduce((sum, value) => sum + value, 0),
    statusCounts: publicStatusCounts,
    ...averageRatingFromRows(publicRatingRows)
  }

  if (!viewerId) {
    return { public: publicStats, friends: null }
  }

  const followingRows = await Follow.find({ follower: viewerId })
    .populate('following', 'username displayName avatarUrl')
    .lean()

  const followedUsers = followingRows
    .map((row) => row.following)
    .filter(Boolean)
    .map((item) => ({
      id: String(item._id),
      username: item.username,
      displayName: item.displayName || '',
      avatarUrl: item.avatarUrl || ''
    }))

  const followedIds = followedUsers.map((item) => item.id)

  if (!followedIds.length) {
    return {
      public: publicStats,
      friends: {
        followingCount: 0,
        favoriteCount: 0,
        loggedCount: 0,
        statusCounts: createEmptyStatusCounts(),
        averageRating: null,
        ratingsCount: 0,
        users: [],
        hasMoreMatches: false
      }
    }
  }

  const [friendLogs, friendFavoriteUsers] = await Promise.all([
    VNLog.find({ user: { $in: followedIds }, vnId })
      .select('user status rating updatedAt')
      .lean(),
    User.find({ _id: { $in: followedIds }, 'favoriteVNs.vnId': vnId })
      .select('username displayName avatarUrl')
      .lean()
  ])

  const friendStatusCounts = createEmptyStatusCounts()
  friendLogs.forEach((item) => {
    const key = String(item?.status || '')
    if (STATUS_KEYS.includes(key)) {
      friendStatusCounts[key] += 1
    }
  })

  const favoriteSet = new Set(friendFavoriteUsers.map((item) => String(item._id)))
  const previewMap = new Map(
    followedUsers.map((item) => [item.id, {
      id: item.id,
      username: item.username,
      displayName: item.displayName,
      avatarUrl: item.avatarUrl,
      status: '',
      rating: null,
      updatedAt: null,
      isFavorite: false
    }])
  )

  friendLogs.forEach((item) => {
    const key = String(item.user)
    const current = previewMap.get(key)
    if (!current) return

    current.status = item.status || ''
    current.rating = Number.isFinite(Number(item.rating)) ? Number(item.rating) : null
    current.updatedAt = item.updatedAt || null
  })

  favoriteSet.forEach((userId) => {
    const current = previewMap.get(String(userId))
    if (!current) return
    current.isFavorite = true
  })

  const matchingUsers = [...previewMap.values()]
    .filter((item) => item.status || item.isFavorite)
    .sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      if (bTime !== aTime) return bTime - aTime
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
      return String(a.username || '').localeCompare(String(b.username || ''))
    })

  return {
    public: publicStats,
    friends: {
      followingCount: followedUsers.length,
      favoriteCount: friendFavoriteUsers.length,
      loggedCount: friendLogs.length,
      statusCounts: friendStatusCounts,
      ...averageRatingFromRows(friendLogs),
      users: matchingUsers.slice(0, 8),
      hasMoreMatches: matchingUsers.length > 8
    }
  }
}

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body
    const existingUser = await User.findOne({ $or: [{ email }, { username }] })
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' })
    }
    
    const user = new User({ username, email, password })
    await user.save()
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET)
    res.json({ token, user: buildClientUser(user) })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET)
    res.json({ token, user: buildClientUser(user) })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/users/me/settings', auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId)
    if (!me) return res.status(404).json({ error: 'User not found' })

    res.json({
      user: buildClientUser(me),
      settings: {
        bio: me.bio || '',
        favoriteVNs: me.favoriteVNs || [],
        favoriteCharacters: me.favoriteCharacters || [],
        preferredVnCovers: me.preferredVnCovers || [],
        preferences: {
          profileVisibility: me.preferences?.profileVisibility || 'public',
          compactMode: Boolean(me.preferences?.compactMode)
        }
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/users/me/settings', auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId)
    if (!me) return res.status(404).json({ error: 'User not found' })

    const {
      displayName,
      bio,
      favoriteVNs,
      favoriteCharacters,
      preferredVnCovers,
      preferences
    } = req.body

    if (typeof displayName === 'string') {
      me.displayName = displayName.trim().slice(0, 60)
    }

    if (typeof bio === 'string') {
      me.bio = bio.trim().slice(0, 240)
    }

    if (favoriteVNs !== undefined) {
      me.favoriteVNs = sanitizeFavoriteVNs(favoriteVNs)
    }

    if (favoriteCharacters !== undefined) {
      me.favoriteCharacters = sanitizeFavoriteCharacters(favoriteCharacters)
    }

    if (preferredVnCovers !== undefined) {
      me.preferredVnCovers = sanitizePreferredVnCovers(preferredVnCovers)
    }

    if (preferences && typeof preferences === 'object') {
      me.preferences = {
        profileVisibility: preferences.profileVisibility === 'private' ? 'private' : 'public',
        compactMode: Boolean(preferences.compactMode)
      }
    }

    await me.save()

    res.json({
      user: buildClientUser(me),
      settings: {
        bio: me.bio || '',
        favoriteVNs: me.favoriteVNs || [],
        favoriteCharacters: me.favoriteCharacters || [],
        preferredVnCovers: me.preferredVnCovers || [],
        preferences: {
          profileVisibility: me.preferences?.profileVisibility || 'public',
          compactMode: Boolean(me.preferences?.compactMode)
        }
      }
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/users/me/vn-cover', auth, async (req, res) => {
  try {
    const vnId = String(req.body?.vnId || '').trim()
    const image = String(req.body?.image || '').trim()
    const title = String(req.body?.title || '').trim().slice(0, 180)

    if (!vnId) return res.status(400).json({ error: 'vnId is required' })
    if (!image) return res.status(400).json({ error: 'image is required' })

    const me = await User.findById(req.userId)
    if (!me) return res.status(404).json({ error: 'User not found' })

    const preferred = sanitizePreferredVnCovers(me.preferredVnCovers || [])
    const idx = preferred.findIndex((item) => String(item.vnId) === vnId)
    if (idx >= 0) {
      preferred[idx] = { vnId, image }
    } else {
      preferred.unshift({ vnId, image })
    }
    me.preferredVnCovers = sanitizePreferredVnCovers(preferred)

    if (Array.isArray(me.favoriteVNs) && me.favoriteVNs.length) {
      me.favoriteVNs = me.favoriteVNs.map((item) => {
        if (String(item?.vnId) !== vnId) return item
        return {
          vnId,
          title: String(item?.title || title || vnId).trim().slice(0, 180),
          image
        }
      })
    }

    await me.save()

    const logUpdate = {
      image,
      updatedAt: new Date()
    }
    if (title) {
      logUpdate.title = title
    }

    await VNLog.findOneAndUpdate(
      { user: req.userId, vnId },
      { $set: logUpdate },
      { upsert: false }
    )

    res.json({
      success: true,
      preferred: { vnId, image },
      settings: {
        bio: me.bio || '',
        favoriteVNs: me.favoriteVNs || [],
        favoriteCharacters: me.favoriteCharacters || [],
        preferredVnCovers: me.preferredVnCovers || [],
        preferences: {
          profileVisibility: me.preferences?.profileVisibility || 'public',
          compactMode: Boolean(me.preferences?.compactMode)
        }
      }
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/users/me/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' })

    const me = await User.findById(req.userId)
    if (!me) return res.status(404).json({ error: 'User not found' })

    me.avatarUrl = `/uploads/avatars/${req.file.filename}`
    await me.save()

    res.json({
      avatarUrl: me.avatarUrl,
      user: buildClientUser(me)
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// VN Log routes
app.get('/api/logs', auth, async (req, res) => {
  try {
    const logs = await VNLog.find({ user: req.userId }).sort({ updatedAt: -1 })
    res.json(logs)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/logs', auth, async (req, res) => {
  try {
    const { vnId, title, image, status, rating, review, silent } = req.body
    if (!vnId) {
      return res.status(400).json({ error: 'vnId is required' })
    }

    const log = await VNLog.findOneAndUpdate(
      { user: req.userId, vnId },
      { 
        title, 
        image, 
        status, 
        rating, 
        review, 
        updatedAt: new Date() 
      },
      { upsert: true, new: true }
    )
    res.json(log)

    if (status && !silent) {
      notifyFollowers({
        actorId: req.userId,
        type: 'status_change',
        message: `updated ${String(title || vnId).slice(0, 80)} to ${status.replace(/-/g, ' ')}`,
        targetId: vnId,
        targetTitle: String(title || vnId).slice(0, 180)
      }).catch(() => {})
    }
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/logs/:vnId', auth, async (req, res) => {
  try {
    await VNLog.findOneAndDelete({ user: req.userId, vnId: req.params.vnId })
    res.json({ message: 'Log deleted' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/users/me/vn-data', auth, async (req, res) => {
  try {
    const [logResult, reviewResult, user] = await Promise.all([
      VNLog.deleteMany({ user: req.userId }),
      VNReview.deleteMany({ user: req.userId }),
      User.findById(req.userId)
    ])

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const favoriteCount = Array.isArray(user.favoriteVNs) ? user.favoriteVNs.length : 0
    const favoriteCharacterCount = Array.isArray(user.favoriteCharacters) ? user.favoriteCharacters.length : 0
    const preferredVnCoverCount = Array.isArray(user.preferredVnCovers) ? user.preferredVnCovers.length : 0
    user.favoriteVNs = []
    user.favoriteCharacters = []
    user.preferredVnCovers = []
    await user.save()

    res.json({
      success: true,
      removed: {
        logs: logResult.deletedCount || 0,
        reviews: reviewResult.deletedCount || 0,
        favoriteVNs: favoriteCount,
        favoriteCharacters: favoriteCharacterCount,
        preferredVnCovers: preferredVnCoverCount
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// User profile
app.get('/api/users/:username', authOptional, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const [logs, socialCounts, relation] = await Promise.all([
      VNLog.find({ user: user._id }).sort({ updatedAt: -1 }),
      getFollowCounts(user._id),
      req.userId ? Follow.findOne({ follower: req.userId, following: user._id }) : null
    ])

    res.json({
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName || '',
        avatarUrl: user.avatarUrl || '',
        bio: user.bio || '',
        favoriteVNs: user.favoriteVNs || [],
        favoriteCharacters: user.favoriteCharacters || [],
        preferences: {
          profileVisibility: user.preferences?.profileVisibility || 'public',
          compactMode: Boolean(user.preferences?.compactMode)
        },
        followerCount: socialCounts.followers,
        followingCount: socialCounts.following,
        isFollowedByMe: Boolean(relation)
      },
      logs
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/users/me/follow', auth, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim()
    if (!username) return res.status(400).json({ error: 'username is required' })

    const target = await User.findOne({ username })
    if (!target) return res.status(404).json({ error: 'User not found' })

    if (String(target._id) === String(req.userId)) {
      return res.status(400).json({ error: 'You cannot follow yourself' })
    }

    const existing = await Follow.findOne({ follower: req.userId, following: target._id })
    if (!existing) {
      await Follow.create({ follower: req.userId, following: target._id })
      await createFollowNotification({ recipientId: target._id, actorId: req.userId })
    }

    const [followerCount, followingCount] = await Promise.all([
      Follow.countDocuments({ following: target._id }),
      Follow.countDocuments({ follower: req.userId })
    ])

    res.json({
      success: true,
      isFollowing: true,
      followerCount,
      followingCount
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/users/me/follow/:username', auth, async (req, res) => {
  try {
    const username = String(req.params.username || '').trim()
    if (!username) return res.status(400).json({ error: 'username is required' })

    const target = await User.findOne({ username })
    if (!target) return res.status(404).json({ error: 'User not found' })

    await Follow.findOneAndDelete({ follower: req.userId, following: target._id })

    const followerCount = await Follow.countDocuments({ following: target._id })
    res.json({
      success: true,
      isFollowing: false,
      followerCount
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/users/:username/follow-status', authOptional, async (req, res) => {
  try {
    const target = await User.findOne({ username: req.params.username })
    if (!target) return res.status(404).json({ error: 'User not found' })

    const [followerCount, followingCount, relation] = await Promise.all([
      Follow.countDocuments({ following: target._id }),
      Follow.countDocuments({ follower: target._id }),
      req.userId ? Follow.findOne({ follower: req.userId, following: target._id }) : null
    ])

    res.json({
      isFollowing: Boolean(relation),
      followerCount,
      followingCount
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/users/:username/followers', authOptional, async (req, res) => {
  try {
    const { skip, limit } = parsePagination(req)
    const target = await User.findOne({ username: req.params.username })
    if (!target) return res.status(404).json({ error: 'User not found' })

    const isOwner = req.userId && String(req.userId) === String(target._id)
    const isPrivate = target.preferences?.profileVisibility === 'private'
    if (isPrivate && !isOwner) {
      return res.status(403).json({ error: 'Followers are private for this profile' })
    }

    const [rows, total] = await Promise.all([
      Follow.find({ following: target._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('follower', 'username displayName avatarUrl createdAt'),
      Follow.countDocuments({ following: target._id })
    ])

    const followerIds = rows
      .map((row) => row.follower?._id)
      .filter(Boolean)

    let followedByMe = new Set()
    if (req.userId && followerIds.length) {
      const myFollowing = await Follow.find({
        follower: req.userId,
        following: { $in: followerIds }
      }).select('following')
      followedByMe = new Set(myFollowing.map((item) => String(item.following)))
    }

    const followers = rows
      .filter((row) => row.follower)
      .map((row) => ({
        ...makePublicUserCard(row.follower),
        isFollowedByMe: followedByMe.has(String(row.follower._id))
      }))

    res.json({ followers, total, skip, limit })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/users/:username/following', authOptional, async (req, res) => {
  try {
    const { skip, limit } = parsePagination(req)
    const target = await User.findOne({ username: req.params.username })
    if (!target) return res.status(404).json({ error: 'User not found' })

    const isOwner = req.userId && String(req.userId) === String(target._id)
    const isPrivate = target.preferences?.profileVisibility === 'private'
    if (isPrivate && !isOwner) {
      return res.status(403).json({ error: 'Following list is private for this profile' })
    }

    const [rows, total] = await Promise.all([
      Follow.find({ follower: target._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('following', 'username displayName avatarUrl createdAt'),
      Follow.countDocuments({ follower: target._id })
    ])

    const followingIds = rows
      .map((row) => row.following?._id)
      .filter(Boolean)

    let followedByMe = new Set()
    if (req.userId && followingIds.length) {
      const myFollowing = await Follow.find({
        follower: req.userId,
        following: { $in: followingIds }
      }).select('following')
      followedByMe = new Set(myFollowing.map((item) => String(item.following)))
    }

    const following = rows
      .filter((row) => row.following)
      .map((row) => ({
        ...makePublicUserCard(row.following),
        isFollowedByMe: followedByMe.has(String(row.following._id))
      }))

    res.json({ following, total, skip, limit })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/users/me/following-options', auth, async (req, res) => {
  try {
    const { limit } = parsePagination(req, { skip: 0, limit: 100, maxLimit: 200 })

    const rows = await Follow.find({ follower: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('following', 'username displayName avatarUrl createdAt')

    const following = rows
      .filter((row) => row.following)
      .map((row) => ({
        ...makePublicUserCard(row.following),
        isFollowedByMe: true
      }))

    res.json({ following, total: following.length, limit })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/members/new', authOptional, async (req, res) => {
  try {
    const { limit } = parsePagination(req, { skip: 0, limit: 12, maxLimit: 40 })
    const users = await User.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('username displayName avatarUrl createdAt')

    const userIds = users.map((item) => item._id)
    let followingSet = new Set()
    if (req.userId && userIds.length) {
      const rows = await Follow.find({
        follower: req.userId,
        following: { $in: userIds }
      }).select('following')
      followingSet = new Set(rows.map((item) => String(item.following)))
    }

    const members = users
      .filter((item) => String(item._id) !== String(req.userId || ''))
      .map((item) => ({
        ...makePublicUserCard(item),
        isFollowedByMe: followingSet.has(String(item._id))
      }))

    res.json({ members })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/members/suggested', auth, async (req, res) => {
  try {
    const { limit } = parsePagination(req, { skip: 0, limit: 12, maxLimit: 40 })
    const currentFollowing = await Follow.find({ follower: req.userId }).select('following')
    const blockedIds = new Set(currentFollowing.map((item) => String(item.following)))
    blockedIds.add(String(req.userId))

    const users = await User.find({ _id: { $nin: [...blockedIds] } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('username displayName avatarUrl createdAt')

    const members = users.map((item) => ({
      ...makePublicUserCard(item),
      isFollowedByMe: false
    }))

    res.json({ members })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/feed/activity', auth, async (req, res) => {
  try {
    const { skip, limit } = parsePagination(req, { skip: 0, limit: 20, maxLimit: 50 })

    const followingRows = await Follow.find({ follower: req.userId }).select('following')
    const followingIds = followingRows.map((item) => item.following)

    if (!followingIds.length) {
      return res.json({ activity: [], total: 0, skip, limit })
    }

    const [logs, reviews] = await Promise.all([
      VNLog.find({ user: { $in: followingIds } })
        .sort({ updatedAt: -1 })
        .limit(200)
        .select('user vnId title image status rating review startedAt completedAt updatedAt'),
      VNReview.find({ user: { $in: followingIds } })
        .sort({ createdAt: -1 })
        .limit(200)
        .select('user vnId title image rating review createdAt')
    ])

    const actorIds = new Set()
    logs.forEach((item) => actorIds.add(String(item.user)))
    reviews.forEach((item) => actorIds.add(String(item.user)))

    const actors = await User.find({ _id: { $in: [...actorIds] } }).select('username displayName avatarUrl')
    const actorMap = new Map(actors.map((item) => [String(item._id), item]))

    const merged = [
      ...logs.map((item) => {
        const actor = actorMap.get(String(item.user))
        return {
          id: `log-${item._id}`,
          type: 'log_update',
          actor: {
            id: actor?._id || item.user,
            username: actor?.username || 'unknown',
            displayName: actor?.displayName || '',
            avatarUrl: actor?.avatarUrl || ''
          },
          vn: {
            vnId: item.vnId,
            title: item.title,
            image: item.image || ''
          },
          data: {
            status: item.status,
            rating: item.rating,
            review: item.review || '',
            startedAt: item.startedAt || null,
            completedAt: item.completedAt || null
          },
          timestamp: item.updatedAt
        }
      }),
      ...reviews.map((item) => {
        const actor = actorMap.get(String(item.user))
        return {
          id: `review-${item._id}`,
          type: 'review',
          actor: {
            id: actor?._id || item.user,
            username: actor?.username || 'unknown',
            displayName: actor?.displayName || '',
            avatarUrl: actor?.avatarUrl || ''
          },
          vn: {
            vnId: item.vnId,
            title: item.title,
            image: item.image || ''
          },
          data: {
            rating: item.rating,
            review: item.review || ''
          },
          timestamp: item.createdAt
        }
      })
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    const total = merged.length
    const activity = merged.slice(skip, skip + limit)

    res.json({ activity, total, skip, limit })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/feed/global', authOptional, async (req, res) => {
  try {
    const { skip, limit } = parsePagination(req, { skip: 0, limit: 20, maxLimit: 50 })

    const [logs, reviews] = await Promise.all([
      VNLog.find({})
        .sort({ updatedAt: -1 })
        .limit(150)
        .select('user vnId title image status rating review updatedAt'),
      VNReview.find({})
        .sort({ createdAt: -1 })
        .limit(150)
        .select('user vnId title image rating review createdAt')
    ])

    const actorIds = new Set()
    logs.forEach((item) => actorIds.add(String(item.user)))
    reviews.forEach((item) => actorIds.add(String(item.user)))

    const actors = await User.find({ _id: { $in: [...actorIds] } }).select('username displayName avatarUrl')
    const actorMap = new Map(actors.map((item) => [String(item._id), item]))

    const merged = [
      ...logs.map((item) => {
        const actor = actorMap.get(String(item.user))
        return {
          id: `log-${item._id}`,
          type: 'log_update',
          actor: { id: actor?._id || item.user, username: actor?.username || 'unknown', displayName: actor?.displayName || '', avatarUrl: actor?.avatarUrl || '' },
          vn: { vnId: item.vnId, title: item.title, image: item.image || '' },
          data: { status: item.status, rating: item.rating },
          timestamp: item.updatedAt
        }
      }),
      ...reviews.map((item) => {
        const actor = actorMap.get(String(item.user))
        return {
          id: `review-${item._id}`,
          type: 'review',
          actor: { id: actor?._id || item.user, username: actor?.username || 'unknown', displayName: actor?.displayName || '', avatarUrl: actor?.avatarUrl || '' },
          vn: { vnId: item.vnId, title: item.title, image: item.image || '' },
          data: { rating: item.rating, review: item.review || '' },
          timestamp: item.createdAt
        }
      })
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    const total = merged.length
    const activity = merged.slice(skip, skip + limit)
    res.json({ activity, total, skip, limit })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/notifications', auth, async (req, res) => {
  try {
    const { skip, limit } = parsePagination(req, { skip: 0, limit: 20, maxLimit: 50 })
    const unreadOnly = String(req.query.unreadOnly || '').toLowerCase() === 'true'
    const filter = { recipient: req.userId }
    if (unreadOnly) filter.isRead = false

    const [rows, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actor', 'username displayName avatarUrl'),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.userId, isRead: false })
    ])

    const notifications = rows.map((item) => ({
      id: item._id,
      type: item.type,
      actor: {
        id: item.actor?._id || '',
        username: item.actor?.username || 'unknown',
        displayName: item.actor?.displayName || '',
        avatarUrl: item.actor?.avatarUrl || ''
      },
      message: item.message || '',
      targetId: item.targetId || '',
      targetTitle: item.targetTitle || '',
      isRead: Boolean(item.isRead),
      createdAt: item.createdAt
    }))

    res.json({ notifications, unreadCount, total, skip, limit })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.patch('/api/notifications/:id/read', auth, async (req, res) => {
  try {
    const item = await Notification.findById(req.params.id)
    if (!item) return res.status(404).json({ error: 'Notification not found' })
    if (String(item.recipient) !== String(req.userId)) {
      return res.status(403).json({ error: 'Not allowed' })
    }

    item.isRead = true
    await item.save()
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.patch('/api/notifications/mark-all-read', auth, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.userId, isRead: false },
      { $set: { isRead: true } }
    )

    res.json({ success: true, markedCount: result.modifiedCount || 0 })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/lists', auth, async (req, res) => {
  try {
    const payload = sanitizeListInput(req.body)
    const list = await VNList.create({
      owner: req.userId,
      name: payload.name,
      description: payload.description || '',
      type: payload.type || 'normal',
      visibility: payload.visibility || 'public',
      updatedAt: new Date()
    })

    const owner = await User.findById(req.userId).select('username displayName avatarUrl').lean()
    res.status(201).json({ list: formatListCard({ list, owner }) })
  } catch (error) {
    if (String(error?.code) === '11000') {
      return res.status(400).json({ error: 'You already have a list with this name' })
    }
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/lists/public', authOptional, async (req, res) => {
  try {
    const { skip, limit } = parsePagination(req)
    const q = String(req.query.q || '').trim()
    const typeFilter = String(req.query.type || '').trim().toLowerCase()
    const sort = listSortSpec(req.query.sort)

    const filter = { visibility: 'public' }
    if (typeFilter && LIST_TYPES.includes(typeFilter)) {
      filter.type = typeFilter
    }

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    }

    const [lists, total] = await Promise.all([
      VNList.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('owner', 'username displayName avatarUrl')
        .lean(),
      VNList.countDocuments(filter)
    ])

    const listIds = lists.map((item) => item._id)
    let followedSet = new Set()
    let likedSet = new Set()
    if (req.userId && listIds.length) {
      const [follows, likes] = await Promise.all([
        ListFollow.find({ user: req.userId, list: { $in: listIds } }).select('list').lean(),
        ListLike.find({ user: req.userId, list: { $in: listIds } }).select('list').lean()
      ])
      followedSet = new Set(follows.map((item) => String(item.list)))
      likedSet = new Set(likes.map((item) => String(item.list)))
    }

    const results = lists.map((item) => formatListCard({
      list: item,
      owner: item.owner,
      isFollowedByViewer: followedSet.has(String(item._id)),
      isLikedByViewer: likedSet.has(String(item._id))
    }))

    res.json({ lists: results, total, skip, limit })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/users/:username/lists', authOptional, async (req, res) => {
  try {
    const target = await User.findOne({ username: req.params.username }).select('username preferences').lean()
    if (!target) return res.status(404).json({ error: 'User not found' })

    const isOwner = req.userId && String(req.userId) === String(target._id)
    const isPrivateProfile = target.preferences?.profileVisibility === 'private'
    if (isPrivateProfile && !isOwner) {
      return res.status(403).json({ error: 'Lists are private for this profile' })
    }

    const bucket = String(req.query.bucket || 'all').trim().toLowerCase()
    const q = String(req.query.q || '').trim()
    const typeFilter = String(req.query.type || '').trim().toLowerCase()
    const sort = listSortSpec(req.query.sort)

    const createdFilter = { owner: target._id }
    if (!isOwner) {
      createdFilter.visibility = { $in: ['public', 'unlisted'] }
    }
    if (typeFilter && LIST_TYPES.includes(typeFilter)) {
      createdFilter.type = typeFilter
    }
    if (q) {
      createdFilter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    }

    let createdRows = []
    if (bucket === 'all' || bucket === 'created') {
      createdRows = await VNList.find(createdFilter)
        .sort(sort)
        .populate('owner', 'username displayName avatarUrl')
        .lean()
    }

    let followedRows = []
    if (bucket === 'all' || bucket === 'followed') {
      const follows = await ListFollow.find({ user: target._id }).select('list').lean()
      const followedIds = follows.map((item) => item.list)
      if (followedIds.length) {
        const followedFilter = { _id: { $in: followedIds }, visibility: 'public' }
        if (typeFilter && LIST_TYPES.includes(typeFilter)) {
          followedFilter.type = typeFilter
        }
        if (q) {
          followedFilter.$or = [
            { name: { $regex: q, $options: 'i' } },
            { description: { $regex: q, $options: 'i' } }
          ]
        }
        followedRows = await VNList.find(followedFilter)
          .sort(sort)
          .populate('owner', 'username displayName avatarUrl')
          .lean()
      }
    }

    const created = createdRows.map((item) => formatListCard({
      list: item,
      owner: item.owner,
      isFollowedByViewer: req.userId ? String(item.owner?._id || '') === String(req.userId) : false
    }))

    const followed = followedRows.map((item) => formatListCard({
      list: item,
      owner: item.owner,
      isFollowedByViewer: true
    }))

    res.json({ created, followed })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/lists/:listId', authOptional, async (req, res) => {
  try {
    const { listId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = await VNList.findById(listId).populate('owner', 'username displayName avatarUrl').lean()
    if (!list) return res.status(404).json({ error: 'List not found' })

    if (!canViewList(list, req.userId, { allowUnlisted: true })) {
      return res.status(403).json({ error: 'You do not have access to this list' })
    }

    const isOwner = req.userId && String(req.userId) === String(list.owner?._id || list.owner)
    let isFollowedByViewer = false
    let isLikedByViewer = false

    if (req.userId && !isOwner) {
      const relation = await ListFollow.findOne({ user: req.userId, list: list._id }).select('_id').lean()
      isFollowedByViewer = Boolean(relation)
    }

    if (req.userId) {
      const relation = await ListLike.findOne({ user: req.userId, list: list._id }).select('_id').lean()
      isLikedByViewer = Boolean(relation)
    }

    res.json({
      list: formatListCard({
        list,
        owner: list.owner,
        isFollowedByViewer,
        isLikedByViewer
      }),
      isOwner
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/lists/:listId', auth, async (req, res) => {
  try {
    const { listId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = await VNList.findById(listId)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (String(list.owner) !== String(req.userId)) {
      return res.status(403).json({ error: 'Not allowed' })
    }

    const updates = sanitizeListInput(req.body, { partial: true })
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    Object.assign(list, updates)
    list.updatedAt = new Date()
    await list.save()

    await list.populate('owner', 'username displayName avatarUrl')
    res.json({ list: formatListCard({ list, owner: list.owner }) })
  } catch (error) {
    if (String(error?.code) === '11000') {
      return res.status(400).json({ error: 'You already have a list with this name' })
    }
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/lists/:listId', auth, async (req, res) => {
  try {
    const { listId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = await VNList.findById(listId)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (String(list.owner) !== String(req.userId)) {
      return res.status(403).json({ error: 'Not allowed' })
    }

    await Promise.all([
      VNList.findByIdAndDelete(listId),
      VNListItem.deleteMany({ list: listId }),
      ListFollow.deleteMany({ list: listId }),
      ListLike.deleteMany({ list: listId }),
      ListComment.deleteMany({ list: listId })
    ])

    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/lists/:listId/follow', auth, async (req, res) => {
  try {
    const { listId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = await VNList.findById(listId)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (list.visibility !== 'public') {
      return res.status(403).json({ error: 'Only public lists can be followed' })
    }

    if (String(list.owner) === String(req.userId)) {
      return res.status(400).json({ error: 'You cannot follow your own list' })
    }

    await ListFollow.updateOne(
      { user: req.userId, list: list._id },
      { $setOnInsert: { user: req.userId, list: list._id, createdAt: new Date() } },
      { upsert: true }
    )

    const followersCount = await ListFollow.countDocuments({ list: list._id })
    list.followersCount = followersCount
    await list.save()

    res.json({ success: true, followersCount })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/lists/:listId/follow', auth, async (req, res) => {
  try {
    const { listId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = await VNList.findById(listId)
    if (!list) return res.status(404).json({ error: 'List not found' })

    await ListFollow.findOneAndDelete({ user: req.userId, list: list._id })

    const followersCount = await ListFollow.countDocuments({ list: list._id })
    list.followersCount = followersCount
    await list.save()

    res.json({ success: true, followersCount })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/lists/:listId/like', auth, async (req, res) => {
  try {
    const { listId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = await VNList.findById(listId)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (!canViewList(list, req.userId, { allowUnlisted: true })) {
      return res.status(403).json({ error: 'Cannot like this list' })
    }

    await ListLike.updateOne(
      { user: req.userId, list: list._id },
      { $setOnInsert: { user: req.userId, list: list._id, createdAt: new Date() } },
      { upsert: true }
    )

    const likesCount = await ListLike.countDocuments({ list: list._id })
    list.likesCount = likesCount
    await list.save()

    res.json({ success: true, likesCount })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/lists/:listId/like', auth, async (req, res) => {
  try {
    const { listId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = await VNList.findById(listId)
    if (!list) return res.status(404).json({ error: 'List not found' })

    await ListLike.findOneAndDelete({ user: req.userId, list: list._id })

    const likesCount = await ListLike.countDocuments({ list: list._id })
    list.likesCount = likesCount
    await list.save()

    res.json({ success: true, likesCount })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/lists/:listId/comments', authOptional, async (req, res) => {
  try {
    const { listId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = await VNList.findById(listId).lean()
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (!canViewList(list, req.userId, { allowUnlisted: true })) {
      return res.status(403).json({ error: 'Cannot view comments' })
    }

    const { skip, limit } = parsePagination(req)
    const [rows, total] = await Promise.all([
      ListComment.find({ list: listId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'username displayName avatarUrl')
        .lean(),
      ListComment.countDocuments({ list: listId })
    ])

    const comments = rows.map((item) => {
      const authorId = String(item.author?._id || '')
      const viewerId = String(req.userId || '')
      const ownerId = String(list.owner || '')
      return {
        id: item._id,
        content: item.content || '',
        author: compactUser(item.author),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        canDelete: Boolean(viewerId) && (viewerId === authorId || viewerId === ownerId)
      }
    })

    res.json({ comments, total, skip, limit })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/lists/:listId/comments', auth, async (req, res) => {
  try {
    const { listId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = await VNList.findById(listId)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (!canViewList(list, req.userId, { allowUnlisted: true })) {
      return res.status(403).json({ error: 'Cannot comment on this list' })
    }

    const content = String(req.body.content || '').trim().slice(0, 500)
    if (!content) return res.status(400).json({ error: 'Comment cannot be empty' })

    const comment = await ListComment.create({
      list: list._id,
      author: req.userId,
      content,
      updatedAt: new Date()
    })

    await comment.populate('author', 'username displayName avatarUrl')

    const commentsCount = await ListComment.countDocuments({ list: list._id })
    list.commentsCount = commentsCount
    await list.save()

    res.status(201).json({
      comment: {
        id: comment._id,
        content: comment.content,
        author: compactUser(comment.author),
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        canDelete: true
      },
      commentsCount
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.put('/api/lists/:listId/comments/:commentId', auth, async (req, res) => {
  try {
    const { listId, commentId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId) || !mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(404).json({ error: 'Not found' })
    }

    const content = String(req.body.content || '').trim().slice(0, 500)
    if (!content) return res.status(400).json({ error: 'Content is required' })

    const [list, comment] = await Promise.all([
      VNList.findById(listId),
      ListComment.findById(commentId)
    ])

    if (!list) return res.status(404).json({ error: 'List not found' })
    if (!comment || String(comment.list) !== String(list._id)) {
      return res.status(404).json({ error: 'Comment not found' })
    }
    if (String(comment.author) !== String(req.userId)) {
      return res.status(403).json({ error: 'Not allowed' })
    }

    comment.content = content
    comment.updatedAt = new Date()
    await comment.save()

    await comment.populate('author', 'username displayName avatarUrl')
    const canDelete = true
    res.json({
      comment: {
        id: comment._id,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: {
          username: comment.author?.username,
          displayName: comment.author?.displayName,
          avatarUrl: comment.author?.avatarUrl
        },
        canDelete
      }
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/lists/:listId/comments/:commentId', auth, async (req, res) => {
  try {
    const { listId, commentId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId) || !mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(404).json({ error: 'Not found' })
    }

    const [list, comment] = await Promise.all([
      VNList.findById(listId),
      ListComment.findById(commentId)
    ])

    if (!list) return res.status(404).json({ error: 'List not found' })
    if (!comment || String(comment.list) !== String(list._id)) {
      return res.status(404).json({ error: 'Comment not found' })
    }

    const isAuthor = String(comment.author) === String(req.userId)
    const isListOwner = String(list.owner) === String(req.userId)
    if (!isAuthor && !isListOwner) {
      return res.status(403).json({ error: 'Not allowed' })
    }

    await ListComment.findByIdAndDelete(comment._id)

    const commentsCount = await ListComment.countDocuments({ list: list._id })
    list.commentsCount = commentsCount
    await list.save()

    res.json({ success: true, commentsCount })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/lists/:listId/items', auth, async (req, res) => {
  try {
    const { listId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = await VNList.findById(listId)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (String(list.owner) !== String(req.userId)) {
      return res.status(403).json({ error: 'Not allowed' })
    }

    const vnId = String(req.body.vnId || '').trim()
    const title = String(req.body.title || '').trim().slice(0, 180)
    const image = String(req.body.image || '').trim()
    const notes = String(req.body.notes || '').trim().slice(0, 500)
    const rawScore = req.body.rankScore

    if (!vnId || !title) {
      return res.status(400).json({ error: 'vnId and title are required' })
    }

    const count = await VNListItem.countDocuments({ list: list._id })
    const isRanking = list.type === 'ranking'
    const rankScore = rawScore == null || rawScore === '' ? null : Number(rawScore)

    if (isRanking && rankScore != null && (!Number.isFinite(rankScore) || rankScore < 1 || rankScore > 10)) {
      return res.status(400).json({ error: 'rankScore must be between 1 and 10' })
    }

    const item = await VNListItem.create({
      list: list._id,
      vnId,
      title,
      image,
      notes,
      addedBy: req.userId,
      position: count,
      originalRank: isRanking ? count + 1 : null,
      rankScore: isRanking ? rankScore : null
    })

    await refreshListDerivedFields(list._id)
    res.status(201).json({
      item: {
        id: item._id,
        vnId: item.vnId,
        title: item.title,
        image: item.image,
        notes: item.notes,
        position: item.position,
        originalRank: item.originalRank,
        rankScore: item.rankScore,
        addedAt: item.addedAt
      }
    })
  } catch (error) {
    if (String(error?.code) === '11000') {
      return res.status(400).json({ error: 'This VN already exists in the list' })
    }
    res.status(400).json({ error: error.message })
  }
})

app.put('/api/lists/:listId/items/:vnId', auth, async (req, res) => {
  try {
    const { listId, vnId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = await VNList.findById(listId)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (String(list.owner) !== String(req.userId)) {
      return res.status(403).json({ error: 'Not allowed' })
    }

    const item = await VNListItem.findOne({ list: list._id, vnId: String(vnId || '').trim() })
    if (!item) return res.status(404).json({ error: 'Item not found' })

    if (req.body.notes !== undefined) {
      item.notes = String(req.body.notes || '').trim().slice(0, 500)
    }

    if (list.type === 'ranking' && req.body.rankScore !== undefined) {
      if (req.body.rankScore === null || req.body.rankScore === '') {
        item.rankScore = null
      } else {
        const rankScore = Number(req.body.rankScore)
        if (!Number.isFinite(rankScore) || rankScore < 1 || rankScore > 10) {
          return res.status(400).json({ error: 'rankScore must be between 1 and 10' })
        }
        item.rankScore = rankScore
      }
    }

    await item.save()
    await refreshListDerivedFields(list._id)

    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/lists/:listId/items/:vnId', auth, async (req, res) => {
  try {
    const { listId, vnId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = await VNList.findById(listId)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (String(list.owner) !== String(req.userId)) {
      return res.status(403).json({ error: 'Not allowed' })
    }

    const deleted = await VNListItem.findOneAndDelete({ list: list._id, vnId: String(vnId || '').trim() })
    if (!deleted) return res.status(404).json({ error: 'Item not found' })

    const remaining = await VNListItem.find({ list: list._id }).sort({ position: 1 })
    await Promise.all(remaining.map((item, idx) => {
      item.position = idx
      return item.save()
    }))

    await refreshListDerivedFields(list._id)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.patch('/api/lists/:listId/reorder', auth, async (req, res) => {
  try {
    const { listId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = await VNList.findById(listId)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (String(list.owner) !== String(req.userId)) {
      return res.status(403).json({ error: 'Not allowed' })
    }

    const orderedVnIds = Array.isArray(req.body.orderedVnIds)
      ? req.body.orderedVnIds.map((item) => String(item || '').trim()).filter(Boolean)
      : []

    if (!orderedVnIds.length) {
      return res.status(400).json({ error: 'orderedVnIds is required' })
    }

    const items = await VNListItem.find({ list: list._id })
    if (items.length !== orderedVnIds.length) {
      return res.status(400).json({ error: 'orderedVnIds must include all items exactly once' })
    }

    const itemMap = new Map(items.map((item) => [String(item.vnId), item]))
    const seen = new Set()

    for (let idx = 0; idx < orderedVnIds.length; idx += 1) {
      const vnId = orderedVnIds[idx]
      if (seen.has(vnId)) {
        return res.status(400).json({ error: 'orderedVnIds contains duplicates' })
      }
      seen.add(vnId)

      const current = itemMap.get(vnId)
      if (!current) {
        return res.status(400).json({ error: 'orderedVnIds contains unknown vnId' })
      }

      current.position = idx
      await current.save()
    }

    await refreshListDerivedFields(list._id)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/lists/:listId/items', authOptional, async (req, res) => {
  try {
    const { listId } = req.params
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = await VNList.findById(listId).populate('owner', 'username displayName avatarUrl').lean()
    if (!list) return res.status(404).json({ error: 'List not found' })

    if (!canViewList(list, req.userId, { allowUnlisted: true })) {
      return res.status(403).json({ error: 'You do not have access to this list' })
    }

    const allItems = await VNListItem.find({ list: list._id }).lean()
    const vnIds = allItems.map((item) => item.vnId)

    let viewerLogsByVn = new Map()
    if (req.userId && vnIds.length) {
      const logs = await VNLog.find({ user: req.userId, vnId: { $in: vnIds } })
        .select('vnId status rating updatedAt')
        .lean()
      viewerLogsByVn = mapLogForListFilters(logs)
    }

    const statusFilter = String(req.query.status || '').trim().toLowerCase()
    const readFilter = String(req.query.readFilter || 'all').trim().toLowerCase()
    const minStarsRaw = req.query.minStars
    const minRatingRaw = req.query.minRating
    const addedFrom = normalizeDate(req.query.addedFrom)
    const addedTo = normalizeDate(req.query.addedTo)
    const sortBy = normalizeListItemSort(req.query.sortBy)
    const order = String(req.query.order || 'asc').trim().toLowerCase() === 'desc' ? 'desc' : 'asc'

    const minStars = minStarsRaw == null || minStarsRaw === '' ? null : Number(minStarsRaw)
    const minRating = minRatingRaw == null || minRatingRaw === ''
      ? (minStars == null ? null : Number(minStars) * 2)
      : Number(minRatingRaw)

    const prepared = allItems.map((item) => {
      const viewerLog = viewerLogsByVn.get(String(item.vnId)) || null
      return {
        ...item,
        viewerLog,
        isRead: Boolean(viewerLog)
      }
    })

    const filtered = prepared.filter((item) => {
      if (readFilter === 'read' && !item.isRead) return false
      if (readFilter === 'unread' && item.isRead) return false

      if (statusFilter && statusFilter !== 'all') {
        if (!item.viewerLog || String(item.viewerLog.status || '') !== statusFilter) {
          return false
        }
      }

      if (Number.isFinite(minRating)) {
        const rating = item.viewerLog?.rating
        if (rating == null || Number(rating) < minRating) {
          return false
        }
      }

      const itemDate = new Date(item.addedAt || 0).getTime()
      if (addedFrom && itemDate < addedFrom.getTime()) return false
      if (addedTo) {
        const end = new Date(addedTo)
        end.setHours(23, 59, 59, 999)
        if (itemDate > end.getTime()) return false
      }

      return true
    })

    const sorted = [...filtered].sort((a, b) => compareListItems({ a, b, sortBy, direction: order }))

    const { skip, limit } = parsePagination(req)
    const total = sorted.length
    const page = sorted.slice(skip, skip + limit)

    const rankHighlightEligible = list.type === 'ranking' &&
      sortBy === 'position' &&
      order === 'asc' &&
      readFilter === 'all' &&
      (!statusFilter || statusFilter === 'all') &&
      !Number.isFinite(minRating) &&
      !addedFrom &&
      !addedTo

    const items = page.map((item) => ({
      id: item._id,
      vnId: item.vnId,
      title: item.title,
      image: item.image || '',
      notes: item.notes || '',
      position: Number(item.position || 0),
      originalRank: item.originalRank == null ? null : Number(item.originalRank),
      rankScore: item.rankScore == null ? null : Number(item.rankScore),
      addedAt: item.addedAt,
      viewerLog: item.viewerLog
        ? {
            status: item.viewerLog.status || '',
            rating: item.viewerLog.rating == null ? null : Number(item.viewerLog.rating),
            updatedAt: item.viewerLog.updatedAt || null
          }
        : null,
      isRead: item.isRead
    }))

    res.json({
      list: formatListCard({ list, owner: list.owner }),
      items,
      total,
      skip,
      limit,
      meta: {
        sortBy,
        order,
        rankHighlightEligible
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/vn/:id/stats', authOptional, async (req, res) => {
  try {
    const stats = await buildVnStats({ vnId: req.params.id, viewerId: req.userId })
    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/vn/:id/recommend', auth, async (req, res) => {
  try {
    const recipients = Array.isArray(req.body.recipients)
      ? [...new Set(req.body.recipients.map((item) => String(item || '').trim()).filter(Boolean))]
      : []

    if (!recipients.length) {
      return res.status(400).json({ error: 'At least one recipient is required' })
    }

    const [followingRows, candidateUsers] = await Promise.all([
      Follow.find({ follower: req.userId }).select('following').lean(),
      User.find({ username: { $in: recipients } }).select('username')
    ])

    const followedSet = new Set(followingRows.map((item) => String(item.following)))
    const validRecipients = candidateUsers.filter((item) => followedSet.has(String(item._id)))
    const validUsernameSet = new Set(validRecipients.map((item) => item.username))
    const invalidRecipients = recipients.filter((username) => !validUsernameSet.has(username))

    if (validRecipients.length) {
      await Notification.insertMany(
        validRecipients.map((recipient) => ({
          recipient: recipient._id,
          actor: req.userId,
          type: 'recommend',
          message: 'recommended this VN to you',
          targetId: req.params.id,
          targetTitle: String(req.body.title || req.params.id).trim().slice(0, 180)
        })),
        { ordered: false }
      )
    }

    res.json({
      success: true,
      sentCount: validRecipients.length,
      skippedCount: invalidRecipients.length,
      invalidRecipients
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/vn', async (req, res) => {
  const response = await fetch('https://api.vndb.org/kana/vn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body)
  })
  const data = await response.json()
  res.json(data)
})

// Character routes
app.post('/api/character', async (req, res) => {
  try {
    const response = await fetch('https://api.vndb.org/kana/character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    })
    const data = await response.json()
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/character/:id', async (req, res) => {
  try {
    const charId = req.params.id
    const cached = await CharacterCache.findOne({ charId })
    if (cached && (new Date() - cached.lastUpdated) < 24 * 60 * 60 * 1000) {
      return res.json(cached.data)
    }

    const response = await fetch('https://api.vndb.org/kana/character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: ['id', '=', charId],
        fields: 'id,name,original,aliases,description,image.url,age,sex,blood_type,height,weight,bust,waist,hips,cup,birthday,vns.id,vns.title,vns.image.url,vns.role,traits.name,traits.group_name,traits.spoiler'
      })
    })
    const data = await response.json()
    if (!data.results?.length) return res.status(404).json({ error: 'Character not found' })

    const charData = data.results[0]
    await CharacterCache.findOneAndUpdate(
      { charId },
      { data: charData, lastUpdated: new Date() },
      { upsert: true, new: true }
    )
    res.json(charData)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/character/:id/favorites', authOptional, async (req, res) => {
  try {
    const { limit } = parsePagination(req, { skip: 0, limit: 12, maxLimit: 40 })
    const charId = String(req.params.id || '').trim()
    if (!charId) return res.status(400).json({ error: 'Character id is required' })

    const followingRows = req.userId
      ? await Follow.find({ follower: req.userId }).select('following').lean()
      : []

    const followingIds = followingRows.map((item) => item.following)
    const followingSet = new Set(followingIds.map((item) => String(item)))

    const publicMatch = req.userId
      ? {
          'favoriteCharacters.charId': charId,
          $or: [
            { 'preferences.profileVisibility': { $ne: 'private' } },
            { _id: req.userId }
          ]
        }
      : {
          'favoriteCharacters.charId': charId,
          'preferences.profileVisibility': { $ne: 'private' }
        }

    const [publicUsersRaw, publicTotal, friendUsersRaw, friendTotal] = await Promise.all([
      User.find(publicMatch)
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('username displayName avatarUrl createdAt')
        .lean(),
      User.countDocuments(publicMatch),
      req.userId && followingIds.length
        ? User.find({ _id: { $in: followingIds }, 'favoriteCharacters.charId': charId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('username displayName avatarUrl createdAt')
            .lean()
        : Promise.resolve([]),
      req.userId && followingIds.length
        ? User.countDocuments({ _id: { $in: followingIds }, 'favoriteCharacters.charId': charId })
        : Promise.resolve(0)
    ])

    const publicUsers = publicUsersRaw.map((item) => ({
      ...makePublicUserCard(item),
      isFollowedByMe: followingSet.has(String(item._id))
    }))

    const payload = {
      public: {
        total: publicTotal,
        users: publicUsers,
        hasMore: publicTotal > publicUsers.length
      },
      friends: null
    }

    if (req.userId) {
      const friendUsers = friendUsersRaw.map((item) => ({
        ...makePublicUserCard(item),
        isFollowedByMe: true
      }))

      payload.friends = {
        followingCount: followingIds.length,
        total: friendTotal,
        users: friendUsers,
        hasMore: friendTotal > friendUsers.length
      }
    }

    res.json(payload)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/vn/:id/characters', async (req, res) => {
  try {
    const vnId = req.params.id
    const response = await fetch('https://api.vndb.org/kana/character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: ['vn', '=', ['id', '=', vnId]],
        fields: 'id,name,original,image.url,vns.id,vns.role',
        results: 50
      })
    })
    const data = await response.json()
    if (!data.results) return res.json([])

    const rolePriority = { main: 0, primary: 0, side: 1, appears: 2 }
    const chars = data.results
      .map((c) => {
        const vnEntry = (c.vns || []).find((v) => String(v.id) === String(vnId))
        return {
          id: c.id,
          name: c.name,
          original: c.original || '',
          image: c.image?.url || '',
          vnRole: vnEntry?.role || 'appears'
        }
      })
      .sort((a, b) => (rolePriority[a.vnRole] ?? 3) - (rolePriority[b.vnRole] ?? 3))

    res.json(chars)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/vn/:id/reviews', async (req, res) => {
  try {
    const reviews = await VNReview.find({ vnId: req.params.id })
      .sort({ updatedAt: -1 })
      .limit(24)
      .populate('user', 'username displayName avatarUrl')

    const formatted = reviews.map((item) => ({
      id: item._id,
      vnId: item.vnId,
      title: item.title,
      review: item.review,
      rating: item.rating,
      updatedAt: item.updatedAt,
      user: {
        id: item.user?._id || '',
        username: item.user?.username || 'unknown',
        displayName: item.user?.displayName || '',
        avatarUrl: item.user?.avatarUrl || ''
      }
    }))

    res.json(formatted)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/vn/:id/reviews', auth, async (req, res) => {
  try {
    const reviewText = String(req.body.review || '').trim()
    const ratingValue = req.body.rating

    if (!reviewText) {
      return res.status(400).json({ error: 'Review text is required' })
    }

    const review = new VNReview({
      user: req.userId,
      vnId: req.params.id,
      title: String(req.body.title || '').trim() || req.params.id,
      image: String(req.body.image || '').trim(),
      review: reviewText,
      rating: ratingValue === null || ratingValue === undefined || ratingValue === '' ? undefined : Number(ratingValue),
      updatedAt: new Date()
    })

    await review.save()
    await review.populate('user', 'username displayName avatarUrl')

    res.status(201).json({
      review: {
        id: review._id,
        vnId: review.vnId,
        title: review.title,
        review: review.review,
        rating: review.rating,
        updatedAt: review.updatedAt,
        user: {
          id: review.user?._id || '',
          username: review.user?.username || 'unknown',
          displayName: review.user?.displayName || '',
          avatarUrl: review.user?.avatarUrl || ''
        }
      }
    })

    notifyFollowers({
      actorId: req.userId,
      type: 'review',
      message: `published a review for ${String(review.title || review.vnId).slice(0, 80)}`,
      targetId: review.vnId,
      targetTitle: String(review.title || '').slice(0, 180)
    }).catch(() => {})
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.put('/api/vn/reviews/:reviewId', auth, async (req, res) => {
  try {
    const review = await VNReview.findById(req.params.reviewId)
    if (!review) return res.status(404).json({ error: 'Review not found' })

    if (String(review.user) !== String(req.userId)) {
      return res.status(403).json({ error: 'You can only edit your own reviews' })
    }

    const nextText = String(req.body.review || '').trim()
    if (!nextText) {
      return res.status(400).json({ error: 'Review text is required' })
    }

    const nextRating = req.body.rating
    review.review = nextText
    review.rating = nextRating === null || nextRating === undefined || nextRating === '' ? undefined : Number(nextRating)
    review.updatedAt = new Date()
    await review.save()
    await review.populate('user', 'username displayName avatarUrl')

    res.json({
      review: {
        id: review._id,
        vnId: review.vnId,
        title: review.title,
        review: review.review,
        rating: review.rating,
        updatedAt: review.updatedAt,
        user: {
          id: review.user?._id || '',
          username: review.user?.username || 'unknown',
          displayName: review.user?.displayName || '',
          avatarUrl: review.user?.avatarUrl || ''
        }
      }
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/vn/reviews/:reviewId', auth, async (req, res) => {
  try {
    const review = await VNReview.findById(req.params.reviewId)
    if (!review) return res.status(404).json({ error: 'Review not found' })

    if (String(review.user) !== String(req.userId)) {
      return res.status(403).json({ error: 'You can only remove your own reviews' })
    }

    await VNReview.findByIdAndDelete(req.params.reviewId)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

const fetchVnById = async (vnId, fields) => {
  const response = await fetch('https://api.vndb.org/kana/vn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: ['id', '=', vnId],
      fields
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(errText || 'VNDB API error')
  }

  const data = await response.json()
  if (!data.results || data.results.length === 0) {
    throw new Error('VN not found')
  }

  return data.results[0]
}

app.get('/api/vn/:id', async (req, res) => {
  try {
    // Check cache first
    let cached = await VNCache.findOne({ vnId: req.params.id })
    if (cached && (new Date() - cached.lastUpdated) < 24 * 60 * 60 * 1000) { // 24 hours
      const cachedData = cached.data || {}
      if (!cachedData.id) {
        cachedData.id = req.params.id
        cached.data = cachedData
        await cached.save()
      }

      const cachedShots = Array.isArray(cachedData.screenshots) ? cachedData.screenshots : []
      const missingScreenshotFlags = cachedShots.some((shot) => {
        if (!shot || typeof shot !== 'object') return false
        const hasSexual = Object.prototype.hasOwnProperty.call(shot, 'sexual')
        const hasViolence = Object.prototype.hasOwnProperty.call(shot, 'violence')
        return !hasSexual && !hasViolence
      })

      if (!missingScreenshotFlags) {
        return res.json(cachedData)
      }
    }

    let vnData

    try {
      vnData = await fetchVnById(
        req.params.id,
        'id,title,alttitle,titles.lang,titles.title,description,tags.name,tags.rating,tags.category,tags.spoiler,developers.name,released,image.url,screenshots.url,screenshots.sexual,screenshots.violence,olang,languages,platforms,length_minutes,length_votes,relations.id,relations.title,relations.relation,rating,votecount'
      )
    } catch (_enhancedError) {
      vnData = await fetchVnById(
        req.params.id,
        'id,title,alttitle,description,tags.name,tags.rating,tags.category,developers.name,released,image.url,rating,votecount'
      )
    }
    
    // Cache the data
    await VNCache.findOneAndUpdate(
      { vnId: req.params.id },
      { data: vnData },
      { upsert: true, new: true }
    )

    res.json(vnData)
  } catch (error) {
    console.error('VN fetch error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/vn/:id/releases', async (req, res) => {
  try {
    const vnId = req.params.id
    const response = await fetch('https://api.vndb.org/kana/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: ['vn', '=', ['id', '=', vnId]],
        fields: 'id,title,released,platforms,languages.lang,producers.name,producers.developer,producers.publisher,minage,patch,official,freeware,doujin,notes,images.id,images.url,images.type,images.languages',
        results: 50,
        sort: 'released'
      })
    })
    if (!response.ok) return res.json([])
    const data = await response.json()
    res.json(Array.isArray(data.results) ? data.results : [])
  } catch (_error) {
    res.json([])
  }
})

app.get('/api/vn/:id/covers', async (req, res) => {
  try {
    const vnId = req.params.id

    const [vnResponse, releaseResponse] = await Promise.all([
      fetch('https://api.vndb.org/kana/vn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: ['id', '=', vnId],
          fields: 'id,image.id,image.url,image.thumbnail,image.thumbnail_dims,image.dims,image.sexual,image.violence'
        })
      }),
      fetch('https://api.vndb.org/kana/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: ['vn', '=', ['id', '=', vnId]],
          fields: 'id,title,released,images.id,images.url,images.thumbnail,images.thumbnail_dims,images.dims,images.sexual,images.violence,images.type,images.languages',
          results: 100,
          sort: 'released'
        })
      })
    ])

    const covers = []
    const seen = new Set()

    if (vnResponse.ok) {
      const vnData = await vnResponse.json()
      const vn = Array.isArray(vnData.results) ? vnData.results[0] : null
      const mainImage = vn?.image
      if (mainImage?.url) {
        const key = `main:${mainImage.id || mainImage.url}`
        if (!seen.has(key)) {
          seen.add(key)
          covers.push({
            id: mainImage.id || `main-${vnId}`,
            url: mainImage.url,
            thumbnail: mainImage.thumbnail || mainImage.url,
            dims: mainImage.dims || null,
            thumbnail_dims: mainImage.thumbnail_dims || null,
            sexual: mainImage.sexual ?? 0,
            violence: mainImage.violence ?? 0,
            type: 'main',
            languages: null,
            release: null
          })
        }
      }
    }

    if (releaseResponse.ok) {
      const releaseData = await releaseResponse.json()
      const releases = Array.isArray(releaseData.results) ? releaseData.results : []

      for (const release of releases) {
        const images = Array.isArray(release.images) ? release.images : []
        for (const image of images) {
          if (!image?.url) continue
          const key = `release:${image.id || image.url}`
          if (seen.has(key)) continue
          seen.add(key)

          covers.push({
            id: image.id || `${release.id}-${covers.length + 1}`,
            url: image.url,
            thumbnail: image.thumbnail || image.url,
            dims: image.dims || null,
            thumbnail_dims: image.thumbnail_dims || null,
            sexual: image.sexual ?? 0,
            violence: image.violence ?? 0,
            type: image.type || 'unknown',
            languages: image.languages || null,
            release: {
              id: release.id,
              title: release.title,
              released: release.released || null
            }
          })
        }
      }
    }

    res.json(covers)
  } catch (_error) {
    res.json([])
  }
})

app.get('/api/vn/:id/quotes', async (req, res) => {
  try {
    const vnId = req.params.id
    const response = await fetch('https://api.vndb.org/kana/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: ['vn', '=', ['id', '=', vnId]],
        fields: 'id,quote,score,character.id,character.name',
        sort: 'score',
        reverse: true,
        results: 50
      })
    })

    if (!response.ok) return res.json([])

    const data = await response.json()
    const quotes = Array.isArray(data.results) ? data.results : []
    res.json(quotes)
  } catch (_error) {
    res.json([])
  }
})

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
})