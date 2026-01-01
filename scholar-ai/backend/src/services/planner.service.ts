import OpenAI from 'openai';
import KnowledgeNode from '../models/KnowledgeNode.model';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';

interface StudyTask {
  day: number;
  date: string;
  tasks: Array<{
    type: 'read' | 'review' | 'practice' | 'quiz' | 'rest';
    title: string;
    duration: number; // minutes
    description: string;
    nodeId?: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  totalMinutes: number;
}

interface StudyPlan {
  goal: string;
  examDate: Date;
  daysRemaining: number;
  totalStudyHours: number;
  schedule: StudyTask[];
  weeklyGoals: string[];
  recommendations: string[];
}

interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: 'concept' | 'prerequisite' | 'application';
  level: number;
}

interface KnowledgeGraphEdge {
  source: string;
  target: string;
  relationship: 'requires' | 'relates_to' | 'applies_to';
}

class PlannerService {
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
   * Generate comprehensive study plan
   */
  async generateStudyPlan(
    userId: string,
    nodeIds: string[],
    examDate: Date,
    currentLevel: 'beginner' | 'intermediate' | 'advanced'
  ): Promise<StudyPlan> {
    try {
      logger.info(`📅 Generating study plan for ${nodeIds.length} documents`);

      // Get all knowledge nodes
      const nodes = await KnowledgeNode.find({
        _id: { $in: nodeIds },
        userId
      });

      if (nodes.length === 0) {
        throw new AppError('No valid documents found', 404);
      }

      // Calculate days remaining
      const now = new Date();
      const daysRemaining = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysRemaining < 1) {
        throw new AppError('Exam date must be in the future', 400);
      }

      // Estimate study hours based on content
      const totalStudyHours = this.estimateStudyHours(nodes, currentLevel);

      // Generate schedule using spaced repetition
      const schedule = await this.generateSchedule(nodes, daysRemaining, totalStudyHours);

      // Generate weekly goals
      const weeklyGoals = this.generateWeeklyGoals(schedule, daysRemaining);

      // Generate AI recommendations
      const recommendations = await this.generateRecommendations(
        nodes,
        daysRemaining,
        currentLevel
      );

      return {
        goal: `Master content from ${nodes.length} document(s) for exam`,
        examDate,
        daysRemaining,
        totalStudyHours,
        schedule,
        weeklyGoals,
        recommendations
      };

    } catch (error) {
      logger.error('Error generating study plan:', error);
      throw error;
    }
  }

  /**
   * Estimate required study hours
   */
  private estimateStudyHours(
    nodes: any[],
    level: string
  ): number {
    let totalMinutes = 0;

    for (const node of nodes) {
      const wordCount = node.meta.wordCount || 0;
      const pageCount = node.meta.pageCount || 0;
      
      // Base reading time: ~200 words per minute
      const readingMinutes = wordCount / 200;

      // Difficulty multiplier
      const difficultyMultiplier = {
        'Beginner': 1.5,
        'Intermediate': 2.0,
        'Advanced': 2.5,
        'Expert': 3.0
      }[node.content.difficulty] || 2.0;

      // User level adjustment
      const levelMultiplier = {
        'beginner': 1.5,
        'intermediate': 1.0,
        'advanced': 0.8
      }[level] || 1.0;

      // Total time = reading + review + practice
      const nodeMinutes = readingMinutes * difficultyMultiplier * levelMultiplier * 2.5;

      totalMinutes += nodeMinutes;
    }

    return Math.ceil(totalMinutes / 60); // Convert to hours
  }

  /**
   * Generate study schedule with spaced repetition
   */
  private async generateSchedule(
    nodes: any[],
    daysRemaining: number,
    totalStudyHours: number
  ): Promise<StudyTask[]> {
    const schedule: StudyTask[] = [];
    const dailyMinutes = (totalStudyHours * 60) / daysRemaining;

    // Spaced repetition intervals (days)
    const repetitionIntervals = [1, 2, 4, 7, 14];

    for (let day = 1; day <= daysRemaining; day++) {
      const date = new Date();
      date.setDate(date.getDate() + day);

      const tasks: any[] = [];
      let dayMinutes = 0;

      // Determine task type based on day pattern
      const cycleDay = (day - 1) % 7;

      if (cycleDay === 6) {
        // Sunday: Rest day with light review
        tasks.push({
          type: 'rest',
          title: 'Rest & Light Review',
          duration: 30,
          description: 'Take a break and do light review of the week',
          priority: 'low'
        });
        dayMinutes = 30;
      } else {
        // Regular study day
        const targetMinutes = Math.min(dailyMinutes * 1.2, 180); // Cap at 3 hours per day

        // New content (40% of time)
        const newContentNode = nodes[Math.floor((day - 1) / 3) % nodes.length];
        tasks.push({
          type: 'read',
          title: `Study: ${newContentNode.meta.originalName}`,
          duration: Math.floor(targetMinutes * 0.4),
          description: 'Learn new material and take notes',
          nodeId: newContentNode._id.toString(),
          priority: 'high'
        });

        // Review previous content (30% of time)
        if (day > 1) {
          const reviewNode = nodes[Math.floor((day - 2) / 3) % nodes.length];
          tasks.push({
            type: 'review',
            title: `Review: ${reviewNode.meta.originalName}`,
            duration: Math.floor(targetMinutes * 0.3),
            description: 'Review and consolidate previous material',
            nodeId: reviewNode._id.toString(),
            priority: 'medium'
          });
        }

        // Practice/Quiz (30% of time)
        if (day > 2) {
          const practiceNode = nodes[Math.floor((day - 3) / 3) % nodes.length];
          tasks.push({
            type: cycleDay % 2 === 0 ? 'quiz' : 'practice',
            title: `${cycleDay % 2 === 0 ? 'Quiz' : 'Practice'}: ${practiceNode.meta.originalName}`,
            duration: Math.floor(targetMinutes * 0.3),
            description: 'Test your understanding with exercises',
            nodeId: practiceNode._id.toString(),
            priority: 'high'
          });
        }

        dayMinutes = tasks.reduce((sum, t) => sum + t.duration, 0);
      }

      schedule.push({
        day,
        date: date.toISOString().split('T')[0],
        tasks,
        totalMinutes: dayMinutes
      });
    }

    return schedule;
  }

  /**
   * Generate weekly goals
   */
  private generateWeeklyGoals(
    schedule: StudyTask[],
    daysRemaining: number
  ): string[] {
    const weeks = Math.ceil(daysRemaining / 7);
    const goals: string[] = [];

    for (let week = 1; week <= weeks; week++) {
      const weekStart = (week - 1) * 7 + 1;
      const weekEnd = Math.min(week * 7, daysRemaining);
      const weekTasks = schedule.slice(weekStart - 1, weekEnd);

      const totalMinutes = weekTasks.reduce((sum, day) => sum + day.totalMinutes, 0);
      const readCount = weekTasks.reduce(
        (sum, day) => sum + day.tasks.filter(t => t.type === 'read').length,
        0
      );
      const quizCount = weekTasks.reduce(
        (sum, day) => sum + day.tasks.filter(t => t.type === 'quiz').length,
        0
      );

      goals.push(
        `Week ${week}: Complete ${readCount} chapters, ${quizCount} quizzes (${Math.round(totalMinutes / 60)} hours)`
      );
    }

    return goals;
  }

  /**
   * Generate AI-powered recommendations
   */
  private async generateRecommendations(
    nodes: any[],
    daysRemaining: number,
    level: string
  ): Promise<string[]> {
    try {
      const nodesSummary = nodes.map(n => ({
        title: n.meta.originalName,
        difficulty: n.content.difficulty,
        topics: n.content.keyTopics.slice(0, 5)
      }));

      const prompt = `As an expert study coach, provide 5 specific recommendations for a ${level} student preparing for an exam in ${daysRemaining} days. They're studying these materials:

${JSON.stringify(nodesSummary, null, 2)}

Provide actionable, specific advice. Format as a JSON array of strings.`;

      const completion = await this.openai.chat.completions.create({
        model: process.env.DEFAULT_AI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert study coach. Provide concise, actionable advice. Respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const responseText = completion.choices[0]?.message?.content || '[]';
      const recommendations = JSON.parse(
        responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      );

      return Array.isArray(recommendations) ? recommendations : [];

    } catch (error) {
      logger.error('Error generating recommendations:', error);
      return [
        'Review material regularly using spaced repetition',
        'Take breaks every 25-30 minutes (Pomodoro technique)',
        'Practice active recall instead of passive reading',
        'Create summaries after each study session',
        'Test yourself frequently with practice questions'
      ];
    }
  }

  /**
   * Generate knowledge graph for visualization
   */
  async generateKnowledgeGraph(
    nodeIds: string[],
    userId: string
  ): Promise<{
    nodes: KnowledgeGraphNode[];
    edges: KnowledgeGraphEdge[];
  }> {
    try {
      const knowledgeNodes = await KnowledgeNode.find({
        _id: { $in: nodeIds },
        userId
      }).select('meta.originalName content.keyTopics content.subjects relationships');

      const graphNodes: KnowledgeGraphNode[] = [];
      const graphEdges: KnowledgeGraphEdge[] = [];

      // Create main document nodes
      knowledgeNodes.forEach((node, index) => {
        graphNodes.push({
          id: node._id.toString(),
          label: node.meta.originalName,
          type: 'concept',
          level: 0
        });

        // Create concept nodes from key topics
        node.content.keyTopics.slice(0, 5).forEach((topic, topicIndex) => {
          const topicId = `${node._id}_topic_${topicIndex}`;
          
          graphNodes.push({
            id: topicId,
            label: topic,
            type: 'concept',
            level: 1
          });

          graphEdges.push({
            source: node._id.toString(),
            target: topicId,
            relationship: 'relates_to'
          });
        });

        // Create edges for prerequisites
        if (node.relationships.prerequisites.length > 0) {
          node.relationships.prerequisites.forEach(prereqId => {
            if (nodeIds.includes(prereqId.toString())) {
              graphEdges.push({
                source: prereqId.toString(),
                target: node._id.toString(),
                relationship: 'requires'
              });
            }
          });
        }
      });

      // Find related nodes based on common topics
      for (let i = 0; i < knowledgeNodes.length; i++) {
        for (let j = i + 1; j < knowledgeNodes.length; j++) {
          const commonTopics = knowledgeNodes[i].content.keyTopics.filter(
            topic => knowledgeNodes[j].content.keyTopics.includes(topic)
          );

          if (commonTopics.length >= 2) {
            graphEdges.push({
              source: knowledgeNodes[i]._id.toString(),
              target: knowledgeNodes[j]._id.toString(),
              relationship: 'relates_to'
            });
          }
        }
      }

      return { nodes: graphNodes, edges: graphEdges };

    } catch (error) {
      logger.error('Error generating knowledge graph:', error);
      throw new AppError('Failed to generate knowledge graph', 500);
    }
  }

  /**
   * Generate debate between two document personas
   */
  async generateDebate(
    nodeId1: string,
    nodeId2: string,
    topic: string,
    rounds: number = 3
  ): Promise<Array<{ speaker: string; statement: string; round: number }>> {
    try {
      const [node1, node2] = await Promise.all([
        KnowledgeNode.findById(nodeId1),
        KnowledgeNode.findById(nodeId2)
      ]);

      if (!node1 || !node2) {
        throw new AppError('One or both documents not found', 404);
      }

      const debate: Array<{ speaker: string; statement: string; round: number }> = [];

      for (let round = 1; round <= rounds; round++) {
        // Persona 1's turn
        const response1 = await this.generateDebateResponse(
          node1,
          topic,
          debate,
          round
        );

        debate.push({
          speaker: node1.persona.generatedName,
          statement: response1,
          round
        });

        // Persona 2's turn
        const response2 = await this.generateDebateResponse(
          node2,
          topic,
          debate,
          round
        );

        debate.push({
          speaker: node2.persona.generatedName,
          statement: response2,
          round
        });
      }

      return debate;

    } catch (error) {
      logger.error('Error generating debate:', error);
      throw new AppError('Failed to generate debate', 500);
    }
  }

  /**
   * Generate single debate response
   */
  private async generateDebateResponse(
    node: any,
    topic: string,
    previousStatements: any[],
    round: number
  ): Promise<string> {
    const context = previousStatements
      .map(s => `${s.speaker}: ${s.statement}`)
      .join('\n\n');

    const prompt = `You are ${node.persona.generatedName}, participating in an academic debate.

Topic: ${topic}

${context ? `Previous statements:\n${context}\n\n` : ''}

Round ${round}: Present your perspective on this topic based on your expertise. ${
      round > 1 ? 'Address points raised by the other speaker.' : ''
    }

Keep your response to 2-3 paragraphs. Be professional but engaging.`;

    const completion = await this.openai.chat.completions.create({
      model: process.env.DEFAULT_AI_MODEL,
      messages: [
        {
          role: 'system',
          content: node.persona.personalityPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 300
    });

    return completion.choices[0]?.message?.content || 'I defer to my opponent on this point.';
  }
}

export default new PlannerService();