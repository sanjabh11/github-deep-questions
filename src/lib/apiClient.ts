import { Message, ThoughtProcess, ArchitectReview } from '../../api/types/messages.js';
import { ProcessRequest, StreamEvent, BaseResponse } from '../../api/types/responses.js';
import { withRetry } from './retry';
import { config } from './config';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';

// Connection manager to handle SSE
class ConnectionManager {
  private eventSource: EventSource | null = null;
  private retryCount = 0;
  private maxRetries = 3;
  private backoffMs = 1000;
  private apiKey: string;
  private isCompleted = false;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  connect(url: string, onMessage: (event: StreamEvent) => void): void {
    this.cleanup(); // Clean up existing connection
    this.isCompleted = false;

    // Add API key to URL for EventSource
    const fullUrl = new URL(`${API_BASE_URL}${url}`);
    fullUrl.searchParams.append('authorization', `Bearer ${this.apiKey}`);

    // Create EventSource without credentials since we're passing auth in URL
    this.eventSource = new EventSource(fullUrl.toString(), {
      withCredentials: false
    });

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as StreamEvent;
        this.retryCount = 0; // Reset retry count on successful message
        
        if (data.type === 'complete') {
          this.isCompleted = true;
          this.cleanup();
        }
        
        onMessage(data);
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
        onMessage({
          type: 'error',
          error: 'Failed to parse server response'
        });
        this.cleanup();
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      
      if (this.isCompleted) {
        this.cleanup();
        return;
      }
      
      // Check if the error is due to authentication
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        onMessage({
          type: 'error',
          error: 'Authentication failed. Please check your API key.'
        });
        this.cleanup();
        return;
      }
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.backoffMs * Math.pow(2, this.retryCount - 1);
        console.log(`Retrying connection in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
        
        setTimeout(() => {
          if (!this.isCompleted) {
            this.cleanup();
            this.connect(url, onMessage);
          }
        }, delay);
      } else {
        onMessage({
          type: 'error',
          error: 'Connection to server lost after multiple retries. Please try again.'
        });
        this.cleanup();
      }
    };

    this.eventSource.onopen = () => {
      console.log('SSE connection established');
      this.retryCount = 0;
    };
  }

  cleanup(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

// API client with retry support
export const apiClient = {
  async process(
    request: ProcessRequest,
    onThinking?: (thought: ThoughtProcess) => void,
    onProgress?: (message: string) => void
  ): Promise<BaseResponse> {
    return new Promise((resolve, reject) => {
      const apiKey = config.DEEPSEEK_API_KEY;
      if (!apiKey) {
        reject(new Error('Missing API key. Please check your configuration.'));
        return;
      }

      const connectionManager = new ConnectionManager(apiKey);
      let isResolved = false;

      // Create SSE connection
      connectionManager.connect('/api/stream', (event) => {
        switch (event.type) {
          case 'thinking':
            if (onThinking && event.thought) {
              onThinking({
                type: 'thinking',
                content: event.thought,
                timestamp: Date.now()
              });
            }
            break;
          
          case 'progress':
            if (onProgress && event.progress) {
              onProgress(event.progress);
            }
            break;
          
          case 'complete':
            isResolved = true;
            connectionManager.cleanup();
            resolve(event.data as BaseResponse);
            break;
          
          case 'error':
            if (!isResolved) {
              isResolved = true;
              connectionManager.cleanup();
              reject(new Error(event.error || 'Unknown error'));
            }
            break;
        }
      });

      // Make the HTTP request
      withRetry(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(request)
          });

          if (!response.ok) {
            const error = await response.json();
            if (response.status === 401) {
              throw new Error('Invalid API key. Please check your configuration.');
            }
            throw new Error(error.message || `HTTP error! status: ${response.status}`);
          }

        } catch (error) {
          if (!isResolved) {
            isResolved = true;
            connectionManager.cleanup();
            if (error instanceof Error) {
              if (error.message.includes('ERR_CONNECTION_REFUSED')) {
                reject(new Error('Cannot connect to server. Please ensure the server is running.'));
              } else if (error.message.includes('API key')) {
                reject(error); // Don't retry API key errors
              } else {
                reject(error);
              }
            } else {
              reject(new Error('An unknown error occurred'));
            }
          }
        }
      }, {
        maxAttempts: 3,
        backoffMs: 1000,
        shouldRetry: (error: unknown) => {
          if (error instanceof Error) {
            // Don't retry authentication errors
            if (error.message.includes('API key')) return false;
            
            return error.message.includes('Failed to fetch') || 
                   error.message.includes('status: 5') ||
                   error.message.includes('ERR_CONNECTION_REFUSED');
          }
          return false;
        }
      }).catch(error => {
        if (!isResolved) {
          isResolved = true;
          connectionManager.cleanup();
          reject(error);
        }
      });
    });
  },

  async architectReview(
    messages: Message[],
    queryType: ProcessRequest['queryType']
  ): Promise<ArchitectReview> {
    return withRetry(async () => {
      const response = await fetch(`${API_BASE_URL}/api/architect-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages, queryType })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get architect review');
      }

      return response.json();
    });
  },

  async generateSpeech(text: string): Promise<Response> {
    return withRetry(async () => {
      const response = await fetch(`${API_BASE_URL}/api/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate speech');
      }

      return response;
    });
  }
}; 