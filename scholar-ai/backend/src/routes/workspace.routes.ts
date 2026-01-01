/**
 * Workspace Routes
 * /api/v1/workspace
 */

 import { Router } from 'express';
 import workspaceController from '../controllers/workspace.controller';
 import { authenticate } from '../middleware/auth.middleware';
 import { limitUpload, limitGeneral } from '../middleware/rateLimiter.middleware';
 import { validateObjectId, validateQuery, paginationSchema } from '../middleware/validator.middleware';
 
 const router = Router();
 
 /**
  * All routes require authentication
  */
 router.use(authenticate);
 
 /**
  * File upload
  */
 
 // POST /api/v1/workspace/upload
 router.post(
   '/upload',
   limitUpload,
   workspaceController.upload.single('file'),
   workspaceController.uploadFile
 );
 
 /**
  * File management
  */
 
 // GET /api/v1/workspace/files
 router.get(
   '/files',
   limitGeneral,
   validateQuery(paginationSchema),
   workspaceController.getFiles
 );
 
 // GET /api/v1/workspace/files/:id
 router.get(
   '/files/:id',
   limitGeneral,
   validateObjectId(),
   workspaceController.getFileDetails
 );
 
 // DELETE /api/v1/workspace/files/:id
 router.delete(
   '/files/:id',
   limitGeneral,
   validateObjectId(),
   workspaceController.deleteFile
 );
 
 // PATCH /api/v1/workspace/files/:id/tags
 router.patch(
   '/files/:id/tags',
   limitGeneral,
   validateObjectId(),
   workspaceController.updateTags
 );
 
 /**
  * Processing status
  */
 
 // GET /api/v1/workspace/files/:id/status
 router.get(
   '/files/:id/status',
   limitGeneral,
   validateObjectId(),
   workspaceController.getProcessingStatus
 );
 
 /**
  * Workspace statistics
  */
 
 // GET /api/v1/workspace/stats
 router.get(
   '/stats',
   limitGeneral,
   workspaceController.getWorkspaceStats
 );
 
 export default router;