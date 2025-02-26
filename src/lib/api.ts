import { z } from "zod";

const API_KEY_REGEX = /^[A-Za-z0-9_-]{10,}$/;

export const ApiKeySchema = z.object({
  deepseek: z.string().regex(API_KEY_REGEX, 'Invalid DeepSeek API key format'),
  elevenlabs: z.string().regex(/^[A-Za-z0-9]{32}$/, 'Invalid ElevenLabs API key format').optional(),
  gemini: z.string().regex(/^[A-Za-z0-9_-]{39}$/, 'Invalid Gemini API key format').optional(),
});

export interface ThoughtProcess {
  type: 'thinking' | 'planning' | 'analyzing' | 'solving';
  content: string | Record<string, any>;
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

export function loadApiKeys() {
  try {
    // First try to load from environment
    const envKeys = {
      deepseek: import.meta.env.VITE_DEEPSEEK_API_KEY,
      gemini: import.meta.env.VITE_GEMINI_API_KEY,
      elevenlabs: import.meta.env.VITE_ELEVENLABS_API_KEY,
    };

    // If any keys are in env, use those
    if (envKeys.deepseek || envKeys.gemini || envKeys.elevenlabs) {
      return envKeys;
    }

    // Otherwise try localStorage
    const storedKeys = localStorage.getItem(API_KEYS_STORAGE);
    if (!storedKeys) {
      return {};
    }

    const parsedKeys = JSON.parse(storedKeys);
    return {
      deepseek: parsedKeys.deepseek || "",
      gemini: parsedKeys.gemini || "",
      elevenlabs: parsedKeys.elevenlabs || "",
    };
  } catch (error) {
    console.error('Error loading API keys:', error);
    return {};
  }
}

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
  onThoughtUpdate?: (thought: ThoughtProcess) => void,
  files: { name: string; content: string }[] = []
): Promise<ApiResponse> => {
  try {
    const validatedKey = validateApiKey(apiKey);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_DURATION);

    // Prepare file content string if files are attached
    const MAX_FILE_CONTENT_LENGTH = 5000; // Limit file content to 5000 characters per file
    const fileContentString = files.length > 0 
      ? `\n\nAttached files:\n${files.map(f => {
          // Truncate file content if it's too large
          const truncated = f.content.length > MAX_FILE_CONTENT_LENGTH;
          const content = truncated 
            ? f.content.substring(0, MAX_FILE_CONTENT_LENGTH) + `... [Content truncated, ${f.content.length - MAX_FILE_CONTENT_LENGTH} more characters]` 
            : f.content;
          
          return `--- ${f.name} ---\n${content}`;
        }).join('\n\n')}`
      : '';

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
            content: `You are in THINKING mode. Analyze the problem step by step. Return your analysis as a JSON object with 'type' and 'content' fields.
            The 'type' should be one of: 'thinking', 'planning', 'analyzing', or 'solving'.
            The 'content' should be a string with your detailed analysis.
            If you need to include structured data, ensure it's properly formatted as a string.
            ${files.length > 0 ? `The user has attached ${files.length} file(s): ${files.map(f => f.name).join(', ')}` : ''}` 
          },
          ...previousMessages.map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
          { 
            role: "user", 
            content: prompt + fileContentString
          }
        ],
        temperature: 0.3,
        max_tokens: 2048
      })
    });

    if (!thoughtResponse.ok) {
      throw new Error(`API error: ${thoughtResponse.status}`);
    }

    // Safely parse the thought response
    let thoughtData;
    try {
      const thoughtText = await thoughtResponse.text();
      console.log('DeepSeek API response:', thoughtText.substring(0, 100)); // Log the first 100 chars of the response
      
      if (!thoughtText || thoughtText.trim() === '') {
        console.error('Empty response received from DeepSeek API');
        // Return a fallback response instead of throwing an error
        return {
          content: "I'm sorry, but I couldn't analyze the file at this time. The DeepSeek API returned an empty response. Please try again later or consider uploading a smaller file.",
          thoughtProcess: [{
            type: 'thinking',
            content: 'The DeepSeek API returned an empty response. This could be due to server load, API rate limits, or issues with processing the file content.',
            timestamp: Date.now()
          }],
          status: 'error'
        };
      }
      
      try {
        thoughtData = JSON.parse(thoughtText);
      } catch (jsonError) {
        console.error('Failed to parse DeepSeek API response as JSON:', jsonError, 'Response:', thoughtText);
        // Return a fallback response for JSON parsing errors
        return {
          content: "I'm sorry, but there was an error processing the response from the AI service. Please try again later.",
          thoughtProcess: [{
            type: 'thinking',
            content: `Error parsing API response: ${jsonError.message}. Raw response: ${thoughtText.substring(0, 200)}...`,
            timestamp: Date.now()
          }],
          status: 'error'
        };
      }
    } catch (parseError) {
      console.error('Failed to process DeepSeek API response:', parseError);
      throw new Error(`Failed to parse API response: ${parseError.message}`);
    }
    
    const thoughts: ThoughtProcess[] = [];
    
    try {
      if (thoughtData?.choices?.[0]?.message?.content) {
        try {
          const cleanedJson = cleanJsonString(thoughtData.choices[0].message.content);
          let thoughtContent;
          
          try {
            thoughtContent = JSON.parse(cleanedJson);
          } catch (parseError) {
            // If it's not valid JSON, use the raw content
            console.log('Not valid JSON, using raw content');
            thoughtContent = { 
              type: 'thinking', 
              content: thoughtData.choices[0].message.content 
            };
          }
          
          // Handle case where content might be an object
          let processedContent = thoughtContent.content;
          
          // If content is an object but not a string, ensure it's properly formatted
          if (typeof processedContent === 'object' && processedContent !== null) {
            // Keep it as an object, will be stringified in the component
            console.log('Content is an object:', processedContent);
          } else if (typeof processedContent !== 'string') {
            // Convert to string if it's not already a string or object
            processedContent = String(processedContent || '');
          }
          
          const thought: ThoughtProcess = {
            type: thoughtContent.type || 'thinking',
            content: processedContent,
            timestamp: Date.now()
          };
          
          console.log('Processed thought:', thought);
          thoughts.push(thought);
          onThoughtUpdate?.(thought);
        } catch (jsonError) {
          // If JSON parsing fails, use the raw content as a fallback
          console.error('Failed to parse thought process:', jsonError);
          const rawContent = thoughtData.choices[0].message.content;
          const defaultThought: ThoughtProcess = {
            type: 'thinking',
            content: typeof rawContent === 'string' ? rawContent : 'Analyzing the problem...',
            timestamp: Date.now()
          };
          thoughts.push(defaultThought);
          onThoughtUpdate?.(defaultThought);
        }
      }
    } catch (e) {
      console.error('Failed to process thought data:', e);
      const defaultThought: ThoughtProcess = {
        type: 'thinking',
        content: 'Analyzing the problem...',
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
            content: `You are in SOLUTION mode. Provide a clear, direct answer to the problem. No need for JSON formatting.
            ${files.length > 0 ? `The user has attached ${files.length} file(s): ${files.map(f => f.name).join(', ')}` : ''}`
          },
          ...previousMessages.map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
          { 
            role: "user", 
            content: prompt + fileContentString
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    clearTimeout(timeoutId);

    if (!solutionResponse.ok) {
      throw new Error(`API error: ${solutionResponse.status}`);
    }

    // Process the solution response
    let solutionData;
    try {
      const solutionText = await solutionResponse.text();
      console.log('DeepSeek solution response:', solutionText.substring(0, 100)); // Log the first 100 chars
      
      if (!solutionText || solutionText.trim() === '') {
        console.error('Empty solution response received from DeepSeek API');
        return {
          content: "I'm sorry, but I couldn't generate a response at this time. The API returned an empty response. Please try again later or consider simplifying your request.",
          thoughtProcess: thoughts,
          status: 'error'
        };
      }
      
      try {
        solutionData = JSON.parse(solutionText);
      } catch (jsonError) {
        console.error('Failed to parse DeepSeek solution response as JSON:', jsonError, 'Response:', solutionText);
        // If we can't parse the JSON, return the raw text as the solution
        return {
          content: "I'm sorry, but there was an error processing the response. Please try again later.",
          thoughtProcess: thoughts,
          status: 'error'
        };
      }
    } catch (parseError) {
      console.error('Failed to process DeepSeek solution response:', parseError);
      throw new Error(`Failed to parse solution response: ${parseError.message}`);
    }
    
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
        reasoning: "Error parsing response: " + error.message,
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