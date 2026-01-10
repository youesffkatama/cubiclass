// Queue service for handling background jobs
const { Queue, Worker } = require('bullmq');
const CONFIG = require('../config');

let pdfQueue = null;

function initializeQueue() {
  if (!pdfQueue) {
    pdfQueue = new Queue('pdf-processing', {
      connection: {
        host: CONFIG.REDIS_HOST,
        port: CONFIG.REDIS_PORT
      }
    });

    // Initialize worker for processing PDFs
    const worker = new Worker('pdf-processing', async (job) => {
      // Process the PDF job
      console.log(`Processing PDF job: ${job.id}`);
      // Add actual PDF processing logic here
      return { status: 'completed', jobId: job.id };
    }, {
      connection: {
        host: CONFIG.REDIS_HOST,
        port: CONFIG.REDIS_PORT
      }
    });

    worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err);
    });
  }

  return pdfQueue;
}

module.exports = {
  pdfQueue,
  initializeQueue
};