export interface ArchitectReview {
  criticalIssues: string[] | ReviewItem[];
  potentialProblems: string[] | ReviewItem[];
  improvements: string[] | ReviewItem[];
  verdict: "APPROVED" | "NEEDS_REVISION" | "REVIEW_FAILED" | "ERROR";
  rawText?: string;
  version?: string;
  timestamp?: number;
  previousVersions?: any[];
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
  if (lastUserMessage.includes('proof') || lastUserMessage.includes('theorem')) return 'MATHEMATICAL';
  if (lastUserMessage.includes('algorithm')) return 'ALGORITHM';
  if (lastUserMessage.includes('architecture') || lastUserMessage.includes('design')) return 'ARCHITECTURE';
  if (lastUserMessage.includes('database') || lastUserMessage.includes('sql')) return 'DATABASE';
  
  // Default to general
  return 'GENERAL';
};

const getReviewStrategy = (queryType: string, messages: Message[]): string => {
  const lastUserMessage = messages.find(m => m.type === 'user')?.content.toLowerCase() || '';
  
  switch (queryType) {
    case 'MATHEMATICAL':
      if (lastUserMessage.includes('proof')) return 'ANALYZE_PROOF';
      return 'ANALYZE_METHOD';
    case 'CODE':
      if (lastUserMessage.includes('optimize') || lastUserMessage.includes('performance')) 
        return 'OPTIMIZE_CODE';
      if (lastUserMessage.includes('debug') || lastUserMessage.includes('fix')) 
        return 'DEBUG_CODE';
      return 'REVIEW_CODE';
    case 'ALGORITHM':
      if (lastUserMessage.includes('complexity') || lastUserMessage.includes('efficiency'))
        return 'ANALYZE_COMPLEXITY';
      return 'REVIEW_ALGORITHM';
    case 'ARCHITECTURE':
      return 'REVIEW_ARCHITECTURE';
    case 'DATABASE':
      return 'REVIEW_DATABASE';
    default:
      return 'GENERAL_REVIEW';
  }
};

const getReviewPrompt = (queryType: string, strategy: string, messages: Message[]): string => {
  const lastUserMessage = messages.find(m => m.type === 'user')?.content || '';
  
  // Base prompt for all reviews
  let prompt = `You are an EXPERT REVIEWER analyzing a ${queryType.toLowerCase()} solution. `;
  
  // Strategy-specific prompts
  switch (strategy) {
    case 'ANALYZE_PROOF':
      prompt += `Evaluate this mathematical proof for correctness, rigor, and clarity. 
      Check for logical errors, gaps in reasoning, and unstated assumptions.`;
      break;
    case 'ANALYZE_METHOD':
      prompt += `Evaluate this mathematical approach for correctness, efficiency, and elegance. 
      Check for calculation errors, invalid steps, and potential simplifications.`;
      break;
    case 'REVIEW_CODE':
      prompt += `Evaluate this code for correctness, style, and maintainability. 
      Check for bugs, edge cases, and adherence to best practices.`;
      break;
    case 'OPTIMIZE_CODE':
      prompt += `Evaluate this code for performance and efficiency. 
      Identify bottlenecks, redundant operations, and optimization opportunities.`;
      break;
    case 'DEBUG_CODE':
      prompt += `Identify bugs and issues in this code. 
      Look for logical errors, edge cases, and potential fixes.`;
      break;
    case 'ANALYZE_COMPLEXITY':
      prompt += `Evaluate the time and space complexity of this algorithm. 
      Verify the analysis and identify potential optimizations.`;
      break;
    case 'REVIEW_ALGORITHM':
      prompt += `Evaluate this algorithm for correctness, efficiency, and elegance. 
      Check for logical errors, edge cases, and potential simplifications.`;
      break;
    case 'REVIEW_ARCHITECTURE':
      prompt += `Evaluate this system architecture for scalability, maintainability, and robustness. 
      Identify potential bottlenecks, single points of failure, and design flaws.`;
      break;
    case 'REVIEW_DATABASE':
      prompt += `Evaluate this database design or query for correctness, performance, and maintainability. 
      Check for normalization issues, indexing opportunities, and query optimizations.`;
      break;
    default:
      prompt += `Provide a thorough review of this solution, highlighting strengths and areas for improvement.`;
  }
  
  // Add the user's message
  prompt += `\n\nHere is the ${queryType.toLowerCase()} to review:\n\n${lastUserMessage}\n\n`;
  
  // Request format
  prompt += `Return a raw JSON object with these fields: criticalIssues, potentialProblems, improvements

Example:
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

  return prompt;
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
    const queryType = analyzeQueryType(messages);
    const strategy = getReviewStrategy(queryType, messages);
    const prompt = getReviewPrompt(queryType, strategy, messages);

    console.log('Sending review request for query type:', queryType);
    console.log('Using strategy:', strategy);

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent", {
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
      const errorData = await response.text();
      console.error('Gemini API error:', response.status, errorData);
      throw new Error(`Gemini API error: ${response.status} ${errorData}`);
    }

    const data = await response.json();
    console.log('Gemini API response:', data);

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Invalid response structure:', data);
      throw new Error('Invalid response structure from Gemini API');
    }

    const reviewText = data.candidates[0].content.parts[0].text;
    console.log('Raw review text:', reviewText);

    let parsedReview;
    try {
      // Inline function to parse the review response
      const parseReview = (text) => {
        try {
          // Remove any potential markdown code block markers
          const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
          
          // Parse the JSON
          return JSON.parse(cleanText);
        } catch (error) {
          console.error('Error parsing JSON:', error);
          return {
            criticalIssues: [],
            potentialProblems: [],
            improvements: ['Could not parse review response. Please try again.']
          };
        }
      };
      
      parsedReview = parseReview(reviewText);
    } catch (parseError) {
      console.error('Failed to parse review response:', parseError);
      // Return a basic review with the raw text
      return {
        criticalIssues: [],
        potentialProblems: [],
        improvements: [{
          title: 'Error parsing review',
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
        description: error.message || 'An unknown error occurred during the review process.',
        severity: 'error'
      }],
      verdict: 'ERROR'
    };
  }
};

// Type definition for Message
interface Message {
  type: string;
  content: string;
}
