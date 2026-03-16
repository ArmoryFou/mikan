import mongoose from 'mongoose'

const listCommentSchema = new mongoose.Schema({
  list: { type: mongoose.Schema.Types.ObjectId, ref: 'VNList', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

listCommentSchema.index({ list: 1, createdAt: -1 })
listCommentSchema.index({ author: 1, createdAt: -1 })

export default mongoose.model('ListComment', listCommentSchema)
