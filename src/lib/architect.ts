import { Message } from "./types";
import { extractJson, validateArrayFields } from "./jsonParser";

export interface ArchitectReview {
  criticalIssues: string[];
  potentialProblems: string[];
  improvements: string[];
  verdict: "APPROVED" | "NEEDS_REVISION";
}

export const callArchitectLLM = async (
  messages: Message[],
  apiKey: string
): Promise<ArchitectReview | null> => {
  try {
    // Format messages for better context
    const formattedMessages = messages.map(m => {
      let prefix = '';
      switch (m.type) {
        case 'user': prefix = '👤 User:'; break;
        case 'answer': prefix = '🤖 Assistant:'; break;
        case 'reasoning': prefix = '💭 Reasoning:'; break;
        default: prefix = m.type.toUpperCase() + ':';
      }
      return `${prefix} ${m.content.trim()}`;
    }).join('\n\n');

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
{"criticalIssues":[],"potentialProblems":[],"improvements":[]}`;

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
          temperature: 0.1,
          topK: 1,
          topP: 1,
        }
      })
    });

    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Gemini API response:', data);

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response format from Gemini');
    }

    const reviewText = data.candidates[0].content.parts[0].text;
    console.log('Raw review text:', reviewText);

    // Extract and parse JSON
    const jsonText = extractJson(reviewText);
    const parsed = JSON.parse(jsonText);
    
    // Validate the structure
    const validated = validateArrayFields(parsed, ['criticalIssues', 'potentialProblems', 'improvements']);
    
    return {
      ...validated,
      verdict: validated.criticalIssues.length > 0 ? 'NEEDS_REVISION' : 'APPROVED'
    };
  } catch (error) {
    console.error('Error calling Architect LLM:', error);
    return {
      criticalIssues: ['Failed to complete automatic review: ' + (error as Error).message],
      potentialProblems: ['Review system encountered an error'],
      improvements: ['Retry the review or manually inspect the solution'],
      verdict: 'NEEDS_REVISION'
    };
  }
};