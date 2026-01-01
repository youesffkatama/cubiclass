/**
 * Authentication Controller
 * Handles user registration, login, and token management
 */

 import { Request, Response } from 'express';
 import User from '../models/User.model';
 import {
   generateToken,
   generateRefreshToken,
   verifyRefreshToken,
 } from '../middleware/auth.middleware';
 import { catchAsync } from '../utils/AppError';
 import { AuthenticationError, ValidationError, ConflictError } from '../utils/AppError';
 import { sendSuccess } from '../utils/helpers';
 import logger from '../utils/logger';
 
 /**
  * Register new user
  * POST /api/v1/auth/register
  */
 export const register = catchAsync(async (req: Request, res: Response) => {
   const { username, email, password } = req.body;
   
   // Check if user already exists
   const existingUser = await User.findOne({
     $or: [{ email }, { username }],
   });
   
   if (existingUser) {
     if (existingUser.email === email) {
       throw new ConflictError('Email already registered');
     }
     if (existingUser.username === username) {
       throw new ConflictError('Username already taken');
     }
   }
   
   // Create new user
   const user = await User.create({
     username,
     email,
     auth: {
       passwordHash: password, // Will be hashed by pre-save hook
       provider: 'local',
     },
   });
   
   // Generate tokens
   const accessToken = generateToken(user._id.toString(), user.email);
   const refreshToken = generateRefreshToken(user._id.toString());
   
   logger.info(`New user registered: ${username} (${email})`);
   
   sendSuccess(
     res,
     {
       user: {
         id: user._id,
         username: user.username,
         email: user.email,
         dna: user.dna,
         settings: user.settings,
         subscription: user.subscription,
       },
       tokens: {
         accessToken,
         refreshToken,
       },
     },
     'Registration successful',
     201
   );
 });
 
 /**
  * Login user
  * POST /api/v1/auth/login
  */
 export const login = catchAsync(async (req: Request, res: Response) => {
   const { email, password } = req.body;
   
   // Find user and include password
   const user = await User.findOne({ email }).select('+auth.passwordHash');
   
   if (!user) {
     throw new AuthenticationError('Invalid email or password');
   }
   
   // Check password
   const isPasswordValid = await user.comparePassword(password);
   
   if (!isPasswordValid) {
     throw new AuthenticationError('Invalid email or password');
   }
   
   // Generate tokens
   const accessToken = generateToken(user._id.toString(), user.email);
   const refreshToken = generateRefreshToken(user._id.toString());
   
   // Update last activity
   user.dna.lastActivity = new Date();
   await user.save();
   
   logger.info(`User logged in: ${user.username}`);
   
   sendSuccess(res, {
     user: {
       id: user._id,
       username: user.username,
       email: user.email,
       dna: user.dna,
       settings: user.settings,
       subscription: user.subscription,
     },
     tokens: {
       accessToken,
       refreshToken,
     },
   });
 });
 
 /**
  * Refresh access token
  * POST /api/v1/auth/refresh
  */
 export const refreshAccessToken = catchAsync(async (req: Request, res: Response) => {
   const { refreshToken } = req.body;
   
   if (!refreshToken) {
     throw new ValidationError('Refresh token is required');
   }
   
   try {
     // Verify refresh token
     const decoded = verifyRefreshToken(refreshToken);
     
     // Find user
     const user = await User.findById(decoded.userId);
     
     if (!user) {
       throw new AuthenticationError('User not found');
     }
     
     // Generate new access token
     const accessToken = generateToken(user._id.toString(), user.email);
     
     sendSuccess(res, {
       accessToken,
     });
   } catch (error) {
     throw new AuthenticationError('Invalid or expired refresh token');
   }
 });
 
 /**
  * Get current user profile
  * GET /api/v1/auth/me
  */
 export const getMe = catchAsync(async (req: Request, res: Response) => {
   const user = await User.findById(req.userId);
   
   if (!user) {
     throw new AuthenticationError('User not found');
   }
   
   sendSuccess(res, {
     user: {
       id: user._id,
       username: user.username,
       email: user.email,
       dna: user.dna,
       settings: user.settings,
       subscription: user.subscription,
       usage: user.usage,
       createdAt: user.createdAt,
     },
   });
 });
 
 /**
  * Update user profile
  * PATCH /api/v1/auth/profile
  */
 export const updateProfile = catchAsync(async (req: Request, res: Response) => {
   const { username, settings, dna } = req.body;
   
   const user = await User.findById(req.userId);
   
   if (!user) {
     throw new AuthenticationError('User not found');
   }
   
   // Update fields
   if (username) {
     // Check if username is already taken
     const existingUser = await User.findOne({
       username,
       _id: { $ne: req.userId },
     });
     
     if (existingUser) {
       throw new ConflictError('Username already taken');
     }
     
     user.username = username;
   }
   
   if (settings) {
     user.settings = { ...user.settings, ...settings };
   }
   
   if (dna) {
     user.dna = { ...user.dna, ...dna };
   }
   
   await user.save();
   
   logger.info(`User profile updated: ${user.username}`);
   
   sendSuccess(res, {
     user: {
       id: user._id,
       username: user.username,
       email: user.email,
       dna: user.dna,
       settings: user.settings,
     },
   });
 });
 
 /**
  * Change password
  * POST /api/v1/auth/change-password
  */
 export const changePassword = catchAsync(async (req: Request, res: Response) => {
   const { currentPassword, newPassword } = req.body;
   
   const user = await User.findById(req.userId).select('+auth.passwordHash');
   
   if (!user) {
     throw new AuthenticationError('User not found');
   }
   
   // Verify current password
   const isPasswordValid = await user.comparePassword(currentPassword);
   
   if (!isPasswordValid) {
     throw new AuthenticationError('Current password is incorrect');
   }
   
   // Update password
   user.auth.passwordHash = newPassword; // Will be hashed by pre-save hook
   await user.save();
   
   logger.info(`Password changed for user: ${user.username}`);
   
   sendSuccess(res, null, 'Password changed successfully');
 });
 
 /**
  * Delete account
  * DELETE /api/v1/auth/account
  */
 export const deleteAccount = catchAsync(async (req: Request, res: Response) => {
   const { password } = req.body;
   
   const user = await User.findById(req.userId).select('+auth.passwordHash');
   
   if (!user) {
     throw new AuthenticationError('User not found');
   }
   
   // Verify password
   const isPasswordValid = await user.comparePassword(password);
   
   if (!isPasswordValid) {
     throw new AuthenticationError('Incorrect password');
   }
   
   // TODO: Delete all user data (nodes, chats, plans, etc.)
   // This should be done in a background job
   
   await User.findByIdAndDelete(req.userId);
   
   logger.warn(`Account deleted: ${user.username}`);
   
   sendSuccess(res, null, 'Account deleted successfully');
 });
 
 /**
  * Logout (optional - client-side token removal is sufficient)
  * POST /api/v1/auth/logout
  */
 export const logout = catchAsync(async (req: Request, res: Response) => {
   // In a JWT-based system, logout is typically handled client-side
   // But we can log it for analytics
   
   logger.info(`User logged out: ${req.userId}`);
   
   sendSuccess(res, null, 'Logged out successfully');
 });
 
 export default {
   register,
   login,
   refreshAccessToken,
   getMe,
   updateProfile,
   changePassword,
   deleteAccount,
   logout,
 };