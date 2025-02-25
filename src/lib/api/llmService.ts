import { Message, ApiResponse, ThoughtProcess } from '../types';

const TIMEOUT_DURATION = 60000; // 60 seconds
const API_ENDPOINTS = {
  DEEPSEEK: 'https://api.deepseek.com/v1/chat/completions',
  GEMINI: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'
};

const validateApiKey = (apiKey: string | null): string => {
  if (!apiKey) throw new Error('API key is required');
  if (!/^[A-Za-z0-9_-]{10,}$/.test(apiKey)) throw new Error('Invalid API key format');
  return apiKey;
};

export const callDeepSeek = async (
  prompt: string,
  apiKey: string,
  previousMessages: Message[] = [],
  onThoughtUpdate?: (thought: ThoughtProcess) => void,
  timeout: number = TIMEOUT_DURATION,
  systemPrompt: string = "You are in THINKING mode. Break down the problem step by step."
): Promise<ApiResponse> => {
  try {
    const validatedKey = validateApiKey(apiKey);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(API_ENDPOINTS.DEEPSEEK, {
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
          { role: "system", content: systemPrompt },
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

    clearTimeout(timeoutId);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in response');
    }

    // Try to parse JSON response
    let parsedContent;
    try {
      const cleanJson = content.replace(/```json\s*|\s*```/g, '').trim();
      parsedContent = JSON.parse(cleanJson);
    } catch (e) {
      // If not JSON, wrap in default format
      parsedContent = {
        type: "thinking",
        content: content
      };
    }

    const thought: ThoughtProcess = {
      type: parsedContent.type || 'thinking',
      content: parsedContent.content,
      timestamp: Date.now()
    };

    if (onThoughtUpdate) {
      onThoughtUpdate(thought);
    }

    return {
      content: thought.content,
      type: thought.type,
      thoughtProcess: [thought],
      status: 'complete',
      timestamp: Date.now()
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        content: '',
        status: 'timeout',
        timeoutReason: `Request timed out after ${timeout}ms`
      };
    }
    throw error;
  }
};

export const callArchitectLLM = async (
  messages: Message[],
  apiKey: string
): Promise<ApiResponse> => {
  try {
    const validatedKey = validateApiKey(apiKey);
    const prompt = `Review this solution as an architect. Consider:
1. Code organization and modularity
2. Error handling and edge cases
3. Performance implications
4. Security considerations
5. Scalability aspects

Previous messages:
${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

Provide your review in this JSON format:
{
  "type": "review",
  "content": {
    "overview": "Brief overview of the solution",
    "strengths": ["List of strengths"],
    "concerns": ["List of concerns"],
    "recommendations": ["List of recommendations"],
    "verdict": "Final assessment"
  }
}`;

    const response = await fetch(API_ENDPOINTS.GEMINI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': validatedKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('No content in response');
    }

    // Try to parse JSON response
    let parsedContent;
    try {
      const cleanJson = content.replace(/```json\s*|\s*```/g, '').trim();
      parsedContent = JSON.parse(cleanJson);
    } catch (e) {
      throw new Error('Invalid response format from architect review');
    }

    return {
      content: JSON.stringify(parsedContent.content, null, 2),
      type: 'architect_review',
      status: 'complete',
      timestamp: Date.now()
    };
  } catch (error) {
    throw error;
  }
};
