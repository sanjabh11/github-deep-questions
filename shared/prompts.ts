export type QueryType = 'CODE' | 'EXPLANATION' | 'RESEARCH';
export type InterfaceType = 'GENERAL' | 'RESEARCHER' | 'CODER';

export interface ThinkingStep {
  reasoning: string;
  verification: string;
  reflection: string;
  conclusion: string;
}

export interface VersionInfo {
  version: string;
  timestamp: number;
  changes: string[];
}

export interface PromptConfig {
  role: string;
  context: string;
  guidelines: string[];
  responseFormat: string;
  thinkingTemplate: ThinkingStep;
  versionTracking: boolean;
  allowsFileAttachments: boolean;
  maxIterations: number;
}

export interface ContextState {
  currentTopic: string;
  previousResponses: Array<{
    type: QueryType;
    response: any;
    timestamp: number;
  }>;
  followUpQuestions: string[];
  exampleRequests: string[];
  architectReviews: any[];
}

export interface StorageConfig {
  storageKey: string;
  maxHistoryItems: number;
  version: string;
}

const THINKING_TEMPLATE: ThinkingStep = {
  reasoning: `[THINK]
1. Initial Problem Analysis
2. Approach Identification
3. Step-by-step Solution`,
  
  verification: `[VERIFY]
1. Solution Correctness
2. Edge Cases
3. Performance Considerations`,
  
  reflection: `[REFLECT]
1. Alternative Approaches
2. Trade-offs
3. Learning Points`,
  
  conclusion: `[CONCLUDE]
Final solution with key insights`
};

const COMMON_GUIDELINES = [
  'Be precise and accurate',
  'Use clear language',
  'Stay focused on the query',
  'Show structured thinking process',
  'Verify solutions thoroughly',
  'Consider edge cases',
];

// Specialized prompt templates from each component
export const SPECIALIZED_PROMPTS = {
  DEEP_CODER: {
    ANALYSIS: `You are a SENIOR SOFTWARE ENGINEER with expertise in code creation, analysis and implementation.

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
   - Assess maintainability`,
    
    GENERATION: `You are a SENIOR SOFTWARE ENGINEER tasked with generating code.
    
REQUIREMENTS:
1. Complete and functional code
2. Follow best practices
3. Include error handling
4. Add documentation
5. Consider performance`
  },
  
  DEEP_RESEARCHER: {
    ANALYSIS: `You are a research assistant specializing in deep technical analysis and comprehensive information synthesis.
          
ANALYSIS APPROACH:
1. Evaluate all provided contexts critically
2. Identify key patterns and insights
3. Synthesize information across multiple sources
4. Provide concrete examples and evidence
5. Acknowledge any limitations or gaps

OUTPUT STRUCTURE:
1. Key Findings
2. Detailed Analysis
3. Supporting Evidence
4. Practical Implications
5. Further Considerations`,
    
    SEARCH: `You are an expert research assistant. Given the user's query, generate up to four distinct, 
    precise search queries that would help gather comprehensive information on the topic. 
    Return only a Python list of strings, for example: ['query1', 'query2', 'query3'].`
  },
  
  DEEP_THINKING: {
    SYSTEM_THINKING: `You are in THINKING mode. Break down the problem step by step. Return your response in this exact JSON format without any markdown:
{"type": "thinking", "content": "your detailed thought process here"}`,
    
    SYSTEM_SOLUTION: `You are in SOLUTION mode. Provide a clear, direct answer to the problem. No need for JSON formatting.`
  }
};

// Storage configurations for each interface
export const STORAGE_CONFIGS: Record<InterfaceType, StorageConfig> = {
  GENERAL: {
    storageKey: 'general_assistant_storage',
    maxHistoryItems: 50,
    version: '1.0.0'
  },
  RESEARCHER: {
    storageKey: 'deep_researcher_storage',
    maxHistoryItems: 100,
    version: '1.0.0'
  },
  CODER: {
    storageKey: 'deep_coder_storage',
    maxHistoryItems: 75,
    version: '1.0.0'
  }
};

