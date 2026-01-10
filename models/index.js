const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    refreshToken: { type: String, default: null },
    refreshTokenExpiry: { type: Date, default: null },

    profile: {
        firstName: String,
        lastName: String,
        avatar: String,
        bio: String,
    },

    dna: {
        learningStyle: { type: String, enum: ['Visual', 'Textual', 'Socratic'], default: 'Visual' },
        weaknesses: [String],
        strengths: [String],
        xp: { type: Number, default: 0 },
        level: { type: Number, default: 1 },
        rank: {
            type: String,
            enum: ['Novice', 'Scholar', 'Researcher', 'Professor', 'Nobel'],
            default: 'Novice'
        },
        badges: [{
            name: String,
            icon: String,
            earnedAt: Date
        }],
        streakDays: { type: Number, default: 0 },
        lastActiveDate: Date
    },

    settings: {
        theme: { type: String, default: 'dark' },
        aiModel: { type: String, default: 'mistralai/mistral-7b-instruct:free' },
        notifications: { type: Boolean, default: true }
    },

    subscription: {
        plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
        expiresAt: Date
    },

    createdAt: { type: Date, default: Date.now },
    lastLogin: Date
});

const KnowledgeNodeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['PDF', 'WebUrl', 'Note'], default: 'PDF' },

    meta: {
        originalName: String,
        filePath: String,
        mimeType: String,
        size: Number,
        pageCount: Number,
        wordCount: Number,
        language: String
    },

    persona: {
        generatedName: String,
        voiceHash: String,
        personalityPrompt: String,
        tone: String,
        avatarUrl: String
    },

    status: {
        type: String,
        enum: ['QUEUED', 'PROCESSING', 'INDEXED', 'FAILED'],
        default: 'QUEUED',
        index: true
    },
    processingError: String,

    tags: [String],
    relatedNodes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeNode' }],

    summary: String,
    keyPoints: [String],

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

KnowledgeNodeSchema.index({ userId: 1, status: 1 });
KnowledgeNodeSchema.index({ userId: 1, createdAt: -1 });

const VectorChunkSchema = new mongoose.Schema({
    nodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeNode', required: true, index: true },
    content: { type: String, required: true },
    embedding: { type: [Number], required: true },

    location: {
        pageNumber: Number,
        chunkIndex: Number,
        bbox: [Number]
    },

    metadata: {
        wordCount: Number,
        language: String
    }
});

VectorChunkSchema.index({ nodeId: 1, 'location.chunkIndex': 1 });

const ConversationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    nodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeNode', index: true },
    title: String,

    messages: [{
        role: { type: String, enum: ['user', 'assistant', 'system'] },
        content: String,
        timestamp: { type: Date, default: Date.now },
        citations: [{
            chunkId: mongoose.Schema.Types.ObjectId,
            pageNumber: Number,
            content: String
        }]
    }],

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

ConversationSchema.index({ userId: 1, updatedAt: -1 });

const StudyPlanSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    nodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeNode' },

    title: String,
    subject: String,
    examDate: Date,
    difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'] },

    schedule: [{
        day: Number,
        date: Date,
        tasks: [{
            type: { type: String, enum: ['Read', 'Review', 'Quiz', 'Practice'] },
            description: String,
            estimatedMinutes: Number,
            completed: { type: Boolean, default: false },
            completedAt: Date
        }]
    }],

    progress: {
        completedTasks: { type: Number, default: 0 },
        totalTasks: Number,
        percentage: { type: Number, default: 0 }
    },

    createdAt: { type: Date, default: Date.now }
});

StudyPlanSchema.index({ userId: 1, createdAt: -1 });

const ActivityLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
        type: String,
        enum: ['login', 'upload', 'chat', 'quiz', 'study', 'achievement'],
        index: true
    },
    description: String,
    metadata: mongoose.Schema.Types.Mixed,
    xpGained: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
});

ActivityLogSchema.index({ userId: 1, timestamp: -1 });
ActivityLogSchema.index({ userId: 1, type: 1, timestamp: -1 });

const ClassSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    description: String,
    color: { type: String, default: 'green' },
    inviteCode: { type: String, unique: true },
    members: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['teacher', 'student'], default: 'student' },
        joinedAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

ClassSchema.index({ userId: 1, createdAt: -1 });

const TaskSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    title: { type: String, required: true },
    description: String,
    dueDate: Date,
    completed: { type: Boolean, default: false },
    completedAt: Date,
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    createdAt: { type: Date, default: Date.now }
});

TaskSchema.index({ userId: 1, completed: 1, dueDate: 1 });

const NoteSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    nodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeNode' },
    title: { type: String, required: true },
    content: String,
    tags: [String],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

NoteSchema.index({ userId: 1, updatedAt: -1 });

const NotificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
    title: String,
    message: String,
    read: { type: Boolean, default: false },
    link: String,
    createdAt: { type: Date, default: Date.now }
});

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = {
    User: mongoose.model('User', UserSchema),
    KnowledgeNode: mongoose.model('KnowledgeNode', KnowledgeNodeSchema),
    VectorChunk: mongoose.model('VectorChunk', VectorChunkSchema),
    Conversation: mongoose.model('Conversation', ConversationSchema),
    StudyPlan: mongoose.model('StudyPlan', StudyPlanSchema),
    ActivityLog: mongoose.model('ActivityLog', ActivityLogSchema),
    Class: mongoose.model('Class', ClassSchema),
    Task: mongoose.model('Task', TaskSchema),
    Note: mongoose.model('Note', NoteSchema),
    Notification: mongoose.model('Notification', NotificationSchema)
};
