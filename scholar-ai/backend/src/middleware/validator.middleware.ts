/**
 * Request Validation Middleware using Zod
 * Validates request body, query, and params
 */

 import { Request, Response, NextFunction } from 'express';
 import { z, ZodSchema, ZodError } from 'zod';
 import { ValidationError } from '../utils/AppError';
 
 /**
  * Validation schemas
  */
 
 // Auth schemas
 export const registerSchema = z.object({
   username: z.string()
     .min(3, 'Username must be at least 3 characters')
     .max(30, 'Username cannot exceed 30 characters')
     .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
   email: z.string().email('Invalid email address'),
   password: z.string()
     .min(8, 'Password must be at least 8 characters')
     .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
     .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
     .regex(/[0-9]/, 'Password must contain at least one number'),
 });
 
 export const loginSchema = z.object({
   email: z.string().email('Invalid email address'),
   password: z.string().min(1, 'Password is required'),
 });
 
 export const updateProfileSchema = z.object({
   username: z.string().min(3).max(30).optional(),
   settings: z.object({
     theme: z.string().optional(),
     language: z.string().optional(),
     openRouterModel: z.string().optional(),
     notificationsEnabled: z.boolean().optional(),
     autoSaveEnabled: z.boolean().optional(),
   }).optional(),
   dna: z.object({
     learningStyle: z.enum(['Visual', 'Textual', 'Socratic', 'Kinesthetic']).optional(),
     weaknesses: z.array(z.string()).optional(),
     strengths: z.array(z.string()).optional(),
   }).optional(),
 });
 
 // Chat schemas
 export const chatQuerySchema = z.object({
   query: z.string()
     .min(1, 'Query cannot be empty')
     .max(2000, 'Query too long'),
   nodeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid node ID'),
   conversationId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid conversation ID').optional(),
   model: z.string().optional(),
 });
 
 // Generation schemas
 export const generateFlashcardsSchema = z.object({
   nodeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid node ID'),
   count: z.number()
     .int('Count must be an integer')
     .min(1, 'Count must be at least 1')
     .max(50, 'Count cannot exceed 50')
     .default(10),
 });
 
 export const generateQuizSchema = z.object({
   nodeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid node ID'),
   count: z.number()
     .int('Count must be an integer')
     .min(1, 'Count must be at least 1')
     .max(20, 'Count cannot exceed 20')
     .default(5),
 });
 
 // Study plan schemas
 export const createStudyPlanSchema = z.object({
   title: z.string().min(3).max(200),
   goal: z.string().min(10).max(500),
   nodeIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/))
     .min(1, 'At least one document required')
     .max(20, 'Cannot exceed 20 documents'),
   examDate: z.string().refine(
     (date) => new Date(date) > new Date(),
     'Exam date must be in the future'
   ),
   difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
   dailyGoalMinutes: z.number().int().min(15).max(300).default(60),
   studyDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
 });
 
 export const completeTaskSchema = z.object({
   planId: z.string().regex(/^[0-9a-fA-F]{24}$/),
   day: z.number().int().min(1),
   timeSpent: z.number().int().min(1).max(300),
 });
 
 // Persona schemas
 export const updatePersonaSchema = z.object({
   nodeId: z.string().regex(/^[0-9a-fA-F]{24}$/),
   feedback: z.string().min(10).max(500),
 });
 
 // File upload validation
 export const fileUploadSchema = z.object({
   filename: z.string()
     .refine(
       (name) => name.toLowerCase().endsWith('.pdf'),
       'Only PDF files are allowed'
     )
     .refine(
       (name) => name.length <= 255,
       'Filename too long'
     ),
   size: z.number()
     .max(50 * 1024 * 1024, 'File size cannot exceed 50MB'),
 });
 
 // Pagination schema
 export const paginationSchema = z.object({
   page: z.string()
     .optional()
     .transform((val) => (val ? parseInt(val, 10) : 1))
     .refine((val) => val > 0, 'Page must be positive'),
   limit: z.string()
     .optional()
     .transform((val) => (val ? parseInt(val, 10) : 10))
     .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
   sortBy: z.string().optional(),
   order: z.enum(['asc', 'desc']).optional().default('desc'),
 });
 
 /**
  * Generic validation middleware factory
  */
 export const validate = (schema: ZodSchema) => {
   return (req: Request, res: Response, next: NextFunction) => {
     try {
       schema.parse(req.body);
       next();
     } catch (error) {
       if (error instanceof ZodError) {
         const errors = error.errors.map((err) => ({
           field: err.path.join('.'),
           message: err.message,
         }));
         
         next(new ValidationError('Validation failed', errors));
       } else {
         next(error);
       }
     }
   };
 };
 
 /**
  * Validate request query parameters
  */
 export const validateQuery = (schema: ZodSchema) => {
   return (req: Request, res: Response, next: NextFunction) => {
     try {
       const validated = schema.parse(req.query);
       req.query = validated as any;
       next();
     } catch (error) {
       if (error instanceof ZodError) {
         const errors = error.errors.map((err) => ({
           field: err.path.join('.'),
           message: err.message,
         }));
         
         next(new ValidationError('Query validation failed', errors));
       } else {
         next(error);
       }
     }
   };
 };
 
 /**
  * Validate request params
  */
 export const validateParams = (schema: ZodSchema) => {
   return (req: Request, res: Response, next: NextFunction) => {
     try {
       schema.parse(req.params);
       next();
     } catch (error) {
       if (error instanceof ZodError) {
         const errors = error.errors.map((err) => ({
           field: err.path.join('.'),
           message: err.message,
         }));
         
         next(new ValidationError('Parameter validation failed', errors));
       } else {
         next(error);
       }
     }
   };
 };
 
 /**
  * Validate MongoDB ObjectId
  */
 export const validateObjectId = (paramName: string = 'id') => {
   const schema = z.object({
     [paramName]: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
   });
   
   return validateParams(schema);
 };
 
 /**
  * Sanitize input
  */
 export const sanitize = (req: Request, res: Response, next: NextFunction) => {
   // Remove any HTML tags from string inputs
   const sanitizeObject = (obj: any): any => {
     if (typeof obj === 'string') {
       return obj.replace(/<[^>]*>/g, '').trim();
     }
     if (Array.isArray(obj)) {
       return obj.map(sanitizeObject);
     }
     if (obj && typeof obj === 'object') {
       const sanitized: any = {};
       for (const key in obj) {
         sanitized[key] = sanitizeObject(obj[key]);
       }
       return sanitized;
     }
     return obj;
   };
   
   if (req.body) {
     req.body = sanitizeObject(req.body);
   }
   
   next();
 };
 
 export default {
   validate,
   validateQuery,
   validateParams,
   validateObjectId,
   sanitize,
   // Export schemas
   registerSchema,
   loginSchema,
   updateProfileSchema,
   chatQuerySchema,
   generateFlashcardsSchema,
   generateQuizSchema,
   createStudyPlanSchema,
   completeTaskSchema,
   updatePersonaSchema,
   fileUploadSchema,
   paginationSchema,
 };