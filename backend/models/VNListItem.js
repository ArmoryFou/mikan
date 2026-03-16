import mongoose from 'mongoose'

const vnListItemSchema = new mongoose.Schema({
  list: { type: mongoose.Schema.Types.ObjectId, ref: 'VNList', required: true },
  vnId: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  image: { type: String, trim: true, default: '' },
  position: { type: Number, required: true, min: 0 },
  originalRank: { type: Number, default: null },
  rankScore: { type: Number, min: 1, max: 10, default: null },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  addedAt: { type: Date, default: Date.now }
})

vnListItemSchema.index({ list: 1, vnId: 1 }, { unique: true })
vnListItemSchema.index({ list: 1, position: 1 })
vnListItemSchema.index({ list: 1, originalRank: 1 })
vnListItemSchema.index({ list: 1, addedAt: -1 })
vnListItemSchema.index({ vnId: 1 })

export default mongoose.model('VNListItem', vnListItemSchema)
