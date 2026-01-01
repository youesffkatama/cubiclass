/**
 * Utility Helper Functions
 * Common functions used across the application
 */

 import crypto from 'crypto';
 import { Response } from 'express';
 
 /**
  * Generate unique ID
  */
 export const generateId = (prefix: string = ''): string => {
   const randomBytes = crypto.randomBytes(16).toString('hex');
   return prefix ? `${prefix}_${randomBytes}` : randomBytes;
 };
 
 /**
  * Generate secure random token
  */
 export const generateToken = (length: number = 32): string => {
   return crypto.randomBytes(length).toString('hex');
 };
 
 /**
  * Hash string using SHA256
  */
 export const hashString = (str: string): string => {
   return crypto.createHash('sha256').update(str).digest('hex');
 };
 
 /**
  * Sleep/delay function
  */
 export const sleep = (ms: number): Promise<void> => {
   return new Promise(resolve => setTimeout(resolve, ms));
 };
 
 /**
  * Retry async function with exponential backoff
  */
 export const retryWithBackoff = async <T>(
   fn: () => Promise<T>,
   maxRetries: number = 3,
   baseDelay: number = 1000
 ): Promise<T> => {
   let lastError: Error;
   
   for (let attempt = 0; attempt < maxRetries; attempt++) {
     try {
       return await fn();
     } catch (error) {
       lastError = error as Error;
       
       if (attempt < maxRetries - 1) {
         const delay = baseDelay * Math.pow(2, attempt);
         await sleep(delay);
       }
     }
   }
   
   throw lastError!;
 };
 
 /**
  * Sanitize filename
  */
 export const sanitizeFilename = (filename: string): string => {
   return filename
     .replace(/[^a-zA-Z0-9.-]/g, '_')
     .replace(/_{2,}/g, '_')
     .toLowerCase();
 };
 
 /**
  * Format file size
  */
 export const formatFileSize = (bytes: number): string => {
   const units = ['B', 'KB', 'MB', 'GB', 'TB'];
   let size = bytes;
   let unitIndex = 0;
   
   while (size >= 1024 && unitIndex < units.length - 1) {
     size /= 1024;
     unitIndex++;
   }
   
   return `${size.toFixed(2)} ${units[unitIndex]}`;
 };
 
 /**
  * Calculate percentage
  */
 export const calculatePercentage = (value: number, total: number): number => {
   if (total === 0) return 0;
   return Math.round((value / total) * 100);
 };
 
 /**
  * Truncate text
  */
 export const truncateText = (text: string, maxLength: number): string => {
   if (text.length <= maxLength) return text;
   return text.slice(0, maxLength - 3) + '...';
 };
 
 /**
  * Check if string is valid JSON
  */
 export const isValidJSON = (str: string): boolean => {
   try {
     JSON.parse(str);
     return true;
   } catch {
     return false;
   }
 };
 
 /**
  * Deep clone object
  */
 export const deepClone = <T>(obj: T): T => {
   return JSON.parse(JSON.stringify(obj));
 };
 
 /**
  * Remove undefined/null values from object
  */
 export const cleanObject = (obj: any): any => {
   return Object.fromEntries(
     Object.entries(obj).filter(([_, v]) => v !== null && v !== undefined)
   );
 };
 
 /**
  * Paginate array
  */
 export const paginate = <T>(
   array: T[],
   page: number = 1,
   limit: number = 10
 ): { data: T[]; total: number; page: number; pages: number } => {
   const startIndex = (page - 1) * limit;
   const endIndex = startIndex + limit;
   
   return {
     data: array.slice(startIndex, endIndex),
     total: array.length,
     page,
     pages: Math.ceil(array.length / limit),
   };
 };
 
 /**
  * Standard API response format
  */
 export const sendSuccess = (
   res: Response,
   data: any,
   message: string = 'Success',
   statusCode: number = 200
 ) => {
   res.status(statusCode).json({
     success: true,
     message,
     data,
     timestamp: new Date().toISOString(),
   });
 };
 
 /**
  * Standard error response format
  */
 export const sendError = (
   res: Response,
   message: string,
   statusCode: number = 500,
   errors?: any
 ) => {
   res.status(statusCode).json({
     success: false,
     message,
     errors,
     timestamp: new Date().toISOString(),
   });
 };
 
 /**
  * Extract pagination params from query
  */
 export const getPaginationParams = (query: any) => {
   const page = Math.max(1, parseInt(query.page) || 1);
   const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
   const skip = (page - 1) * limit;
   
   return { page, limit, skip };
 };
 
 /**
  * Extract sort params from query
  */
 export const getSortParams = (query: any, defaultSort: string = '-createdAt') => {
   const sortBy = query.sortBy || defaultSort;
   return sortBy.startsWith('-')
     ? { [sortBy.slice(1)]: -1 }
     : { [sortBy]: 1 };
 };
 
 /**
  * Calculate time ago
  */
 export const timeAgo = (date: Date): string => {
   const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
   
   const intervals: { [key: string]: number } = {
     year: 31536000,
     month: 2592000,
     week: 604800,
     day: 86400,
     hour: 3600,
     minute: 60,
     second: 1,
   };
   
   for (const [unit, secondsInUnit] of Object.entries(intervals)) {
     const interval = Math.floor(seconds / secondsInUnit);
     
     if (interval >= 1) {
       return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
     }
   }
   
   return 'just now';
 };
 
 /**
  * Validate email format
  */
 export const isValidEmail = (email: string): boolean => {
   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
   return emailRegex.test(email);
 };
 
 /**
  * Generate random color hex
  */
 export const randomColor = (): string => {
   return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
 };
 
 /**
  * Debounce function
  */
 export const debounce = <T extends (...args: any[]) => any>(
   func: T,
   wait: number
 ): ((...args: Parameters<T>) => void) => {
   let timeout: NodeJS.Timeout;
   
   return (...args: Parameters<T>) => {
     clearTimeout(timeout);
     timeout = setTimeout(() => func(...args), wait);
   };
 };
 
 /**
  * Rate limit key generator
  */
 export const getRateLimitKey = (identifier: string, action: string): string => {
   return `ratelimit:${action}:${identifier}`;
 };
 
 /**
  * Extract user IP
  */
 export const getUserIP = (req: any): string => {
   return (
     req.headers['x-forwarded-for']?.split(',')[0] ||
     req.headers['x-real-ip'] ||
     req.connection.remoteAddress ||
     req.socket.remoteAddress ||
     'unknown'
   );
 };