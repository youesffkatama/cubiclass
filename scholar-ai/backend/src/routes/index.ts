/**
 * Main Routes Index
 * Central routing configuration
 */

 import { Router } from 'express';
 import authRoutes from './auth.routes';
 import workspaceRoutes from './workspace.routes';
 import intelligenceRoutes from './intelligence.routes';
 import analyticsRoutes from './analytics.routes';
 
 const router = Router();
 
 /**
  * Health check endpoint
  * GET /api/v1/health
  */
 router.get('/health', (req, res) => {
   res.json({
     success: true,
     message: 'Scholar.AI API is running',
     timestamp: new Date().toISOString(),
     version: process.env.APP_VERSION || '1.0.0',
   });
 });
 
 /**
  * API info endpoint
  * GET /api/v1/info
  */
 router.get('/info', (req, res) => {
   res.json({
     success: true,
     data: {
       name: 'Scholar.AI Backend API',
       version: process.env.APP_VERSION || '1.0.0',
       description: 'AI-powered study assistant with RAG capabilities',
       features: [
         'PDF processing and vectorization',
         'AI chat with document context',
         'Flashcard and quiz generation',
         'Study plan creation',
         'Progress analytics',
         'Personalized AI tutors',
       ],
       documentation: '/api/v1/docs',
     },
   });
 });
 
 /**
  * Mount route modules
  */
 router.use('/auth', authRoutes);
 router.use('/workspace', workspaceRoutes);
 router.use('/intelligence', intelligenceRoutes);
 router.use('/analytics', analyticsRoutes);
 
 export default router;