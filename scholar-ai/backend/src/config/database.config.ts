/**
 * Database Configuration
 * MongoDB connection and optimization settings
 */

 import mongoose from 'mongoose';
 import logger from '../utils/logger';
 
 interface ConnectionOptions {
   maxPoolSize?: number;
   minPoolSize?: number;
   serverSelectionTimeoutMS?: number;
   socketTimeoutMS?: number;
   family?: 4 | 6;
   retryWrites?: boolean;
   w?: string | number;
 }
 
 class DatabaseConfig {
   private isConnected = false;
 
   /**
    * Get MongoDB connection options based on environment
    */
   getConnectionOptions(): ConnectionOptions {
     const isProduction = process.env.NODE_ENV === 'production';
 
     return {
       maxPoolSize: isProduction ? 50 : 10,
       minPoolSize: isProduction ? 10 : 5,
       serverSelectionTimeoutMS: 5000,
       socketTimeoutMS: 45000,
       family: 4, // Use IPv4
       retryWrites: true,
       w: 'majority',
     };
   }
 
   /**
    * Connect to MongoDB with retry logic
    */
   async connect(maxRetries: number = 5): Promise<void> {
     if (this.isConnected) {
       logger.info('Database already connected');
       return;
     }
 
     const uri = process.env.MONGODB_URI;
 
     if (!uri) {
       throw new Error('MONGODB_URI environment variable is not defined');
     }
 
     let retries = 0;
 
     while (retries < maxRetries) {
       try {
         await mongoose.connect(uri, this.getConnectionOptions());
 
         this.isConnected = true;
 
         logger.info('✅ MongoDB connected successfully');
         logger.info(`📊 Database: ${mongoose.connection.name}`);
         logger.info(`🌐 Host: ${mongoose.connection.host}`);
         logger.info(`🔢 Collections: ${Object.keys(mongoose.connection.collections).length}`);
 
         this.setupEventListeners();
         return;
 
       } catch (error) {
         retries++;
         logger.error(`❌ MongoDB connection attempt ${retries}/${maxRetries} failed:`, error);
 
         if (retries >= maxRetries) {
           throw new Error('Failed to connect to MongoDB after maximum retries');
         }
 
         // Exponential backoff
         const delay = Math.min(1000 * Math.pow(2, retries), 10000);
         logger.info(`⏳ Retrying in ${delay}ms...`);
         await new Promise(resolve => setTimeout(resolve, delay));
       }
     }
   }
 
   /**
    * Setup MongoDB event listeners
    */
   private setupEventListeners(): void {
     mongoose.connection.on('connected', () => {
       logger.info('🟢 Mongoose connected to MongoDB');
     });
 
     mongoose.connection.on('error', (err) => {
       logger.error('🔴 Mongoose connection error:', err);
     });
 
     mongoose.connection.on('disconnected', () => {
       logger.warn('🟡 Mongoose disconnected from MongoDB');
       this.isConnected = false;
     });
 
     mongoose.connection.on('reconnected', () => {
       logger.info('🔵 Mongoose reconnected to MongoDB');
       this.isConnected = true;
     });
 
     // Handle process termination
     process.on('SIGINT', async () => {
       await this.disconnect();
       process.exit(0);
     });
   }
 
   /**
    * Disconnect from MongoDB gracefully
    */
   async disconnect(): Promise<void> {
     if (!this.isConnected) {
       return;
     }
 
     try {
       await mongoose.connection.close();
       this.isConnected = false;
       logger.info('✅ MongoDB connection closed gracefully');
     } catch (error) {
       logger.error('❌ Error closing MongoDB connection:', error);
       throw error;
     }
   }
 
   /**
    * Get connection status
    */
   getStatus(): {
     isConnected: boolean;
     readyState: number;
     host: string;
     name: string;
   } {
     return {
       isConnected: this.isConnected,
       readyState: mongoose.connection.readyState,
       host: mongoose.connection.host,
       name: mongoose.connection.name,
     };
   }
 
   /**
    * Ping database to check connectivity
    */
   async ping(): Promise<boolean> {
     try {
       await mongoose.connection.db.admin().ping();
       return true;
     } catch (error) {
       logger.error('Database ping failed:', error);
       return false;
     }
   }
 
   /**
    * Get database statistics
    */
   async getStats(): Promise<any> {
     try {
       const stats = await mongoose.connection.db.stats();
       return {
         collections: stats.collections,
         dataSize: this.formatBytes(stats.dataSize),
         storageSize: this.formatBytes(stats.storageSize),
         indexes: stats.indexes,
         indexSize: this.formatBytes(stats.indexSize),
         objects: stats.objects,
       };
     } catch (error) {
       logger.error('Failed to get database stats:', error);
       return null;
     }
   }
 
   /**
    * Format bytes to human-readable size
    */
   private formatBytes(bytes: number): string {
     if (bytes === 0) return '0 Bytes';
 
     const k = 1024;
     const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
     const i = Math.floor(Math.log(bytes) / Math.log(k));
 
     return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
   }
 
   /**
    * Create indexes for collections (for initial setup)
    */
   async createIndexes(): Promise<void> {
     try {
       logger.info('Creating database indexes...');
 
       const collections = Object.keys(mongoose.connection.collections);
 
       for (const collectionName of collections) {
         const collection = mongoose.connection.collections[collectionName];
         await collection.createIndexes();
       }
 
       logger.info('✅ Database indexes created successfully');
     } catch (error) {
       logger.error('Failed to create indexes:', error);
       throw error;
     }
   }
 }
 
 export default new DatabaseConfig();