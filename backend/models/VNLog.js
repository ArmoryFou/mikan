import mongoose from 'mongoose'

const vnLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vnId: { type: String, required: true }, // VNDB ID like 'v17'
  title: { type: String, required: true },
  image: String,
  status: { 
    type: String, 
    enum: ['want-to-play', 'playing', 'completed', 'dropped', 'on-hold'], 
    default: 'want-to-play' 
  },
  rating: { type: Number, min: 1, max: 10 }, // 1-10 scale
  review: String,
  startedAt: Date,
  completedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// Compound index to prevent duplicate logs
vnLogSchema.index({ user: 1, vnId: 1 }, { unique: true })
vnLogSchema.index({ vnId: 1 })
vnLogSchema.index({ vnId: 1, status: 1 })

export default mongoose.model('VNLog', vnLogSchema)