/**
 * Scholar.AI Backend - Main Application
 * Production-ready Express server with comprehensive security and features
 */

 import express, { Express, Request, Response } from 'express';
 import mongoose from 'mongoose';
 import cors from 'cors';
 import helmet from 'helmet';
 import compression from 'compression';
 import mongoSanitize from 'express-mongo-sanitize';
 import morgan from 'morgan';
 import { createServer } from 'http';
 import { Server as SocketIOServer } from 'socket.io';
 import dotenv from 'dotenv';
 
 // Import custom modules
 import routes from './routes';
 import { errorHandler, notFound } from './middleware/error.middleware';
 import logger, { stream } from './utils/logger';
 import vectorizationService from './services/vectorization.service';
 import { pdfWorker, emailWorker, analyticsWorker } from './workers/pdf.worker';
 
 // Load environment variables
 dotenv.config();
 
 /**
  * Create Express application
  */
 const app: Express = express();
 const httpServer = createServer(app);
 
 /**
  * Socket.IO setup for real-time features
  */
 const io = new SocketIOServer(httpServer, {
   cors: {
     origin: process.env.CORS_ORIGIN || '*',
     methods: ['GET', 'POST'],
     credentials: true,
   },
 });
 
 /**
  * Security middleware
  */
 
 // Helmet - sets security headers
 app.use(
   helmet({
     contentSecurityPolicy: false, // Disable CSP for API
     crossOriginEmbedderPolicy: false,
   })
 );
 
 // CORS configuration
 app.use(
   cors({
     origin: process.env.CORS_ORIGIN || '*',
     credentials: true,
     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
     allowedHeaders: ['Content-Type', 'Authorization'],
   })
 );
 
 // Prevent NoSQL injection
 app.use(mongoSanitize());
 
 /**
  * Body parsing middleware
  */
 app.use(express.json({ limit: '10mb' }));
 app.use(express.urlencoded({ extended: true, limit: '10mb' }));
 
 /**
  * Compression middleware
  */
 app.use(compression());
 
 /**
  * Logging middleware
  */
 if (process.env.NODE_ENV === 'development') {
   app.use(morgan('dev', { stream }));
 } else {
   app.use(morgan('combined', { stream }));
 }
 
 /**
  * Trust proxy (for deployment behind reverse proxy)
  */
 app.set('trust proxy', 1);
 
 /**
  * Root route
  */
 app.get('/', (req: Request, res: Response) => {
   res.json({
     success: true,
     message: 'Welcome to Scholar.AI API',
     version: process.env.APP_VERSION || '1.0.0',
     documentation: '/api/v1/info',
     health: '/api/v1/health',
   });
 });
 
 /**
  * Mount API routes
  */
 app.use('/api/v1', routes);
 
 /**
  * Socket.IO event handlers
  */
 io.on('connection', (socket) => {
   logger.info(`Socket connected: ${socket.id}`);
   
   // Join user room
   socket.on('join', (userId: string) => {
     socket.join(`user:${userId}`);
     logger.info(`User ${userId} joined their room`);
   });
   
   // Handle processing updates
   socket.on('subscribe:processing', (nodeId: string) => {
     socket.join(`processing:${nodeId}`);
   });
   
   socket.on('disconnect', () => {
     logger.info(`Socket disconnected: ${socket.id}`);
   });
 });
 
 // Export io for use in other modules
 export { io };
 
 /**
  * 404 handler
  */
 app.use(notFound);
 
 /**
  * Global error handler
  */
 app.use(errorHandler);
 
 /**
  * Database connection
  */
 const connectDatabase = async () => {
   try {
     const mongoUri = process.env.MONGODB_URI;
     
     if (!mongoUri) {
       throw new Error('MONGODB_URI is not defined in environment variables');
     }
     
     await mongoose.connect(mongoUri, {
       maxPoolSize: 10,
       serverSelectionTimeoutMS: 5000,
       socketTimeoutMS: 45000,
     });
     
     logger.info('✅ MongoDB connected successfully');
     
     // Log connection details in development
     if (process.env.NODE_ENV === 'development') {
       logger.info(`Database: ${mongoose.connection.name}`);
       logger.info(`Host: ${mongoose.connection.host}`);
     }
   } catch (error) {
     logger.error('❌ MongoDB connection failed:', error);
     process.exit(1);
   }
 };
 
 /**
  * Initialize services
  */
 const initializeServices = async () => {
   try {
     // Initialize vectorization service
     logger.info('Initializing vectorization service...');
     await vectorizationService.initialize();
     
     logger.info('✅ All services initialized');
   } catch (error) {
     logger.error('❌ Service initialization failed:', error);
     process.exit(1);
   }
 };
 
 /**
  * Start server
  */
 const startServer = async () => {
   try {
     const PORT = parseInt(process.env.PORT || '3000', 10);
     
     // Connect to database
     await connectDatabase();
     
     // Initialize services
     await initializeServices();
     
     // Start HTTP server
     httpServer.listen(PORT, '0.0.0.0', () => {
       logger.info('='.repeat(50));
       logger.info(`🚀 Scholar.AI Backend Server Started`);
       logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
       logger.info(`Port: ${PORT}`);
       logger.info(`API URL: http://localhost:${PORT}/api/v1`);
       logger.info(`Workers: PDF, Email, Analytics`);
       logger.info('='.repeat(50));
     });
   } catch (error) {
     logger.error('❌ Failed to start server:', error);
     process.exit(1);
   }
 };
 
 /**
  * Graceful shutdown
  */
 const gracefulShutdown = async (signal: string) => {
   logger.info(`${signal} received. Starting graceful shutdown...`);
   
   try {
     // Close HTTP server
     await new Promise<void>((resolve) => {
       httpServer.close(() => {
         logger.info('HTTP server closed');
         resolve();
       });
     });
     
     // Close workers
     await Promise.all([
       pdfWorker.close(),
       emailWorker.close(),
       analyticsWorker.close(),
     ]);
     logger.info('Workers closed');
     
     // Close database connection
     await mongoose.connection.close();
     logger.info('Database connection closed');
     
     logger.info('✅ Graceful shutdown completed');
     process.exit(0);
   } catch (error) {
     logger.error('❌ Error during shutdown:', error);
     process.exit(1);
   }
 };
 
 // Handle shutdown signals
 process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
 process.on('SIGINT', () => gracefulShutdown('SIGINT'));
 
 // Handle uncaught exceptions
 process.on('uncaughtException', (error: Error) => {
   logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', error);
   process.exit(1);
 });
 
 // Handle unhandled promise rejections
 process.on('unhandledRejection', (reason: any) => {
   logger.error('UNHANDLED REJECTION! 💥 Shutting down...', reason);
   gracefulShutdown('UNHANDLED_REJECTION');
 });
 
 /**
  * Start the application
  */
 if (require.main === module) {
   startServer();
 }
 
 export default app;