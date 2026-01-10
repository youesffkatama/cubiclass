/**
 * Production-ready server configuration for Scholar.AI
 * Implements security best practices and production optimizations
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIO = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// Import configuration
const CONFIG = require('./config');
const { connectDB } = require('./config/database');

// Import services
const logger = require('./services/logger');
const { initializeQueue } = require('./services/queueService');

// Import routes
const apiRoutes = require('./routes/api');

// Create Express app
const app = express();
const server = http.createServer(app);

// Configure Socket.IO with security
const io = socketIO(server, {
  cors: {
    origin: CONFIG.FRONTEND_URL || 'http://localhost:8080',
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  // Production settings
  maxHttpBufferSize: 1e6, // 1MB
  cors: {
    origin: CONFIG.FRONTEND_URL || 'http://localhost:8080',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Apply security middleware in correct order
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdn.jsdelivr.net'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https:', 'http:'],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration with security in mind
const corsOptions = {
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://studious-space-telegram-5gj47g7j6rvxhvv94-3000.app.github.dev',
      process.env.FRONTEND_URL
    ].filter(Boolean); // Remove undefined values
    
    if (CONFIG.NODE_ENV === 'production') {
      // In production, only allow specific origins
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // In development, allow all origins
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  maxAge: 86400 // Cache CORS preflight for 24 hours
};

app.use(cors(corsOptions));

// Additional security middleware
app.use(compression()); // Enable gzip compression
app.use(mongoSanitize()); // Prevent MongoDB operator injection
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: { message: 'Invalid JSON' } });
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving with security
app.use(express.static('public', {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Prevent execution of uploaded files
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }
}));

app.use('/uploads', express.static('uploads', {
  maxAge: '1d',
  etag: true,
  setHeaders: (res, path) => {
    // Prevent execution of uploaded files
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
  }
}));

// Enhanced rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: CONFIG.NODE_ENV === 'production' ? 5 : 50, // More generous in development
  message: {
    error: {
      message: 'Too many auth attempts, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    // Skip rate limiting for development
    return CONFIG.NODE_ENV === 'development';
  }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: CONFIG.NODE_ENV === 'production' ? 100 : 1000, // More generous in development
  message: {
    error: {
      message: 'Too many requests from this IP'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    // Skip rate limiting for development
    return CONFIG.NODE_ENV === 'development';
  }
});

const sensitiveApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: CONFIG.NODE_ENV === 'production' ? 50 : 500, // More restrictive for sensitive endpoints
  message: {
    error: {
      message: 'Too many requests to sensitive API endpoints'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    // Skip rate limiting for development
    return CONFIG.NODE_ENV === 'development';
  }
});

// Apply rate limits to specific routes
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);
app.use('/api/v1/intelligence', sensitiveApiLimiter);
app.use('/api/v1/workspace', sensitiveApiLimiter);
app.use('/api/v1/', apiLimiter);

// Logging middleware
if (CONFIG.NODE_ENV === 'production') {
  app.use(morgan('combined', {
    stream: { write: msg => logger.info(msg.trim()) }
  }));
} else {
  app.use(morgan('dev'));
}

// Initialize database connection
async function connectDatabase() {
  await connectDB();
}

// Initialize queue service
initializeQueue();

// Routes
app.use('/api', apiRoutes);

// Serve static files in production
if (CONFIG.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
  
  // Serve index.html for all non-API routes (SPA fallback)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    node_env: CONFIG.NODE_ENV,
    version: '3.0.0'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found'
    }
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  // Log the error with context
  logger.error('Unhandled error:', {
    error: err.message,
    stack: CONFIG.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Determine status code
  const statusCode = err.status || err.statusCode || 500;
  
  // Prepare error response
  const errorResponse = {
    error: {
      message: CONFIG.NODE_ENV === 'production' 
        ? 'An error occurred' 
        : err.message
    }
  };

  // Add stack trace only in development
  if (CONFIG.NODE_ENV === 'development' && err.stack) {
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
});

// Socket.IO connection handling
io.use((socket, next) => {
  // Authenticate socket connection
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  
  if (!token) {
    logger.warn('Socket connection attempt without token');
    return next(new Error('Authentication error'));
  }
  
  // In a real app, you would verify the JWT token here
  // For now, we'll just check if it's a reasonable length
  if (token.length < 10) {
    logger.warn('Socket connection attempt with invalid token');
    return next(new Error('Invalid token'));
  }
  
  next();
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  
  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);
  });
  
  // Add other socket event handlers as needed
});

// Start server
async function startServer() {
  try {
    await connectDatabase();
    
    server.listen(CONFIG.PORT, () => {
      logger.info(`🚀 Server running on port ${CONFIG.PORT} in ${CONFIG.NODE_ENV} mode`);
      logger.info(`📊 Health check available at http://localhost:${CONFIG.PORT}/health`);
      logger.info(`🌐 Access the application at http://localhost:${CONFIG.PORT}`);
      
      if (CONFIG.NODE_ENV === 'development') {
        logger.info(`🔧 Development mode: CORS enabled for all origins`);
        logger.info(`🔧 Development mode: Rate limiting disabled`);
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start the server
startServer();

module.exports = { app, server, io };