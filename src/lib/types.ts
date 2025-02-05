export type ChatMode = 'default' | 'researcher' | 'coder';

export interface FileUpload {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string | ArrayBuffer;
}

export interface ChatState {
  mode: ChatMode;
  isProcessing: boolean;
  currentOperation?: AbortController;
  uploadedFiles: FileUpload[];
}