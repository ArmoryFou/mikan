import mongoose from 'mongoose'

const listLikeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  list: { type: mongoose.Schema.Types.ObjectId, ref: 'VNList', required: true },
  createdAt: { type: Date, default: Date.now }
})

listLikeSchema.index({ user: 1, list: 1 }, { unique: true })
listLikeSchema.index({ list: 1, createdAt: -1 })
listLikeSchema.index({ user: 1, createdAt: -1 })

export default mongoose.model('ListLike', listLikeSchema)
