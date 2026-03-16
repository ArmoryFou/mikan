import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['follow', 'review', 'status_change', 'recommend'],
    required: true
  },
  message: { type: String, trim: true, maxlength: 240, default: '' },
  targetId: { type: String, trim: true, default: '' },
  targetTitle: { type: String, trim: true, default: '' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
})

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 })

export default mongoose.model('Notification', notificationSchema)