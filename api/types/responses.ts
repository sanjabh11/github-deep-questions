// LLM Provider Response Types
export interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
  }>;
}

export interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Common Response Types
export interface BaseResponse {
  success: boolean;
  data?: {
    thinking?: string;
    analysis?: string;
    messages?: Array<{
      type: string;
      content: string;
    }>;
    config?: any;
  };
  error?: string;
}

// Streaming Event Types
export interface StreamEvent {
  type: 'thinking' | 'progress' | 'complete' | 'error';
  content?: string;
  thought?: string;
  progress?: string;
  data?: any;
  error?: string;
}

// API Request Types
export interface ProcessRequest {
  query: string;
  interfaceType: 'GENERAL' | 'RESEARCHER' | 'CODER';
  queryType: 'CODE' | 'EXPLANATION' | 'RESEARCH';
  files?: Array<{
    name: string;
    content: string;
  }>;
}

export type LLMResponse = DeepSeekResponse | GeminiResponse;

export function isDeepSeekResponse(response: unknown): response is DeepSeekResponse {
  return typeof response === 'object' && response !== null && 'choices' in response;
}

export function isGeminiResponse(response: unknown): response is GeminiResponse {
  return typeof response === 'object' && response !== null && 'candidates' in response;
} 