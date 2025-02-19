import { Message } from "./types";
import { extractJson, validateArrayFields } from "./jsonParser";

export interface ArchitectReview {
  criticalIssues: string[];
  potentialProblems: string[];
  improvements: string[];
  verdict: "APPROVED" | "NEEDS_REVISION";
}

const analyzeQueryType = (messages: Message[]): string => {
  const lastUserMessage = messages.find(m => m.type === 'user')?.content.toLowerCase() || '';
  
  if (lastUserMessage.match(/\d[\s+\-*\/=]+\d/)) return 'MATHEMATICAL';
  if (lastUserMessage.includes('function') || lastUserMessage.includes('code')) return 'CODE';
  if (lastUserMessage.includes('design') || lastUserMessage.includes('architecture')) return 'SYSTEM_DESIGN';
  return 'CONCEPTUAL';
};

const getReviewStrategy = (queryType: string, messages: Message[]): string => {
  const isSimple = messages.every(m => m.content.length < 100);
  
  switch(queryType) {
    case 'MATHEMATICAL':
      return isSimple ? 'VERIFY_ACCURACY' : 'ANALYZE_METHOD';
    case 'CODE':
      return 'FULL_REVIEW';
    case 'SYSTEM_DESIGN':
      return 'ARCHITECTURE_REVIEW';
    default:
      return isSimple ? 'BASIC_CHECK' : 'DETAILED_REVIEW';
  }
};

const getReviewPrompt = (queryType: string, strategy: string, messages: Message[]): string => {
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

  let reviewFocus = '';
  switch(strategy) {
    case 'VERIFY_ACCURACY':
      reviewFocus = `
REVIEW FOCUS:
1. Verify mathematical accuracy
2. Check step-by-step explanation
3. Validate final answer`;
      break;
    case 'ANALYZE_METHOD':
      reviewFocus = `
REVIEW FOCUS:
1. Analyze solution methodology
2. Check for alternative approaches
3. Verify efficiency of solution`;
      break;
    case 'FULL_REVIEW':
      reviewFocus = `
REVIEW FOCUS:
1. Code correctness and efficiency
2. Error handling and edge cases
3. Documentation and maintainability
4. Best practices and standards`;
      break;
    case 'ARCHITECTURE_REVIEW':
      reviewFocus = `
REVIEW FOCUS:
1. System architecture and design
2. Component interactions
3. Scalability and performance
4. Security considerations`;
      break;
    case 'BASIC_CHECK':
      reviewFocus = `
REVIEW FOCUS:
1. Answer accuracy
2. Clarity of explanation`;
      break;
    case 'DETAILED_REVIEW':
      reviewFocus = `
REVIEW FOCUS:
1. Completeness of answer
2. Technical accuracy
3. Clarity and organization
4. Supporting examples`;
      break;
  }

  return `You are an EXPERT REVIEWER analyzing a ${queryType.toLowerCase()} solution.

CONTEXT:
${formattedMessages}

${reviewFocus}

RESPONSE FORMAT:
Return a JSON object with these fields (use empty arrays if none found):
{
  "criticalIssues": string[],    // Major problems that must be fixed
  "potentialProblems": string[], // Minor issues or concerns
  "improvements": string[]        // Suggestions for enhancement
}

For simple queries with correct answers, return empty arrays.
For complex queries, provide detailed feedback in each category.`;
};

export const callArchitectLLM = async (
  messages: Message[],
  apiKey: string
): Promise<ArchitectReview | null> => {
  try {
    const queryType = analyzeQueryType(messages);
    const strategy = getReviewStrategy(queryType, messages);
    const prompt = getReviewPrompt(queryType, strategy, messages);

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
    const jsonText = reviewText.includes('```') ? 
      reviewText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)?.[1] || reviewText :
      reviewText;
    
    const parsed = JSON.parse(jsonText.trim());
    
    // Ensure all required fields exist
    const validated = {
      criticalIssues: Array.isArray(parsed.criticalIssues) ? parsed.criticalIssues : [],
      potentialProblems: Array.isArray(parsed.potentialProblems) ? parsed.potentialProblems : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : []
    };
    
    return {
      ...validated,
      verdict: validated.criticalIssues.length > 0 ? 'NEEDS_REVISION' : 'APPROVED'
    };
  } catch (error) {
    console.error('Error calling Architect LLM:', error);
    return {
      criticalIssues: [],
      potentialProblems: [],
      improvements: [],
      verdict: 'APPROVED'
    };
  }
};