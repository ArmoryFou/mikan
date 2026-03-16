import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  displayName: { type: String, trim: true, maxlength: 60, default: '' },
  avatarUrl: { type: String, trim: true, default: '' },
  bio: { type: String, trim: true, maxlength: 240, default: '' },
  favoriteVNs: {
    type: [
      {
        vnId: { type: String, required: true },
        title: { type: String, required: true, trim: true, maxlength: 180 },
        image: { type: String, trim: true, default: '' }
      }
    ],
    default: [],
    validate: {
      validator: (value) => value.length <= 4,
      message: 'favoriteVNs cannot exceed 4 entries'
    }
  },
  favoriteCharacters: {
    type: [
      {
        charId: { type: String, required: true },
        name: { type: String, required: true, trim: true, maxlength: 120 },
        image: { type: String, trim: true, default: '' }
      }
    ],
    default: [],
    validate: {
      validator: (value) => value.length <= 4,
      message: 'favoriteCharacters cannot exceed 4 entries'
    }
  },
  preferredVnCovers: {
    type: [
      {
        vnId: { type: String, required: true },
        image: { type: String, required: true, trim: true }
      }
    ],
    default: [],
    validate: {
      validator: (value) => value.length <= 200,
      message: 'preferredVnCovers cannot exceed 200 entries'
    }
  },
  preferences: {
    profileVisibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public'
    },
    compactMode: {
      type: Boolean,
      default: false
    }
  },
  createdAt: { type: Date, default: Date.now }
})

userSchema.pre('save', async function() {
  if (!this.isModified('password')) return

  try {
    const hash = await bcrypt.hash(this.password, 10)
    this.password = hash
  } catch (error) {
    throw error
  }
})

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

export default mongoose.model('User', userSchema)