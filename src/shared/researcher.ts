import { FileUpload } from "./types";
import { API_ENDPOINTS } from "./api";
import { PDFHandler } from '../lib/fileHandlers/pdfHandler';

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
        console.error('OpenRouter error:', errorData);
        throw new Error(`Failed to generate search queries: ${errorData.error?.message || 'Unknown error'}`);
      }

      const searchQueriesData = await searchQueriesResponse.json();
      console.log('Search queries response:', searchQueriesData);
      
      let searchQueries: string[];
      try {
        searchQueries = JSON.parse(searchQueriesData.choices[0].message.content.trim());
        if (!Array.isArray(searchQueries)) {
          throw new Error('Response is not an array');
        }
      } catch (e) {
        console.warn('Failed to parse search queries response, using fallback:', e);
        searchQueries = [query];
      }
      
      // Now perform searches with each generated query
      const allContexts: ResearchContext[] = [];
      for (const searchQuery of searchQueries) {
        console.log('Searching web with query:', searchQuery);
        
        // Build query parameters
        const params = new URLSearchParams({
          q: searchQuery,
          api_key: this.serpapiKey,
          engine: 'google',
          google_domain: 'google.com',
          gl: 'us',
          hl: 'en'
        });
        
        const url = `${API_ENDPOINTS.SERPAPI}?${params.toString()}`;
        console.log('Full URL:', url.replace(this.serpapiKey, '[REDACTED]'));
        
        const response = await this.fetchWithTimeout(url, { 
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        });

        if (!response.ok) {
          const text = await response.text();
          console.error('SerpAPI error response:', text);
          throw new Error(`Failed to search web: ${response.status} ${response.statusText} - ${text}`);
        }

        const data = await response.json();
        if (!data.organic_results || !Array.isArray(data.organic_results)) {
          console.error('Unexpected response structure:', data);
          throw new Error('Invalid search results format');
        }

        for (const result of data.organic_results.slice(0, 3)) {
          const url = result.link || '';
          const pageContent = result.snippet || result.title || '';
          
          // Add directly to contexts without additional API calls
          allContexts.push({
            source: url,
            content: pageContent
          });
        }
      }
      return allContexts;
    } catch (error) {
      console.error('Search web error:', error);
      throw error;
    }
  }

  private async analyzeContent(content: string, files: FileUpload[] = [], attempt: number = 1): Promise<string> {
    try {
      const fileContents = files.map(file => {
        // For binary files, we include just the metadata
        if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
          return `[Binary file: ${file.name} (${file.type})]`;
        }
        return `File: ${file.name}\nContent: ${file.content}`;
      }).join('\n\n');

      const prompt = `Analyze the following content and attached files:\n\n${content}\n\n${fileContents}`;
      
      const response = await this.fetchWithTimeout(
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
                content: "You are an expert research assistant analyzing content and files."
              },
              {
                role: "user", 
                content: prompt
              }
            ],
            temperature: 0.3
          })
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid response format: missing or empty content');
      }

      return data.choices[0].message.content;

    } catch (error) {
      if (attempt < 3) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.analyzeContent(content, files, attempt + 1);
      }
      throw error;
    }
  }

  private async processLargeContent(content: string, chunkSize: number = 4000): Promise<string[]> {
    // Split content into chunks while preserving word boundaries
    const chunks: string[] = [];
    let currentChunk = '';
    const words = content.split(/\s+/);
    
    for (const word of words) {
      if ((currentChunk + word).length > chunkSize) {
        chunks.push(currentChunk.trim());
        currentChunk = word;
      } else {
        currentChunk += ' ' + word;
      }
    }
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  private async preprocessFiles(files: FileUpload[]): Promise<FileUpload[]> {
    const processedFiles: FileUpload[] = [];
    
    for (const file of files) {
      try {
        if (file.type === 'application/pdf') {
          const extractedText = await PDFHandler.processPDFContent(file);
          processedFiles.push({
            name: file.name,
            content: extractedText,
            type: 'text/plain'
          });
        } else {
          processedFiles.push(file);
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        // Add error information to the file content
        processedFiles.push({
          name: file.name,
          content: `Error processing file: ${error.message}`,
          type: 'text/plain'
        });
      }
    }
    
    return processedFiles;
  }

  public async analyze(content: string, files: FileUpload[] = []): Promise<string> {
    try {
      // First preprocess any files
      const processedFiles = await this.preprocessFiles(files);
      
      // Process content in chunks
      const chunks = await this.processLargeContent(content);
      const analyses: string[] = [];
      
      // Add processed file contents to the analysis
      const fileContents = processedFiles.map(file => 
        `File: ${file.name}\nContent: ${file.content}`
      ).join('\n\n');
      
      // Analyze each chunk with file contents
      for (let i = 0; i < chunks.length; i++) {
        const chunkContent = `${chunks[i]}\n\nAttached Files:\n${fileContents}`;
        const chunkAnalysis = await this.analyzeContent(
          `Part ${i + 1}/${chunks.length}:\n${chunkContent}`, 
          []
        );
        analyses.push(chunkAnalysis);
      }
      
      // If we have multiple analyses, synthesize them
      if (analyses.length > 1) {
        return await this.analyzeContent(
          'Synthesize the following analyses into a coherent response:\n\n' +
          analyses.map((a, i) => `Analysis ${i + 1}:\n${a}`).join('\n\n'),
          []
        );
      }
      
      return analyses[0];
    } catch (error) {
      console.error('Analysis error:', error);
      throw error;
    }
  }

  private openRouterKey: string;
  private serpapiKey: string;
  private jinaKey: string;
  private geminiKey: string;
}