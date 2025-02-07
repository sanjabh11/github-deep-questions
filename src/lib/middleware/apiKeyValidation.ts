import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// API Key validation schema with specific requirements
const ApiKeySchema = z.object({
  openrouter: z.string().regex(/^[A-Za-z0-9_-]{10,}$/, 'Invalid OpenRouter API key format'),
  deepseek: z.string().regex(/^[A-Za-z0-9_-]{10,}$/, 'Invalid DeepSeek API key format'),
  gemini: z.string().regex(/^[A-Za-z0-9_-]{39}$/, 'Invalid Gemini API key format').optional(),
  serpapi: z.string().regex(/^[A-Za-z0-9]{32}$/, 'Invalid SerpAPI key format').optional(),
});

// Cache for validated API keys to reduce validation overhead
const validationCache = new Map<string, {
  isValid: boolean;
  timestamp: number;
  interface: string;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

export const validateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    const interfaceType = req.body.interfaceType;

    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Check cache first
    const cachedValidation = validationCache.get(apiKey);
    if (cachedValidation && 
        Date.now() - cachedValidation.timestamp < CACHE_TTL &&
        cachedValidation.interface === interfaceType) {
      if (!cachedValidation.isValid) {
        throw new Error('Invalid API key');
      }
      return next();
    }

    // Determine which API key to validate based on interface type
    let keyType: keyof typeof ApiKeySchema.shape;
    switch (interfaceType) {
      case 'RESEARCHER':
        keyType = 'serpapi';
        break;
      case 'CODER':
        keyType = 'deepseek';
        break;
      default:
        keyType = 'openrouter';
    }

    // Validate the API key format
    const validationResult = ApiKeySchema.shape[keyType].safeParse(apiKey);
    
    if (!validationResult.success) {
      // Cache the invalid result
      validationCache.set(apiKey, {
        isValid: false,
        timestamp: Date.now(),
        interface: interfaceType
      });
      
      throw new Error(`Invalid API key format for ${interfaceType}: ${validationResult.error.message}`);
    }

    // Verify the API key with the respective service
    const isValid = await verifyApiKeyWithService(apiKey, interfaceType);
    
    // Cache the validation result
    validationCache.set(apiKey, {
      isValid,
      timestamp: Date.now(),
      interface: interfaceType
    });

    if (!isValid) {
      throw new Error(`Invalid API key for ${interfaceType}`);
    }

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'API key validation failed'
    });
  }
};

async function verifyApiKeyWithService(apiKey: string, interfaceType: string): Promise<boolean> {
  try {
    // Implement actual API key verification with respective services
    const verificationEndpoints = {
      RESEARCHER: 'https://serpapi.com/account',
      CODER: 'https://api.deepseek.com/v1/models',
      GENERAL: 'https://openrouter.ai/api/v1/auth/key'
    };

    const endpoint = verificationEndpoints[interfaceType as keyof typeof verificationEndpoints];
    if (!endpoint) {
      throw new Error(`Unsupported interface type: ${interfaceType}`);
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;
  } catch (error) {
    console.error('API key verification failed:', error);
    return false;
  }
}

// Cleanup expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of validationCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      validationCache.delete(key);
    }
  }
}, CACHE_TTL); 