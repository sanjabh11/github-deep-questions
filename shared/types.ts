export interface FileUpload {
  name: string;
  content: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
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

export enum InterfaceType {
  GENERAL = 'GENERAL',
  RESEARCHER = 'RESEARCHER',
  CODER = 'CODER',
  GENERAL_WITH_EXPLANATION = 'GENERAL_WITH_EXPLANATION',
  DEEP_RESEARCHER = 'DEEP_RESEARCHER',
  CODE_GENERATION = 'CODE_GENERATION'
}

export enum QueryType {
  CODE = 'CODE',
  EXPLANATION = 'EXPLANATION',
  RESEARCH = 'RESEARCH'
}

export interface ProcessRequest {
  query: string;
  interfaceType: InterfaceType;
  queryType: QueryType;
  files?: Array<{ 
    name: string; 
    content: string 
  }>;
  messages?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface BaseResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface StreamEvent {
  type: 'thinking' | 'progress' | 'complete' | 'error';
  thought?: string;
  progress?: string;
  error?: string;
  data?: any;
  content?: string;
} 