import mongoose from 'mongoose'

const characterCacheSchema = new mongoose.Schema({
  charId: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  lastUpdated: { type: Date, default: Date.now }
})

characterCacheSchema.pre('save', function(next) {
  this.lastUpdated = new Date()
  next()
})

export default mongoose.model('CharacterCache', characterCacheSchema)
