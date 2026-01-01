/**
 * PDF Processing Worker
 * Handles background PDF ingestion jobs
 */

 import { Worker, Job } from 'bullmq';
 import { connection, PDFJobData } from './queue.config';
 import ingestionService from '../services/ingestion.service';
 import KnowledgeNode from '../models/KnowledgeNode.model';
 import User from '../models/User.model';
 import logger from '../utils/logger';
 import fs from 'fs/promises';
 
 /**
  * PDF Worker Configuration
  */
 const PDF_WORKER_CONCURRENCY = parseInt(process.env.PDF_WORKER_CONCURRENCY || '2');
 
 /**
  * Process PDF job
  */
 async function processPDF(job: Job<PDFJobData>) {
   const { filePath, nodeId, userId, originalName } = job.data;
   
   logger.info(`🚀 Starting PDF processing for: ${originalName}`);
   
   try {
     // Update job progress
     await job.updateProgress({ step: 'starting', progress: 0 });
     
     // Step 1: Verify file exists
     try {
       await fs.access(filePath);
     } catch (error) {
       throw new Error(`File not found: ${filePath}`);
     }
     
     await job.updateProgress({ step: 'file_verified', progress: 5 });
     
     // Step 2: Update node status
     await KnowledgeNode.findByIdAndUpdate(nodeId, {
       'processing.status': 'PROCESSING',
       'processing.progress': 10,
       'processing.startedAt': new Date(),
     });
     
     await job.updateProgress({ step: 'node_updated', progress: 10 });
     
     // Step 3: Process PDF through ingestion service
     logger.info(`📄 Processing PDF with ingestion service`);
     await ingestionService.processPDF(filePath, nodeId, userId);
     
     await job.updateProgress({ step: 'processing_complete', progress: 90 });
     
     // Step 4: Clean up file (optional - keep for backup)
     if (process.env.DELETE_PROCESSED_FILES === 'true') {
       try {
         await fs.unlink(filePath);
         logger.info(`🗑️ Deleted processed file: ${filePath}`);
       } catch (error) {
         logger.warn(`Failed to delete file: ${filePath}`, error);
       }
     }
     
     // Step 5: Award XP to user
     await User.findByIdAndUpdate(userId, {
       $inc: {
         'dna.xp': 50,
         'usage.uploadedFiles': 1,
       },
       'usage.lastUpload': new Date(),
     });
     
     await job.updateProgress({ step: 'completed', progress: 100 });
     
     logger.info(`✅ PDF processing completed: ${originalName}`);
     
     return {
       success: true,
       nodeId,
       message: 'PDF processed successfully',
     };
     
   } catch (error) {
     logger.error(`❌ PDF processing failed for ${originalName}:`, error);
     
     // Update node with error
     await KnowledgeNode.findByIdAndUpdate(nodeId, {
       'processing.status': 'FAILED',
       'processing.error': error instanceof Error ? error.message : 'Unknown error',
       'processing.attempts': { $inc: 1 },
     });
     
     throw error;
   }
 }
 
 /**
  * Create and start the worker
  */
 export const pdfWorker = new Worker(
   'pdf-processing',
   async (job: Job<PDFJobData>) => {
     return await processPDF(job);
   },
   {
     connection,
     concurrency: PDF_WORKER_CONCURRENCY,
     limiter: {
       max: 10,
       duration: 60000, // 10 jobs per minute max
     },
   }
 );
 
 /**
  * Worker event handlers
  */
 pdfWorker.on('ready', () => {
   logger.info(`🟢 PDF Worker ready (concurrency: ${PDF_WORKER_CONCURRENCY})`);
 });
 
 pdfWorker.on('completed', (job, result) => {
   logger.info(`✅ Job ${job.id} completed:`, result);
 });
 
 pdfWorker.on('failed', (job, error) => {
   if (job) {
     logger.error(`❌ Job ${job.id} failed after ${job.attemptsMade} attempts:`, error);
   }
 });
 
 pdfWorker.on('error', (error) => {
   logger.error('❌ Worker error:', error);
 });
 
 pdfWorker.on('stalled', (jobId) => {
   logger.warn(`⚠️ Job ${jobId} has stalled`);
 });
 
 /**
  * Email Worker (for notifications)
  */
 export const emailWorker = new Worker(
   'email',
   async (job: Job) => {
     const { to, subject, template, data } = job.data;
     
     logger.info(`📧 Sending email to: ${to}`);
     
     try {
       // TODO: Implement actual email sending
       // For now, just log
       logger.info(`Email would be sent: ${subject} to ${to}`);
       
       return {
         success: true,
         recipient: to,
         subject,
       };
     } catch (error) {
       logger.error(`Failed to send email to ${to}:`, error);
       throw error;
     }
   },
   {
     connection,
     concurrency: 5,
   }
 );
 
 emailWorker.on('completed', (job, result) => {
   logger.info(`📧 Email sent:`, result);
 });
 
 /**
  * Analytics Worker
  */
 export const analyticsWorker = new Worker(
   'analytics',
   async (job: Job) => {
     const { userId, type, data } = job.data;
     
     logger.info(`📊 Processing analytics: ${type} for user ${userId}`);
     
     try {
       // TODO: Implement actual analytics processing
       // This could include:
       // - Daily study summaries
       // - Weekly reports
       // - Achievement checking
       // - Streak updates
       
       return {
         success: true,
         type,
         userId,
       };
     } catch (error) {
       logger.error(`Analytics processing failed:`, error);
       throw error;
     }
   },
   {
     connection,
     concurrency: 3,
   }
 );
 
 analyticsWorker.on('completed', (job, result) => {
   logger.info(`📊 Analytics processed:`, result);
 });
 
 /**
  * Graceful shutdown
  */
 const shutdown = async () => {
   logger.info('🛑 Shutting down workers...');
   
   await Promise.all([
     pdfWorker.close(),
     emailWorker.close(),
     analyticsWorker.close(),
   ]);
   
   logger.info('✅ All workers shut down successfully');
   process.exit(0);
 };
 
 process.on('SIGTERM', shutdown);
 process.on('SIGINT', shutdown);
 
 /**
  * Export workers for monitoring
  */
 export default {
   pdfWorker,
   emailWorker,
   analyticsWorker,
   shutdown,
 };