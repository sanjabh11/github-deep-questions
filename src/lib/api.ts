import { z } from "zod";

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

export type MessageType = "user" | "reasoning" | "answer" | "system";

export interface Message {
  type: MessageType;
  content: string;
}

const STORAGE_KEY = "chat_history";
const API_KEYS_STORAGE = "api_keys";
const MAX_HISTORY = 5;
const API_URL = "https://api.deepseek.com/v1/chat/completions";

// Keep track of API key validation status
const apiKeyValidationCache = new Map<string, { isValid: boolean; timestamp: number }>();
const VALIDATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const TIMEOUT_DURATION = 120000; // 120 seconds
const ARCHITECT_TIMEOUT = 120000; // 120 seconds for architect review

// API Endpoints
export const API_ENDPOINTS = {
  OPENROUTER: "https://openrouter.ai/api/v1",
  SERPAPI: "https://serpapi.com",
  JINA: "https://api.jina.ai/v1",
  GEMINI: "https://generativelanguage.googleapis.com/v1beta",
  DEEPSEEK: "https://api.deepseek.com/v1"
} as const;

export const saveApiKeys = (keys: { [key: string]: string }) => {
  try {
    // Validate keys before saving
    ApiKeySchema.parse(keys);
    localStorage.setItem(API_KEYS_STORAGE, JSON.stringify(keys));
    // Clear validation cache when new keys are saved
    apiKeyValidationCache.clear();
  } catch (error) {
    console.error("Invalid API key format:", error);
    throw new Error("Invalid API key format. Please check your API keys.");
  }
};

export const loadApiKeys = () => {
  try {
    const stored = localStorage.getItem(API_KEYS_STORAGE);
    if (!stored) {
      return {
        deepseek: null,
        elevenlabs: null,
        gemini: null
      };
    }
    
    const keys = JSON.parse(stored);
    // Validate loaded keys
    try {
      ApiKeySchema.parse(keys);
      return keys;
    } catch (error) {
      console.error("Invalid stored API keys:", error);
      // Return empty keys if validation fails
      return {
        deepseek: null,
        elevenlabs: null,
        gemini: null
      };
    }
  } catch (error) {
    console.error("Error loading API keys:", error);
    return {
      deepseek: null,
      elevenlabs: null,
      gemini: null
    };
  }
};

export const validateApiKey = (apiKey: string | null): string => {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  try {
    // Basic format validation
    if (!API_KEY_REGEX.test(apiKey)) {
      throw new Error('Invalid API key format');
    }

    return apiKey;
  } catch (error) {
    console.error('API key validation failed:', error);
    throw new Error('Invalid API key. Please check your API key format.');
  }
};

export const handleApiError = (error: any): never => {
  let message = 'An unknown error occurred';
  
  if (error?.error?.message) {
    if (error.error.message.includes('Authentication Fails')) {
      message = 'Invalid or expired API key. Please check your DeepSeek API key in settings.';
      // Cache the invalid status
      const apiKey = error?.config?.headers?.Authorization?.replace('Bearer ', '');
      if (apiKey) {
        apiKeyValidationCache.set(apiKey, { isValid: false, timestamp: Date.now() });
      }
    } else if (error.error.type === 'authentication_error') {
      message = 'Authentication failed. Please verify your API key and try again.';
    } else {
      message = error.error.message;
    }
  }
  
  throw new Error(message);
};

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
    
    // Validate that messages is an array and each message has the correct shape
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

const cleanJsonString = (str: string): string => {
  // Remove markdown code blocks
  str = str.replace(/```json\s*|\s*```/g, '');
  // Remove any other markdown formatting
  str = str.replace(/```[a-z]*\s*|\s*```/g, '');
  // Ensure proper JSON structure
  str = str.trim();
  // If the string doesn't start with {, wrap it
  if (!str.startsWith('{')) {
    str = `{"type": "thinking", "content": ${JSON.stringify(str)}}`;
  }
  return str;
};

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

    // First, get the thought process
    const thoughtResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validatedKey}`,
        'Accept': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "deepseek-chat",
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

    // Now get the actual solution
    const solutionResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validatedKey}`,
        'Accept': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "deepseek-chat",
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

    // Handle JSON parsing errors
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