import { Message, ApiResponse } from '../types';
import ChatStorage from '../storage/chatStorage';

interface VersionEntry {
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

const VERSION_STORAGE_KEY = 'chat_versions';

class ChatVersionManager {
  private versions: Map<string, VersionEntry>;
  private currentVersion: string;

  constructor() {
    this.versions = new Map();
    this.currentVersion = '1.0.0';
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(VERSION_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.versions = new Map(Object.entries(data.versions));
        this.currentVersion = data.currentVersion;
      }
    } catch (error) {
      console.error('Failed to load versions:', error);
    }
  }

  private saveToStorage(): void {
    try {
      const data = {
        versions: Object.fromEntries(this.versions),
        currentVersion: this.currentVersion
      };
      localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save versions:', error);
    }
  }

  createVersion(description: string, component: string, type: VersionEntry['metadata']['type']): string {
    const messages = ChatStorage.loadMessages();
    const lastResponse = ChatStorage.loadLastResponse();
    
    // Increment version number
    const [major, minor, patch] = this.currentVersion.split('.').map(Number);
    this.currentVersion = `${major}.${minor}.${patch + 1}`;

    const entry: VersionEntry = {
      version: this.currentVersion,
      timestamp: Date.now(),
      messages,
      lastResponse,
      metadata: {
        description,
        component,
        type
      }
    };

    this.versions.set(this.currentVersion, entry);
    this.saveToStorage();
    return this.currentVersion;
  }

  revertToVersion(version: string): boolean {
    const entry = this.versions.get(version);
    if (!entry) {
      console.error(`Version ${version} not found`);
      return false;
    }

    try {
      ChatStorage.saveMessages(entry.messages);
      ChatStorage.saveLastResponse(entry.lastResponse);
      this.currentVersion = version;
      this.saveToStorage();
      return true;
    } catch (error) {
      console.error('Failed to revert version:', error);
      return false;
    }
  }

  getCurrentVersion(): string {
    return this.currentVersion;
  }

  getVersionHistory(): VersionEntry[] {
    return Array.from(this.versions.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getVersion(version: string): VersionEntry | undefined {
    return this.versions.get(version);
  }
}

export const versionManager = new ChatVersionManager();
