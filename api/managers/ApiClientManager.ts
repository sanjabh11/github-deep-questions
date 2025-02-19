import { createLogger } from 'winston';
import { Provider } from '../types/providers';
import NodeCache from 'node-cache';

interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  backoffMs: number;
}

export class ApiClientManager {
  private cache: NodeCache;
  private configs: Record<Provider, ApiConfig> = {
    deepseek: {
      baseUrl: 'https://api.deepseek.com/v1',
      timeout: 30000,
      retries: 3,
      backoffMs: 1000
    },
    gemini: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1',
      timeout: 30000,
      retries: 3,
      backoffMs: 1000
    },
    openrouter: {
      baseUrl: 'https://openrouter.ai/api',
      timeout: 45000,
      retries: 2,
      backoffMs: 2000
    }
  };

  private logger = createLogger({
    level: 'info',
    format: createLogger.format.json(),
    defaultMeta: { service: 'api-client-manager' },
    transports: [
      new createLogger.transports.File({ filename: 'logs/api-error.log', level: 'error' }),
      new createLogger.transports.File({ filename: 'logs/api-calls.log' })
    ]
  });

  constructor() {
    this.cache = new NodeCache({
      stdTTL: 300, // 5 minutes default TTL
      checkperiod: 60
    });
  }

  private async makeRequest(
    provider: Provider,
    endpoint: string,
    options: RequestInit,
    retryCount = 0
  ): Promise<Response> {
    const config = this.configs[provider];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const response = await fetch(`${config.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal
      });

      if (!response.ok) {
        if (retryCount < config.retries) {
          const backoff = config.backoffMs * Math.pow(2, retryCount);
          await new Promise(resolve => setTimeout(resolve, backoff));
          return this.makeRequest(provider, endpoint, options, retryCount + 1);
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`${provider} API error: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`${provider} API request timed out after ${config.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async callApi(
    provider: Provider,
    endpoint: string,
    options: RequestInit,
    cacheKey?: string
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      if (cacheKey) {
        const cached = this.cache.get(cacheKey);
        if (cached) {
          this.logger.info(`Cache hit for ${provider}:${endpoint}`, { cacheKey });
          return cached;
        }
      }

      const response = await this.makeRequest(provider, endpoint, options);
      const data = await response.json();

      // Cache successful responses
      if (cacheKey) {
        this.cache.set(cacheKey, data);
      }

      const duration = Date.now() - startTime;
      this.logger.info(`API call successful`, {
        provider,
        endpoint,
        duration,
        cacheKey
      });

      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`API call failed`, {
        provider,
        endpoint,
        duration,
        error: error.message
      });
      throw error;
    }
  }

  clearCache(): void {
    this.cache.flushAll();
    this.logger.info('Cache cleared');
  }

  getApiStats(): Record<Provider, { success: number; error: number; avgLatency: number }> {
    // Implementation for tracking API stats
    return {} as any; // TODO: Implement stats tracking
  }
}
