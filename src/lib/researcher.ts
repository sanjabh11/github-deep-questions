import { Message } from "./api";

interface ResearchContext {
  source: string;
  content: string;
}

export class Researcher {
  private abortController: AbortController | null = null;
  private contexts: ResearchContext[] = [];
  private searchQueries: string[] = [];

  constructor(
    private openRouterKey: string,
    private serpapiKey: string,
    private jinaKey: string
  ) {}

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

  private async callLLM(messages: { role: string; content: string }[]): Promise<string> {
    const response = await this.fetchWithTimeout(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.openRouterKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash-thinking-exp-01-21",
          messages
        })
      }
    );

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async searchWeb(query: string): Promise<string[]> {
    const response = await this.fetchWithTimeout(
      `https://serpapi.com/search?q=${encodeURIComponent(query)}&api_key=${this.serpapiKey}`,
      { method: "GET" }
    );

    if (!response.ok) {
      throw new Error(`SERPAPI error: ${response.status}`);
    }

    const data = await response.json();
    return data.organic_results?.map((result: any) => result.link) || [];
  }

  private async fetchPageContent(url: string): Promise<string> {
    const response = await this.fetchWithTimeout(
      `https://r.jina.ai/${url}`,
      {
        headers: {
          "Authorization": `Bearer ${this.jinaKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Jina fetch error: ${response.status}`);
    }

    return response.text();
  }

  public async research(query: string, onProgress?: (message: Message) => void): Promise<Message[]> {
    const messages: Message[] = [];
    const addMessage = (message: Message) => {
      messages.push(message);
      onProgress?.(message);
    };

    try {
      // Generate initial search queries
      addMessage({
        type: "system",
        content: "🔍 Generating research queries..."
      });

      const searchQueriesResponse = await this.callLLM([
        { role: "system", content: "Generate 4 search queries for comprehensive research on this topic. Return as JSON array." },
        { role: "user", content: query }
      ]);

      this.searchQueries = JSON.parse(searchQueriesResponse);

      // Perform searches and gather information
      for (const searchQuery of this.searchQueries) {
        addMessage({
          type: "system",
          content: `🌐 Searching: "${searchQuery}"`
        });

        const urls = await this.searchWeb(searchQuery);
        
        for (const url of urls.slice(0, 3)) { // Limit to top 3 results per query
          try {
            const content = await this.fetchPageContent(url);
            
            // Extract relevant information
            const relevantContent = await this.callLLM([
              { role: "system", content: "Extract only the most relevant information for the query." },
              { role: "user", content: `Query: ${query}\nContent: ${content.substring(0, 10000)}` }
            ]);

            this.contexts.push({
              source: url,
              content: relevantContent
            });

            addMessage({
              type: "system",
              content: `📑 Analyzed source: ${url}`
            });
          } catch (error) {
            console.error(`Error processing ${url}:`, error);
          }
        }
      }

      // Generate final comprehensive response
      addMessage({
        type: "system",
        content: "✍️ Generating comprehensive research report..."
      });

      const finalReport = await this.callLLM([
        { role: "system", content: "Generate a comprehensive research report based on the gathered information." },
        { role: "user", content: `Query: ${query}\n\nGathered Information:\n${this.contexts.map(c => c.content).join('\n\n')}` }
      ]);

      addMessage({
        type: "answer",
        content: finalReport
      });

      // Add sources
      addMessage({
        type: "system",
        content: "📚 Sources:\n" + this.contexts.map(c => `- ${c.source}`).join('\n')
      });

      return messages;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        addMessage({
          type: "system",
          content: "❌ Research operation cancelled."
        });
      } else {
        addMessage({
          type: "system",
          content: `❌ Error during research: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      return messages;
    }
  }
}