// Enhanced thinking template with metadata
const ENHANCED_THINKING_TEMPLATE: ThinkingStep & { metadata: any } = {
  reasoning: `[THINK]
1. Initial Context Analysis
   - Problem scope
   - Available resources
   - Constraints
2. Approach Formulation
   - Methodology selection
   - Tool identification
   - Risk assessment
3. Solution Architecture
   - Component design
   - Integration points
   - Implementation plan`,
  
  verification: `[VERIFY]
1. Solution Validation
   - Correctness check
   - Edge case analysis
   - Performance impact
2. Security Assessment
   - Vulnerability scan
   - Access control review
   - Data protection
3. Quality Assurance
   - Code standards
   - Documentation
   - Test coverage`,
  
  reflection: `[REFLECT]
1. Solution Analysis
   - Strengths
   - Limitations
   - Trade-offs
2. Alternative Approaches
   - Different methods
   - Pros and cons
   - Why current chosen
3. Future Considerations
   - Scalability
   - Maintainability
   - Evolution path`,
  
  conclusion: `[CONCLUDE]
1. Final Solution
   - Implementation details
   - Usage guidelines
   - Known limitations
2. Next Steps
   - Action items
   - Follow-up tasks
   - Documentation needs`,
  
  metadata: {
    version: '2.0.0',
    lastUpdated: new Date().toISOString(),
    contextId: '',
    dependencies: [],
    tags: []
  }
};

