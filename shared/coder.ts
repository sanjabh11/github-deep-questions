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
        content: "🎨 Analyzing visualization requirements..."
      });

      // First, analyze the mathematical context
      const mathAnalysis = await fetch(
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
                text: `You are a MATHEMATICS EXPERT. Analyze this visualization request and provide mathematical context:

REQUEST: ${prompt}

Please provide:
1. Mathematical background
2. Key equations/theorems
3. Visualization requirements
4. Numerical considerations
5. Edge cases to handle

Format your response as JSON:
{
  "background": "string",
  "equations": ["string"],
  "visualizationNeeds": ["string"],
  "numericalConsiderations": ["string"],
  "edgeCases": ["string"]
}`
              }]
            }],
            generationConfig: {
              temperature: 0.3,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
            }
          }),
          signal: this.abortController.signal
        }
      );

      if (!mathAnalysis.ok) {
        throw new Error(`Math analysis error: ${mathAnalysis.status}`);
      }

      const mathContext = await mathAnalysis.json();
      const mathDetails = JSON.parse(mathContext.candidates[0].content.parts[0].text);

      addMessage({
        type: "system",
        content: "🎨 Generating optimized visualization code..."
      });

      // Generate the actual code with mathematical context
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
                text: `You are a SENIOR SOFTWARE ENGINEER specializing in web-based scientific visualization and interactive animations.

TASK:
Generate complete, self-contained HTML/CSS/JavaScript code for: ${prompt}

MATHEMATICAL CONTEXT:
${JSON.stringify(mathDetails, null, 2)}

REQUIREMENTS:
1. Code must run directly in modern browsers
2. Use Three.js for 3D rendering (latest version, via CDN)
3. Implement precise mathematical calculations
4. Include comprehensive error handling
5. Generate all visual elements programmatically

CODE STRUCTURE:
1. HTML5
   - Viewport and meta setup
   - Canvas container
   - Loading indicators
   - UI controls
   - Error messages

2. CSS
   - Responsive design
   - Professional UI
   - Loading animations
   - Error states

3. JavaScript
   - ES6+ modules
   - Three.js setup
   - Math utilities
   - Camera controls
   - Performance optimization
   - Error handling
   - Debug logging

4. Mathematical Implementation
   - Precise calculations
   - Error bounds
   - Numerical stability
   - Unit handling

5. Visualization
   - Interactive 3D scene
   - Proper axes/labels
   - Camera controls
   - Performance monitoring

RESPONSE FORMAT:
\`\`\`html
<!-- index.html -->
<!-- Complete HTML code with proper structure -->
\`\`\`

\`\`\`css
/* styles.css */
/* Complete CSS code with responsive design */
\`\`\`

\`\`\`javascript
// main.js
// Complete JavaScript code with proper organization

// mathUtils.js
// Mathematical utility functions

// sceneSetup.js
// Three.js scene setup and management

// controls.js
// User interface and camera controls

// visualization.js
// Core visualization logic
\`\`\`

\`\`\`markdown
# Mathematical Background
${mathDetails.background}

## Key Equations
${mathDetails.equations.join('\n')}

## Usage Instructions
1. Open index.html in a modern browser
2. Interact with controls to explore
3. Performance may vary by device

## Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Known Limitations
${mathDetails.numericalConsiderations.join('\n')}
\`\`\``
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192,
            }
          }),
          signal: this.abortController.signal
        }
      );

      if (!response.ok) {
        throw new Error(`Code generation error: ${response.status}`);
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
          content: `❌ Error during generation: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      return messages;
    }
  }
}