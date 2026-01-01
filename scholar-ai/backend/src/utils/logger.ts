/**
 * Production-Grade Logger using Winston
 * Features: Log rotation, multiple transports, structured logging
 */

 import winston from 'winston';
 import DailyRotateFile from 'winston-daily-rotate-file';
 import path from 'path';
 
 // Define log levels
 const levels = {
   error: 0,
   warn: 1,
   info: 2,
   http: 3,
   debug: 4,
 };
 
 // Define colors for each level
 const colors = {
   error: 'red',
   warn: 'yellow',
   info: 'green',
   http: 'magenta',
   debug: 'blue',
 };
 
 winston.addColors(colors);
 
 // Determine log level based on environment
 const level = () => {
   const env = process.env.NODE_ENV || 'development';
   const isDevelopment = env === 'development';
   return isDevelopment ? 'debug' : 'info';
 };
 
 // Define log format
 const format = winston.format.combine(
   winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
   winston.format.errors({ stack: true }),
   winston.format.splat(),
   winston.format.json(),
   winston.format.printf((info) => {
     const { timestamp, level, message, ...meta } = info;
     
     let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
     
     if (Object.keys(meta).length > 0) {
       logMessage += ` ${JSON.stringify(meta, null, 2)}`;
     }
     
     return logMessage;
   })
 );
 
 // Console transport with colors
 const consoleFormat = winston.format.combine(
   winston.format.colorize({ all: true }),
   winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
   winston.format.printf((info) => {
     const { timestamp, level, message, ...meta } = info;
     
     let logMessage = `${timestamp} [${level}]: ${message}`;
     
     if (Object.keys(meta).length > 0 && meta.stack) {
       logMessage += `\n${meta.stack}`;
     } else if (Object.keys(meta).length > 0) {
       logMessage += ` ${JSON.stringify(meta)}`;
     }
     
     return logMessage;
   })
 );
 
 // File transports with rotation
 const transports: winston.transport[] = [
   // Console output
   new winston.transports.Console({
     format: consoleFormat,
   }),
   
   // All logs
   new DailyRotateFile({
     filename: path.join('logs', 'application-%DATE%.log'),
     datePattern: 'YYYY-MM-DD',
     maxSize: '20m',
     maxFiles: '14d',
     format,
   }),
   
   // Error logs only
   new DailyRotateFile({
     level: 'error',
     filename: path.join('logs', 'error-%DATE%.log'),
     datePattern: 'YYYY-MM-DD',
     maxSize: '20m',
     maxFiles: '30d',
     format,
   }),
 ];
 
 // Create the logger
 const logger = winston.createLogger({
   level: level(),
   levels,
   transports,
   exitOnError: false,
 });
 
 /**
  * Stream object for Morgan HTTP logger
  */
 export const stream = {
   write: (message: string) => {
     logger.http(message.trim());
   },
 };
 
 /**
  * Log request/response info
  */
 export const logRequest = (req: any) => {
   logger.http('Incoming request', {
     method: req.method,
     url: req.url,
     ip: req.ip,
     userAgent: req.get('user-agent'),
   });
 };
 
 /**
  * Log error with full context
  */
 export const logError = (error: Error, context?: any) => {
   logger.error('Error occurred', {
     message: error.message,
     stack: error.stack,
     ...context,
   });
 };
 
 /**
  * Log performance metrics
  */
 export const logPerformance = (operation: string, duration: number, metadata?: any) => {
   logger.info(`Performance: ${operation}`, {
     duration: `${duration}ms`,
     ...metadata,
   });
 };
 
 /**
  * Log security events
  */
 export const logSecurity = (event: string, details: any) => {
   logger.warn(`Security Event: ${event}`, details);
 };
 
 export default logger;