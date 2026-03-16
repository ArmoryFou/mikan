import mongoose from 'mongoose'

const vnCacheSchema = new mongoose.Schema({
  vnId: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  lastUpdated: { type: Date, default: Date.now }
})

// Auto-update lastUpdated on save
vnCacheSchema.pre('save', function(next) {
  this.lastUpdated = new Date()
  next()
})

export default mongoose.model('VNCache', vnCacheSchema)