import { Message, ApiResponse } from './chat';

export interface VersionEntry {
  version: string;
  timestamp: number;
  messages: Message[];
  lastResponse: ApiResponse | null;
  metadata: {
    description: string;
    component: string;
    type: 'interaction' | 'message' | 'system';
  };
}

export interface VersionHistory {
  versions: Map<string, VersionEntry>;
  currentVersion: string;
}

export interface VersionMetadata {
  description: string;
  component: string;
  type: VersionEntry['metadata']['type'];
}
