import { config } from 'dotenv';
import fetch from 'node-fetch';
import { Message } from './types/messages.js';
import { 
  DeepSeekResponse, 
  GeminiResponse,
  LLMResponse,
  isDeepSeekResponse,
  isGeminiResponse
} from './types/responses.js';
import { createLogger, format, transports } from 'winston';
import NodeCache from 'node-cache';

config(); // Load environment variables

// Initialize logger
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' })
  ]
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple()
    )
  }));
}

// Initialize cache
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 60, // Check for expired entries every 60 seconds
  maxKeys: 1000 // Maximum number of cached items
});

const API_ENDPOINTS = {
  DEEPSEEK: 'https://api.deepseek.com/chat/completions',
  OPENROUTER: 'https://openrouter.ai/api/v1/chat/completions',
  GEMINI: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
  ELEVENLABS: 'https://api.elevenlabs.io/v1/text-to-speech'
} as const;

type Provider = 'deepseek' | 'openrouter' | 'gemini';

// Error types
class ApiError extends Error {
  constructor(
    message: string, 
    public status?: number,
    public provider?: Provider,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Validate API key format
const validateApiKey = (key: string | undefined, provider: Provider): string => {
  if (!key) {
    throw new ValidationError(`Missing ${provider} API key`);
  }
  
  // Add provider-specific validation
  switch (provider) {
    case 'deepseek':
      if (!key.startsWith('sk-')) {
        throw new ValidationError('Invalid DeepSeek API key format');
      }
      break;
    case 'gemini':
      if (key.length < 20) {
        throw new ValidationError('Invalid Gemini API key format');
      }
      break;
  }
  
  return key;
};

// Cache key generator
const generateCacheKey = (messages: Message[], provider: Provider): string => {
  return `${provider}:${messages.map(m => `${m.role}:${m.content}`).join('|')}`;
};

export const apiClient = {
  async callLLM(messages: Message[], provider: Provider = 'deepseek'): Promise<LLMResponse> {
    try {
      // Validate API key
      const apiKey = validateApiKey(
        process.env[`${provider.toUpperCase()}_API_KEY`],
        provider
      );

      // Check cache
      const cacheKey = generateCacheKey(messages, provider);
      const cachedResponse = cache.get(cacheKey);
      
      if (cachedResponse) {
        logger.info('Cache hit', { provider, cacheKey });
        return cachedResponse as LLMResponse;
      }

      // Log request
      logger.info('Making API request', {
        provider,
        messageCount: messages.length,
        firstMessage: messages[0]?.content.substring(0, 100)
      });

      let response;
      const startTime = Date.now();

      switch (provider) {
        case 'deepseek':
          const deepseekBody = {
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant.'
              },
              ...messages.map(msg => ({
                role: msg.role,
                content: msg.content
              }))
            ],
            stream: false
          };

          logger.debug('DeepSeek request:', {
            url: API_ENDPOINTS.DEEPSEEK,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey.substring(0, 10)}...`
            },
            body: deepseekBody
          });

          response = await fetch(API_ENDPOINTS.DEEPSEEK, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(deepseekBody)
          });
          break;

        case 'gemini':
          response = await fetch(API_ENDPOINTS.GEMINI, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: messages[messages.length - 1].content
                }]
              }]
            })
          });
          break;

        default:
          throw new ApiError(`Unsupported provider: ${provider}`);
      }

      const duration = Date.now() - startTime;
      logger.info('API response received', {
        provider,
        status: response.status,
        duration
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'API error' }));
        logger.error('DeepSeek API Error:', {
          status: response.status,
          statusText: response.statusText,
          data: errorData,
          request: {
            url: API_ENDPOINTS.DEEPSEEK,
            body: deepseekBody
          }
        });
        throw new ApiError(
          `${provider} API error: ${response.status} - ${JSON.stringify(errorData)}`,
          response.status,
          provider,
          errorData
        );
      }

      const result = await response.json();
      
      // Validate response type
      if (!isDeepSeekResponse(result) && !isGeminiResponse(result)) {
        throw new ApiError(
          'Invalid response format from API',
          response.status,
          provider,
          result
        );
      }

      // Log success
      logger.info('API request successful', {
        provider,
        duration,
        hasContent: isDeepSeekResponse(result) ? result.choices.length > 0 : result.candidates.length > 0
      });

      // Cache successful response
      cache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error('Validation error:', {
          message: error.message,
          provider
        });
      } else if (error instanceof ApiError) {
        logger.error('API error:', {
          message: error.message,
          status: error.status,
          provider: error.provider,
          details: error.details
        });
      } else {
        logger.error('Unexpected error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          provider
        });
      }
      throw error;
    }
  },

  async generateSpeech(text: string) {
    const cacheKey = `speech:${Buffer.from(text).toString('base64')}`;
    
    // Try to get from cache first
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      logger.info('Cache hit for speech', { cacheKey });
      return cachedResponse;
    }

    logger.info('Generating speech', { textLength: text.length });
    
    const apiKey = process.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) {
      const error = 'ElevenLabs API key not found';
      logger.error(error);
      throw new ApiError(error);
    }

    try {
      const startTime = Date.now();
      const response = await fetch(API_ENDPOINTS.ELEVENLABS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
          voice_id: 'default',
          model_id: 'eleven_monolingual_v1'
        })
      });

      const duration = Date.now() - startTime;
      logger.info('Speech generation complete', { 
        status: response.status, 
        duration,
        textLength: text.length 
      });

      if (!response.ok) {
        throw new ApiError(`ElevenLabs API error: ${response.status}`, response.status);
      }

      const data = await response.blob();
      
      // Cache successful responses (only metadata, not the audio blob)
      cache.set(cacheKey, {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      // Create a new response with the correct headers type
      const headers = new Headers();
      for (const [key, value] of response.headers.entries()) {
        headers.set(key, value);
      }
      
      return new Response(data, {
        status: response.status,
        headers
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        logger.error('Speech API Error', { 
          error: error.message, 
          status: error.status 
        });
        throw error;
      }
      
      logger.error('Unexpected error in speech generation', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      throw new ApiError(`Failed to generate speech: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}; 