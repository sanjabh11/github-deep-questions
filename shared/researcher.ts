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
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!openRouterKey || !serpapiKey || !jinaKey || !geminiKey) {
      throw new Error("Missing required API keys for researcher mode");
    }

    this.openRouterKey = openRouterKey;
    this.serpapiKey = serpapiKey;
    this.jinaKey = jinaKey;
    this.geminiKey = geminiKey;
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
      // First generate focused search queries using LLM
      console.log("DEBUG: searchWeb function is being called");
      console.log("DEBUG: OpenRouter API Key value (this.openRouterKey):", this.openRouterKey);
      console.log("DEBUG: typeof this.openRouterKey:", typeof this.openRouterKey);
      console.log("DEBUG: Boolean(this.openRouterKey):", Boolean(this.openRouterKey));

      const searchQueriesResponse = await this.fetchWithTimeout(
        '/api/proxy/openrouter/chat/completions',
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.openRouterKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "deepseek/deepseek-chat",
            messages: [
              {
                role: "system",
                content: `You are an expert research assistant. Given the user's query, generate up to four distinct,
                precise search queries that would help gather comprehensive information on the topic.
                Return only a Python list of strings, for example: ['query1', 'query2', 'query3'].`
              },
              {
                role: "user",
                content: query
              }
            ],
            temperature: 0.3  // Lower temperature for more consistent formatting
          })
        }
      );

      if (!searchQueriesResponse.ok) {
        const errorData = await searchQueriesResponse.json();
        console.error('Error:', errorData);
        throw new Error(`Request failed with status ${searchQueriesResponse.status}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await searchQueriesResponse.json();
      console.log('Response Data:', data);
      
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        this.searchQueries = data.candidates[0].content.parts.map((part: { text: string }) => part.text);
      } else {
        console.error('Unexpected search queries response structure:', JSON.stringify(data, null, 2));
        throw new Error('Search queries generation failed: Invalid response format');
      }

      // Validate search queries
      if (this.searchQueries.length === 0) {
        console.warn('No search queries generated, proceeding with analysis anyway');
      }

      return this.searchQueries.map((searchQuery) => ({
        source: searchQuery,
        content: searchQuery
      }));
    } catch (error) {
      console.error('Search queries generation error:', error);
      // Add more context to the error
      const enhancedError = new Error(`Search queries generation failed: ${error.message}`);
      enhancedError.stack = error.stack;
      throw enhancedError;
    }
  }

  private async analyzeContent(content: string, contexts: ResearchContext[]): Promise<string> {
    try {
      const messages = [
        {
          role: "system",
          content: `You are a research assistant specializing in deep technical analysis and comprehensive information synthesis.
          Your task is to analyze the research query and provided contexts to generate a thorough, well-structured response.
          
          ANALYSIS APPROACH:
          1. Evaluate all provided contexts critically
          2. Identify key patterns and insights
          3. Synthesize information across multiple sources
          4. Provide concrete examples and evidence
          5. Acknowledge any limitations or gaps
          
          OUTPUT STRUCTURE:
          1. Key Findings
          2. Detailed Analysis
          3. Supporting Evidence
          4. Practical Implications
          5. Further Considerations`
        },
        {
          role: "user",
          content: `Research Query: ${content}\n\nContexts:\n${contexts
            .map((ctx) => `Source: ${ctx.source}\nContent: ${ctx.content}\n`)
            .join("\n")}`
        }
      ];

      console.log('Sending request to Gemini with messages:', JSON.stringify(messages, null, 2));

      const response = await this.fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.geminiKey
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: messages[messages.length - 1].content
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
            }
          })
        }
      );

      console.log('Gemini response status:', response.status);
      console.log('Gemini response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error:', errorData);
        throw new Error(`Request failed with status ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('Response Data:', data);
      
      // Handle different response structures
      let analysisText = '';
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        analysisText = data.candidates[0].content.parts[0].text;
      } else if (data.contents?.[0]?.parts?.[0]?.text) {
        analysisText = data.contents[0].parts[0].text;
      } else {
        console.error('Unexpected Gemini response structure:', JSON.stringify(data, null, 2));
        throw new Error('Research analysis failed: Invalid response format');
      }

      // Validate analysis result
      if (!analysisText.trim()) {
        throw new Error('Research analysis failed: Empty response');
      }

      return analysisText;
    } catch (error) {
      console.error('Analyze content error:', error);
      // Add more context to the error
      const enhancedError = new Error(`Research analysis failed: ${error.message}`);
      enhancedError.stack = error.stack;
      throw enhancedError;
    }
  }

  public async analyze(content: string, files: FileUpload[] = []): Promise<string> {
    const MAX_RETRIES = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt}/${MAX_RETRIES}`);
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }

        // Search for relevant information
        const contexts = await this.searchWeb(content);
        
        // Validate contexts
        if (!contexts || contexts.length === 0) {
          console.warn('No research contexts found, proceeding with analysis anyway');
        }
        
        // Analyze the content with the found contexts
        const analysis = await this.analyzeContent(content, contexts);
        
        return analysis;
      } catch (error) {
        lastError = error;
        console.error(`Analysis attempt ${attempt + 1} failed:`, error);
        
        // If this was the last attempt, throw the error
        if (attempt === MAX_RETRIES) {
          throw new Error(`Research analysis failed after ${MAX_RETRIES + 1} attempts: ${error.message}`);
        }
      }
    }

    // This should never be reached due to the throw above, but TypeScript needs it
    throw lastError || new Error('Unknown error occurred');
  }

  private openRouterKey: string;
  private serpapiKey: string;
  private jinaKey: string;
  private geminiKey: string;
}