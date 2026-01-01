/**
 * Global Error Handling Middleware
 * Catches all errors and formats them consistently
 */

 import { Request, Response, NextFunction } from 'express';
 import { AppError, isOperationalError } from '../utils/AppError';
 import logger, { logError } from '../utils/logger';
 import mongoose from 'mongoose';
 
 /**
  * Development error response (includes stack trace)
  */
 const sendErrorDev = (err: AppError, res: Response) => {
   res.status(err.statusCode).json({
     success: false,
     error: {
       message: err.message,
       code: err.code,
       statusCode: err.statusCode,
       stack: err.stack,
       details: err.details,
     },
     timestamp: new Date().toISOString(),
   });
 };
 
 /**
  * Production error response (clean, no sensitive info)
  */
 const sendErrorProd = (err: AppError, res: Response) => {
   // Operational, trusted error: send message to client
   if (err.isOperational) {
     res.status(err.statusCode).json({
       success: false,
       error: {
         message: err.message,
         code: err.code,
       },
       timestamp: new Date().toISOString(),
     });
   } else {
     // Programming or unknown error: don't leak error details
     logger.error('CRITICAL ERROR:', err);
     
     res.status(500).json({
       success: false,
       error: {
         message: 'Something went wrong',
         code: 'INTERNAL_SERVER_ERROR',
       },
       timestamp: new Date().toISOString(),
     });
   }
 };
 
 /**
  * Handle MongoDB CastError (invalid ObjectId)
  */
 const handleCastError = (err: mongoose.Error.CastError): AppError => {
   const message = `Invalid ${err.path}: ${err.value}`;
   return new AppError(message, 400, true, 'INVALID_ID');
 };
 
 /**
  * Handle MongoDB duplicate key error
  */
 const handleDuplicateKeyError = (err: any): AppError => {
   const field = Object.keys(err.keyValue)[0];
   const value = err.keyValue[field];
   const message = `${field} '${value}' already exists`;
   return new AppError(message, 409, true, 'DUPLICATE_KEY');
 };
 
 /**
  * Handle MongoDB validation error
  */
 const handleValidationError = (err: mongoose.Error.ValidationError): AppError => {
   const errors = Object.values(err.errors).map((e: any) => ({
     field: e.path,
     message: e.message,
   }));
   
   return new AppError(
     'Validation failed',
     400,
     true,
     'VALIDATION_ERROR',
     errors
   );
 };
 
 /**
  * Handle JWT errors
  */
 const handleJWTError = (): AppError => {
   return new AppError('Invalid token. Please log in again.', 401, true, 'INVALID_TOKEN');
 };
 
 const handleJWTExpiredError = (): AppError => {
   return new AppError('Your token has expired. Please log in again.', 401, true, 'TOKEN_EXPIRED');
 };
 
 /**
  * Handle Multer file upload errors
  */
 const handleMulterError = (err: any): AppError => {
   if (err.code === 'LIMIT_FILE_SIZE') {
     return new AppError('File too large. Maximum size is 50MB.', 400, true, 'FILE_TOO_LARGE');
   }
   
   if (err.code === 'LIMIT_FILE_COUNT') {
     return new AppError('Too many files uploaded.', 400, true, 'TOO_MANY_FILES');
   }
   
   if (err.code === 'LIMIT_UNEXPECTED_FILE') {
     return new AppError('Unexpected field in upload.', 400, true, 'UNEXPECTED_FIELD');
   }
   
   return new AppError('File upload error.', 400, true, 'UPLOAD_ERROR');
 };
 
 /**
  * Main error handling middleware
  */
 export const errorHandler = (
   err: Error | AppError,
   req: Request,
   res: Response,
   next: NextFunction
 ) => {
   // Default to 500 server error
   let error = err as AppError;
   
   if (!(err instanceof AppError)) {
     error = new AppError(err.message || 'Something went wrong', 500, false);
   }
   
   // Handle specific error types
   if (err.name === 'CastError') {
     error = handleCastError(err as mongoose.Error.CastError);
   }
   
   if ((err as any).code === 11000) {
     error = handleDuplicateKeyError(err);
   }
   
   if (err.name === 'ValidationError') {
     error = handleValidationError(err as mongoose.Error.ValidationError);
   }
   
   if (err.name === 'JsonWebTokenError') {
     error = handleJWTError();
   }
   
   if (err.name === 'TokenExpiredError') {
     error = handleJWTExpiredError();
   }
   
   if (err.name === 'MulterError') {
     error = handleMulterError(err);
   }
   
   // Log error
   if (!error.isOperational || error.statusCode >= 500) {
     logError(error, {
       url: req.url,
       method: req.method,
       ip: req.ip,
       userId: req.userId,
     });
   }
   
   // Send response
   if (process.env.NODE_ENV === 'development') {
     sendErrorDev(error, res);
   } else {
     sendErrorProd(error, res);
   }
 };
 
 /**
  * Handle 404 - Not Found
  */
 export const notFound = (req: Request, res: Response, next: NextFunction) => {
   const error = new AppError(
     `Route ${req.originalUrl} not found`,
     404,
     true,
     'NOT_FOUND'
   );
   next(error);
 };
 
 /**
  * Handle uncaught exceptions
  */
 export const handleUncaughtException = () => {
   process.on('uncaughtException', (err: Error) => {
     logger.error('UNCAUGHT EXCEPTION! Shutting down...', err);
     
     // Log the error
     logError(err);
     
     // Exit process
     process.exit(1);
   });
 };
 
 /**
  * Handle unhandled promise rejections
  */
 export const handleUnhandledRejection = () => {
   process.on('unhandledRejection', (err: Error) => {
     logger.error('UNHANDLED REJECTION! Shutting down...', err);
     
     // Log the error
     logError(err);
     
     // Give server time to finish existing requests
     setTimeout(() => {
       process.exit(1);
     }, 1000);
   });
 };
 
 /**
  * Handle SIGTERM for graceful shutdown
  */
 export const handleSIGTERM = (server: any) => {
   process.on('SIGTERM', () => {
     logger.info('SIGTERM received. Shutting down gracefully...');
     
     server.close(() => {
       logger.info('Process terminated');
       process.exit(0);
     });
   });
 };
 
 export default {
   errorHandler,
   notFound,
   handleUncaughtException,
   handleUnhandledRejection,
   handleSIGTERM,
 };