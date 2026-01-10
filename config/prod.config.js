/**
 * Production configuration for Scholar.AI
 * Contains environment-specific settings
 */

require('dotenv').config();

const CONFIG = {
  PORT: process.env.PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/scholar_ai',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || 6379,
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_jwt_secret_for_development',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_for_development',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '1h',
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || '7d',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:8080',
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  VECTOR_DIMENSIONS: parseInt(process.env.VECTOR_DIMENSIONS) || 384,
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Production-specific settings
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  TRUST_PROXY: process.env.TRUST_PROXY === 'true',
  SECURE_COOKIES: process.env.SECURE_COOKIES === 'true',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // Database settings
  DB_CONNECTION_POOL_SIZE: parseInt(process.env.DB_CONNECTION_POOL_SIZE) || 10,
  DB_CONNECTION_TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000,
  DB_SOCKET_TIMEOUT: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
  
  // Security settings
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [],
  
  // Queue settings
  QUEUE_CONCURRENCY: parseInt(process.env.QUEUE_CONCURRENCY) || 5,
  QUEUE_ATTEMPTS: parseInt(process.env.QUEUE_ATTEMPTS) || 3,
  
  // Performance settings
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 3600, // 1 hour
  RESPONSE_CACHE_TTL: parseInt(process.env.RESPONSE_CACHE_TTL) || 300, // 5 minutes
  
  // Feature flags
  ENABLE_AI_INTEGRATION: process.env.ENABLE_AI_INTEGRATION !== 'false',
  ENABLE_REALTIME_FEATURES: process.env.ENABLE_REALTIME_FEATURES !== 'false',
  ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS !== 'false',
  ENABLE_GAMIFICATION: process.env.ENABLE_GAMIFICATION !== 'false'
};

// Validate required environment variables in production
if (CONFIG.NODE_ENV === 'production') {
  const required = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'OPENROUTER_API_KEY', 'FRONTEND_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// Validate JWT secrets are not using defaults in production
if (CONFIG.NODE_ENV === 'production') {
  if (CONFIG.JWT_SECRET === 'fallback_jwt_secret_for_development') {
    console.error('❌ JWT_SECRET is using default value in production - this is insecure!');
    process.exit(1);
  }
  
  if (CONFIG.JWT_REFRESH_SECRET === 'fallback_refresh_secret_for_development') {
    console.error('❌ JWT_REFRESH_SECRET is using default value in production - this is insecure!');
    process.exit(1);
  }
}

module.exports = CONFIG;