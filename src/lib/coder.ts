import { Message } from "./api";

export class Coder {
  private abortController: AbortController | null = null;

  constructor(private geminiKey: string) {}

  public abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async analyze(
    query: string,
    files: { name: string; content: string }[],
    onProgress?: (message: Message) => void
  ): Promise<Message[]> {
    const messages: Message[] = [];
    const addMessage = (message: Message) => {
      messages.push(message);
      onProgress?.(message);
    };

    this.abortController = new AbortController();

    try {
      addMessage({
        type: "system",
        content: "🔍 Analyzing code and requirements..."
      });

      const response = await fetch(
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
                text: `As an expert programmer, analyze this request and provided code files:

Query: ${query}

Files:
${files.map(f => `--- ${f.name} ---\n${f.content}`).join('\n\n')}

Provide:
1. Code analysis
2. Suggested improvements
3. Implementation details
4. Security considerations
5. Best practices`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
            }
          }),
          signal: this.abortController.signal
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const analysis = data.candidates[0].content.parts[0].text;

      addMessage({
        type: "answer",
        content: analysis
      });

      return messages;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        addMessage({
          type: "system",
          content: "❌ Code analysis cancelled."
        });
      } else {
        addMessage({
          type: "system",
          content: `❌ Error during analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      return messages;
    }
  }
}