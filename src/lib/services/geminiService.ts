import { Message, ApiResponse } from '../types';
import { API_ENDPOINTS } from '../api';

export interface GeminiConfig {
  temperature?: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
}

const DEFAULT_CONFIG: GeminiConfig = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 2048,
};

export class GeminiService {
  private static instance: GeminiService;
  private version = '1.0.0';

  private constructor() {}

  static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  getVersion(): string {
    return this.version;
  }

  async generateContent(
    prompt: string,
    apiKey: string,
    previousMessages: Message[] = [],
    config: Partial<GeminiConfig> = {}
  ): Promise<ApiResponse> {
    try {
      console.log(`[GeminiService v${this.version}] Generating content...`);

      const mergedConfig = { ...DEFAULT_CONFIG, ...config };
      
      // Prepare conversation history
      const contents = previousMessages.map(msg => ({
        role: msg.type === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      }));

      // Add the current prompt
      contents.push({
        role: "user",
        parts: [{ text: prompt }]
      });

      const response = await fetch(`${API_ENDPOINTS.GEMINI}/models/gemini-pro:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents,
          generationConfig: mergedConfig
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GeminiService] API error:', response.status, errorText);
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response format from Gemini API');
      }

      const content = data.candidates[0].content.parts[0].text;

      return {
        content,
        reasoning: '',
        status: 'complete',
        thoughtProcess: [],
        version: this.version
      };
    } catch (error) {
      console.error('[GeminiService] Error:', error);
      return {
        content: '',
        reasoning: '',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        version: this.version
      };
    }
  }

  async generateFollowUpQuestions(
    apiKey: string,
    previousMessages: Message[] = []
  ): Promise<string[]> {
    try {
      console.log(`[GeminiService v${this.version}] Generating follow-up questions...`);

      const response = await this.generateContent(
        'Based on our conversation, generate 3 relevant follow-up questions that would help deepen the understanding or explore related aspects. Return ONLY a JSON array of strings.',
        apiKey,
        previousMessages,
        { maxOutputTokens: 1024 }
      );

      if (response.status === 'error' || !response.content) {
        throw new Error(response.error || 'Failed to generate follow-up questions');
      }

      // Clean and parse the response
      const cleanContent = response.content.replace(/```json\n|\n```|```/g, '').trim();
      const questions = JSON.parse(cleanContent);

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid questions format');
      }

      return questions;
    } catch (error) {
      console.error('[GeminiService] Follow-up questions error:', error);
      throw error;
    }
  }
}
