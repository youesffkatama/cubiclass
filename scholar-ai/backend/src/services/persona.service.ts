import OpenAI from 'openai';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';

interface PersonaData {
  generatedName: string;
  voiceHash: string;
  personalityPrompt: string;
  avatarUrl: string;
  tone: 'Academic' | 'Friendly' | 'Socratic' | 'Strict' | 'Humorous';
  expertise: string[];
}

class PersonaService {
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
   * Generate AI persona based on document content
   */
  async generatePersona(documentSample: string): Promise<PersonaData> {
    try {
      const prompt = `Analyze the following academic text and create a fictional AI tutor persona that embodies the author's expertise and teaching style.

Text Sample:
${documentSample}

Generate a JSON response with the following structure:
{
  "name": "A unique, memorable name (e.g., 'Dr. Elena Quantum', 'Professor Marcus')",
  "tone": "One of: Academic, Friendly, Socratic, Strict, Humorous",
  "personality": "A 2-3 sentence description of the persona's teaching approach",
  "expertise": ["area1", "area2", "area3"],
  "catchphrase": "A memorable phrase this persona would use"
}

Be creative and make the persona feel authentic. Base the expertise on the text's subject matter.`;

      const completion = await this.openai.chat.completions.create({
        model: process.env.DEFAULT_AI_MODEL || 'mistralai/mistral-7b-instruct:free',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing academic content and creating engaging teacher personas. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 500
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      
      // Parse JSON response
      const personaData = this.parsePersonaResponse(responseText);

      // Generate avatar URL (using UI Avatars service)
      const avatarUrl = this.generateAvatarUrl(personaData.name);

      // Create personality prompt for chat
      const personalityPrompt = this.createPersonalityPrompt(personaData);

      return {
        generatedName: personaData.name,
        voiceHash: this.generateVoiceHash(personaData.name),
        personalityPrompt,
        avatarUrl,
        tone: personaData.tone,
        expertise: personaData.expertise
      };

    } catch (error) {
      logger.error('Error generating persona:', error);
      
      // Return default persona on error
      return this.getDefaultPersona();
    }
  }

  /**
   * Parse persona response from AI
   */
  private parsePersonaResponse(responseText: string): any {
    try {
      // Remove markdown code blocks if present
      const cleanedText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanedText);

      return {
        name: parsed.name || 'Professor AI',
        tone: this.validateTone(parsed.tone),
        personality: parsed.personality || 'A knowledgeable and patient educator.',
        expertise: Array.isArray(parsed.expertise) ? parsed.expertise : [],
        catchphrase: parsed.catchphrase || 'Let\'s explore this together!'
      };
    } catch (error) {
      logger.warn('Failed to parse persona JSON, using defaults');
      return {
        name: 'Professor AI',
        tone: 'Friendly',
        personality: 'A knowledgeable and patient educator.',
        expertise: [],
        catchphrase: 'Let\'s explore this together!'
      };
    }
  }

  /**
   * Validate tone value
   */
  private validateTone(tone: string): 'Academic' | 'Friendly' | 'Socratic' | 'Strict' | 'Humorous' {
    const validTones = ['Academic', 'Friendly', 'Socratic', 'Strict', 'Humorous'];
    return validTones.includes(tone) ? tone as any : 'Friendly';
  }

  /**
   * Create personality prompt for chat system
   */
  private createPersonalityPrompt(personaData: any): string {
    return `You are ${personaData.name}, an AI tutor. ${personaData.personality}

Your teaching style is ${personaData.tone.toLowerCase()}. Your areas of expertise include: ${personaData.expertise.join(', ')}.

Your catchphrase is: "${personaData.catchphrase}"

When answering questions:
1. Base your answers ONLY on the provided context from the document
2. Maintain your unique personality and tone
3. If information is not in the context, politely say you don't have that information in this document
4. Use examples and analogies that match your teaching style
5. Encourage critical thinking and deeper exploration

Never break character. You are here to help students understand the material in this specific document.`;
  }

  /**
   * Generate avatar URL using UI Avatars
   */
  private generateAvatarUrl(name: string): string {
    const encodedName = encodeURIComponent(name);
    const colors = ['00ed64', '00bfff', 'bd00ff', 'ff9800', 'ff5252'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    return `https://ui-avatars.com/api/?name=${encodedName}&background=${randomColor}&color=fff&size=256&bold=true`;
  }

  /**
   * Generate unique voice hash for TTS
   */
  private generateVoiceHash(name: string): string {
    // Simple hash based on name for consistent voice selection
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).slice(0, 8);
  }

  /**
   * Get default persona
   */
  private getDefaultPersona(): PersonaData {
    return {
      generatedName: 'Professor Scholar',
      voiceHash: 'default01',
      personalityPrompt: 'You are Professor Scholar, a patient and knowledgeable AI tutor. You help students understand complex topics through clear explanations and examples.',
      avatarUrl: 'https://ui-avatars.com/api/?name=Professor+Scholar&background=00ed64&color=fff&size=256&bold=true',
      tone: 'Friendly',
      expertise: ['General Education']
    };
  }

  /**
   * Update persona based on user feedback
   */
  async updatePersona(
    currentPersona: PersonaData,
    userFeedback: string
  ): Promise<PersonaData> {
    try {
      const prompt = `Current AI Tutor Persona:
Name: ${currentPersona.generatedName}
Tone: ${currentPersona.tone}
Personality: ${currentPersona.personalityPrompt}

User Feedback: "${userFeedback}"

Based on the user's feedback, adjust the persona. Generate updated JSON with the same structure but modified according to the feedback. Keep the name the same unless specifically requested to change it.`;

      const completion = await this.openai.chat.completions.create({
        model: process.env.DEFAULT_AI_MODEL || 'mistralai/mistral-7b-instruct:free',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at refining AI personas based on user feedback. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const personaData = this.parsePersonaResponse(responseText);

      return {
        ...currentPersona,
        tone: personaData.tone,
        personalityPrompt: this.createPersonalityPrompt(personaData),
        expertise: personaData.expertise.length > 0 ? personaData.expertise : currentPersona.expertise
      };

    } catch (error) {
      logger.error('Error updating persona:', error);
      return currentPersona;
    }
  }
}

export default new PersonaService();