export interface FileUpload {
  name: string;
  content: string;
}

export interface Message {
  type: 'user' | 'system' | 'thinking' | 'answer';
  content: string;
  timestamp?: number;
}

export interface ThoughtProcess {
  type: 'thinking' | 'planning' | 'analyzing' | 'solving';
  content: string;
  timestamp: number;
}

export interface ApiResponse {
  success: boolean;
  data?: {
    content?: string;
    reasoning?: string;
    thoughtProcess?: ThoughtProcess[];
    messages?: Message[];
    config?: any;
  };
  error?: string;
}

export interface VersionInfo {
  version: string;
  timestamp: number;
  changes: string[];
}

export interface ReviewResult {
  criticalIssues: string[];
  potentialProblems: string[];
  improvements: string[];
  versionAnalysis?: Record<string, any>;
  securityConcerns?: string[];
  performanceImpact?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ResearchContext {
  source: string;
  content: string;
  confidence?: number;
  relevance?: number;
} 