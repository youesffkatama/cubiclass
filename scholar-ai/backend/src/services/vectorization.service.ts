import { pipeline, Pipeline } from '@xenova/transformers';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';

class VectorizationService {
  private extractor: Pipeline | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initialize the embedding model
   * Uses Xenova's transformers.js for local embedding generation
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        logger.info('🧠 Initializing embedding model...');
        
        // Load the embedding model
        this.extractor = await pipeline(
          'feature-extraction',
          process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',
          { quantized: true } // Use quantized model for faster inference
        );
        
        this.isInitialized = true;
        logger.info('✅ Embedding model initialized successfully');
      } catch (error) {
        logger.error('❌ Failed to initialize embedding model:', error);
        throw new AppError('Failed to initialize vectorization service', 500);
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Generate embeddings for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    await this.initialize();

    if (!this.extractor) {
      throw new AppError('Vectorization service not initialized', 500);
    }

    try {
      // Clean and truncate text
      const cleanText = text.trim().slice(0, 512); // Max tokens for model
      
      if (!cleanText) {
        throw new AppError('Empty text provided for embedding', 400);
      }

      // Generate embedding
      const output = await this.extractor(cleanText, {
        pooling: 'mean',
        normalize: true
      });

      // Convert tensor to array
      const embedding = Array.from(output.data) as number[];
      
      // Validate embedding dimension
      const expectedDim = parseInt(process.env.EMBEDDING_DIMENSION || '384');
      if (embedding.length !== expectedDim) {
        throw new AppError(
          `Invalid embedding dimension: expected ${expectedDim}, got ${embedding.length}`,
          500
        );
      }

      return embedding;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw new AppError('Failed to generate embedding', 500);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    await this.initialize();

    if (!this.extractor) {
      throw new AppError('Vectorization service not initialized', 500);
    }

    try {
      const embeddings: number[][] = [];

      // Process in batches to avoid memory issues
      const batchSize = 10;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        const batchEmbeddings = await Promise.all(
          batch.map(text => this.generateEmbedding(text))
        );
        
        embeddings.push(...batchEmbeddings);
        
        logger.info(`Processed embeddings batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
      }

      return embeddings;
    } catch (error) {
      logger.error('Error generating batch embeddings:', error);
      throw new AppError('Failed to generate batch embeddings', 500);
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new AppError('Vectors must have same dimension', 400);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export default new VectorizationService();