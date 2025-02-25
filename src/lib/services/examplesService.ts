import { Message } from '../types';
import { callDeepSeek } from '../api';
import { versionManager } from '../version/chatVersionManager';

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const MAX_RETRIES = 2;

export interface Example {
  title: string;
  description: string;
  code?: string;
  explanation?: string;
}

interface CacheEntry {
  examples: Example[];
  timestamp: number;
  context: string;
}

// Define ApiResponse interface here since it's not exported from types
interface ApiResponse {
  success: boolean;
  status: string;
  data?: any;
  error?: string;
  metadata?: {
    version?: string;
    timestamp?: number;
    type?: string;
  };
}

export class ExamplesService {
  private static instance: ExamplesService;
  private cache: Map<string, CacheEntry>;
  private version: string;

  private constructor() {
    this.cache = new Map();
    this.version = '1.0.0';
  }

  public static getInstance(): ExamplesService {
    if (!ExamplesService.instance) {
      ExamplesService.instance = new ExamplesService();
    }
    return ExamplesService.instance;
  }

  private generateCacheKey(messages: Message[]): string {
    const lastMessage = messages[messages.length - 1];
    return `examples_${lastMessage ? lastMessage.content.substring(0, 100) : 'empty'}`;
  }

  private isValidCache(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < CACHE_DURATION;
  }

  private generateExamplesPrompt(messages: Message[]): string {
    const lastMessage = messages[messages.length - 1];
    return `Generate 3 concrete, practical examples that illustrate: ${lastMessage.content}

Please return your response in this JSON format:
{
  "examples": [
    {
      "title": "Short descriptive title",
      "description": "Brief overview of this example",
      "code": "Code snippet if applicable, otherwise null",
      "explanation": "Detailed explanation of how this example works and why it's relevant"
    }
  ]
}

Each example should be clear, educational, and directly relevant to the topic.`;
  }

  private async retryWithFallback(
    apiKey: string,
    messages: Message[],
    retryCount: number = 0
  ): Promise<Example[]> {
    try {
      const prompt = this.generateExamplesPrompt(messages);
      const response = await callDeepSeek(prompt, apiKey, messages);

      if (!response || response.status !== 'complete') {
        throw new Error('Failed to generate examples');
      }

      try {
        // Safely parse the JSON response
        const parsed = JSON.parse(response.content);
        if (!parsed.examples || !Array.isArray(parsed.examples)) {
          throw new Error('Invalid response format: missing examples array');
        }
        return parsed.examples;
      } catch (parseError) {
        console.error('Failed to parse examples JSON:', parseError);
        // Try to extract examples from the response content
        const extractedExamples = this.extractExamplesFromText(response.content);
        if (extractedExamples.length > 0) {
          return extractedExamples;
        }
        throw parseError;
      }
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        console.warn(`Retry ${retryCount + 1} for examples generation`);
        return this.retryWithFallback(apiKey, messages, retryCount + 1);
      }

      // Fallback to basic examples
      const lastMessage = messages[messages.length - 1];
      return [
        {
          title: 'Basic Example 1',
          description: 'A simple illustration of the concept',
          explanation: 'This example demonstrates the fundamental principles.'
        },
        {
          title: 'Basic Example 2',
          description: 'Another perspective on the topic',
          explanation: 'This shows an alternative approach or viewpoint.'
        },
        {
          title: 'Basic Example 3',
          description: 'Practical application',
          explanation: 'This demonstrates how the concept applies in real-world scenarios.'
        }
      ];
    }
  }

  private extractExamplesFromText(text: string): Example[] {
    // Enhanced extractor that looks for examples in various formats
    const examples: Example[] = [];
    
    // Try to find "Example X:" or "Example X." patterns
    const exampleRegex = /Example\s*(\d+)[:.]\s*([^Example]*?)(?=Example\s*\d+[:.]\s*|$)/gis;
    let match;

    while ((match = exampleRegex.exec(text)) !== null) {
      const number = match[1];
      const content = match[2].trim();
      
      // Try to extract a title from the first line
      const lines = content.split('\n');
      const title = lines[0].replace(/^[#\-*:]+/, '').trim();
      const description = lines.slice(1).join('\n').trim();

      examples.push({
        title: title || `Example ${number}`,
        description: description || content,
        explanation: content
      });
    }

    // If no examples were found with the regex, try to find sections with headers
    if (examples.length === 0) {
      const headerRegex = /#+\s+(.+?)\n([\s\S]*?)(?=#+\s+|$)/g;
      let headerMatch;
      let count = 1;
      
      while ((headerMatch = headerRegex.exec(text)) !== null && count <= 3) {
        const title = headerMatch[1].trim();
        const content = headerMatch[2].trim();
        
        if (title && content) {
          // Split content into first paragraph (description) and rest (explanation)
          const paragraphs = content.split('\n\n');
          const description = paragraphs[0];
          const explanation = content;
          
          examples.push({
            title,
            description,
            explanation
          });
          
          count++;
        }
      }
    }

    // If still no examples found, create a single example from the entire text
    if (examples.length === 0) {
      examples.push({
        title: 'Example',
        description: text.substring(0, 100) + '...',
        explanation: text
      });
    }

    return examples;
  }

  public async generateExamples(
    apiKey: string,
    messages: Message[]
  ): Promise<ApiResponse> {
    const cacheKey = this.generateCacheKey(messages);
    const cachedEntry = this.cache.get(cacheKey);

    if (cachedEntry && this.isValidCache(cachedEntry)) {
      return {
        success: true,
        status: 'complete',
        data: {
          examples: cachedEntry.examples
        }
      };
    }

    try {
      const examples = await this.retryWithFallback(apiKey, messages);
      
      // Update cache
      this.cache.set(cacheKey, {
        examples,
        timestamp: Date.now(),
        context: messages[messages.length - 1]?.content || ''
      });

      // Create new version for this generation
      const newVersion = versionManager.createVersion(
        'Generated examples',
        'ExamplesService',
        'system'
      );

      return {
        success: true,
        status: 'complete',
        data: {
          examples
        },
        metadata: {
          version: newVersion,
          timestamp: Date.now(),
          type: 'examples'
        }
      };
    } catch (error) {
      console.error('Error generating examples:', error);
      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to generate examples'
      };
    }
  }

  public clearCache(): void {
    this.cache.clear();
  }
} 