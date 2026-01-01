import mongoose, { Schema, Document } from 'mongoose';

export interface IKnowledgeNode extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'PDF' | 'WebUrl' | 'YoutubeTranscript' | 'Note' | 'Book';
  meta: {
    originalName: string;
    s3Key: string;
    mimeType: string;
    size: number;
    pageCount: number;
    wordCount: number;
    language?: string;
    uploadedAt: Date;
  };
  persona: {
    generatedName: string;
    voiceHash: string;
    personalityPrompt: string;
    avatarUrl: string;
    tone: 'Academic' | 'Friendly' | 'Socratic' | 'Strict' | 'Humorous';
    expertise: string[];
  };
  processing: {
    status: 'QUEUED' | 'PROCESSING' | 'VECTORIZING' | 'INDEXED' | 'FAILED';
    progress: number;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
    attempts: number;
  };
  content: {
    rawText?: string;
    summary: string;
    keyTopics: string[];
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
    subjects: string[];
  };
  relationships: {
    relatedNodes: mongoose.Types.ObjectId[];
    prerequisites: mongoose.Types.ObjectId[];
    citations: string[];
  };
  analytics: {
    viewCount: number;
    queryCount: number;
    avgSessionTime: number;
    lastAccessed?: Date;
  };
  classId?: mongoose.Types.ObjectId;
  tags: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeNodeSchema = new Schema<IKnowledgeNode>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['PDF', 'WebUrl', 'YoutubeTranscript', 'Note', 'Book'],
    required: true
  },
  meta: {
    originalName: {
      type: String,
      required: true
    },
    s3Key: {
      type: String,
      required: true
    },
    mimeType: String,
    size: {
      type: Number,
      required: true
    },
    pageCount: {
      type: Number,
      default: 0
    },
    wordCount: {
      type: Number,
      default: 0
    },
    language: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  persona: {
    generatedName: {
      type: String,
      default: 'AI Assistant'
    },
    voiceHash: String,
    personalityPrompt: {
      type: String,
      default: 'You are a helpful academic assistant.'
    },
    avatarUrl: String,
    tone: {
      type: String,
      enum: ['Academic', 'Friendly', 'Socratic', 'Strict', 'Humorous'],
      default: 'Friendly'
    },
    expertise: [String]
  },
  processing: {
    status: {
      type: String,
      enum: ['QUEUED', 'PROCESSING', 'VECTORIZING', 'INDEXED', 'FAILED'],
      default: 'QUEUED',
      index: true
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    startedAt: Date,
    completedAt: Date,
    error: String,
    attempts: {
      type: Number,
      default: 0
    }
  },
  content: {
    rawText: String,
    summary: {
      type: String,
      default: ''
    },
    keyTopics: [String],
    difficulty: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
      default: 'Intermediate'
    },
    subjects: [String]
  },
  relationships: {
    relatedNodes: [{
      type: Schema.Types.ObjectId,
      ref: 'KnowledgeNode'
    }],
    prerequisites: [{
      type: Schema.Types.ObjectId,
      ref: 'KnowledgeNode'
    }],
    citations: [String]
  },
  analytics: {
    viewCount: {
      type: Number,
      default: 0
    },
    queryCount: {
      type: Number,
      default: 0
    },
    avgSessionTime: {
      type: Number,
      default: 0
    },
    lastAccessed: Date
  },
  classId: {
    type: Schema.Types.ObjectId,
    ref: 'Class'
  },
  tags: [String],
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
KnowledgeNodeSchema.index({ userId: 1, createdAt: -1 });
KnowledgeNodeSchema.index({ 'processing.status': 1 });
KnowledgeNodeSchema.index({ 'content.subjects': 1 });
KnowledgeNodeSchema.index({ tags: 1 });
KnowledgeNodeSchema.index({ classId: 1 });

// Text search index
KnowledgeNodeSchema.index({
  'meta.originalName': 'text',
  'content.summary': 'text',
  'content.keyTopics': 'text'
});

export default mongoose.model<IKnowledgeNode>('KnowledgeNode', KnowledgeNodeSchema);