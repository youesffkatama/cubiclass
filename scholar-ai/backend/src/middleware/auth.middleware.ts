/**
 * Authentication Middleware
 * Handles JWT verification and user authentication
 */

 import { Request, Response, NextFunction } from 'express';
 import jwt from 'jsonwebtoken';
 import User from '../models/User.model';
 import { AuthenticationError, AuthorizationError } from '../utils/AppError';
 import logger from '../utils/logger';
 
 // Extend Express Request type
 declare global {
   namespace Express {
     interface Request {
       user?: any;
       userId?: string;
     }
   }
 }
 
 export interface JWTPayload {
   userId: string;
   email: string;
   iat: number;
   exp: number;
 }
 
 /**
  * Verify JWT token and attach user to request
  */
 export const authenticate = async (
   req: Request,
   res: Response,
   next: NextFunction
 ) => {
   try {
     // Extract token from header
     const authHeader = req.headers.authorization;
     
     if (!authHeader || !authHeader.startsWith('Bearer ')) {
       throw new AuthenticationError('No token provided');
     }
     
     const token = authHeader.split(' ')[1];
     
     if (!token) {
       throw new AuthenticationError('Invalid token format');
     }
     
     // Verify token
     const jwtSecret = process.env.JWT_SECRET;
     if (!jwtSecret) {
       throw new Error('JWT_SECRET not configured');
     }
     
     const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
     
     // Fetch user from database
     const user = await User.findById(decoded.userId).select('-auth.passwordHash');
     
     if (!user) {
       throw new AuthenticationError('User not found');
     }
     
     // Attach user to request
     req.user = user;
     req.userId = user._id.toString();
     
     // Update last activity
     user.dna.lastActivity = new Date();
     await user.save();
     
     next();
   } catch (error) {
     if (error instanceof jwt.JsonWebTokenError) {
       next(new AuthenticationError('Invalid token'));
     } else if (error instanceof jwt.TokenExpiredError) {
       next(new AuthenticationError('Token expired'));
     } else {
       next(error);
     }
   }
 };
 
 /**
  * Optional authentication - doesn't fail if no token
  */
 export const optionalAuth = async (
   req: Request,
   res: Response,
   next: NextFunction
 ) => {
   try {
     const authHeader = req.headers.authorization;
     
     if (authHeader && authHeader.startsWith('Bearer ')) {
       const token = authHeader.split(' ')[1];
       const jwtSecret = process.env.JWT_SECRET;
       
       if (jwtSecret && token) {
         const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
         const user = await User.findById(decoded.userId).select('-auth.passwordHash');
         
         if (user) {
           req.user = user;
           req.userId = user._id.toString();
         }
       }
     }
     
     next();
   } catch (error) {
     // Continue without authentication
     next();
   }
 };
 
 /**
  * Check if user has specific subscription plan
  */
 export const requireSubscription = (
   ...plans: Array<'free' | 'pro' | 'enterprise'>
 ) => {
   return (req: Request, res: Response, next: NextFunction) => {
     if (!req.user) {
       return next(new AuthenticationError());
     }
     
     const userPlan = req.user.subscription.plan;
     
     if (!plans.includes(userPlan)) {
       return next(
         new AuthorizationError(
           `This feature requires ${plans.join(' or ')} subscription`
         )
       );
     }
     
     next();
   };
 };
 
 /**
  * Check if user has specific feature access
  */
 export const requireFeature = (featureName: string) => {
   return (req: Request, res: Response, next: NextFunction) => {
     if (!req.user) {
       return next(new AuthenticationError());
     }
     
     const hasFeature = req.user.subscription.features.includes(featureName);
     
     if (!hasFeature) {
       return next(
         new AuthorizationError(
           `This feature is not available in your current plan`
         )
       );
     }
     
     next();
   };
 };
 
 /**
  * Generate JWT token
  */
 export const generateToken = (userId: string, email: string): string => {
   const jwtSecret = process.env.JWT_SECRET;
   const jwtExpiry = process.env.JWT_EXPIRY || '7d';
   
   if (!jwtSecret) {
     throw new Error('JWT_SECRET not configured');
   }
   
   return jwt.sign(
     { userId, email },
     jwtSecret,
     { expiresIn: jwtExpiry }
   );
 };
 
 /**
  * Generate refresh token
  */
 export const generateRefreshToken = (userId: string): string => {
   const jwtSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
   
   if (!jwtSecret) {
     throw new Error('JWT_SECRET not configured');
   }
   
   return jwt.sign(
     { userId },
     jwtSecret,
     { expiresIn: '30d' }
   );
 };
 
 /**
  * Verify refresh token
  */
 export const verifyRefreshToken = (token: string): JWTPayload => {
   const jwtSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
   
   if (!jwtSecret) {
     throw new Error('JWT_SECRET not configured');
   }
   
   return jwt.verify(token, jwtSecret) as JWTPayload;
 };
 
 export default {
   authenticate,
   optionalAuth,
   requireSubscription,
   requireFeature,
   generateToken,
   generateRefreshToken,
   verifyRefreshToken,
 };