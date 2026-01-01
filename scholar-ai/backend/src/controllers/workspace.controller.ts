/**
 * Workspace Controller
 * Handles file uploads, document management, and workspace operations
 */

 import { Request, Response } from 'express';
 import multer from 'multer';
 import path from 'path';
 import fs from 'fs/promises';
 import KnowledgeNode from '../models/KnowledgeNode.model';
 import VectorChunk from '../models/VectorChunk.model';
 import { addPDFProcessingJob } from '../workers/queue.config';
 import { catchAsync } from '../utils/AppError';
 import { NotFoundError, ValidationError } from '../utils/AppError';
 import { sendSuccess, getPaginationParams, getSortParams } from '../utils/helpers';
 import { generateId, sanitizeFilename, formatFileSize } from '../utils/helpers';
 import logger from '../utils/logger';
 
 /**
  * Multer configuration for file uploads
  */
 const storage = multer.diskStorage({
   destination: async (req, file, cb) => {
     const uploadDir = process.env.UPLOAD_DIR || 'uploads/pdfs';
     await fs.mkdir(uploadDir, { recursive: true });
     cb(null, uploadDir);
   },
   filename: (req, file, cb) => {
     const uniqueSuffix = generateId('pdf');
     const ext = path.extname(file.originalname);
     cb(null, `${uniqueSuffix}${ext}`);
   },
 });
 
 const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
   if (file.mimetype === 'application/pdf') {
     cb(null, true);
   } else {
     cb(new ValidationError('Only PDF files are allowed'));
   }
 };
 
 export const upload = multer({
   storage,
   fileFilter,
   limits: {
     fileSize: 50 * 1024 * 1024, // 50MB
     files: 1,
   },
 });
 
 /**
  * Upload PDF file
  * POST /api/v1/workspace/upload
  */
 export const uploadFile = catchAsync(async (req: Request, res: Response) => {
   if (!req.file) {
     throw new ValidationError('No file uploaded');
   }
   
   const { originalname, filename, size, path: filePath } = req.file;
   
   logger.info(`File upload initiated: ${originalname} (${formatFileSize(size)})`);
   
   // Create knowledge node
   const node = await KnowledgeNode.create({
     userId: req.userId,
     type: 'PDF',
     meta: {
       originalName: originalname,
       s3Key: filename, // Using local filename for now
       mimeType: 'application/pdf',
       size,
       uploadedAt: new Date(),
     },
     processing: {
       status: 'QUEUED',
       progress: 0,
     },
   });
   
   // Add to processing queue
   await addPDFProcessingJob({
     filePath,
     nodeId: node._id.toString(),
     userId: req.userId!,
     originalName: originalname,
   });
   
   logger.info(`File queued for processing: ${node._id}`);
   
   sendSuccess(
     res,
     {
       nodeId: node._id,
       filename: originalname,
       size: formatFileSize(size),
       status: 'queued',
       message: 'File uploaded and queued for processing',
     },
     'Upload successful',
     201
   );
 });
 
 /**
  * Get all user's documents
  * GET /api/v1/workspace/files
  */
 export const getFiles = catchAsync(async (req: Request, res: Response) => {
   const { page, limit, skip } = getPaginationParams(req.query);
   const sort = getSortParams(req.query, '-createdAt');
   
   // Optional filters
   const filter: any = { userId: req.userId };
   
   if (req.query.status) {
     filter['processing.status'] = req.query.status;
   }
   
   if (req.query.type) {
     filter.type = req.query.type;
   }
   
   if (req.query.search) {
     filter.$or = [
       { 'meta.originalName': { $regex: req.query.search, $options: 'i' } },
       { 'content.keyTopics': { $regex: req.query.search, $options: 'i' } },
     ];
   }
   
   // Execute query
   const [files, total] = await Promise.all([
     KnowledgeNode.find(filter)
       .sort(sort)
       .skip(skip)
       .limit(limit)
       .select('-content.rawText'),
     KnowledgeNode.countDocuments(filter),
   ]);
   
   sendSuccess(res, {
     files: files.map(file => ({
       id: file._id,
       name: file.meta.originalName,
       size: formatFileSize(file.meta.size),
       type: file.type,
       status: file.processing.status,
       progress: file.processing.progress,
       persona: file.persona,
       topics: file.content.keyTopics,
       difficulty: file.content.difficulty,
       pageCount: file.meta.pageCount,
       wordCount: file.meta.wordCount,
       uploadedAt: file.meta.uploadedAt,
       lastAccessed: file.analytics.lastAccessed,
     })),
     pagination: {
       page,
       limit,
       total,
       pages: Math.ceil(total / limit),
     },
   });
 });
 
 /**
  * Get single document details
  * GET /api/v1/workspace/files/:id
  */
 export const getFileDetails = catchAsync(async (req: Request, res: Response) => {
   const { id } = req.params;
   
   const file = await KnowledgeNode.findOne({
     _id: id,
     userId: req.userId,
   });
   
   if (!file) {
     throw new NotFoundError('Document');
   }
   
   // Update view count
   file.analytics.viewCount += 1;
   file.analytics.lastAccessed = new Date();
   await file.save();
   
   sendSuccess(res, {
     id: file._id,
     name: file.meta.originalName,
     size: formatFileSize(file.meta.size),
     type: file.type,
     status: file.processing.status,
     progress: file.processing.progress,
     persona: file.persona,
     content: {
       summary: file.content.summary,
       keyTopics: file.content.keyTopics,
       difficulty: file.content.difficulty,
       subjects: file.content.subjects,
     },
     meta: {
       pageCount: file.meta.pageCount,
       wordCount: file.meta.wordCount,
       language: file.meta.language,
       uploadedAt: file.meta.uploadedAt,
     },
     analytics: file.analytics,
     tags: file.tags,
   });
 });
 
 /**
  * Delete document
  * DELETE /api/v1/workspace/files/:id
  */
 export const deleteFile = catchAsync(async (req: Request, res: Response) => {
   const { id } = req.params;
   
   const file = await KnowledgeNode.findOne({
     _id: id,
     userId: req.userId,
   });
   
   if (!file) {
     throw new NotFoundError('Document');
   }
   
   // Delete associated vector chunks
   await VectorChunk.deleteMany({ nodeId: id });
   
   // Delete physical file
   try {
     const filePath = path.join(
       process.env.UPLOAD_DIR || 'uploads/pdfs',
       file.meta.s3Key
     );
     await fs.unlink(filePath);
   } catch (error) {
     logger.warn(`Failed to delete physical file: ${file.meta.s3Key}`);
   }
   
   // Delete node
   await file.deleteOne();
   
   logger.info(`Document deleted: ${file._id} (${file.meta.originalName})`);
   
   sendSuccess(res, null, 'Document deleted successfully');
 });
 
 /**
  * Update document tags
  * PATCH /api/v1/workspace/files/:id/tags
  */
 export const updateTags = catchAsync(async (req: Request, res: Response) => {
   const { id } = req.params;
   const { tags } = req.body;
   
   if (!Array.isArray(tags)) {
     throw new ValidationError('Tags must be an array');
   }
   
   const file = await KnowledgeNode.findOne({
     _id: id,
     userId: req.userId,
   });
   
   if (!file) {
     throw new NotFoundError('Document');
   }
   
   file.tags = tags.map((tag: string) => tag.toLowerCase().trim()).slice(0, 10);
   await file.save();
   
   sendSuccess(res, { tags: file.tags });
 });
 
 /**
  * Get processing status
  * GET /api/v1/workspace/files/:id/status
  */
 export const getProcessingStatus = catchAsync(async (req: Request, res: Response) => {
   const { id } = req.params;
   
   const file = await KnowledgeNode.findOne({
     _id: id,
     userId: req.userId,
   }).select('processing meta.originalName');
   
   if (!file) {
     throw new NotFoundError('Document');
   }
   
   sendSuccess(res, {
     nodeId: file._id,
     filename: file.meta.originalName,
     status: file.processing.status,
     progress: file.processing.progress,
     error: file.processing.error,
     startedAt: file.processing.startedAt,
     completedAt: file.processing.completedAt,
   });
 });
 
 /**
  * Get workspace statistics
  * GET /api/v1/workspace/stats
  */
 export const getWorkspaceStats = catchAsync(async (req: Request, res: Response) => {
   const [
     totalFiles,
     processingFiles,
     totalSize,
     subjectDistribution,
   ] = await Promise.all([
     KnowledgeNode.countDocuments({ userId: req.userId }),
     KnowledgeNode.countDocuments({
       userId: req.userId,
       'processing.status': { $in: ['QUEUED', 'PROCESSING', 'VECTORIZING'] },
     }),
     KnowledgeNode.aggregate([
       { $match: { userId: req.userId } },
       { $group: { _id: null, total: { $sum: '$meta.size' } } },
     ]),
     KnowledgeNode.aggregate([
       { $match: { userId: req.userId, 'processing.status': 'INDEXED' } },
       { $unwind: '$content.subjects' },
       { $group: { _id: '$content.subjects', count: { $sum: 1 } } },
       { $sort: { count: -1 } },
       { $limit: 5 },
     ]),
   ]);
   
   const totalSizeBytes = totalSize[0]?.total || 0;
   
   sendSuccess(res, {
     totalFiles,
     processingFiles,
     totalSize: formatFileSize(totalSizeBytes),
     subjectDistribution: subjectDistribution.map(s => ({
       subject: s._id,
       count: s.count,
     })),
   });
 });
 
 export default {
   upload,
   uploadFile,
   getFiles,
   getFileDetails,
   deleteFile,
   updateTags,
   getProcessingStatus,
   getWorkspaceStats,
 };