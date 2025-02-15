export type MessageType = 'user' | 'system' | 'reasoning' | 'answer';

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

export interface ArchitectReview {
  criticalIssues: string[];
  potentialProblems: string[];
  improvements: string[];
  verdict: 'APPROVED' | 'NEEDS_REVISION' | 'REJECTED';
}

export interface ChatHistory {
  messages: Message[];
  thoughtProcesses: ThoughtProcess[];
  architectReviews: ArchitectReview[];
  lastUpdated: number;
} 