// Interface-specific configurations
export const INTERFACE_CONFIGS: Record<InterfaceType, Record<QueryType, PromptConfig & {
  responseHandlers: {
    followUp: (context: ContextState) => string[];
    explain: (context: ContextState) => string;
    examples: (context: ContextState) => string[];
    newTopic: () => void;
    architectReview: (context: ContextState) => any;
  }
}>> = {
  GENERAL: {
    CODE: {
      role: 'General Assistant',
      context: SPECIALIZED_PROMPTS.DEEP_THINKING.SYSTEM_THINKING,
      guidelines: [
        ...COMMON_GUIDELINES,
        'Focus on clarity and explanation',
        'Provide step-by-step guidance',
        'Include practical examples',
        'Consider user skill level'
      ],
      responseFormat: `
**Solution:**
\`\`\`json
{
  "context": {
    "topic": "",
    "scope": "",
    "requirements": []
  },
  "explanation": "",
  "code": "",
  "examples": [],
  "nextSteps": [],
  "metadata": {
    "timestamp": "",
    "version": "",
    "confidence": ""
  }
}
\`\`\``,
      thinkingTemplate: ENHANCED_THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 3,
      responseHandlers: {
        followUp: (context) => [
          'Can you explain more about the implementation details?',
          'What are the potential edge cases?',
          'How can we optimize this solution?'
        ],
        explain: (context) => 'Detailed explanation of the current solution...',
        examples: (context) => ['Example 1...', 'Example 2...'],
        newTopic: () => { /* Reset context */ },
        architectReview: (context) => ({
          review: {
            architecture: [],
            security: [],
            performance: []
          }
        })
      }
    },
    EXPLANATION: {
      role: 'Technical Educator',
      context: 'You are explaining a complex concept',
      guidelines: [
        ...COMMON_GUIDELINES,
        'Break down complex ideas into simpler parts',
        'Use analogies when helpful',
        'Provide real-world examples',
        'Address common misconceptions'
      ],
      responseFormat: `
**Explanation:**
1. Key Concepts
2. Detailed Analysis
3. Examples
4. Implications
`,
      thinkingTemplate: ENHANCED_THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 3,
      responseHandlers: {
        followUp: (context) => [
          'Can you provide more examples?',
          'How does this relate to other concepts?',
          'What are the key takeaways?'
        ],
        explain: (context) => 'Detailed explanation of the concept...',
        examples: (context) => ['Example 1...', 'Example 2...'],
        newTopic: () => { /* Reset context */ },
        architectReview: (context) => ({
          review: {
            architecture: [],
            security: [],
            performance: []
          }
        })
      }
    },
    RESEARCH: {
      role: 'Research Analyst',
      context: 'You are analyzing current research and data',
      guidelines: [
        ...COMMON_GUIDELINES,
        'Cite reliable sources when possible',
        'Distinguish between facts and theories',
        'Consider multiple perspectives',
        'Acknowledge uncertainties'
      ],
      responseFormat: `
**Research Analysis:**
1. Current Understanding
2. Key Findings
3. Uncertainties
4. Future Directions
`,
      thinkingTemplate: ENHANCED_THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 3,
      responseHandlers: {
        followUp: (context) => [
          'Can you provide more information on the research?',
          'How does this relate to other studies?',
          'What are the implications of the findings?'
        ],
        explain: (context) => 'Detailed explanation of the research...',
        examples: (context) => ['Example 1...', 'Example 2...'],
        newTopic: () => { /* Reset context */ },
        architectReview: (context) => ({
          review: {
            architecture: [],
            security: [],
            performance: []
          }
        })
      }
    }
  },
  
  RESEARCHER: {
    RESEARCH: {
      role: 'Deep Researcher',
      context: SPECIALIZED_PROMPTS.DEEP_RESEARCHER.ANALYSIS,
      guidelines: [
        ...COMMON_GUIDELINES,
        'Perform systematic research analysis',
        'Use meta-analysis techniques',
        'Evaluate source credibility',
        'Track research methodology',
        'Maintain citation standards'
      ],
      responseFormat: `
**Research Analysis:**
\`\`\`json
{
  "context": {
    "topic": "",
    "scope": "",
    "methodology": ""
  },
  "research": {
    "searchQueries": [],
    "sources": {
      "academic": [],
      "industry": [],
      "documentation": []
    },
    "findings": [],
    "analysis": "",
    "synthesis": "",
    "gaps": []
  },
  "quality": {
    "sourceCredibility": "HIGH" | "MEDIUM" | "LOW",
    "evidenceStrength": "HIGH" | "MEDIUM" | "LOW",
    "confidenceScore": number
  },
  "metadata": {
    "timestamp": "",
    "version": "",
    "researchMethod": ""
  }
}
\`\`\``,
      thinkingTemplate: ENHANCED_THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 5,
      responseHandlers: {
        followUp: (context) => [
          'What are the key research gaps?',
          'Can you explain the methodology in detail?',
          'How reliable are the sources?'
        ],
        explain: (context) => 'Detailed explanation of research findings...',
        examples: (context) => ['Research Example 1...', 'Research Example 2...'],
        newTopic: () => { /* Reset research context */ },
        architectReview: (context) => ({
          review: {
            methodology: [],
            findings: [],
            recommendations: []
          }
        })
      }
    },
    CODE: {
      role: 'Senior Software Engineer',
      context: 'You are implementing a technical solution',
      guidelines: [
        ...COMMON_GUIDELINES,
        'Follow best practices and design patterns',
        'Consider performance, security, and maintainability',
        'Include error handling and edge cases',
        'Provide clear documentation'
      ],
      responseFormat: `
**Implementation Details:**
\`\`\`json
{
  "solution": {
    "changes": [],
    "validation": "",
    "remaining_tasks": []
  }
}
\`\`\``,
      thinkingTemplate: ENHANCED_THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 5,
      responseHandlers: {
        followUp: (context) => [
          'Can you explain more about the implementation details?',
          'What are the potential edge cases?',
          'How can we optimize this solution?'
        ],
        explain: (context) => 'Detailed explanation of the implementation...',
        examples: (context) => ['Example 1...', 'Example 2...'],
        newTopic: () => { /* Reset context */ },
        architectReview: (context) => ({
          review: {
            architecture: [],
            security: [],
            performance: []
          }
        })
      }
    },
    EXPLANATION: {
      role: 'Technical Educator',
      context: 'You are explaining a complex concept',
      guidelines: [
        ...COMMON_GUIDELINES,
        'Break down complex ideas into simpler parts',
        'Use analogies when helpful',
        'Provide real-world examples',
        'Address common misconceptions'
      ],
      responseFormat: `
**Explanation:**
1. Key Concepts
2. Detailed Analysis
3. Examples
4. Implications
`,
      thinkingTemplate: ENHANCED_THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 5,
      responseHandlers: {
        followUp: (context) => [
          'Can you provide more examples?',
          'How does this relate to other concepts?',
          'What are the key takeaways?'
        ],
        explain: (context) => 'Detailed explanation of the concept...',
        examples: (context) => ['Example 1...', 'Example 2...'],
        newTopic: () => { /* Reset context */ },
        architectReview: (context) => ({
          review: {
            architecture: [],
            security: [],
            performance: []
          }
        })
      }
    }
  },
  
  CODER: {
    CODE: {
      role: 'Deep Coder',
      context: SPECIALIZED_PROMPTS.DEEP_CODER.ANALYSIS,
      guidelines: [
        ...COMMON_GUIDELINES,
        'Implement secure coding practices',
        'Follow SOLID principles',
        'Consider system architecture',
        'Maintain test coverage',
        'Document thoroughly'
      ],
      responseFormat: `
**Implementation Analysis:**
\`\`\`json
{
  "context": {
    "topic": "",
    "scope": "",
    "requirements": []
  },
  "analysis": {
    "architecture": {
      "patterns": [],
      "components": [],
      "interfaces": []
    },
    "security": {
      "vulnerabilities": [],
      "mitigations": [],
      "recommendations": []
    },
    "quality": {
      "metrics": {},
      "improvements": [],
      "risks": []
    }
  },
  "implementation": {
    "code": {
      "files": [],
      "changes": [],
      "tests": []
    },
    "documentation": {
      "setup": "",
      "usage": "",
      "api": ""
    }
  },
  "metadata": {
    "timestamp": "",
    "version": "",
    "reviewStatus": ""
  }
}
\`\`\``,
      thinkingTemplate: ENHANCED_THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 5,
      responseHandlers: {
        followUp: (context) => [
          'What are the security implications?',
          'Can you explain the architectural decisions?',
          'How can we improve performance?'
        ],
        explain: (context) => 'Detailed explanation of implementation...',
        examples: (context) => ['Code Example 1...', 'Code Example 2...'],
        newTopic: () => { /* Reset coding context */ },
        architectReview: (context) => ({
          review: {
            architecture: [],
            security: [],
            performance: [],
            maintenance: []
          }
        })
      }
    },
    EXPLANATION: {
      role: 'Technical Educator',
      context: 'You are explaining a complex concept',
      guidelines: [
        ...COMMON_GUIDELINES,
        'Break down complex ideas into simpler parts',
        'Use analogies when helpful',
        'Provide real-world examples',
        'Address common misconceptions'
      ],
      responseFormat: `
**Explanation:**
1. Key Concepts
2. Detailed Analysis
3. Examples
4. Implications
`,
      thinkingTemplate: ENHANCED_THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 5,
      responseHandlers: {
        followUp: (context) => [
          'Can you provide more examples?',
          'How does this relate to other concepts?',
          'What are the key takeaways?'
        ],
        explain: (context) => 'Detailed explanation of the concept...',
        examples: (context) => ['Example 1...', 'Example 2...'],
        newTopic: () => { /* Reset context */ },
        architectReview: (context) => ({
          review: {
            architecture: [],
            security: [],
            performance: []
          }
        })
      }
    },
    RESEARCH: {
      role: 'Research Analyst',
      context: 'You are analyzing current research and data',
      guidelines: [
        ...COMMON_GUIDELINES,
        'Cite reliable sources when possible',
        'Distinguish between facts and theories',
        'Consider multiple perspectives',
        'Acknowledge uncertainties'
      ],
      responseFormat: `
**Research Analysis:**
1. Current Understanding
2. Key Findings
3. Uncertainties
4. Future Directions
`,
      thinkingTemplate: ENHANCED_THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 5,
      responseHandlers: {
        followUp: (context) => [
          'Can you provide more information on the research?',
          'How does this relate to other studies?',
          'What are the implications of the findings?'
        ],
        explain: (context) => 'Detailed explanation of the research...',
        examples: (context) => ['Example 1...', 'Example 2...'],
        newTopic: () => { /* Reset context */ },
        architectReview: (context) => ({
          review: {
            architecture: [],
            security: [],
            performance: []
          }
        })
      }
    }
  }
};

// Helper functions for version tracking
export const createVersion = (changes: string[]): VersionInfo => ({
  version: generateVersionNumber(),
  timestamp: Date.now(),
  changes
});

const generateVersionNumber = (): string => {
  return `1.0.${Math.floor(Date.now() / 1000).toString(36)}`;
};