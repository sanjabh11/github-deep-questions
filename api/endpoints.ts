import { Router } from 'express';
import { z } from 'zod';
import { InterfaceType, QueryType, ProcessRequest, BaseResponse, StreamEvent } from '../shared/types';
import { apiClient } from './client.js';
import type { DeepSeekResponse, GeminiResponse } from './types/responses.js';
import { Readable } from 'stream';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DEEPSEEK_API_KEY', 'GEMINI_API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const router = Router();

// Request validation schema using shared types
const ProcessRequestSchema = z.object({
  query: z.string(),
  interfaceType: z.nativeEnum(InterfaceType),
  queryType: z.nativeEnum(QueryType),
  files: z.array(z.object({
    name: z.string(),
    content: z.string()
  })).optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional()
});

// Middleware to validate API key from header or query parameter
const validateApiKey = (req: any, res: any, next: any) => {
  try {
    // Check header first, then query parameter
    const authHeader = req.headers.authorization || req.query.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        error: 'Missing API key. Please provide a valid API key in the Authorization header or query parameter.' 
      });
    }
    
    const apiKey = authHeader.split(' ')[1];
    if (!apiKey) {
      return res.status(401).json({ 
        success: false,
        error: 'API key cannot be empty' 
      });
    }

    // Validate API key format
    if (!apiKey.startsWith('sk-') || apiKey.length < 32) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key format'
      });
    }

    // Compare with environment variable in production
    if (process.env.NODE_ENV === 'production' && apiKey !== process.env.DEEPSEEK_API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    // Store validated key in request for later use
    req.validatedApiKey = apiKey;
    
    // Log masked API key for debugging
    console.log('API Key validated:', `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
    
    next();
  } catch (error) {
    console.error('API Key validation error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error validating API key. Please try again.' 
    });
  }
};

// Request logging middleware
const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);
  
  // Log request
  console.log({
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.method === 'POST' ? JSON.stringify(req.body).substring(0, 200) + '...' : undefined,
    headers: {
      ...req.headers,
      authorization: req.headers.authorization ? '**masked**' : undefined
    }
  });

  // Intercept response
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - start;
    
    // Log response
    console.log({
      timestamp: new Date().toISOString(),
      requestId,
      duration,
      status: res.statusCode,
      response: typeof data === 'string' ? data.substring(0, 200) + '...' : undefined
    });
    
    return originalSend.apply(res, arguments);
  };

  next();
};

// Performance monitoring middleware
const performanceMonitor = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) { // Log slow requests (>1s)
      console.warn({
        type: 'SLOW_REQUEST',
        path: req.path,
        method: req.method,
        duration,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  next();
};

// Apply middleware
router.use(requestLogger);
router.use(performanceMonitor);

// SSE endpoint for streaming responses
router.get('/stream', validateApiKey, (req, res) => {
  const clientId = Date.now();
  console.log(`Client connected: ${clientId}`);
  
  // Set SSE headers with specific origin
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
      ? process.env.ALLOWED_ORIGIN 
      : 'http://localhost:8080',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  
  // Send initial connection success
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    clientId
  })}\n\n`);
  
  // Keep connection alive
  const keepAlive = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keepalive\n\n');
    } else {
      clearInterval(keepAlive);
    }
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
    clearInterval(keepAlive);
    if (!res.writableEnded) {
      res.end();
    }
  });

  // Handle errors
  res.on('error', (error) => {
    console.error(`Error for client ${clientId}:`, error);
    clearInterval(keepAlive);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Server error occurred'
      })}\n\n`);
      res.end();
    }
  });
});

// Process endpoint with SSE support
router.post('/process', validateApiKey, async (req: any, res) => {
  const clientId = Date.now();
  console.log(`Processing request for client: ${clientId}`, {
    query: req.body.query,
    interfaceType: req.body.interfaceType,
    apiKey: `${req.validatedApiKey.substring(0, 10)}...`
  });
  
  try {
    const validatedRequest = ProcessRequestSchema.parse(req.body);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' 
      ? (process.env.ALLOWED_ORIGIN || 'http://localhost:8080')
      : 'http://localhost:8080');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Send initial thinking state
    res.write(`data: ${JSON.stringify({
      type: 'thinking',
      thought: 'Analyzing your request...'
    })}\n\n`);

    try {
      let llmResponse;
      let normalizedResponse;
      
      switch (validatedRequest.interfaceType) {
        case InterfaceType.GENERAL:
        case InterfaceType.GENERAL_WITH_EXPLANATION:
          console.log('Making DeepSeek API request...');
          
          const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${req.validatedApiKey}`
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: validatedRequest.query }
              ],
              stream: false
            })
          });

          if (!deepseekResponse.ok) {
            throw new Error(`DeepSeek API error: ${deepseekResponse.status}`);
          }

          llmResponse = await deepseekResponse.json();
          normalizedResponse = {
            content: llmResponse.choices[0].message.content,
            config: {
              interfaceType: validatedRequest.interfaceType,
              queryType: validatedRequest.queryType
            }
          };
          break;

        case InterfaceType.CODER:
        case InterfaceType.CODE_GENERATION:
          res.write(`data: ${JSON.stringify({
            type: 'progress',
            progress: 'Generating code...'
          })}\n\n`);
          
          const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': process.env.GEMINI_API_KEY as string
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: validatedRequest.query }] }],
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
              }
            })
          });

          if (!geminiResponse.ok) {
            throw new Error(`Gemini API error: ${geminiResponse.status}`);
          }

          llmResponse = await geminiResponse.json();
          normalizedResponse = {
            content: llmResponse.candidates[0].content.parts[0].text,
            config: {
              interfaceType: validatedRequest.interfaceType,
              queryType: validatedRequest.queryType
            }
          };
          break;

        case InterfaceType.RESEARCHER:
        case InterfaceType.DEEP_RESEARCHER:
          res.write(`data: ${JSON.stringify({
            type: 'progress',
            progress: 'Researching...'
          })}\n\n`);
          
          const researchResponse = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${req.validatedApiKey}`
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: 'You are a research assistant. Provide detailed, well-structured responses.' },
                { role: 'user', content: `Research query: ${validatedRequest.query}` }
              ],
              stream: false
            })
          });

          if (!researchResponse.ok) {
            throw new Error(`Research API error: ${researchResponse.status}`);
          }

          llmResponse = await researchResponse.json();
          normalizedResponse = {
            content: llmResponse.choices[0].message.content,
            config: {
              interfaceType: validatedRequest.interfaceType,
              queryType: validatedRequest.queryType
            }
          };
          break;

        default:
          throw new Error(`Unsupported interface type: ${validatedRequest.interfaceType}`);
      }

      // Send completion event with normalized response
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        data: {
          success: true,
          data: normalizedResponse
        }
      })}\n\n`);

      console.log(`Request completed for client: ${clientId}`);
      res.end();
    } catch (error) {
      console.error(`API error for client ${clientId}:`, error);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error(`Error processing request for client: ${clientId}:`, error);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })}\n\n`);
    res.end();
  }
});

// Architect review endpoint
router.post('/architect-review', async (req, res) => {
  try {
    const { messages, queryType } = req.body;
    const response = await apiClient.callLLM(messages, 'gemini') as GeminiResponse;
    const analysis = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    res.json({
      criticalIssues: [],
      potentialProblems: [],
      improvements: [analysis],
      verdict: 'NEEDS_REVISION' as const
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get architect review'
    });
  }
});

// Speech generation endpoint
router.post('/speech', async (req, res) => {
  try {
    const { text } = req.body;
    const response = await apiClient.generateSpeech(text);
    
    if (response instanceof Response) {
      // Forward the response headers
      response.headers.forEach((value: string, key: string) => {
        res.setHeader(key, value);
      });
      
      // Handle streaming response
      if (response.body) {
        const stream = Readable.from(response.body);
        stream.pipe(res);
      } else {
        throw new Error('No response body');
      }
    } else {
      throw new Error('Invalid response type');
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate speech'
    });
  }
});

export default router; 