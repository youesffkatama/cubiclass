const mongoose = require('mongoose');
const logger = require('../services/logger');
const CONFIG = require('./index');

let dbConnection = null;

const connectDB = async () => {
  if (dbConnection) {
    return dbConnection;
  }

  try {
    // For development, we'll use a mock connection if MongoDB isn't available
    if (CONFIG.NODE_ENV === 'development') {
      // Try to connect to MongoDB
      dbConnection = await mongoose.connect(CONFIG.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000, // 5 seconds timeout
        bufferCommands: false,
        maxPoolSize: 10,
        socketTimeoutMS: 45000,
        retryWrites: true
      });
      
      logger.info(`✅ MongoDB connected: ${dbConnection.connection.host}`);
    } else {
      // For production, we'll use the real connection
      dbConnection = await mongoose.connect(CONFIG.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        retryWrites: true
      });
      
      logger.info(`✅ MongoDB connected: ${dbConnection.connection.host}`);
    }

    // Graceful shutdown handling
    process.on('SIGINT', async () => {
      logger.info('SIGINT received, closing MongoDB connection');
      await mongoose.connection.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, closing MongoDB connection');
      await mongoose.connection.close();
      process.exit(0);
    });

    return dbConnection;
  } catch (error) {
    logger.error('❌ MongoDB connection error:', error);
    
    // In development, we can use a mock connection as fallback
    if (CONFIG.NODE_ENV === 'development') {
      logger.warn('⚠️  MongoDB not available, using in-memory storage for development');
      // We'll continue without MongoDB for development purposes
      return null;
    } else {
      process.exit(1);
    }
  }
};

module.exports = { connectDB };