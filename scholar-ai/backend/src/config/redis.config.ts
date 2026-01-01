/**
 * Redis Configuration
 * Connection and queue management for background jobs and caching
 */

 import Redis, { RedisOptions } from 'ioredis';
 import logger from '../utils/logger';
 
 class RedisConfig {
   private client: Redis | null = null;
   private subscriber: Redis | null = null;
   private isConnected = false;
 
   /**
    * Get Redis connection options
    */
   private getConnectionOptions(): RedisOptions {
     const isProduction = process.env.NODE_ENV === 'production';
 
     return {
       host: process.env.REDIS_HOST || 'localhost',
       port: parseInt(process.env.REDIS_PORT || '6379'),
       password: process.env.REDIS_PASSWORD || undefined,
       db: 0,
       retryStrategy: (times: number) => {
         const delay = Math.min(times * 50, 2000);
         return delay;
       },
       maxRetriesPerRequest: 3,
       enableReadyCheck: true,
       enableOfflineQueue: true,
       connectTimeout: 10000,
       ...(isProduction && {
         tls: {
           rejectUnauthorized: false,
         },
       }),
     };
   }
 
   /**
    * Get Redis client (singleton)
    */
   getClient(): Redis {
     if (!this.client) {
       this.client = new Redis(this.getConnectionOptions());
       this.setupEventListeners(this.client, 'Client');
     }
 
     return this.client;
   }
 
   /**
    * Get Redis subscriber client for pub/sub
    */
   getSubscriber(): Redis {
     if (!this.subscriber) {
       this.subscriber = new Redis(this.getConnectionOptions());
       this.setupEventListeners(this.subscriber, 'Subscriber');
     }
 
     return this.subscriber;
   }
 
   /**
    * Setup event listeners
    */
   private setupEventListeners(client: Redis, label: string): void {
     client.on('connect', () => {
       logger.info(`🟢 Redis ${label} connecting...`);
     });
 
     client.on('ready', () => {
       logger.info(`✅ Redis ${label} ready`);
       this.isConnected = true;
     });
 
     client.on('error', (error) => {
       logger.error(`🔴 Redis ${label} error:`, error);
     });
 
     client.on('close', () => {
       logger.warn(`🟡 Redis ${label} connection closed`);
       this.isConnected = false;
     });
 
     client.on('reconnecting', () => {
       logger.info(`🔵 Redis ${label} reconnecting...`);
     });
 
     client.on('end', () => {
       logger.info(`⚫ Redis ${label} connection ended`);
       this.isConnected = false;
     });
   }
 
   /**
    * Test Redis connection
    */
   async testConnection(): Promise<boolean> {
     try {
       const client = this.getClient();
       await client.ping();
       logger.info('✅ Redis connection test successful');
       return true;
     } catch (error) {
       logger.error('❌ Redis connection test failed:', error);
       return false;
     }
   }
 
   /**
    * Get connection status
    */
   getStatus(): {
     isConnected: boolean;
     host: string;
     port: number;
     status: string;
   } {
     return {
       isConnected: this.isConnected,
       host: process.env.REDIS_HOST || 'localhost',
       port: parseInt(process.env.REDIS_PORT || '6379'),
       status: this.client?.status || 'disconnected',
     };
   }
 
   /**
    * Gracefully disconnect
    */
   async disconnect(): Promise<void> {
     try {
       if (this.client) {
         await this.client.quit();
         this.client = null;
       }
 
       if (this.subscriber) {
         await this.subscriber.quit();
         this.subscriber = null;
       }
 
       this.isConnected = false;
       logger.info('✅ Redis connections closed gracefully');
     } catch (error) {
       logger.error('❌ Error closing Redis connections:', error);
       throw error;
     }
   }
 
   /**
    * Cache operations
    */
   async cache = {
     get: async (key: string): Promise<string | null> => {
       try {
         return await this.getClient().get(key);
       } catch (error) {
         logger.error(`Cache get error for key ${key}:`, error);
         return null;
       }
     },
 
     set: async (key: string, value: string, ttlSeconds?: number): Promise<void> => {
       try {
         if (ttlSeconds) {
           await this.getClient().setex(key, ttlSeconds, value);
         } else {
           await this.getClient().set(key, value);
         }
       } catch (error) {
         logger.error(`Cache set error for key ${key}:`, error);
       }
     },
 
     del: async (key: string): Promise<void> => {
       try {
         await this.getClient().del(key);
       } catch (error) {
         logger.error(`Cache delete error for key ${key}:`, error);
       }
     },
 
     exists: async (key: string): Promise<boolean> => {
       try {
         const result = await this.getClient().exists(key);
         return result === 1;
       } catch (error) {
         logger.error(`Cache exists error for key ${key}:`, error);
         return false;
       }
     },
 
     ttl: async (key: string): Promise<number> => {
       try {
         return await this.getClient().ttl(key);
       } catch (error) {
         logger.error(`Cache TTL error for key ${key}:`, error);
         return -1;
       }
     },
 
     keys: async (pattern: string): Promise<string[]> => {
       try {
         return await this.getClient().keys(pattern);
       } catch (error) {
         logger.error(`Cache keys error for pattern ${pattern}:`, error);
         return [];
       }
     },
 
     flush: async (): Promise<void> => {
       try {
         await this.getClient().flushdb();
         logger.info('🗑️  Redis cache flushed');
       } catch (error) {
         logger.error('Cache flush error:', error);
       }
     },
   };
 
   /**
    * Pub/Sub operations
    */
   pubsub = {
     publish: async (channel: string, message: string): Promise<void> => {
       try {
         await this.getClient().publish(channel, message);
       } catch (error) {
         logger.error(`Publish error for channel ${channel}:`, error);
       }
     },
 
     subscribe: async (
       channel: string,
       callback: (message: string) => void
     ): Promise<void> => {
       try {
         const subscriber = this.getSubscriber();
         await subscriber.subscribe(channel);
 
         subscriber.on('message', (ch, msg) => {
           if (ch === channel) {
             callback(msg);
           }
         });
       } catch (error) {
         logger.error(`Subscribe error for channel ${channel}:`, error);
       }
     },
 
     unsubscribe: async (channel: string): Promise<void> => {
       try {
         await this.getSubscriber().unsubscribe(channel);
       } catch (error) {
         logger.error(`Unsubscribe error for channel ${channel}:`, error);
       }
     },
   };
 
   /**
    * Get Redis stats
    */
   async getStats(): Promise<any> {
     try {
       const info = await this.getClient().info();
       const lines = info.split('\r\n');
       const stats: any = {};
 
       for (const line of lines) {
         if (line && !line.startsWith('#')) {
           const [key, value] = line.split(':');
           if (key && value) {
             stats[key.trim()] = value.trim();
           }
         }
       }
 
       return {
         version: stats.redis_version,
         uptime: parseInt(stats.uptime_in_seconds || '0'),
         connectedClients: parseInt(stats.connected_clients || '0'),
         usedMemory: stats.used_memory_human,
         totalCommands: parseInt(stats.total_commands_processed || '0'),
         hitRate: this.calculateHitRate(
           parseInt(stats.keyspace_hits || '0'),
           parseInt(stats.keyspace_misses || '0')
         ),
       };
     } catch (error) {
       logger.error('Failed to get Redis stats:', error);
       return null;
     }
   }
 
   /**
    * Calculate cache hit rate
    */
   private calculateHitRate(hits: number, misses: number): string {
     const total = hits + misses;
     if (total === 0) return '0%';
 
     const rate = (hits / total) * 100;
     return `${rate.toFixed(2)}%`;
   }
 }
 
 export default new RedisConfig();