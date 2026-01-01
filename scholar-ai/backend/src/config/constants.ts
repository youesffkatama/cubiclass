/**
 * Application Constants
 * Centralized configuration values and enums
 */

// ==================== ENUMS ====================

export enum ProcessingStatus {
    QUEUED = 'QUEUED',
    PROCESSING = 'PROCESSING',
    EXTRACTING = 'EXTRACTING',
    VECTORIZING = 'VECTORIZING',
    INDEXED = 'INDEXED',
    FAILED = 'FAILED',
  }
  
  export enum UserRole {
    USER = 'user',
    ADMIN = 'admin',
    PREMIUM = 'premium',
  }
  
  export enum SubscriptionPlan {
    FREE = 'free',
    PRO = 'pro',
    ENTERPRISE = 'enterprise',
  }
  
  export enum MessageRole {
    USER = 'user',
    ASSISTANT = 'assistant',
    SYSTEM = 'system',
  }
  
  export enum Difficulty {
    BEGINNER = 'beginner',
    INTERMEDIATE = 'intermediate',
    ADVANCED = 'advanced',
    EXPERT = 'expert',
  }
  
  export enum FileType {
    PDF = 'PDF',
    DOCUMENT = 'DOCUMENT',
    IMAGE = 'IMAGE',
  }
  
  // ==================== RATE LIMITS ====================
  
  export const RATE_LIMITS = {
    // Authentication
    AUTH_REGISTER: { points: 5, duration: 900 }, // 5 requests per 15 min
    AUTH_LOGIN: { points: 10, duration: 900 }, // 10 requests per 15 min
    
    // File operations
    FILE_UPLOAD: {
      free: { points: 5, duration: 86400 }, // 5 per day
      pro: { points: 50, duration: 86400 }, // 50 per day
      enterprise: { points: 500, duration: 86400 }, // 500 per day
    },
    
    // Chat operations
    CHAT_MESSAGE: {
      free: { points: 50, duration: 3600 }, // 50 per hour
      pro: { points: 200, duration: 3600 }, // 200 per hour
      enterprise: { points: 1000, duration: 3600 }, // 1000 per hour
    },
    
    // Generation operations
    GENERATION: {
      free: { points: 20, duration: 3600 }, // 20 per hour
      pro: { points: 100, duration: 3600 }, // 100 per hour
      enterprise: { points: 500, duration: 3600 }, // 500 per hour
    },
    
    // General API
    GENERAL: { points: 100, duration: 900 }, // 100 requests per 15 min
  };
  
  // ==================== AI MODEL CONFIGS ====================
  
  export const AI_MODELS = {
    DEFAULT: 'mistralai/mistral-7b-instruct:free',
    FALLBACK: 'meta-llama/llama-3-8b-instruct:free',
    
    AVAILABLE: {
      'mistral-7b': {
        id: 'mistralai/mistral-7b-instruct:free',
        name: 'Mistral 7B',
        contextWindow: 8192,
        costPer1kTokens: 0,
        description: 'Fast and efficient for general tasks',
      },
      'llama-3-8b': {
        id: 'meta-llama/llama-3-8b-instruct:free',
        name: 'Llama 3 8B',
        contextWindow: 8192,
        costPer1kTokens: 0,
        description: 'Balanced performance and quality',
      },
      'llama-3-70b': {
        id: 'meta-llama/llama-3-70b-instruct',
        name: 'Llama 3 70B',
        contextWindow: 8192,
        costPer1kTokens: 0.0009,
        description: 'High quality responses',
      },
      'mixtral-8x7b': {
        id: 'mistralai/mixtral-8x7b-instruct',
        name: 'Mixtral 8x7B',
        contextWindow: 32768,
        costPer1kTokens: 0.0006,
        description: 'Large context window',
      },
    },
  };
  
  // ==================== VECTORIZATION CONFIG ====================
  
  export const VECTOR_CONFIG = {
    MODEL: 'Xenova/all-MiniLM-L6-v2',
    DIMENSION: 384,
    CHUNK_SIZE: 1000,
    CHUNK_OVERLAP: 200,
    MAX_CHUNKS_PER_QUERY: 5,
    SIMILARITY_THRESHOLD: 0.5,
  };
  
  // ==================== FILE PROCESSING CONFIG ====================
  
  export const FILE_CONFIG = {
    MAX_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_TYPES: ['application/pdf'],
    UPLOAD_DIR: 'uploads/pdfs',
    
    PDF: {
      MAX_PAGES: 500,
      OCR_ENABLED: true,
      OCR_LANGUAGES: ['eng', 'fra', 'deu', 'spa'],
    },
  };
  
  // ==================== WORKER CONFIG ====================
  
  export const WORKER_CONFIG = {
    PDF_PROCESSING: {
      concurrency: 2,
      maxRetries: 3,
      retryDelay: 5000, // 5 seconds
    },
    
    EMAIL: {
      concurrency: 5,
      maxRetries: 3,
      retryDelay: 10000, // 10 seconds
    },
    
    ANALYTICS: {
      concurrency: 3,
      maxRetries: 2,
      retryDelay: 5000,
    },
  };
  
  // ==================== ACHIEVEMENT BADGES ====================
  
  export const ACHIEVEMENT_BADGES = {
    FIRST_UPLOAD: {
      id: 'first_upload',
      name: 'First Upload',
      description: 'Upload your first document',
      icon: '📄',
      xp: 10,
    },
    PROLIFIC_LEARNER: {
      id: 'prolific_learner',
      name: 'Prolific Learner',
      description: 'Upload 10 documents',
      icon: '📚',
      xp: 100,
    },
    WEEK_WARRIOR: {
      id: 'week_warrior',
      name: 'Week Warrior',
      description: '7-day study streak',
      icon: '🔥',
      xp: 50,
    },
    MONTHLY_MASTER: {
      id: 'monthly_master',
      name: 'Monthly Master',
      description: '30-day study streak',
      icon: '⭐',
      xp: 200,
    },
    LEVEL_10: {
      id: 'level_10',
      name: 'Level 10',
      description: 'Reach level 10',
      icon: '🎖️',
      xp: 150,
    },
  };
  
  // ==================== JWT CONFIG ====================
  
  export const JWT_CONFIG = {
    ACCESS_TOKEN_EXPIRY: process.env.JWT_EXPIRY || '7d',
    REFRESH_TOKEN_EXPIRY: '30d',
    ALGORITHM: 'HS256' as const,
  };
  
  // ==================== ERROR MESSAGES ====================
  
  export const ERROR_MESSAGES = {
    // Authentication
    INVALID_CREDENTIALS: 'Invalid email or password',
    TOKEN_EXPIRED: 'Token has expired',
    TOKEN_INVALID: 'Invalid token',
    UNAUTHORIZED: 'Authentication required',
    
    // Validation
    VALIDATION_FAILED: 'Validation failed',
    INVALID_INPUT: 'Invalid input data',
    
    // Resources
    NOT_FOUND: 'Resource not found',
    ALREADY_EXISTS: 'Resource already exists',
    
    // Rate Limiting
    RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later',
    
    // Processing
    PROCESSING_FAILED: 'Failed to process file',
    VECTORIZATION_FAILED: 'Failed to generate embeddings',
    
    // General
    INTERNAL_ERROR: 'Internal server error',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  };
  
  // ==================== SUCCESS MESSAGES ====================
  
  export const SUCCESS_MESSAGES = {
    REGISTRATION_SUCCESS: 'Registration successful',
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logout successful',
    UPDATE_SUCCESS: 'Update successful',
    DELETE_SUCCESS: 'Delete successful',
    UPLOAD_SUCCESS: 'Upload successful',
  };
  
  // ==================== SUBSCRIPTION FEATURES ====================
  
  export const SUBSCRIPTION_FEATURES = {
    free: {
      maxUploads: 5,
      maxStorageGB: 1,
      chatMessagesPerHour: 50,
      generationsPerHour: 20,
      features: ['basic-chat', 'pdf-upload', 'flashcards', 'quizzes'],
    },
    pro: {
      maxUploads: 50,
      maxStorageGB: 10,
      chatMessagesPerHour: 200,
      generationsPerHour: 100,
      features: [
        'basic-chat',
        'pdf-upload',
        'flashcards',
        'quizzes',
        'advanced-analytics',
        'study-plans',
        'priority-processing',
        'export-data',
      ],
    },
    enterprise: {
      maxUploads: 500,
      maxStorageGB: 100,
      chatMessagesPerHour: 1000,
      generationsPerHour: 500,
      features: [
        'basic-chat',
        'pdf-upload',
        'flashcards',
        'quizzes',
        'advanced-analytics',
        'study-plans',
        'priority-processing',
        'export-data',
        'api-access',
        'custom-models',
        'team-collaboration',
        'sso',
      ],
    },
  };