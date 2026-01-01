// models.js - Scholar.AI Database Models
const mongoose = require('mongoose');

// New Connection String
const MONGO_URI = "mongodb+srv://youesff:Ihatmy@cluster0.0g59bdw.mongodb.net/scholarai?retryWrites=true&w=majority";

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ MongoDB Connected: Scholar.AI Cluster');
  } catch (err) {
    console.error('❌ DB Connection Error:', err.message);
    process.exit(1);
  }
};

// User Schema (Enhanced for Academic Profile)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  hash: { type: String, required: true },
  salt: { type: String, required: true },
  gradeLevel: { type: String, default: 'University' },
  major: { type: String, default: 'General' },
  profilePic: { type: String, default: '' },
  token: String,
  tokenExpiry: Date
}, { timestamps: true });

// Document Schema (Stores PDF content & AI Persona settings)
const documentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: { type: String, required: true },
  textContent: { type: String }, // Extracted text
  summary: { type: String },
  personaName: { type: String, default: 'The Author' }, // e.g., "Professor of Physics"
  personaTone: { type: String, default: 'Academic' }, // e.g., "Strict", "Friendly"
  fileSize: String,
  uploadDate: { type: Date, default: Date.now }
});

// Study Plan Schema
const studyPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subject: String,
  goal: String,
  deadline: Date,
  schedule: [
    {
      day: String,
      tasks: [String],
      completed: { type: Boolean, default: false }
    }
  ],
  isActive: { type: Boolean, default: true }
});

// Analytics/Progress Schema
const progressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subject: String,
  score: { type: Number, default: 0 }, // 0-100
  studyHours: { type: Number, default: 0 },
  lastSession: Date
});

const User = mongoose.model('User', userSchema);
const Document = mongoose.model('Document', documentSchema);
const StudyPlan = mongoose.model('StudyPlan', studyPlanSchema);
const Progress = mongoose.model('Progress', progressSchema);

module.exports = { connectDB, User, Document, StudyPlan, Progress };