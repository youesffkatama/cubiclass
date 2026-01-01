/**
 * Intelligence Controller
 * Handles AI-powered features: chat, flashcards, quiz, summaries
 */

 import { Request, Response } from 'express';
 import KnowledgeNode from '../models/KnowledgeNode.model';
 import ChatSession from '../models/ChatSession.model';
 import chatService from '../services/chat.service';
 import personaService from '../services/persona.service';
 import plannerService from '../services/planner.service';
 import { catchAsync } from '../utils/AppError';
 import { NotFoundError, ValidationError } from '../utils/AppError';
 import { sendSuccess } from '../utils/helpers';
 import logger from '../utils/logger';
 
 /**
  * Stream chat response
  * POST /api/v1/intelligence/chat/stream
  */
 export const chatStream = catchAsync(async (req: Request, res: Response) => {
   const { query, nodeId, conversationId, model } = req.body;
   
   // Verify node access
   const node = await KnowledgeNode.findOne({
     _id: nodeId,
     userId: req.userId,
     'processing.status': 'INDEXED',
   });
   
   if (!node) {
     throw new NotFoundError('Document not found or not ready');
   }
   
   // Get or create conversation
   let conversation;
   if (conversationId) {
     conversation = await ChatSession.findOne({
       _id: conversationId,
       userId: req.userId,
       nodeId,
     });
     
     if (!conversation) {
       throw new NotFoundError('Conversation');
     }
   } else {
     conversation = await ChatSession.create({
       userId: req.userId,
       nodeId,
       title: query.slice(0, 50) + (query.length > 50 ? '...' : ''),
     });
   }
   
   // Get conversation history
   const history = conversation.getRecentMessages(5).map(msg => ({
     role: msg.role,
     content: msg.content,
   }));
   
   // Set up SSE
   res.setHeader('Content-Type', 'text/event-stream');
   res.setHeader('Cache-Control', 'no-cache');
   res.setHeader('Connection', 'keep-alive');
   
   // Track response
   let fullResponse = '';
   const startTime = Date.now();
   
   // Stream handler
   const onToken = (token: string) => {
     fullResponse += token;
     res.write(`data: ${JSON.stringify({ token })}\n\n`);
   };
   
   const onComplete = async () => {
     const duration = Date.now() - startTime;
     
     // Save messages to conversation
     await conversation.addMessage('user', query);
     await conversation.addMessage('assistant', fullResponse, {
       model,
       tokens: fullResponse.split(' ').length,
     });
     
     // Send completion event
     res.write(
       `data: ${JSON.stringify({
         done: true,
         conversationId: conversation._id,
         duration,
       })}\n\n`
     );
     res.end();
     
     logger.info(`Chat completed in ${duration}ms`);
   };
   
   try {
     await chatService.chatStream(
       query,
       nodeId,
       history,
       onToken,
       onComplete,
       model
     );
   } catch (error) {
     res.write(
       `data: ${JSON.stringify({
         error: 'Failed to generate response',
       })}\n\n`
     );
     res.end();
     throw error;
   }
 });
 
 /**
  * Get chat history
  * GET /api/v1/intelligence/chat/conversations
  */
 export const getConversations = catchAsync(async (req: Request, res: Response) => {
   const { nodeId } = req.query;
   
   const filter: any = { userId: req.userId, isActive: true };
   if (nodeId) filter.nodeId = nodeId;
   
   const conversations = await ChatSession.find(filter)
     .sort({ 'metadata.lastMessageAt': -1 })
     .limit(20)
     .populate('nodeId', 'meta.originalName persona.generatedName');
   
   sendSuccess(res, {
     conversations: conversations.map(conv => ({
       id: conv._id,
       title: conv.title,
       nodeId: conv.nodeId,
       lastMessage: conv.messages[conv.messages.length - 1],
       messageCount: conv.metadata.totalMessages,
       lastMessageAt: conv.metadata.lastMessageAt,
     })),
   });
 });
 
 /**
  * Get specific conversation
  * GET /api/v1/intelligence/chat/conversations/:id
  */
 export const getConversation = catchAsync(async (req: Request, res: Response) => {
   const { id } = req.params;
   
   const conversation = await ChatSession.findOne({
     _id: id,
     userId: req.userId,
   }).populate('nodeId', 'meta.originalName persona');
   
   if (!conversation) {
     throw new NotFoundError('Conversation');
   }
   
   sendSuccess(res, {
     conversation: {
       id: conversation._id,
       title: conversation.title,
       nodeId: conversation.nodeId,
       messages: conversation.messages,
       metadata: conversation.metadata,
       analytics: conversation.analytics,
     },
   });
 });
 
 /**
  * Delete conversation
  * DELETE /api/v1/intelligence/chat/conversations/:id
  */
 export const deleteConversation = catchAsync(async (req: Request, res: Response) => {
   const { id } = req.params;
   
   const conversation = await ChatSession.findOne({
     _id: id,
     userId: req.userId,
   });
   
   if (!conversation) {
     throw new NotFoundError('Conversation');
   }
   
   await conversation.deleteOne();
   
   logger.info(`Conversation deleted: ${id}`);
   
   sendSuccess(res, null, 'Conversation deleted');
 });
 
 /**
  * Generate flashcards
  * POST /api/v1/intelligence/flashcards
  */
 export const generateFlashcards = catchAsync(async (req: Request, res: Response) => {
   const { nodeId, count } = req.body;
   
   const node = await KnowledgeNode.findOne({
     _id: nodeId,
     userId: req.userId,
     'processing.status': 'INDEXED',
   });
   
   if (!node) {
     throw new NotFoundError('Document not found or not ready');
   }
   
   logger.info(`Generating ${count} flashcards for node: ${nodeId}`);
   
   const flashcards = await chatService.generateFlashcards(nodeId, count);
   
   sendSuccess(res, {
     flashcards,
     nodeId,
     count: flashcards.length,
   });
 });
 
 /**
  * Generate quiz
  * POST /api/v1/intelligence/quiz
  */
 export const generateQuiz = catchAsync(async (req: Request, res: Response) => {
   const { nodeId, count } = req.body;
   
   const node = await KnowledgeNode.findOne({
     _id: nodeId,
     userId: req.userId,
     'processing.status': 'INDEXED',
   });
   
   if (!node) {
     throw new NotFoundError('Document not found or not ready');
   }
   
   logger.info(`Generating ${count} quiz questions for node: ${nodeId}`);
   
   const quiz = await chatService.generateQuiz(nodeId, count);
   
   sendSuccess(res, {
     quiz,
     nodeId,
     count: quiz.length,
   });
 });
 
 /**
  * Get document summary
  * GET /api/v1/intelligence/summary/:nodeId
  */
 export const getSummary = catchAsync(async (req: Request, res: Response) => {
   const { nodeId } = req.params;
   
   const node = await KnowledgeNode.findOne({
     _id: nodeId,
     userId: req.userId,
     'processing.status': 'INDEXED',
   });
   
   if (!node) {
     throw new NotFoundError('Document not found or not ready');
   }
   
   const summary = await chatService.generateSummary(nodeId);
   
   sendSuccess(res, {
     summary,
     nodeId,
     documentName: node.meta.originalName,
   });
 });
 
 /**
  * Update persona
  * POST /api/v1/intelligence/persona/update
  */
 export const updatePersona = catchAsync(async (req: Request, res: Response) => {
   const { nodeId, feedback } = req.body;
   
   const node = await KnowledgeNode.findOne({
     _id: nodeId,
     userId: req.userId,
   });
   
   if (!node) {
     throw new NotFoundError('Document');
   }
   
   logger.info(`Updating persona for node: ${nodeId}`);
   
   const updatedPersona = await personaService.updatePersona(
     node.persona,
     feedback
   );
   
   node.persona = updatedPersona;
   await node.save();
   
   sendSuccess(res, {
     persona: updatedPersona,
   });
 });
 
 /**
  * Generate debate between two documents
  * POST /api/v1/intelligence/debate
  */
 export const generateDebate = catchAsync(async (req: Request, res: Response) => {
   const { nodeId1, nodeId2, topic, rounds } = req.body;
   
   // Verify both nodes exist and belong to user
   const [node1, node2] = await Promise.all([
     KnowledgeNode.findOne({
       _id: nodeId1,
       userId: req.userId,
       'processing.status': 'INDEXED',
     }),
     KnowledgeNode.findOne({
       _id: nodeId2,
       userId: req.userId,
       'processing.status': 'INDEXED',
     }),
   ]);
   
   if (!node1 || !node2) {
     throw new NotFoundError('One or both documents not found');
   }
   
   logger.info(`Generating debate: ${node1.persona.generatedName} vs ${node2.persona.generatedName}`);
   
   const debate = await plannerService.generateDebate(
     nodeId1,
     nodeId2,
     topic || 'Compare and contrast your perspectives',
     rounds || 3
   );
   
   sendSuccess(res, {
     debate,
     participants: {
       persona1: node1.persona.generatedName,
       persona2: node2.persona.generatedName,
     },
     topic,
   });
 });
 
 /**
  * Search across documents
  * POST /api/v1/intelligence/search
  */
 export const searchDocuments = catchAsync(async (req: Request, res: Response) => {
   const { query, nodeIds, limit } = req.body;
   
   if (!query || query.trim().length === 0) {
     throw new ValidationError('Search query is required');
   }
   
   // If nodeIds provided, limit search to those
   const filter: any = {
     userId: req.userId,
     'processing.status': 'INDEXED',
   };
   
   if (nodeIds && nodeIds.length > 0) {
     filter._id = { $in: nodeIds };
   }
   
   // Search in document metadata
   const results = await KnowledgeNode.find({
     ...filter,
     $or: [
       { 'meta.originalName': { $regex: query, $options: 'i' } },
       { 'content.summary': { $regex: query, $options: 'i' } },
       { 'content.keyTopics': { $regex: query, $options: 'i' } },
       { 'content.subjects': { $regex: query, $options: 'i' } },
     ],
   })
     .limit(limit || 10)
     .select('meta.originalName content.summary content.keyTopics persona');
   
   sendSuccess(res, {
     results: results.map(doc => ({
       nodeId: doc._id,
       title: doc.meta.originalName,
       summary: doc.content.summary,
       topics: doc.content.keyTopics,
       persona: doc.persona.generatedName,
     })),
     query,
     count: results.length,
   });
 });
 
 export default {
   chatStream,
   getConversations,
   getConversation,
   deleteConversation,
   generateFlashcards,
   generateQuiz,
   getSummary,
   updatePersona,
   generateDebate,
   searchDocuments,
 };