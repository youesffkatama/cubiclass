import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import { PDFDocument } from 'pdf-lib';
import Tesseract from 'tesseract.js';
import natural from 'natural';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import KnowledgeNode, { IKnowledgeNode } from '../models/KnowledgeNode.model';
import VectorChunk from '../models/VectorChunk.model';
import vectorizationService from './vectorization.service';
import personaService from './persona.service';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';

class IngestionService {
  /**
   * Process PDF file - Main ingestion pipeline
   */
  async processPDF(
    filePath: string,
    nodeId: string,
    userId: string
  ): Promise<void> {
    let node: IKnowledgeNode | null = null;

    try {
      // Step 1: Load the knowledge node
      node = await KnowledgeNode.findById(nodeId);
      if (!node) {
        throw new AppError('Knowledge node not found', 404);
      }

      // Update status
      await this.updateProcessingStatus(nodeId, 'PROCESSING', 10);

      // Step 2: Extract text from PDF
      logger.info(`📄 Extracting text from: ${node.meta.originalName}`);
      const { text, pageCount, language } = await this.extractPDFText(filePath);

      // Update node with extracted data
      node.meta.pageCount = pageCount;
      node.meta.language = language;
      node.meta.wordCount = this.countWords(text);
      node.content.rawText = text.slice(0, 50000); // Store first 50k chars

      await this.updateProcessingStatus(nodeId, 'PROCESSING', 30);

      // Step 3: Intelligent chunking
      logger.info(`✂️ Chunking document into semantic segments`);
      const chunks = await this.intelligentChunk(text);

      await this.updateProcessingStatus(nodeId, 'VECTORIZING', 50);

      // Step 4: Generate embeddings for all chunks
      logger.info(`🧠 Generating embeddings for ${chunks.length} chunks`);
      const embeddings = await vectorizationService.generateEmbeddingsBatch(chunks);

      // Step 5: Save vector chunks to database
      logger.info(`💾 Saving ${chunks.length} vector chunks to database`);
      await this.saveVectorChunks(nodeId, chunks, embeddings);

      await this.updateProcessingStatus(nodeId, 'VECTORIZING', 70);

      // Step 6: Generate AI persona
      logger.info(`🎭 Generating AI persona for document`);
      const persona = await personaService.generatePersona(text.slice(0, 2000));
      node.persona = persona;

      await this.updateProcessingStatus(nodeId, 'VECTORIZING', 85);

      // Step 7: Extract metadata and analytics
      logger.info(`📊 Extracting metadata and analyzing content`);
      const metadata = await this.extractMetadata(text);
      node.content.keyTopics = metadata.topics;
      node.content.difficulty = metadata.difficulty;
      node.content.subjects = metadata.subjects;
      node.content.summary = metadata.summary;

      // Step 8: Mark as complete
      node.processing.status = 'INDEXED';
      node.processing.progress = 100;
      node.processing.completedAt = new Date();
      await node.save();

      logger.info(`✅ Successfully processed: ${node.meta.originalName}`);

      // Award XP to user
      await this.awardXP(userId, 50);

    } catch (error) {
      logger.error(`❌ Error processing PDF:`, error);

      if (node) {
        node.processing.status = 'FAILED';
        node.processing.error = error instanceof Error ? error.message : 'Unknown error';
        node.processing.attempts += 1;
        await node.save();
      }

      throw error;
    }
  }

  /**
   * Extract text from PDF with OCR fallback
   */
  private async extractPDFText(filePath: string): Promise<{
    text: string;
    pageCount: number;
    language: string;
  }> {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);

      let text = pdfData.text;
      const pageCount = pdfData.numpages;

      // If text extraction yields very little, try OCR
      if (text.trim().length < 100 && pageCount > 0) {
        logger.info('🔍 Low text content detected, attempting OCR...');
        text = await this.performOCR(filePath);
      }

      // Detect language
      const language = this.detectLanguage(text);

