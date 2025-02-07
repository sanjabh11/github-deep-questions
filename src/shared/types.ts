export interface Message {
  type: 'user' | 'system' | 'thinking' | 'answer' | 'reasoning';
  content: string;
  timestamp: number;
}

export interface ThoughtProcess {
  type: 'thinking' | 'planning' | 'analyzing' | 'solving';
  content: string;
  timestamp: number;
} 