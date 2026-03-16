import mongoose from 'mongoose'

const vnListSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 90 },
  description: { type: String, trim: true, maxlength: 1200, default: '' },
  type: {
    type: String,
    enum: ['normal', 'ranking'],
    default: 'normal'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'unlisted'],
    default: 'public'
  },
  itemCount: { type: Number, default: 0 },
  followersCount: { type: Number, default: 0 },
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  coverImages: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

vnListSchema.index({ owner: 1, name: 1 }, { unique: true })
vnListSchema.index({ owner: 1, updatedAt: -1 })
vnListSchema.index({ visibility: 1, followersCount: -1, updatedAt: -1 })
vnListSchema.index({ visibility: 1, likesCount: -1, updatedAt: -1 })
vnListSchema.index({ visibility: 1, type: 1, updatedAt: -1 })
vnListSchema.index({ name: 'text', description: 'text' })

export default mongoose.model('VNList', vnListSchema)