      return { text, pageCount, language };
    } catch (error) {
      logger.error('Error extracting PDF text:', error);
      throw new AppError('Failed to extract text from PDF', 500);
    }
  }

  /**
   * Perform OCR on PDF using Tesseract
   */
  private async performOCR(filePath: string): Promise<string> {
    try {
      const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
        logger: (m) => logger.debug(`OCR Progress: ${m.status}`)
      });

      return text;
    } catch (error) {
      logger.error('OCR failed:', error);
      return '';
    }
  }

  /**
   * Intelligent text chunking with overlap
   */
  private async intelligentChunk(text: string): Promise<string[]> {
    const chunkSize = parseInt(process.env.CHUNK_SIZE || '1000');
    const chunkOverlap = parseInt(process.env.CHUNK_OVERLAP || '200');

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ['\n\n', '\n', '. ', ' ', '']
    });

    const chunks = await splitter.splitText(text);
    
    // Filter out very short chunks
    return chunks.filter(chunk => chunk.trim().length > 50);
  }

  /**
   * Save vector chunks to database in batch
   */
  private async saveVectorChunks(
    nodeId: string,
    chunks: string[],
    embeddings: number[][]
  ): Promise<void> {
    const vectorChunks = chunks.map((content, index) => ({
      nodeId,
      content,
      embedding: embeddings[index],
      metadata: {
        chunkIndex: index,
        totalChunks: chunks.length,
        startChar: index * parseInt(process.env.CHUNK_SIZE || '1000'),
        endChar: (index + 1) * parseInt(process.env.CHUNK_SIZE || '1000')
      },
      semantics: {
        topics: this.extractTopics(content),
        entities: this.extractEntities(content)
      }
    }));

    // Batch insert for performance
    const batchSize = 100;
    for (let i = 0; i < vectorChunks.length; i += batchSize) {
      const batch = vectorChunks.slice(i, i + batchSize);
      await VectorChunk.insertMany(batch);
    }
  }

  /**
   * Extract metadata from document
   */
  private async extractMetadata(text: string): Promise<{
    topics: string[];
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
    subjects: string[];
    summary: string;
  }> {
    // Extract topics using TF-IDF
    const topics = this.extractTopics(text);

    // Determine difficulty based on vocabulary complexity
    const difficulty = this.determineDifficulty(text);

    // Classify subjects
    const subjects = this.classifySubjects(text, topics);

    // Generate brief summary (first paragraph or first 300 chars)
    const summary = text.split('\n\n')[0].slice(0, 300) + '...';

    return { topics, difficulty, subjects, summary };
  }

  /**
   * Extract key topics using TF-IDF
   */
  private extractTopics(text: string, maxTopics: number = 10): string[] {
    const tokenizer = new natural.WordTokenizer();
    const tfidf = new natural.TfIdf();

    tfidf.addDocument(text);

    const topics: string[] = [];
    tfidf.listTerms(0).slice(0, maxTopics).forEach((item) => {
      if (item.term.length > 3 && item.tfidf > 0.1) {
        topics.push(item.term);
      }
    });

    return topics;
  }

  /**
   * Extract named entities
   */
  private extractEntities(text: string): string[] {
    // Simple entity extraction using capitalization heuristic
    const words = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    
    // Deduplicate and filter
    const entities = [...new Set(words)]
      .filter(entity => entity.length > 2 && entity.length < 50)
      .slice(0, 20);

    return entities;
  }

  /**
   * Determine document difficulty
   */
  private determineDifficulty(
    text: string
  ): 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' {
    // Calculate average word length
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;

    // Calculate sentence complexity
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = words.length / sentences.length;

    // Scoring
    const score = avgWordLength * 2 + avgSentenceLength * 0.5;

    if (score < 15) return 'Beginner';
    if (score < 20) return 'Intermediate';
    if (score < 25) return 'Advanced';
    return 'Expert';
  }

  /**
   * Classify document subjects
   */
  private classifySubjects(text: string, topics: string[]): string[] {
    const subjectKeywords = {
      Mathematics: ['equation', 'theorem', 'calculus', 'algebra', 'geometry', 'math'],
      Physics: ['force', 'energy', 'quantum', 'mechanics', 'physics', 'particle'],
      Chemistry: ['molecule', 'atom', 'chemical', 'reaction', 'compound', 'element'],
      Biology: ['cell', 'organism', 'DNA', 'evolution', 'species', 'biology'],
      'Computer Science': ['algorithm', 'programming', 'software', 'computer', 'code', 'data'],
      History: ['century', 'war', 'empire', 'civilization', 'historical', 'ancient'],
      Literature: ['novel', 'poetry', 'author', 'literary', 'narrative', 'character'],
      Economics: ['market', 'economy', 'trade', 'GDP', 'inflation', 'economic']
    };

    const textLower = text.toLowerCase();
    const subjects: string[] = [];

    for (const [subject, keywords] of Object.entries(subjectKeywords)) {
      const matches = keywords.filter(keyword => 
        textLower.includes(keyword) || topics.includes(keyword)
      ).length;

      if (matches >= 3) {
        subjects.push(subject);
      }
    }

    return subjects.length > 0 ? subjects : ['General'];
  }

  /**
   * Detect text language
   */
  private detectLanguage(text: string): string {
    // Simple language detection using franc library could be added
    // For now, default to English
    return 'en';
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Update processing status
   */
  private async updateProcessingStatus(
    nodeId: string,
    status: string,
    progress: number
  ): Promise<void> {
    await KnowledgeNode.findByIdAndUpdate(nodeId, {
      'processing.status': status,
      'processing.progress': progress,
      ...(status === 'PROCESSING' && !await KnowledgeNode.findOne({ _id: nodeId, 'processing.startedAt': { $exists: true } }) 
        ? { 'processing.startedAt': new Date() } 
        : {})
    });
  }

  /**
   * Award XP to user
   */
  private async awardXP(userId: string, amount: number): Promise<void> {
    const User = (await import('../models/User.model')).default;
    await User.findByIdAndUpdate(userId, {
      $inc: { 'dna.xp': amount }
    });
  }
}

export default new IngestionService();