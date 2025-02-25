import { Message, FollowUpQuestion } from '../types';
import { callDeepSeek } from '../api';
import { versionManager } from '../version/chatVersionManager';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const TIMEOUT = 30000; // 30 seconds

interface CacheEntry {
  questions: FollowUpQuestion[];
  timestamp: number;
  context: string;
}

// Define a service response interface for our follow-up service
interface ServiceResponse {
  success: boolean;
  status: string;
  data?: {
    followUpQuestions?: FollowUpQuestion[];
  };
  error?: string;
  metadata?: {
    version?: string;
    timestamp?: number;
    type?: string;
  };
}

export class FollowUpService {
  private static instance: FollowUpService;
  private cache: Map<string, CacheEntry>;
  private version: string;

  private constructor() {
    this.cache = new Map();
    this.version = '1.0.0';
  }

  public static getInstance(): FollowUpService {
    if (!FollowUpService.instance) {
      FollowUpService.instance = new FollowUpService();
    }
    return FollowUpService.instance;
  }

  private generateCacheKey(messages: Message[]): string {
    const lastMessages = messages.slice(-3); // Consider last 3 messages for context
    return lastMessages.map(m => `${m.type}:${m.content.substring(0, 100)}`).join('|');
  }

  private isValidCache(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < CACHE_DURATION;
  }

  private async generateQuestionsPrompt(messages: Message[]): Promise<string> {
    const context = messages.slice(-3).map(m => m.content).join('\n');
    return `Based on this conversation context:\n${context}\n\nGenerate 3 relevant follow-up questions that would help deepen the understanding or explore related aspects. Return response in this JSON format:
    {
      "questions": [
        {
          "id": "unique_id",
          "question": "the follow-up question",
          "relevance": 0.95,
          "context": "brief context why this question is relevant"
        }
      ]
    }`;
  }

  private async callLLMWithRetry(
    apiKey: string,
    messages: Message[],
    retryCount: number = 0
  ): Promise<FollowUpQuestion[]> {
    try {
      const prompt = await this.generateQuestionsPrompt(messages);
      const response = await callDeepSeek(
        prompt,
        apiKey,
        messages
      );

      if (!response || response.status !== 'complete') {
        throw new Error('Failed to generate questions');
      }

      try {
        // Safely parse the JSON response
        const parsed = JSON.parse(response.content);
        if (!parsed.questions || !Array.isArray(parsed.questions)) {
          throw new Error('Invalid response format: missing questions array');
        }
        return parsed.questions;
      } catch (parseError) {
        console.error('Failed to parse follow-up questions JSON:', parseError);
        // Try to extract questions from text if JSON parsing fails
        const extractedQuestions = this.extractQuestionsFromText(response.content);
        if (extractedQuestions.length > 0) {
          return extractedQuestions;
        }
        throw parseError;
      }
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        console.warn(`Retry ${retryCount + 1} for follow-up questions`);
        return this.callLLMWithRetry(apiKey, messages, retryCount + 1);
      }

      // Fallback to basic questions based on last message
      const lastMessage = messages[messages.length - 1];
      return [
        {
          id: 'fallback_1',
          question: 'Can you explain that in more detail?',
          relevance: 0.8,
          context: 'Basic clarification'
        },
        {
          id: 'fallback_2',
          question: 'What are the implications of this?',
          relevance: 0.7,
          context: 'Understanding impact'
        },
        {
          id: 'fallback_3',
          question: 'Could you provide an example?',
          relevance: 0.6,
          context: 'Practical application'
        }
      ];
    }
  }

  // Add a helper method to extract questions from text when JSON parsing fails
  private extractQuestionsFromText(text: string): FollowUpQuestion[] {
    const questions: FollowUpQuestion[] = [];
    
    // Try to find numbered questions (e.g., "1. What is...")
    const numberedQuestionRegex = /\d+\.\s+([^?]+\??)/g;
    let match;
    let id = 1;
    
    while ((match = numberedQuestionRegex.exec(text)) !== null) {
      if (match[1] && match[1].trim()) {
        questions.push({
          id: `extracted_${id}`,
          question: match[1].trim(),
          relevance: 0.7 - (id * 0.05), // Decreasing relevance for later questions
          context: 'Extracted from response'
        });
        id++;
      }
    }
    
    // If no numbered questions found, try to find question marks
    if (questions.length === 0) {
      const questionRegex = /([^.!?]+\?)/g;
      id = 1;
      
      while ((match = questionRegex.exec(text)) !== null) {
        if (match[1] && match[1].trim()) {
          questions.push({
            id: `extracted_${id}`,
            question: match[1].trim(),
            relevance: 0.7 - (id * 0.05),
            context: 'Extracted from response'
          });
          id++;
          
          // Limit to 3 questions
          if (id > 3) break;
        }
      }
    }
    
    return questions;
  }

  public async generateFollowUpQuestions(
    apiKey: string,
    messages: Message[]
  ): Promise<ServiceResponse> {
    const cacheKey = this.generateCacheKey(messages);
    const cachedEntry = this.cache.get(cacheKey);

    if (cachedEntry && this.isValidCache(cachedEntry)) {
      return {
        success: true,
        status: 'complete',
        data: {
          followUpQuestions: cachedEntry.questions
        }
      };
    }

    try {
      const questions = await this.callLLMWithRetry(apiKey, messages);
      
      // Update cache
      this.cache.set(cacheKey, {
        questions,
        timestamp: Date.now(),
        context: messages[messages.length - 1]?.content || ''
      });

      // Create new version for this generation
      const newVersion = versionManager.createVersion(
        'Generated follow-up questions',
        'FollowUpService',
        'message'
      );

      return {
        success: true,
        status: 'complete',
        data: {
          followUpQuestions: questions
        },
        metadata: {
          version: newVersion,
          timestamp: Date.now(),
          type: 'message'
        }
      };
    } catch (error) {
      console.error('Error generating follow-up questions:', error);
      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to generate follow-up questions'
      };
    }
  }

  public clearCache(): void {
    this.cache.clear();
  }
} 