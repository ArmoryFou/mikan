import mongoose from 'mongoose'

const vnReviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vnId: { type: String, required: true },
  title: { type: String, required: true },
  image: { type: String, default: '' },
  rating: { type: Number, min: 1, max: 10 },
  review: { type: String, required: true, trim: true, maxlength: 5000 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

vnReviewSchema.index({ vnId: 1, createdAt: -1 })
vnReviewSchema.index({ user: 1, vnId: 1, createdAt: -1 })

export default mongoose.model('VNReview', vnReviewSchema)
