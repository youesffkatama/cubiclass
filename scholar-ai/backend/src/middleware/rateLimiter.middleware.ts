/**
 * Rate Limiting Middleware
 * Implements sliding window rate limiting using Redis
 */

 import { Request, Response, NextFunction } from 'express';
 import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
 import { connection as redisClient } from '../workers/queue.config';
 import { RateLimitError } from '../utils/AppError';
 import { getUserIP } from '../utils/helpers';
 import logger from '../utils/logger';
 
 /**
  * Redis-based rate limiter
  */
 const createRedisLimiter = (options: {
   points: number;
   duration: number;
   keyPrefix: string;
 }) => {
   return new RateLimiterRedis({
     storeClient: redisClient,
     keyPrefix: options.keyPrefix,
     points: options.points,
     duration: options.duration,
     blockDuration: 0,
   });
 };
 
 /**
  * Memory-based rate limiter (fallback)
  */
 const createMemoryLimiter = (options: {
   points: number;
   duration: number;
 }) => {
   return new RateLimiterMemory({
     points: options.points,
     duration: options.duration,
   });
 };
 
 /**
  * Rate limiters for different endpoints
  */
 export const limiters = {
   // General API: 100 requests per 15 minutes
   general: createRedisLimiter({
     keyPrefix: 'rl_general',
     points: 100,
     duration: 15 * 60,
   }),
   
   // Auth endpoints: 5 requests per 15 minutes
   auth: createRedisLimiter({
     keyPrefix: 'rl_auth',
     points: 5,
     duration: 15 * 60,
   }),
   
   // Upload: 5 uploads per day
   upload: createRedisLimiter({
     keyPrefix: 'rl_upload',
     points: 5,
     duration: 24 * 60 * 60,
   }),
   
   // Chat: 50 messages per hour
   chat: createRedisLimiter({
     keyPrefix: 'rl_chat',
     points: 50,
     duration: 60 * 60,
   }),
   
   // Generation (flashcards/quiz): 20 per hour
   generation: createRedisLimiter({
     keyPrefix: 'rl_generation',
     points: 20,
     duration: 60 * 60,
   }),
 };
 
 /**
  * Get rate limit key from request
  */
 const getRateLimitKey = (req: Request, prefix: string): string => {
   // Use userId if authenticated, otherwise use IP
   if (req.userId) {
     return `${prefix}:user:${req.userId}`;
   }
   
   const ip = getUserIP(req);
   return `${prefix}:ip:${ip}`;
 };
 
 /**
  * Create rate limit middleware
  */
 export const createRateLimiter = (
   limiterType: keyof typeof limiters,
   customOptions?: {
     skipSuccessfulRequests?: boolean;
     skipFailedRequests?: boolean;
   }
 ) => {
   const limiter = limiters[limiterType];
   
   return async (req: Request, res: Response, next: NextFunction) => {
     try {
       const key = getRateLimitKey(req, limiterType);
       
       const rateLimiterRes = await limiter.consume(key);
       
       // Add rate limit headers
       res.setHeader('X-RateLimit-Limit', limiter.points);
       res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
       res.setHeader(
         'X-RateLimit-Reset',
         new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString()
       );
       
       next();
     } catch (error: any) {
       if (error.remainingPoints !== undefined) {
         // Rate limit exceeded
         const retryAfter = Math.ceil(error.msBeforeNext / 1000);
         
         res.setHeader('X-RateLimit-Limit', limiter.points);
         res.setHeader('X-RateLimit-Remaining', 0);
         res.setHeader('Retry-After', retryAfter);
         
         logger.warn(`Rate limit exceeded for ${limiterType}:`, {
           key: getRateLimitKey(req, limiterType),
           retryAfter,
         });
         
         next(
           new RateLimitError(
             `Too many requests. Please try again in ${retryAfter} seconds.`
           )
         );
       } else {
         // Other error
         logger.error('Rate limiter error:', error);
         next(); // Continue on error (fail open)
       }
     }
   };
 };
 
 /**
  * Specific rate limiters for different routes
  */
 
 export const limitGeneral = createRateLimiter('general');
 export const limitAuth = createRateLimiter('auth');
 export const limitUpload = createRateLimiter('upload');
 export const limitChat = createRateLimiter('chat');
 export const limitGeneration = createRateLimiter('generation');
 
 /**
  * Adaptive rate limiter based on user subscription
  */
 export const adaptiveRateLimit = (baseType: keyof typeof limiters) => {
   return async (req: Request, res: Response, next: NextFunction) => {
     try {
       let multiplier = 1;
       
       // Adjust rate limit based on subscription
       if (req.user) {
         switch (req.user.subscription.plan) {
           case 'pro':
             multiplier = 3;
             break;
           case 'enterprise':
             multiplier = 10;
             break;
           default:
             multiplier = 1;
         }
       }
       
       const limiter = limiters[baseType];
       const adjustedPoints = limiter.points * multiplier;
       
       const key = getRateLimitKey(req, baseType);
       const rateLimiterRes = await limiter.consume(key, 1);
       
       res.setHeader('X-RateLimit-Limit', adjustedPoints);
       res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
       
       next();
     } catch (error: any) {
       if (error.remainingPoints !== undefined) {
         const retryAfter = Math.ceil(error.msBeforeNext / 1000);
         res.setHeader('Retry-After', retryAfter);
         
         next(
           new RateLimitError(
             `Rate limit exceeded. Upgrade your plan for higher limits.`
           )
         );
       } else {
         next();
       }
     }
   };
 };
 
 /**
  * Reset rate limit for a user (admin only)
  */
 export const resetRateLimit = async (
   userId: string,
   limiterType: keyof typeof limiters
 ) => {
   const key = `${limiterType}:user:${userId}`;
   await limiters[limiterType].delete(key);
   logger.info(`Rate limit reset for user ${userId} on ${limiterType}`);
 };
 
 export default {
   limitGeneral,
   limitAuth,
   limitUpload,
   limitChat,
   limitGeneration,
   adaptiveRateLimit,
   createRateLimiter,
   resetRateLimit,
 };