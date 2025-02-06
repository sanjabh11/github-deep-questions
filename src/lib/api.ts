import { z } from "zod";
import { Message, ApiKeys } from "./types";

const API_KEY_REGEX = /^[A-Za-z0-9_-]{10,}$/;

export const ApiKeySchema = z.object({
  deepseek: z.string().regex(API_KEY_REGEX, 'Invalid DeepSeek API key format'),
  elevenlabs: z.string().regex(/^[A-Za-z0-9]{32}$/, 'Invalid ElevenLabs API key format').optional(),
  gemini: z.string().regex(/^[A-Za-z0-9_-]{39}$/, 'Invalid Gemini API key format').optional(),
});

export interface ThoughtProcess {
  type: 'thinking' | 'planning' | 'analyzing' | 'solving';
  content: string;
  timestamp: number;
}

export interface ApiResponse {
  content: string;
  reasoning: string;
  thoughtProcess?: ThoughtProcess[];
  status: 'complete' | 'timeout' | 'error';
  timeoutReason?: string;
}

// API Endpoints configuration
export const API_ENDPOINTS = {
  OPENROUTER: "https://openrouter.ai/api/v1/chat/completions",
  SERPAPI: "/api/proxy/serpapi",
  JINA: "/api/proxy/jina",
  GEMINI: "/api/proxy/gemini",
  DEEPSEEK: "/api/proxy/deepseek"
} as const;

// Constants
const STORAGE_KEY = "chat_history";
const API_KEYS_STORAGE = "api_keys";
const MAX_HISTORY = 5;
const TIMEOUT_DURATION = 120000; // 120 seconds

// Local storage functions
export const saveToLocalStorage = (messages: Message[]) => {
  try {
    const trimmedHistory = messages.slice(-MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
};

export const loadFromLocalStorage = (): Message[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const messages = stored ? JSON.parse(stored) : [];
    
    if (!Array.isArray(messages)) {
      return [];
    }
    
    return messages.filter((msg): msg is Message => {
      return (
        msg &&
        typeof msg === "object" &&
        "type" in msg &&
        "content" in msg &&
        typeof msg.content === "string" &&
        (msg.type === "user" || msg.type === "reasoning" || msg.type === "answer" || msg.type === "system")
      );
    });
  } catch (error) {
    console.error("Error loading from localStorage:", error);
    return [];
  }
};

// API Key management
export const saveApiKeys = (keys: ApiKeys) => {
  try {
    localStorage.setItem(API_KEYS_STORAGE, JSON.stringify(keys));
  } catch (error) {
    console.error("Error saving API keys:", error);
    throw new Error("Failed to save API keys");
  }
};

export const loadApiKeys = (): ApiKeys => {
  try {
    const stored = localStorage.getItem(API_KEYS_STORAGE);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error("Error loading API keys:", error);
    return {};
  }
};

export const validateApiKey = (apiKey: string | null): string => {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!API_KEY_REGEX.test(apiKey)) {
    throw new Error('Invalid API key format');
  }

  return apiKey;
};

const cleanJsonString = (str: string): string => {
  str = str.replace(/```json\s*|\s*```/g, '');
  str = str.replace(/```[a-z]*\s*|\s*```/g, '');
  str = str.trim();
  if (!str.startsWith('{')) {
    str = `{"type": "thinking", "content": ${JSON.stringify(str)}}`;
  }
  return str;
};

// DeepSeek API integration
export const callDeepSeek = async (
  prompt: string, 
  apiKey: string, 
  previousMessages: Message[] = [],
  onThoughtUpdate?: (thought: ThoughtProcess) => void
): Promise<ApiResponse> => {
  try {
    const validatedKey = validateApiKey(apiKey);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_DURATION);

    // First, get the thought process using OpenRouter
    const thoughtResponse = await fetch(API_ENDPOINTS.OPENROUTER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validatedKey}`,
        'HTTP-Referer': 'http://localhost:8080',
        'X-Title': 'Deep Researcher'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "deepseek-ai/deepseek-chat-1.3b",
        messages: [
          { 
            role: "system", 
            content: "You are in THINKING mode. Break down the problem step by step. Return your response in this exact JSON format without any markdown:\n{\"type\": \"thinking\", \"content\": \"your detailed thought process here\"}"
          },
          ...previousMessages.map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!thoughtResponse.ok) {
      throw new Error(`API error: ${thoughtResponse.status}`);
    }

    const thoughtData = await thoughtResponse.json();
    const thoughts: ThoughtProcess[] = [];
    
    try {
      if (thoughtData?.choices?.[0]?.message?.content) {
        const cleanedJson = cleanJsonString(thoughtData.choices[0].message.content);
        const thoughtContent = JSON.parse(cleanedJson);
        const thought: ThoughtProcess = {
          type: thoughtContent.type || 'thinking',
          content: thoughtContent.content || thoughtContent.toString(),
          timestamp: Date.now()
        };
        thoughts.push(thought);
        onThoughtUpdate?.(thought);
      }
    } catch (e) {
      console.error('Failed to parse thought process:', e);
      const defaultThought: ThoughtProcess = {
        type: 'thinking',
        content: thoughtData?.choices?.[0]?.message?.content || 'Analyzing the problem...',
        timestamp: Date.now()
      };
      thoughts.push(defaultThought);
      onThoughtUpdate?.(defaultThought);
    }

    // Now get the actual solution using OpenRouter
    const solutionResponse = await fetch(API_ENDPOINTS.OPENROUTER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validatedKey}`,
        'HTTP-Referer': 'http://localhost:8080',
        'X-Title': 'Deep Researcher'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "deepseek-ai/deepseek-chat-1.3b",
        messages: [
          { 
            role: "system", 
            content: "You are in SOLUTION mode. Provide a clear, direct answer to the problem. No need for JSON formatting."
          },
          ...previousMessages.map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    clearTimeout(timeoutId);

    if (!solutionResponse.ok) {
      throw new Error(`API error: ${solutionResponse.status}`);
    }

    const solutionData = await solutionResponse.json();
    
    if (!solutionData?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format: missing content');
    }

    return {
      content: solutionData.choices[0].message.content,
      reasoning: "Analysis complete",
      thoughtProcess: thoughts,
      status: 'complete'
    };

  } catch (error) {
    console.error('DeepSeek API Error:', error);

    if (error.name === 'AbortError') {
      return {
        content: "The request took too long to process.",
        reasoning: "Request timed out after 120 seconds",
        thoughtProcess: [],
        status: 'timeout',
        timeoutReason: 'The model took too long to generate a response. Would you like to escalate this to an architect review?'
      };
    }

    if (error instanceof SyntaxError) {
      return {
        content: "I encountered an error processing the response. Let me try a simpler approach.",
        reasoning: "Error parsing response",
        thoughtProcess: [],
        status: 'error'
      };
    }

    return {
      content: "The AI service encountered an error. Please try again in a moment.",
      reasoning: error.message || "Unknown error",
      thoughtProcess: [],
      status: 'error'
    };
  }
};