import { Router } from 'express';
import { z } from 'zod';
import { InterfaceType, QueryType, INTERFACE_CONFIGS, SPECIALIZED_PROMPTS } from '../shared/prompts.js';
import { Researcher } from '../shared/researcher.js';
import { Coder } from '../shared/coder.js';
import { validateApiKey, handleApiError } from '../shared/api.js';

const router = Router();

// Request validation schemas
const BaseRequestSchema = z.object({
  query: z.string(),
  interfaceType: z.enum(['GENERAL', 'RESEARCHER', 'CODER']),
  queryType: z.enum(['CODE', 'EXPLANATION', 'RESEARCH']),
  apiKey: z.string(),
  files: z.array(z.object({
    name: z.string(),
    content: z.string()
  })).optional()
});

// Response interfaces
interface BaseResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Initialize specialized handlers
const researcher = new Researcher();
const coder = new Coder();

// Endpoint for processing queries
router.post('/process', async (req, res) => {
  try {
    const { query, interfaceType, queryType, apiKey, files = [] } = BaseRequestSchema.parse(req.body);
    
    // Validate API key
    const validatedKey = validateApiKey(apiKey);
    
    // Get interface configuration
    const config = INTERFACE_CONFIGS[interfaceType as InterfaceType][queryType as QueryType];
    
    let response: BaseResponse;
    
    switch (interfaceType) {
      case 'RESEARCHER':
        response = await handleResearcherQuery(query, queryType, files, config);
        break;
      
      case 'CODER':
        response = await handleCoderQuery(query, queryType, files, config);
        break;
      
      case 'GENERAL':
        response = await handleGeneralQuery(query, queryType, files, config);
        break;
      
      default:
        throw new Error('Invalid interface type');
    }
    
    res.json(response);
  } catch (error) {
    handleApiError(error);
  }
});

// Specialized handlers
async function handleResearcherQuery(
  query: string,
  queryType: QueryType,
  files: Array<{ name: string; content: string }>,
  config: any
): Promise<BaseResponse> {
  try {
    const analysis = await researcher.analyze(query, files);
    return {
      success: true,
      data: {
        analysis,
        config
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
}

async function handleCoderQuery(
  query: string,
  queryType: QueryType,
  files: Array<{ name: string; content: string }>,
  config: any
): Promise<BaseResponse> {
  try {
    const messages = await coder.analyze(query, files);
    return {
      success: true,
      data: {
        messages,
        config
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
}

async function handleGeneralQuery(
  query: string,
  queryType: QueryType,
  files: Array<{ name: string; content: string }>,
  config: any
): Promise<BaseResponse> {
  try {
    // Use the thinking template for structured analysis
    const thinking = SPECIALIZED_PROMPTS.DEEP_THINKING;
    
    // Process query using the general assistant approach
    const response = await fetch('/api/proxy/openrouter/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: thinking.SYSTEM_THINKING
          },
          {
            role: 'user',
            content: query
          }
        ],
        config
      })
    });
    
    const data = await response.json();
    
    return {
      success: true,
      data: {
        thinking: data.choices[0].message.content,
        config
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
}

export default router; 