import { Message } from "./types";

export interface ArchitectReview {
  criticalIssues: string[] | ReviewItem[];
  potentialProblems: string[] | ReviewItem[];
  improvements: string[] | ReviewItem[];
  verdict: "APPROVED" | "NEEDS_REVISION" | "REVIEW_FAILED" | "ERROR";
  rawText?: string;
}

export interface ReviewItem {
  title: string;
  description: string;
  severity?: string;
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

RESPONSE REQUIREMENTS:
Return a raw JSON object with these fields:

1. criticalIssues: array of strings
   - List serious problems that must be fixed
   - For code: missing error handling, security issues
   - For math: incorrect calculations, wrong methodology
   - Empty array if no critical issues found

2. potentialProblems: array of strings
   - List minor issues that could be improved
   - For code: performance optimizations, better naming
   - For math: clearer explanations, missing edge cases
   - Empty array if no potential problems found

3. improvements: array of strings
   - List specific suggestions with examples
   - For code: "Add input validation: if (n < 0) throw Error('Invalid input')"
   - For math: "Add visual representation of the pattern"
   - At least one improvement even if solution is correct

Example correct format:
{
  "criticalIssues": ["Issue 1", "Issue 2"],
  "potentialProblems": ["Problem 1", "Problem 2"],
  "improvements": ["Improvement 1", "Improvement 2"]
}

STRICT FORMAT RULES:
1. Return ONLY the raw JSON object starting with {
2. NO markdown code blocks (do not wrap in \`\`\`json)
3. NO text before or after the JSON
4. NO explanatory text`;
};

const parseReviewResponse = (text: string): any => {
  try {
    // Remove any potential markdown code block markers
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    
    // Parse the JSON
    const review = JSON.parse(cleanText);
    
    // Validate the structure
    if (!review.criticalIssues || !Array.isArray(review.criticalIssues) ||
        !review.potentialProblems || !Array.isArray(review.potentialProblems) ||
        !review.improvements || !Array.isArray(review.improvements)) {
      console.error('Invalid review structure:', review);
      return {
        criticalIssues: [],
        potentialProblems: [],
        improvements: ['Could not parse review response. Please try again.']
      };
    }
    
    return review;
  } catch (error) {
    console.error('Error parsing review response:', error, '\nText:', text);
    return {
      criticalIssues: [],
      potentialProblems: [],
      improvements: ['Could not parse review response. Please try again.']
    };
  }
};

const validateReviewObject = (obj: any): ArchitectReview => {
  const defaultReview: ArchitectReview = {
    criticalIssues: [],
    potentialProblems: [],
    improvements: [],
    verdict: 'APPROVED'
  };

  if (!obj || typeof obj !== 'object') {
    console.error('Invalid review object:', obj);
    return defaultReview;
  }

  // Convert string arrays to ReviewItem arrays if needed
  const convertToReviewItems = (items: string[]): ReviewItem[] => {
    return items.map(item => ({
      title: item.substring(0, 50) + (item.length > 50 ? '...' : ''),
      description: item,
      severity: 'suggestion'
    }));
  };

  // Process critical issues
  let criticalIssues: ReviewItem[] = [];
  if (Array.isArray(obj.criticalIssues)) {
    criticalIssues = obj.criticalIssues.map(issue => {
      if (typeof issue === 'string') {
        return {
          title: issue.substring(0, 50) + (issue.length > 50 ? '...' : ''),
          description: issue,
          severity: 'critical'
        };
      }
      return {
        ...issue,
        severity: issue.severity || 'critical'
      };
    });
  }

  // Process potential problems
  let potentialProblems: ReviewItem[] = [];
  if (Array.isArray(obj.potentialProblems)) {
    potentialProblems = obj.potentialProblems.map(problem => {
      if (typeof problem === 'string') {
        return {
          title: problem.substring(0, 50) + (problem.length > 50 ? '...' : ''),
          description: problem,
          severity: 'warning'
        };
      }
      return {
        ...problem,
        severity: problem.severity || 'warning'
      };
    });
  }

  // Process improvements
  let improvements: ReviewItem[] = [];
  if (Array.isArray(obj.improvements)) {
    improvements = obj.improvements.map(improvement => {
      if (typeof improvement === 'string') {
        return {
          title: improvement.substring(0, 50) + (improvement.length > 50 ? '...' : ''),
          description: improvement,
          severity: 'suggestion'
        };
      }
      return {
        ...improvement,
        severity: improvement.severity || 'suggestion'
      };
    });
  }

  return {
    criticalIssues,
    potentialProblems,
    improvements,
    verdict: criticalIssues.length > 0 ? 'NEEDS_REVISION' : 'APPROVED',
    rawText: obj.rawText
  };
};

export const callArchitectLLM = async (
  messages: Message[],
  apiKey: string
): Promise<ArchitectReview> => {
  try {
    // Validate API key
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Gemini API key is required for architect review');
    }

    const queryType = analyzeQueryType(messages);
    const strategy = getReviewStrategy(queryType, messages);
    const prompt = getReviewPrompt(queryType, strategy, messages);

    console.log('Sending review request for query type:', queryType);
    console.log('Using strategy:', strategy);

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
      
      // Handle specific error codes
      if (response.status === 400) {
        throw new Error('Invalid request to Gemini API. Please check your API key and request format.');
      } else if (response.status === 401 || response.status === 403) {
        throw new Error('Authentication error with Gemini API. Please check your API key.');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded for Gemini API. Please try again later.');
      } else {
        throw new Error(`Gemini API error: ${response.status}`);
      }
    }

    // Safely parse the response
    let data;
    try {
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from Gemini API');
      }
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Gemini API response:', parseError);
      throw new Error(`Failed to parse Gemini API response: ${parseError.message}`);
    }

    console.log('Gemini API response:', data);

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Invalid response structure:', data);
      throw new Error('Invalid response structure from Gemini API');
    }

    const reviewText = data.candidates[0].content.parts[0].text;
    console.log('Raw review text:', reviewText);

    let parsedReview;
    try {
      parsedReview = parseReviewResponse(reviewText);
    } catch (parseError) {
      console.error('Failed to parse review response:', parseError);
      // Return a basic review with the raw text
      return {
        criticalIssues: [],
        potentialProblems: [],
        improvements: [{
          title: 'Review could not be parsed',
          description: 'The raw review text is provided below.',
          severity: 'suggestion'
        }],
        verdict: 'REVIEW_FAILED',
        rawText: reviewText
      };
    }

    const validatedReview = validateReviewObject(parsedReview);

    console.log('Validated review:', validatedReview);
    return validatedReview;

  } catch (error) {
    console.error('Error in architect review:', error);
    // Return a safe default instead of propagating the error
    return {
      criticalIssues: [],
      potentialProblems: [],
      improvements: [{
        title: 'Error generating review',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        severity: 'warning'
      }],
      verdict: 'ERROR'
    };
  }
};