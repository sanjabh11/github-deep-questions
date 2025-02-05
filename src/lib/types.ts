export type ChatMode = 'default' | 'researcher' | 'coder';

export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageType = "user" | "reasoning" | "answer" | "system";

export interface Message {
  role: MessageRole;
  type: MessageType;
  content: string;
  timestamp?: number;
}

export interface FileUpload {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string | ArrayBuffer;
}

export interface ChatState {
  mode: ChatMode;
  isProcessing: boolean;
  currentOperation?: AbortController;
  messages: Message[];
  uploadedFiles: FileUpload[];
}

export interface ApiKeys {
  deepseek?: string;
  elevenlabs?: string;
  gemini?: string;
  serpapi?: string;
  jina?: string;
  openrouter?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export interface ApiKeyValidation {
  isValid: boolean;
  error?: string;
}