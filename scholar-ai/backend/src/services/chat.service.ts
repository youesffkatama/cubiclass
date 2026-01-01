import OpenAI from 'openai';
import VectorChunk from '../models/VectorChunk.model';
import KnowledgeNode from '../models/KnowledgeNode.model';
import vectorizationService from './vectorization.service';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatContext {
  chunks: string[];
  sources: Array<{
    nodeId: string;
    chunkIndex: number;
    pageNumber?: number;
    similarity: number;
  }>;
}

class ChatService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': 'https://scholar.ai',
        'X-Title': 'Scholar.AI'
      }
    });
  }

  /**
   * Main RAG chat method with streaming support
   */
  async chatStream(
    query: string,
    nodeId: string,
    conversationHistory: ChatMessage[],
    onToken: (token: string) => void,
    onComplete: () => void,
    model?: string
  ): Promise<void> {
    try {
      // Step 1: Get the knowledge node for persona
      const node = await KnowledgeNode.findById(nodeId);
      if (!node) {
        throw new AppError('Document not found', 404);
      }

      // Step 2: Perform vector search to get relevant context
      logger.info(`🔍 Performing vector search for query: "${query.slice(0, 50)}..."`);
      const context = await this.performVectorSearch(query, nodeId);

      // Step 3: Build messages array with system prompt
      const messages = this.buildMessages(
        query,
        context,
        node.persona.personalityPrompt,
        conversationHistory
      );

      // Step 4: Stream response from OpenRouter
      const selectedModel = model || node.settings?.openRouterModel || process.env.DEFAULT_AI_MODEL;
      
      logger.info(`🤖 Streaming response from ${selectedModel}`);

      const stream = await this.openai.chat.completions.create({
        model: selectedModel,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true
      });

      // Step 5: Stream tokens to client
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          onToken(content);
        }
      }

      onComplete();

      // Step 6: Update analytics
      await this.updateAnalytics(nodeId);

    } catch (error) {
      logger.error('Chat stream error:', error);
      throw new AppError('Failed to generate response', 500);
    }
  }

  /**
   * Perform vector search using MongoDB Atlas Vector Search
   */
  private async performVectorSearch(
    query: string,
    nodeId: string,
    topK: number = 5
  ): Promise<ChatContext> {
    try {
      // Generate query embedding
      const queryEmbedding = await vectorizationService.generateEmbedding(query);

      // Perform vector search using MongoDB aggregation
      const results = await VectorChunk.aggregate([
        {
          $vectorSearch: {
            index: 'vector_index', // Must be created in Atlas
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: topK,
            filter: {
              nodeId: { $eq: nodeId }
            }
          }
        },
        {
          $project: {
            content: 1,
            metadata: 1,
            nodeId: 1,
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ]);

      if (results.length === 0) {
        logger.warn('No relevant chunks found for query');
      }

      const chunks = results.map(r => r.content);
      const sources = results.map(r => ({
        nodeId: r.nodeId.toString(),
        chunkIndex: r.metadata.chunkIndex,
        pageNumber: r.metadata.pageNumber,
        similarity: r.score
      }));

      logger.info(`Found ${results.length}relevant chunks`);

      return { chunks, sources };

    } catch (error) {
      logger.error('Vector search error:', error);
      
      // Fallback: return empty context
      return { chunks: [], sources: [] };
    }
  }

  /**
   * Build messages array for OpenAI API
   */
  private buildMessages(
    query: string,
    context: ChatContext,
    personalityPrompt: string,
    conversationHistory: ChatMessage[]
  ): ChatMessage[] {
    // System message with persona and context
    const systemMessage: ChatMessage = {
      role: 'system',
      content: `${personalityPrompt}

CONTEXT FROM DOCUMENT:
${context.chunks.join('\n\n---\n\n')}

INSTRUCTIONS:
- Answer the user's question based ONLY on the context provided above
- If the answer is not in the context, politely say so
- Cite specific sections when possible
- Maintain your unique teaching persona
- Be concise but thorough`
    };

    // Include recent conversation history (last 5 messages)
    const recentHistory = conversationHistory.slice(-5);

    // User's current query
    const userMessage: ChatMessage = {
      role: 'user',
      content: query
    };

    return [systemMessage, ...recentHistory, userMessage];
  }

  /**
   * Generate flashcards from document
   */
  async generateFlashcards(
    nodeId: string,
    count: number = 10
  ): Promise<Array<{ question: string; answer: string; difficulty: string }>> {
    try {
      const node = await KnowledgeNode.findById(nodeId);
      if (!node) {
        throw new AppError('Document not found', 404);
      }

      // Get sample chunks
      const chunks = await VectorChunk.find({ nodeId })
        .limit(20)
        .select('content');

      const context = chunks.map(c => c.content).join('\n\n');

      const prompt = `Based on the following academic content, generate ${count} high-quality flashcards.

CONTENT:
${context.slice(0, 4000)}

Generate a JSON array of flashcards with this structure:
[
  {
    "question": "Clear, specific question",
    "answer": "Concise, accurate answer",
    "difficulty": "easy|medium|hard"
  }
]

Make questions that test understanding, not just memorization. Vary difficulty levels.`;

      const completion = await this.openai.chat.completions.create({
        model: process.env.DEFAULT_AI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert educator creating study materials. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2000
      });

      const responseText = completion.choices[0]?.message?.content || '[]';
      const flashcards = JSON.parse(
        responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      );

      return Array.isArray(flashcards) ? flashcards : [];

    } catch (error) {
      logger.error('Error generating flashcards:', error);
      throw new AppError('Failed to generate flashcards', 500);
    }
  }

  /**
   * Generate quiz questions
   */
  async generateQuiz(
    nodeId: string,
    count: number = 5
  ): Promise<Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }>> {
    try {
      const node = await KnowledgeNode.findById(nodeId);
      if (!node) {
        throw new AppError('Document not found', 404);
      }

      const chunks = await VectorChunk.find({ nodeId })
        .limit(15)
        .select('content');

      const context = chunks.map(c => c.content).join('\n\n');

      const prompt = `Based on the following content, create ${count} multiple-choice quiz questions.

CONTENT:
${context.slice(0, 4000)}

Generate a JSON array with this structure:
[
  {
    "question": "Clear question testing comprehension",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Why this answer is correct"
  }
]

Make questions challenging but fair. Ensure all options are plausible.`;

      const completion = await this.openai.chat.completions.create({
        model: process.env.DEFAULT_AI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating educational assessments. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const responseText = completion.choices[0]?.message?.content || '[]';
      const quiz = JSON.parse(
        responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      );

      return Array.isArray(quiz) ? quiz : [];

    } catch (error) {
      logger.error('Error generating quiz:', error);
      throw new AppError('Failed to generate quiz', 500);
    }
  }

  /**
   * Generate document summary
   */
  async generateSummary(nodeId: string): Promise<string> {
    try {
      const node = await KnowledgeNode.findById(nodeId);
      if (!node) {
        throw new AppError('Document not found', 404);
      }

      // Check if summary already exists
      if (node.content.summary && node.content.summary.length > 100) {
        return node.content.summary;
      }

      // Get representative chunks
      const chunks = await VectorChunk.find({ nodeId })
        .limit(10)
        .select('content');

      const context = chunks.map(c => c.content).join('\n\n');

      const completion = await this.openai.chat.completions.create({
        model: process.env.DEFAULT_AI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating concise, informative summaries of academic content.'
          },
          {
            role: 'user',
            content: `Summarize the following academic content in 3-4 paragraphs. Focus on main ideas, key concepts, and important takeaways.\n\n${context.slice(0, 5000)}`
          }
        ],
        temperature: 0.5,
        max_tokens: 800
      });

      const summary = completion.choices[0]?.message?.content || 'Summary unavailable.';

      // Cache summary
      node.content.summary = summary;
      await node.save();

      return summary;

    } catch (error) {
      logger.error('Error generating summary:', error);
      throw new AppError('Failed to generate summary', 500);
    }
  }

  /**
   * Update document analytics
   */
  private async updateAnalytics(nodeId: string): Promise<void> {
    await KnowledgeNode.findByIdAndUpdate(nodeId, {
      $inc: { 'analytics.queryCount': 1 },
      'analytics.lastAccessed': new Date()
    });
  }
}

export default new ChatService();
