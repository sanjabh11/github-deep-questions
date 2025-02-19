import { Message } from "./api";

export class Coder {
  private abortController: AbortController | null = null;

  constructor() {
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!geminiKey) {
      const loadedKeys = loadApiKeys();
      if (!loadedKeys.gemini) {
        throw new Error("Gemini API key is required for coder mode");
      }
      this.geminiKey = loadedKeys.gemini;
    } else {
      this.geminiKey = geminiKey;
    }
  }

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
                text: `You are a SENIOR SOFTWARE ENGINEER with expertise in code creation, analysis and implementation.

CONTEXT:
Query: ${query}

Files to analyze:
${files.map(f => `--- ${f.name} ---\n${f.content}`).join('\n\n')}

ANALYSIS INSTRUCTIONS:
1. Code Structure and Organization
   - Evaluate code architecture and patterns
   - Identify potential code smells
   - Assess modularity and reusability

2. Implementation Quality
   - Review algorithm efficiency
   - Check error handling
   - Validate edge cases
   - Examine type safety and null checks

3. Security Assessment
   - Find security vulnerabilities
   - Check for proper input validation
   - Review authentication/authorization
   - Identify data exposure risks

4. Performance Optimization
   - Spot performance bottlenecks
   - Suggest optimization strategies
   - Review resource usage

5. Best Practices
   - Compare against industry standards
   - Check documentation quality
   - Verify testing coverage
   - Assess maintainability

YOUR RESPONSE MUST:
1. Be thorough yet concise
2. Provide specific examples
3. Include actionable improvements
4. Consider scalability
5. Follow clean code principles

RESPONSE FORMAT:
{
  "analysis": {
    "structure": ["Findings about code organization"],
    "quality": ["Implementation quality findings"],
    "security": ["Security-related issues"],
    "performance": ["Performance observations"],
    "bestPractices": ["Best practice recommendations"]
  },
  "improvements": ["Specific, actionable improvements"],
  "priority": "HIGH" | "MEDIUM" | "LOW"
}`
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

  public async generateCode(prompt: string, onProgress?: (message: Message) => void): Promise<Message[]> {
    const messages: Message[] = [];
    const addMessage = (message: Message) => {
      messages.push(message);
      onProgress?.(message);
    };

    this.abortController = new AbortController();

    try {
      addMessage({
        type: "system",
        content: "🔍 Generating code based on the prompt..."
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
                text: `You are a SENIOR SOFTWARE ENGINEER tasked with generating code based on the following prompt:

PROMPT:
${prompt}

Please provide a complete and functional code snippet for the requested functionality.`
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
      const generatedCode = data.candidates[0].content.parts[0].text;

      addMessage({
        type: "answer",
        content: generatedCode
      });

      return messages;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        addMessage({
          type: "system",
          content: "❌ Code generation cancelled."
        });
      } else {
        addMessage({
          type: "system",
          content: `❌ Error during code generation: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      return messages;
    }
  }
}