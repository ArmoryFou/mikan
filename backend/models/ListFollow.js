import mongoose from 'mongoose'

const listFollowSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  list: { type: mongoose.Schema.Types.ObjectId, ref: 'VNList', required: true },
  createdAt: { type: Date, default: Date.now }
})

listFollowSchema.index({ user: 1, list: 1 }, { unique: true })
listFollowSchema.index({ list: 1, createdAt: -1 })
listFollowSchema.index({ user: 1, createdAt: -1 })

export default mongoose.model('ListFollow', listFollowSchema)
