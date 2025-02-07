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

// Interface-specific configurations
export const INTERFACE_CONFIGS: Record<InterfaceType, Record<QueryType, PromptConfig>> = {
  GENERAL: {
    CODE: {
      role: 'General Assistant',
      context: 'You are providing general coding assistance',
      guidelines: [
        ...COMMON_GUIDELINES,
        'Focus on clarity and explanation',
        'Provide step-by-step guidance',
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
      context: 'You are conducting in-depth technical research',
      guidelines: [
        ...COMMON_GUIDELINES,
        'Analyze multiple sources',
        'Consider historical context',
        'Evaluate future implications',
      ],
      responseFormat: `
**Research Analysis:**
\`\`\`json
{
  "findings": [],
  "analysis": "",
  "implications": [],
  "sources": []
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
      context: 'You are implementing complex technical solutions',
      guidelines: [
        ...COMMON_GUIDELINES,
        'Optimize for performance',
        'Ensure security best practices',
        'Consider scalability',
      ],
      responseFormat: `
**Implementation:**
\`\`\`json
{
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

// Helper functions for version tracking
export const createVersion = (changes: string[]): VersionInfo => ({
  version: generateVersionNumber(),
  timestamp: Date.now(),
  changes
});

const generateVersionNumber = (): string => {
  return `1.0.${Math.floor(Date.now() / 1000).toString(36)}`;
};