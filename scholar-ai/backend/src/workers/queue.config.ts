/**
 * Queue Configuration using BullMQ
 * Manages background job processing for PDF ingestion and other async tasks
 */

 import { Queue, Worker, QueueEvents, Job } from 'bullmq';
 import IORedis from 'ioredis';
 import logger from '../utils/logger';
 
 // Redis connection configuration
 const connection = new IORedis({
   host: process.env.REDIS_HOST || 'localhost',
   port: parseInt(process.env.REDIS_PORT || '6379'),
   password: process.env.REDIS_PASSWORD,
   maxRetriesPerRequest: null,
   enableReadyCheck: false,
   retryStrategy(times) {
     const delay = Math.min(times * 50, 2000);
     return delay;
   },
 });
 
 connection.on('connect', () => {
   logger.info('✅ Redis connected successfully');
 });
 
 connection.on('error', (error) => {
   logger.error('❌ Redis connection error:', error);
 });
 
 /**
  * Queue Definitions
  */
 
 // PDF Processing Queue
 export const pdfQueue = new Queue('pdf-processing', {
   connection,
   defaultJobOptions: {
     attempts: 3,
     backoff: {
       type: 'exponential',
       delay: 2000,
     },
     removeOnComplete: {
       count: 100,
       age: 3600 * 24, // 24 hours
     },
     removeOnFail: {
       count: 500,
       age: 3600 * 48, // 48 hours
     },
   },
 });
 
 // Email Queue (for notifications)
 export const emailQueue = new Queue('email', {
   connection,
   defaultJobOptions: {
     attempts: 5,
     backoff: {
       type: 'exponential',
       delay: 1000,
     },
   },
 });
 
 // Analytics Queue (for background analytics processing)
 export const analyticsQueue = new Queue('analytics', {
   connection,
   defaultJobOptions: {
     attempts: 2,
     backoff: {
       type: 'fixed',
       delay: 5000,
     },
   },
 });
 
 /**
  * Queue Events for monitoring
  */
 export const pdfQueueEvents = new QueueEvents('pdf-processing', { connection });
 
 pdfQueueEvents.on('completed', ({ jobId }) => {
   logger.info(`✅ PDF job ${jobId} completed successfully`);
 });
 
 pdfQueueEvents.on('failed', ({ jobId, failedReason }) => {
   logger.error(`❌ PDF job ${jobId} failed:`, failedReason);
 });
 
 pdfQueueEvents.on('progress', ({ jobId, data }) => {
   logger.debug(`⏳ PDF job ${jobId} progress: ${JSON.stringify(data)}`);
 });
 
 /**
  * Helper functions for adding jobs
  */
 
 export interface PDFJobData {
   filePath: string;
   nodeId: string;
   userId: string;
   originalName: string;
 }
 
 export const addPDFProcessingJob = async (data: PDFJobData, priority: number = 0) => {
   const job = await pdfQueue.add(
     'process-pdf',
     data,
     {
       priority, // Higher numbers = higher priority
       jobId: `pdf-${data.nodeId}`,
     }
   );
   
   logger.info(`📄 Added PDF processing job: ${job.id}`);
   return job;
 };
 
 export interface EmailJobData {
   to: string;
   subject: string;
   template: string;
   data: any;
 }
 
 export const addEmailJob = async (data: EmailJobData) => {
   const job = await emailQueue.add('send-email', data);
   logger.info(`📧 Added email job: ${job.id}`);
   return job;
 };
 
 export interface AnalyticsJobData {
   userId: string;
   type: 'daily-summary' | 'weekly-report' | 'achievement-check';
   data?: any;
 }
 
 export const addAnalyticsJob = async (data: AnalyticsJobData) => {
   const job = await analyticsQueue.add('process-analytics', data, {
     delay: 5000, // Delay 5 seconds to batch operations
   });
   logger.info(`📊 Added analytics job: ${job.id}`);
   return job;
 };
 
 /**
  * Queue health check
  */
 export const getQueueHealth = async () => {
   const [pdfCounts, emailCounts, analyticsCounts] = await Promise.all([
     pdfQueue.getJobCounts(),
     emailQueue.getJobCounts(),
     analyticsQueue.getJobCounts(),
   ]);
 
   return {
     pdf: pdfCounts,
     email: emailCounts,
     analytics: analyticsCounts,
     healthy: 
       pdfCounts.failed < 10 && 
       emailCounts.failed < 10 && 
       analyticsCounts.failed < 10,
   };
 };
 
 /**
  * Pause/Resume queues
  */
 export const pauseAllQueues = async () => {
   await Promise.all([
     pdfQueue.pause(),
     emailQueue.pause(),
     analyticsQueue.pause(),
   ]);
   logger.warn('⏸️ All queues paused');
 };
 
 export const resumeAllQueues = async () => {
   await Promise.all([
     pdfQueue.resume(),
     emailQueue.resume(),
     analyticsQueue.resume(),
   ]);
   logger.info('▶️ All queues resumed');
 };
 
 /**
  * Clean up old jobs
  */
 export const cleanQueues = async () => {
   const gracePeriod = 3600 * 1000 * 24 * 7; // 7 days
   
   await Promise.all([
     pdfQueue.clean(gracePeriod, 100, 'completed'),
     pdfQueue.clean(gracePeriod, 100, 'failed'),
     emailQueue.clean(gracePeriod, 100, 'completed'),
     emailQueue.clean(gracePeriod, 100, 'failed'),
     analyticsQueue.clean(gracePeriod, 100, 'completed'),
     analyticsQueue.clean(gracePeriod, 100, 'failed'),
   ]);
   
   logger.info('🧹 Queues cleaned successfully');
 };
 
 /**
  * Graceful shutdown
  */
 export const closeQueues = async () => {
   await Promise.all([
     pdfQueue.close(),
     emailQueue.close(),
     analyticsQueue.close(),
     pdfQueueEvents.close(),
     connection.quit(),
   ]);
   
   logger.info('🔌 All queues and connections closed');
 };
 
 // Clean queues periodically (every 24 hours)
 setInterval(cleanQueues, 1000 * 60 * 60 * 24);
 
 export default {
   pdfQueue,
   emailQueue,
   analyticsQueue,
   connection,
 };