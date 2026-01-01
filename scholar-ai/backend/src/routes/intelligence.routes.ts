/**
 * Intelligence Routes
 * /api/v1/intelligence
 */

 import { Router } from 'express';
 import intelligenceController from '../controllers/intelligence.controller';
 import { authenticate } from '../middleware/auth.middleware';
 import { limitChat, limitGeneration, limitGeneral } from '../middleware/rateLimiter.middleware';
 import {
   validate,
   validateObjectId,
   chatQuerySchema,
   generateFlashcardsSchema,
   generateQuizSchema,
   updatePersonaSchema,
 } from '../middleware/validator.middleware';
 
 const router = Router();
 
 /**
  * All routes require authentication
  */
 router.use(authenticate);
 
 /**
  * Chat routes
  */
 
 // POST /api/v1/intelligence/chat/stream
 router.post(
   '/chat/stream',
   limitChat,
   validate(chatQuerySchema),
   intelligenceController.chatStream
 );
 
 // GET /api/v1/intelligence/chat/conversations
 router.get(
   '/chat/conversations',
   limitGeneral,
   intelligenceController.getConversations
 );
 
 // GET /api/v1/intelligence/chat/conversations/:id
 router.get(
   '/chat/conversations/:id',
   limitGeneral,
   validateObjectId(),
   intelligenceController.getConversation
 );
 
 // DELETE /api/v1/intelligence/chat/conversations/:id
 router.delete(
   '/chat/conversations/:id',
   limitGeneral,
   validateObjectId(),
   intelligenceController.deleteConversation
 );
 
 /**
  * Content generation routes
  */
 
 // POST /api/v1/intelligence/flashcards
 router.post(
   '/flashcards',
   limitGeneration,
   validate(generateFlashcardsSchema),
   intelligenceController.generateFlashcards
 );
 
 // POST /api/v1/intelligence/quiz
 router.post(
   '/quiz',
   limitGeneration,
   validate(generateQuizSchema),
   intelligenceController.generateQuiz
 );
 
 // GET /api/v1/intelligence/summary/:nodeId
 router.get(
   '/summary/:nodeId',
   limitGeneral,
   validateObjectId('nodeId'),
   intelligenceController.getSummary
 );
 
 /**
  * Persona routes
  */
 
 // POST /api/v1/intelligence/persona/update
 router.post(
   '/persona/update',
   limitGeneral,
   validate(updatePersonaSchema),
   intelligenceController.updatePersona
 );
 
 /**
  * Advanced features
  */
 
 // POST /api/v1/intelligence/debate
 router.post(
   '/debate',
   limitGeneration,
   intelligenceController.generateDebate
 );
 
 // POST /api/v1/intelligence/search
 router.post(
   '/search',
   limitGeneral,
   intelligenceController.searchDocuments
 );
 
 export default router;