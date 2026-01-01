/**
 * OpenRouter API Configuration
 * Centralized LLM API configuration and model management
 */

 import OpenAI from 'openai';
 import logger from '../utils/logger';
 import { AI_MODELS } from './constants';
 
 interface ModelInfo {
   id: string;
   name: string;
   contextWindow: number;
   costPer1kTokens: number;
   description: string;
 }
 
 class OpenRouterConfig {
   private client: OpenAI | null = null;
   private baseURL: string;
   private apiKey: string;
   private defaultModel: string;
 
   constructor() {
     this.baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
     this.apiKey = process.env.OPENROUTER_API_KEY || '';
     this.defaultModel = process.env.DEFAULT_AI_MODEL || AI_MODELS.DEFAULT;
 
     if (!this.apiKey) {
       logger.warn('⚠️  OPENROUTER_API_KEY not set. AI features will not work.');
     }
   }
 
   /**
    * Get OpenAI client instance (singleton)
    */
   getClient(): OpenAI {
     if (!this.client) {
       if (!this.apiKey) {
         throw new Error('OpenRouter API key is not configured');
       }
 
       this.client = new OpenAI({
         baseURL: this.baseURL,
         apiKey: this.apiKey,
         defaultHeaders: {
           'HTTP-Referer': process.env.APP_URL || 'https://scholar.ai',
           'X-Title': 'Scholar.AI',
         },
         timeout: 60000, // 60 seconds
         maxRetries: 3,
       });
 
       logger.info('✅ OpenRouter client initialized');
     }
 
     return this.client;
   }
 
   /**
    * Get default model ID
    */
   getDefaultModel(): string {
     return this.defaultModel;
   }
 
   /**
    * Get model info by ID
    */
   getModelInfo(modelId: string): ModelInfo | null {
     for (const [key, model] of Object.entries(AI_MODELS.AVAILABLE)) {
       if (model.id === modelId) {
         return model;
       }
     }
     return null;
   }
 
   /**
    * List all available models
    */
   listAvailableModels(): ModelInfo[] {
     return Object.values(AI_MODELS.AVAILABLE);
   }
 
   /**
    * Validate model availability
    */
   isModelAvailable(modelId: string): boolean {
     return Object.values(AI_MODELS.AVAILABLE).some(m => m.id === modelId);
   }
 
   /**
    * Get best model for task
    */
   getBestModelForTask(task: 'chat' | 'generation' | 'analysis'): string {
     switch (task) {
       case 'chat':
         return AI_MODELS.AVAILABLE['mistral-7b'].id;
       case 'generation':
         return AI_MODELS.AVAILABLE['llama-3-8b'].id;
       case 'analysis':
         return AI_MODELS.AVAILABLE['mixtral-8x7b'].id;
       default:
         return this.defaultModel;
     }
   }
 
   /**
    * Estimate cost for completion
    */
   estimateCost(modelId: string, tokens: number): number {
     const model = this.getModelInfo(modelId);
     if (!model) return 0;
 
     return (tokens / 1000) * model.costPer1kTokens;
   }
 
   /**
    * Test API connectivity
    */
   async testConnection(): Promise<boolean> {
     try {
       const client = this.getClient();
 
       const response = await client.chat.completions.create({
         model: this.defaultModel,
         messages: [{ role: 'user', content: 'Hello' }],
         max_tokens: 5,
       });
 
       logger.info('✅ OpenRouter API connection test successful');
       return true;
 
     } catch (error: any) {
       logger.error('❌ OpenRouter API connection test failed:', error.message);
       return false;
     }
   }
 
   /**
    * Get API status
    */
   getStatus(): {
     configured: boolean;
     baseURL: string;
     defaultModel: string;
     availableModels: number;
   } {
     return {
       configured: !!this.apiKey,
       baseURL: this.baseURL,
       defaultModel: this.defaultModel,
       availableModels: this.listAvailableModels().length,
     };
   }
 
   /**
    * Format streaming response
    */
   async *streamCompletion(
     messages: Array<{ role: string; content: string }>,
     model?: string
   ): AsyncGenerator<string, void, unknown> {
     const client = this.getClient();
 
     const stream = await client.chat.completions.create({
       model: model || this.defaultModel,
       messages,
       stream: true,
       temperature: 0.7,
       max_tokens: 1000,
     });
 
     for await (const chunk of stream) {
       const content = chunk.choices[0]?.delta?.content || '';
       if (content) {
         yield content;
       }
     }
   }
 
   /**
    * Create completion with retry logic
    */
   async createCompletion(
     messages: Array<{ role: string; content: string }>,
     options?: {
       model?: string;
       temperature?: number;
       maxTokens?: number;
       stream?: boolean;
     }
   ): Promise<string> {
     const client = this.getClient();
 
     try {
       const response = await client.chat.completions.create({
         model: options?.model || this.defaultModel,
         messages,
         temperature: options?.temperature ?? 0.7,
         max_tokens: options?.maxTokens ?? 1000,
         stream: false,
       });
 
       return response.choices[0]?.message?.content || '';
 
     } catch (error: any) {
       logger.error('OpenRouter API error:', error.message);
 
       // Try fallback model
       if (options?.model && options.model !== AI_MODELS.FALLBACK) {
         logger.info('Trying fallback model...');
 
         const fallbackResponse = await client.chat.completions.create({
           model: AI_MODELS.FALLBACK,
           messages,
           temperature: options?.temperature ?? 0.7,
           max_tokens: options?.maxTokens ?? 1000,
         });
 
         return fallbackResponse.choices[0]?.message?.content || '';
       }
 
       throw error;
     }
   }
 }
 
 export default new OpenRouterConfig();