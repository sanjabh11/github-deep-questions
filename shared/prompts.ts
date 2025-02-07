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

// Interface-specific configurations
export const INTERFACE_CONFIGS: Record<InterfaceType, Record<QueryType, PromptConfig>> = {
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
  "explanation": "",
  "code": "",
  "nextSteps": []
}
\`\`\``,
      thinkingTemplate: THINKING_TEMPLATE,
      versionTracking: false,
      allowsFileAttachments: true,
      maxIterations: 3
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
      thinkingTemplate: THINKING_TEMPLATE,
      versionTracking: false,
      allowsFileAttachments: true,
      maxIterations: 3
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
      thinkingTemplate: THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 4
    }
  },
  
  RESEARCHER: {
    RESEARCH: {
      role: 'Deep Researcher',
      context: SPECIALIZED_PROMPTS.DEEP_RESEARCHER.ANALYSIS,
      guidelines: [
        ...COMMON_GUIDELINES,
        'Analyze multiple sources',
        'Consider historical context',
        'Evaluate future implications',
        'Validate information accuracy',
        'Provide comprehensive citations'
      ],
      responseFormat: `
**Research Analysis:**
\`\`\`json
{
  "searchQueries": [],
  "findings": [],
  "analysis": "",
  "implications": [],
  "sources": [],
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "nextSteps": []
}
\`\`\``,
      thinkingTemplate: THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 5
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
      thinkingTemplate: THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 5
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
      thinkingTemplate: THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 5
    }
  },
  
  CODER: {
    CODE: {
      role: 'Deep Coder',
      context: SPECIALIZED_PROMPTS.DEEP_CODER.ANALYSIS,
      guidelines: [
        ...COMMON_GUIDELINES,
        'Optimize for performance',
        'Ensure security best practices',
        'Consider scalability',
        'Follow test-driven development',
        'Document thoroughly'
      ],
      responseFormat: `
**Implementation Analysis:**
\`\`\`json
{
  "analysis": {
    "structure": [],
    "quality": [],
    "security": [],
    "performance": [],
    "bestPractices": []
  },
  "improvements": [],
  "priority": "HIGH" | "MEDIUM" | "LOW",
  "solution": {
    "code": "",
    "tests": [],
    "documentation": "",
    "version": ""
  }
}
\`\`\``,
      thinkingTemplate: THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 5
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
      thinkingTemplate: THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 5
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
      thinkingTemplate: THINKING_TEMPLATE,
      versionTracking: true,
      allowsFileAttachments: true,
      maxIterations: 5
    }
  }
};

export const ARCHITECT_REVIEW_CONFIG = {
  role: 'Technical Architect',
  context: 'You are reviewing technical implementations',
  guidelines: [
    'Evaluate architecture and design',
    'Check for potential issues',
    'Suggest improvements',
    'Track version history',
  ],
  responseFormat: `
**Review:**
\`\`\`json
{
  "review": {
    "criticalIssues": [],
    "potentialProblems": [],
    "improvements": [],
    "versionAnalysis": {}
  }
}
\`\`\``,
  thinkingTemplate: THINKING_TEMPLATE,
  versionTracking: true,
  allowsFileAttachments: true,
  maxIterations: 3
};

// Add specialized review configurations
export const REVIEW_CONFIGS = {
  CODE_REVIEW: {
    ...ARCHITECT_REVIEW_CONFIG,
    context: SPECIALIZED_PROMPTS.DEEP_CODER.ANALYSIS,
    responseFormat: `
**Code Review:**
\`\`\`json
{
  "review": {
    "criticalIssues": [],
    "potentialProblems": [],
    "improvements": [],
    "versionAnalysis": {},
    "securityConcerns": [],
    "performanceImpact": "HIGH" | "MEDIUM" | "LOW"
  }
}
\`\`\``,
  },
  
  RESEARCH_REVIEW: {
    ...ARCHITECT_REVIEW_CONFIG,
    context: SPECIALIZED_PROMPTS.DEEP_RESEARCHER.ANALYSIS,
    responseFormat: `
**Research Review:**
\`\`\`json
{
  "review": {
    "methodologyAssessment": [],
    "dataQuality": [],
    "findingsValidity": [],
    "limitations": [],
    "suggestedImprovements": []
  }
}
\`\`\``,
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