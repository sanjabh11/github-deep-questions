import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'api-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/api-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/api-calls.log' })
  ]
});

interface DeepSeekResponse {
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

export async function makeDeepSeekRequest(query: string, apiKey: string) {
  logger.info('Making DeepSeek API request', { query: query.substring(0, 50) + '...' });
  
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: query }
        ],
        stream: false // Changed to false since streaming isn't working properly
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`DeepSeek API error: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    const data: DeepSeekResponse = await response.json();
    logger.info('DeepSeek API response received', { 
      id: data.id,
      model: data.model,
      tokensUsed: data.usage?.total_tokens 
    });

    return {
      success: true,
      data: data.choices[0].message.content
    };

  } catch (error) {
    logger.error('DeepSeek API error:', error);
    throw error;
  }
}

export async function processResearchQuery(query: string, apiKey: string) {
  logger.info('Processing research query', { query: query.substring(0, 50) + '...' });
  
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: 'You are a research assistant. Provide detailed, well-structured responses.' 
          },
          { 
            role: 'user', 
            content: query 
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Research API error: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    const data: DeepSeekResponse = await response.json();
    logger.info('Research API response received', { 
      id: data.id,
      model: data.model,
      tokensUsed: data.usage?.total_tokens 
    });

    return {
      success: true,
      data: data.choices[0].message.content
    };

  } catch (error) {
    logger.error('Research API error:', error);
    throw error;
  }
}
