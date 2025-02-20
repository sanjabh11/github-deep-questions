import { FileUpload } from "./types";

interface ResearchContext {
  source: string;
  content: string;
}

export class Researcher {
  private abortController: AbortController | null = null;
  private contexts: ResearchContext[] = [];
  private searchQueries: string[] = [];
  private openRouterKey: string;
  private serpapiKey: string;
  private jinaKey: string;
  private geminiKey: string;

  constructor() {
    console.log('Loading API keys:', {
      openRouter: !!import.meta.env.VITE_OPENROUTER_API_KEY,
      serpapi: !!import.meta.env.VITE_SERPAPI_API_KEY,
      gemini: !!import.meta.env.VITE_GEMINI_API_KEY
    });
    
    const openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    const serpapiKey = import.meta.env.VITE_SERPAPI_API_KEY;
    const jinaKey = import.meta.env.VITE_JINA_API_KEY;
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

    // --- Debugging: Log API Keys ---
    console.log('OpenRouter API Key:', openRouterKey);
    console.log('SerpAPI API Key:', serpapiKey);
    console.log('Gemini API Key:', geminiKey);
    // --- End Debugging Logs ---

    if (!openRouterKey || !serpapiKey || !jinaKey || !geminiKey) {
      throw new Error("Missing required API keys for researcher mode");
    }

    this.openRouterKey = openRouterKey;
    this.serpapiKey = serpapiKey;
    this.jinaKey = jinaKey;
    this.geminiKey = geminiKey;

    // --- API Key Validation at Startup (Step 2 of 3-step ahead thinking) ---
    if (!this.openRouterKey) {
      console.error("VITE_OPENROUTER_API_KEY is missing!");
    }
    if (!this.serpapiKey) {
      console.error("VITE_SERPAPI_API_KEY is missing!");
    }
    if (!this.jinaKey) {
      console.error("VITE_JINA_API_KEY is missing!");
    }
    if (!this.geminiKey) {
      console.error("VITE_GEMINI_API_KEY is missing!");
    }
    // --- End API Key Validation ---
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
        signal: this.abortController.signal,
        headers: {
          ...options.headers,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async parseSearchQueriesResponse(response: string): Promise<string[]> {
    try {
      // Replace single quotes with double quotes and clean up the response
      const cleanedResponse = response
        .replace(/'/g, '"')
        .replace(/\n/g, ' ')
        .trim();

      // Attempt to parse as JSON
      const parsed = JSON.parse(cleanedResponse);
      
      if (Array.isArray(parsed)) {
        return parsed.map(query => query.toString());
      } else if (typeof parsed === 'string') {
        return [parsed];
      } else if (parsed.queries && Array.isArray(parsed.queries)) {
        return parsed.queries.map(query => query.toString());
      }
      
      throw new Error('Invalid response format');
    } catch (error) {
      console.warn('Failed to parse search queries response, using fallback:', error);
      // Fallback: split by commas and clean up
      return response
        .split(',')
        .map(query => query.trim())
        .filter(query => query.length > 0);
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
            "HTTP-Referer": "http://localhost:8080",
            "X-Title": "GitHub Deep Questions"
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
            temperature: 0.3
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
        searchQueries = await this.parseSearchQueriesResponse(searchQueriesData.choices[0].message.content.trim());
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
        
        const response = await this.fetchWithTimeout(
          `/api/proxy/serpapi?${params.toString()}`,
          { 
            method: "GET"
          }
        );

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
          5. Further Considerations
          
          IMPORTANT FORMATTING RULES:
          - Use clear section headers
          - Keep paragraphs concise and focused
          - Use bullet points for lists
          - Include numerical values and metrics when available
          - Highlight critical information
          - Maintain consistent formatting throughout`
        },
        {
          role: "user",
          content: `Research Query: ${content}\n\nAnalyze the following contexts and provide a comprehensive report:\n\n${contexts
            .map((ctx, index) => `[Source ${index + 1}] ${ctx.source}\n${ctx.content}\n---\n`)
            .join("\n")}`
        }
      ];

      console.log('Sending request to Gemini with messages:', JSON.stringify(messages, null, 2));

      let retryCount = 0;
      const maxRetries = 3;
      const baseDelay = 1000; // 1 second

      while (retryCount < maxRetries) {
        try {
          const response = await this.fetchWithTimeout(
            '/api/proxy/gemini/models/gemini-2.0-flash-thinking-exp-01-21:generateContent',
            {
              method: "POST",
              headers: {
                "x-goog-api-key": this.geminiKey,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                contents: [{
                  role: "user",
                  parts: [{
                    text: messages[0].content + "\n\n" + messages[1].content
                  }]
                }],
                generationConfig: {
                  temperature: 0.7,
                  topK: 40,
                  topP: 0.95,
                  maxOutputTokens: 1024,
                  candidateCount: 1
                },
                safetySettings: [
                  {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                  },
                  {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                  }
                ]
              })
            }
          );

          if (!response.ok) {
            const text = await response.text();
            console.error(`Gemini API error response (attempt ${retryCount + 1}/${maxRetries}):`, text);
            throw new Error(`Failed to analyze content: ${response.status} ${response.statusText} - ${text}`);
          }

          const data = await response.json();
          
          // Enhanced response validation
          if (!data) {
            throw new Error('Empty response from Gemini API');
          }

          // Check for error field in response
          if (data.error) {
            throw new Error(`Gemini API error: ${data.error.message || JSON.stringify(data.error)}`);
          }

          // Validate response structure
          if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
            throw new Error('Invalid response format: missing or empty candidates array');
          }

          const candidate = data.candidates[0];
          if (!candidate.content?.parts?.[0]?.text) {
            throw new Error('Invalid response format: missing content text in first candidate');
          }

          // If we reach here, we have valid data
          return candidate.content.parts[0].text.trim();

        } catch (error) {
          console.error(`Attempt ${retryCount + 1}/${maxRetries} failed:`, error);
          
          if (retryCount < maxRetries - 1) {
            // Calculate delay with exponential backoff
            const delay = baseDelay * Math.pow(2, retryCount);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retryCount++;
          } else {
            throw error; // Rethrow on final attempt
          }
        }
      }

      return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
      console.error('Analyze content error:', error);
      throw error;
    }
  }

  public async analyze(content: string, files: FileUpload[] = []): Promise<string> {
    const MAX_RETRIES = 2;
    let lastError: Error | null = null;

    // Log file attachments status
    console.log('Analyzing with files:', files.length ? files.map(f => ({ name: f.name, size: f.size })) : 'No files attached');

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        // Search the web for relevant information
        console.log(`Starting web search (attempt ${attempt}/${MAX_RETRIES + 1})...`);
        const contexts = await this.searchWeb(content);
        console.log(`Web search completed with ${contexts.length} results`);

        // Add file content to contexts if available
        if (files.length > 0) {
          console.log('Processing attached files...');
          for (const file of files) {
            try {
              // Extract and process file content
              if (file.content) {
                let fileContent = '';
                if (typeof file.content === 'string') {
                  // Handle base64 encoded content
                  if (file.content.startsWith('data:')) {
                    const base64Content = file.content.split(',')[1];
                    fileContent = atob(base64Content);
                  } else {
                    fileContent = file.content;
                  }
                } else {
                  // Handle ArrayBuffer content
                  fileContent = new TextDecoder().decode(file.content);
                }
                
                contexts.push({
                  source: `File: ${file.name}`,
                  content: fileContent.substring(0, 50000) // Limit content size for API processing
                });
              } else {
                console.error(`No content available for file: ${file.name}`);
                contexts.push({
                  source: `File: ${file.name}`,
                  content: `Error: Unable to read file content for ${file.name}`
                });
              }
            } catch (fileError) {
              console.error(`Error processing file ${file.name}:`, fileError);
            }
          }
        }

        // Analyze the content with the gathered contexts
        console.log('Starting content analysis...');
        const analysis = await this.analyzeContent(content, contexts);
        console.log('Content analysis completed successfully');
        return analysis;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Analysis attempt ${attempt}/${MAX_RETRIES + 1} failed:`, error);
        
        if (attempt <= MAX_RETRIES) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff with 5s max
          console.log(`Waiting ${waitTime}ms before retry ${attempt}/${MAX_RETRIES}...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
    }

    throw new Error(`Research analysis failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
    // Consider implementing a fallback response here if needed
  }
}