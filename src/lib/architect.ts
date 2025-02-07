import { Message } from "./types";

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

    console.log('Sending request to Gemini with formatted messages:', formattedMessages);

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a CRITICAL CODE REVIEWER analyzing a conversation and solution. Your task:

CONTEXT:
${formattedMessages}

REVIEW INSTRUCTIONS:
1. Analyze the conversation flow, solution quality, and technical accuracy
2. Identify any issues with code examples, mathematical explanations, or technical concepts
3. Suggest specific improvements with examples
4. If there are no critical issues, explain why the solution is good

YOUR RESPONSE MUST:
1. Be a valid JSON object (no markdown, no code blocks)
2. Include at least one item in each array
3. Use "NEEDS_REVISION" verdict if ANY critical issues exist
4. Use "APPROVED" verdict ONLY if NO critical issues exist

RESPONSE FORMAT:
{
  "criticalIssues": ["At least one critical issue or 'No critical issues found: [reason]'"],
  "potentialProblems": ["At least one potential problem or 'No significant problems found: [reason]'"],
  "improvements": ["At least one suggested improvement"],
  "verdict": "NEEDS_REVISION" or "APPROVED"
}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Architect LLM API call failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Gemini API response:', data);
    
    if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Invalid response format from Gemini API:', data);
      throw new Error('Invalid response format from Gemini API');
    }

    const reviewText = data.candidates[0].content.parts[0].text.trim();
    console.log('Raw review text:', reviewText);
    
    try {
      // Remove any potential markdown formatting
      const cleanedText = reviewText
        .replace(/```json\n?|\n?```/g, '')
        .replace(/^[`\s]+|[`\s]+$/g, '') // Remove any remaining backticks and whitespace
        .trim();
      
      console.log('Cleaned review text:', cleanedText);
      
      let parsedReview: ArchitectReview;
      try {
        parsedReview = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Failed text:', cleanedText);
        throw new Error('Failed to parse review JSON');
      }
      
      // Validate the parsed object structure and content
      if (!parsedReview || typeof parsedReview !== 'object') {
        throw new Error('Invalid review: not an object');
      }

      // Ensure all required arrays exist and are arrays
      ['criticalIssues', 'potentialProblems', 'improvements'].forEach(field => {
        if (!Array.isArray(parsedReview[field])) {
          console.warn(`Field ${field} is not an array, initializing empty array`);
          parsedReview[field] = [];
        }
      });

      // Ensure verdict is valid
      if (!['APPROVED', 'NEEDS_REVISION'].includes(parsedReview.verdict)) {
        console.warn('Invalid verdict, defaulting based on critical issues');
        parsedReview.verdict = parsedReview.criticalIssues.length > 0 ? 'NEEDS_REVISION' : 'APPROVED';
      }

      // Ensure arrays have at least one item
      if (parsedReview.criticalIssues.length === 0) {
        parsedReview.criticalIssues = ['No critical issues found: Solution provides accurate and clear explanation'];
      }
      if (parsedReview.potentialProblems.length === 0) {
        parsedReview.potentialProblems = ['No significant problems identified: Content is well-structured and accurate'];
      }
      if (parsedReview.improvements.length === 0) {
        parsedReview.improvements = ['Consider adding more interactive examples or visualizations to enhance understanding'];
      }

      return parsedReview;
    } catch (parseError) {
      console.error('Failed to parse review:', {
        error: parseError instanceof Error ? {
          message: parseError.message,
          name: parseError.name,
          stack: parseError.stack
        } : parseError,
        reviewText
      });
      
      // Return a fallback review instead of throwing
      return {
        criticalIssues: ['Error parsing review response: Will need manual review'],
        potentialProblems: ['Unable to automatically analyze the solution'],
        improvements: ['Retry the review or manually inspect the solution'],
        verdict: 'NEEDS_REVISION'
      };
    }
  } catch (error) {
    let errorMessage = 'Unknown error occurred';
    let errorDetails = {};

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        stack: error.stack
      };
    }

    console.error("Error calling Architect LLM:", {
      message: errorMessage,
      details: errorDetails
    });

    return {
      criticalIssues: ['Failed to complete automatic review: ' + errorMessage],
      potentialProblems: ['Review system encountered an error'],
      improvements: ['Retry the review or manually inspect the solution'],
      verdict: 'NEEDS_REVISION'
    };
  }
};