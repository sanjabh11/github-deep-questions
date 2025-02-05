import { FileUpload } from "./types";
import { API_ENDPOINTS } from "./api";

interface ResearchContext {
  source: string;
  content: string;
}

export class Researcher {
  private abortController: AbortController | null = null;
  private contexts: ResearchContext[] = [];
  private searchQueries: string[] = [];

  constructor() {
    const openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    const serpapiKey = import.meta.env.VITE_SERPAPI_API_KEY;
    const jinaKey = import.meta.env.VITE_JINA_API_KEY;

    if (!openRouterKey || !serpapiKey || !jinaKey) {
      throw new Error("Missing required API keys for researcher mode");
    }

    this.openRouterKey = openRouterKey;
    this.serpapiKey = serpapiKey;
    this.jinaKey = jinaKey;
  }

  public abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number = 30000
  ): Promise<Response> {
    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: this.abortController.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async searchWeb(query: string): Promise<ResearchContext[]> {
    try {
      console.log('Searching web with query:', query);
      
      // Build query parameters
      const params = new URLSearchParams({
        q: query,
        api_key: this.serpapiKey,
        engine: 'google',  // Specify search engine
        google_domain: 'google.com',
        gl: 'us',  // Set location to US
        hl: 'en'   // Set language to English
      });
      
      const url = `${API_ENDPOINTS.SERPAPI}?${params.toString()}`;
      console.log('Full URL:', url.replace(this.serpapiKey, '[REDACTED]'));
      
      const response = await this.fetchWithTimeout(url, { 
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const text = await response.text();
        console.error('SerpAPI error response:', text);
        throw new Error(`Failed to search web: ${response.status} ${response.statusText} - ${text}`);
      }

      const contentType = response.headers.get('content-type');
      const rawData = await response.text();
      console.log('Raw response:', rawData);

      if (!contentType?.includes('application/json')) {
        console.error('Unexpected response type:', contentType, 'Response:', rawData);
        throw new Error('Invalid response format from search API');
      }
      
      let data;
      try {
        data = JSON.parse(rawData);
      } catch (e) {
        console.error('Failed to parse response:', e);
        throw new Error('Invalid JSON response from search API');
      }

      if (!data.organic_results || !Array.isArray(data.organic_results)) {
        console.error('Unexpected response structure:', data);
        throw new Error('Invalid search results format');
      }

      return data.organic_results.slice(0, 3).map((result: any) => ({
        source: result.link || '',
        content: result.snippet || result.title || ''
      }));
    } catch (error) {
      console.error('Search web error:', error);
      throw error;
    }
  }

  private async analyzeContent(content: string, contexts: ResearchContext[]): Promise<string> {
    try {
      const messages = [
        {
          role: "system",
          content: "You are a research assistant helping to analyze and summarize information."
        },
        {
          role: "user",
          content: `Please analyze the following research query and provide a comprehensive answer based on the given context:\n\nQuery: ${content}\n\nContexts:\n${contexts
            .map((ctx) => `Source: ${ctx.source}\nContent: ${ctx.content}\n`)
            .join("\n")}`
        }
      ];

      const response = await this.fetchWithTimeout(
        API_ENDPOINTS.OPENROUTER,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.openRouterKey}`
          },
          body: JSON.stringify({
            model: "anthropic/claude-2",
            messages
          })
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error('OpenRouter error response:', text);
        throw new Error(`Failed to analyze content: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        const text = await response.text();
        console.error('Unexpected response type:', contentType, 'Response:', text);
        throw new Error('Invalid response format from analysis API');
      }

      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        console.error('Unexpected response structure:', data);
        throw new Error('Invalid analysis result format');
      }

      return data.choices[0].message.content;
    } catch (error) {
      console.error('Analyze content error:', error);
      throw new Error(`Failed to analyze content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async analyze(content: string, files: FileUpload[] = []): Promise<string> {
    try {
      // Search for relevant information
      const contexts = await this.searchWeb(content);
      
      // Analyze the content with the found contexts
      const analysis = await this.analyzeContent(content, contexts);
      
      return analysis;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Research analysis failed: ${error.message}`);
      }
      throw new Error("Research analysis failed");
    }
  }

  private openRouterKey: string;
  private serpapiKey: string;
  private jinaKey: string;
}