import { Message } from "./api";

export class Coder {
  private abortController: AbortController | null = null;

  constructor(private geminiKey: string = import.meta.env.VITE_GEMINI_API_KEY) {
    console.log("Gemini API Key:", this.geminiKey); // Log the key for debugging
  }

  public abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async processRequest(
    query: string,
    files: { name: string; content: string }[] = [],
    onProgress?: (message: Message) => void
  ): Promise<Message[]> {
    const messages: Message[] = [];
    const addMessage = (message: Message) => {
      messages.push(message);
      onProgress?.(message);
    };

    try {
      const intent = await this.classifyIntent(query);
      switch (intent) {
        case "code generation":
          return await this.generateCode(query, onProgress);
        case "code improvement":
        case "debugging":
          if (files.length === 0) {
            throw new Error("Files are required for code improvement or debugging.");
          }
          return await this.analyze(query, files, onProgress);
        case "mathematical analysis":
          return await this.generateCode(query, onProgress);
        default:
          throw new Error(`Unknown intent: ${intent}`);
      }
    } catch (error) {
      addMessage({
        type: "system",
        content: `❌ Error: ${error.message}`,
      });
      return messages;
    }
  }

  public async generateCode(
    prompt: string,
    onProgress?: (message: Message) => void
  ): Promise<Message[]> {
    const messages: Message[] = [];
    const addMessage = (message: Message) => {
      messages.push(message);
      onProgress?.(message);
    };

    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController?.abort(), 60000); // 60 seconds timeout

    try {
      addMessage({ type: "system", content: "🎨 Generating code..." });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.geminiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Generate code based on: " + prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
          }),
          signal: this.abortController.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Code generation error: ${response.status}`);
      }

      const data = await response.json();
      const generatedCode = data.candidates[0].content.parts[0].text;

      addMessage({ type: "answer", content: generatedCode });
      return messages;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        addMessage({ type: "system", content: "❌ Code generation timed out after 60 seconds." });
      } else {
        addMessage({ type: "system", content: `❌ Error during generation: ${error.message}` });
      }
      return messages;
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
    const timeoutId = setTimeout(() => this.abortController?.abort(), 60000); // 60 seconds timeout

    try {
      addMessage({ type: "system", content: "🔍 Analyzing code..." });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.geminiKey,
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: "Analyze code: " + query + " with files: " + files.map(f => f.name).join(", ")
              }]
            }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
          }),
          signal: this.abortController.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Analysis error: ${response.status}`);
      }

      const data = await response.json();
      const analysis = data.candidates[0].content.parts[0].text;

      addMessage({ type: "answer", content: analysis });
      return messages;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        addMessage({ type: "system", content: "❌ Analysis timed out after 60 seconds." });
      } else {
        addMessage({ type: "system", content: `❌ Error during analysis: ${error.message}` });
      }
      return messages;
    }
  }

  private async classifyIntent(query: string): Promise<string> {
    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController?.abort(), 10000); // 10 seconds timeout

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.geminiKey,
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Classify the following user request into one of these categories:

- code generation: requests to create new code or scripts.
- code improvement: requests to enhance or optimize existing code.
- debugging: requests to find and fix errors in existing code.
- mathematical analysis: requests for mathematical insights or computations without code.

Examples:
- "Write a Python script to solve the quadratic equation." → code generation
- "How can I make this function faster?" → code improvement
- "Why does this loop cause an infinite loop?" → debugging
- "Explain the concept of eigenvalues." → mathematical analysis

Now, classify this request: "${query}"
Respond with only the category name.`
              }]
            }],
            generationConfig: { temperature: 0.0, maxOutputTokens: 10 },
          }),
          signal: this.abortController.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Intent classification error: ${response.status}`);
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text.trim().toLowerCase();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error("Intent classification timed out after 10 seconds");
      }
      throw error;
    }
  }
}