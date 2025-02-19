import { Message } from "./types";

export interface ArchitectReview {
  criticalIssues: string[];
  potentialProblems: string[];
  improvements: string[];
  verdict: "APPROVED" | "NEEDS_REVISION";
}

interface ArchitectReviewError {
  type: 'PARSING' | 'VALIDATION' | 'API';
  message: string;
  details?: any;
}

export class ArchitectReviewer {
  private formatMessages(messages: Message[]): string {
    return messages.map(m => {
      let prefix = '';
      switch (m.type) {
        case 'user': prefix = '👤 User:'; break;
        case 'answer': prefix = '🤖 Assistant:'; break;
        case 'reasoning': prefix = '💭 Reasoning:'; break;
        default: prefix = m.type.toUpperCase() + ':';
      }
      return `${prefix} ${m.content.trim()}`;
    }).join('\n\n');
  }

  private extractJsonFromText(text: string): string {
    // Find JSON content between curly braces, including nested structures
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : '';
  }

  private validateReviewStructure(data: any): ArchitectReview {
    const requiredArrays = ['criticalIssues', 'potentialProblems', 'improvements'];
    for (const field of requiredArrays) {
      if (!Array.isArray(data[field])) {
        data[field] = [];
      }
    }
    return {
      criticalIssues: data.criticalIssues,
      potentialProblems: data.potentialProblems,
      improvements: data.improvements,
      verdict: data.criticalIssues.length > 0 ? 'NEEDS_REVISION' : 'APPROVED'
    };
  }

  private parseAndValidateReview(text: string): ArchitectReview {
    try {
      console.log('Raw review text:', text);
      
      const jsonContent = this.extractJsonFromText(text);
      if (!jsonContent) {
        throw new Error('No valid JSON found in response');
      }
      
      console.log('Extracted JSON:', jsonContent);
      const parsed = JSON.parse(jsonContent);
      return this.validateReviewStructure(parsed);
    } catch (error) {
      console.error('Review parsing error:', error);
      console.error('Failed text:', text);
      throw {
        type: 'PARSING',
        message: 'Failed to parse review response',
        details: error
      } as ArchitectReviewError;
    }
  }

  private handleReviewError(error: Error | ArchitectReviewError): ArchitectReview {
    const errorMessage = 'type' in error ? error.message : error.message;
    console.error('Review error:', error);
    
    return {
      criticalIssues: ['Failed to complete automatic review: ' + errorMessage],
      potentialProblems: ['Review system encountered an error'],
      improvements: ['Retry the review or manually inspect the solution'],
      verdict: 'NEEDS_REVISION'
    };
  }

  public async review(messages: Message[], apiKey: string): Promise<ArchitectReview> {
    const formattedMessages = this.formatMessages(messages);
    const prompt = `You are a CRITICAL CODE REVIEWER analyzing a conversation and solution.

CONTEXT:
${formattedMessages}

REVIEW INSTRUCTIONS:
1. Analyze the conversation flow, solution quality, and technical accuracy
2. Identify any issues with code examples, mathematical explanations, or technical concepts
3. Suggest specific improvements with examples

RESPONSE REQUIREMENTS:
1. Return ONLY a JSON object with NO additional text
2. Do NOT use markdown formatting or code blocks
3. Must contain these exact fields (use empty arrays if none found):
   - criticalIssues: string[]
   - potentialProblems: string[]
   - improvements: string[]

EXAMPLE RESPONSE (copy this format exactly):
{
  "criticalIssues": [],
  "potentialProblems": [],
  "improvements": []
}`;

    try {
      console.log('Sending request to Gemini with formatted messages');

      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 1,
            topP: 1,
          }
        })
      });

      if (!response.ok) {
        throw {
          type: 'API',
          message: `Gemini API error: ${response.status}`,
          details: await response.text()
        } as ArchitectReviewError;
      }

      const data = await response.json();
      console.log('Gemini API response:', data);

      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw {
          type: 'API',
          message: 'Invalid response format from Gemini'
        } as ArchitectReviewError;
      }

      const reviewText = data.candidates[0].content.parts[0].text;
      return this.parseAndValidateReview(reviewText);
    } catch (error) {
      return this.handleReviewError(error as Error | ArchitectReviewError);
    }
  }
}
