import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  username: string;
  email: string;
  auth: {
    passwordHash: string;
    mfaEnabled: boolean;
    provider: 'local' | 'google' | 'github';
    providerId?: string;
  };
  dna: {
    learningStyle: 'Visual' | 'Textual' | 'Socratic' | 'Kinesthetic';
    weaknesses: string[];
    strengths: string[];
    xp: number;
    level: number;
    rank: 'Novice' | 'Scholar' | 'Researcher' | 'Professor' | 'Nobel';
    badges: string[];
    streak: number;
    lastActivity: Date;
  };
  settings: {
    theme: string;
    language: string;
    openRouterModel: string;
    notificationsEnabled: boolean;
    autoSaveEnabled: boolean;
  };
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    validUntil?: Date;
    features: string[];
  };
  usage: {
    uploadedFiles: number;
    totalQueries: number;
    totalStudyHours: number;
    lastUpload?: Date;
  };
  comparePassword(candidatePassword: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  auth: {
    passwordHash: {
      type: String,
      required: function() {
        return this.auth.provider === 'local';
      },
      select: false
    },
    mfaEnabled: {
      type: Boolean,
      default: false
    },
    provider: {
      type: String,
      enum: ['local', 'google', 'github'],
      default: 'local'
    },
    providerId: String
  },
  dna: {
    learningStyle: {
      type: String,
      enum: ['Visual', 'Textual', 'Socratic', 'Kinesthetic'],
      default: 'Textual'
    },
    weaknesses: {
      type: [String],
      default: []
    },
    strengths: {
      type: [String],
      default: []
    },
    xp: {
      type: Number,
      default: 0,
      min: 0
    },
    level: {
      type: Number,
      default: 1,
      min: 1
    },
    rank: {
      type: String,
      enum: ['Novice', 'Scholar', 'Researcher', 'Professor', 'Nobel'],
      default: 'Novice'
    },
    badges: {
      type: [String],
      default: []
    },
    streak: {
      type: Number,
      default: 0
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },
  settings: {
    theme: {
      type: String,
      default: 'vience-dark'
    },
    language: {
      type: String,
      default: 'en'
    },
    openRouterModel: {
      type: String,
      default: 'mistralai/mistral-7b-instruct:free'
    },
    notificationsEnabled: {
      type: Boolean,
      default: true
    },
    autoSaveEnabled: {
      type: Boolean,
      default: true
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free'
    },
    validUntil: Date,
    features: {
      type: [String],
      default: ['basic-chat', 'pdf-upload', 'flashcards']
    }
  },
  usage: {
    uploadedFiles: {
      type: Number,
      default: 0
    },
    totalQueries: {
      type: Number,
      default: 0
    },
    totalStudyHours: {
      type: Number,
      default: 0
    },
    lastUpload: Date
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.auth.passwordHash;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ 'dna.xp': -1 });
UserSchema.index({ createdAt: -1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('auth.passwordHash')) return next();
  
  if (this.auth.passwordHash) {
    this.auth.passwordHash = await bcrypt.hash(this.auth.passwordHash, 12);
  }
  next();
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.auth.passwordHash);
};

// Update rank based on XP
UserSchema.pre('save', function(next) {
  const xp = this.dna.xp;
  
  if (xp >= 10000) this.dna.rank = 'Nobel';
  else if (xp >= 5000) this.dna.rank = 'Professor';
  else if (xp >= 2000) this.dna.rank = 'Researcher';
  else if (xp >= 500) this.dna.rank = 'Scholar';
  else this.dna.rank = 'Novice';
  
  this.dna.level = Math.floor(xp / 100) + 1;
  
  next();
});

export default mongoose.model<IUser>('User', UserSchema);