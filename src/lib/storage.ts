import { Message, ChatHistory, ThoughtProcess, ArchitectReview } from '../../api/types/messages.js';

const STORAGE_KEYS = {
  CHAT_MODE: 'chat_mode',
  CHAT_HISTORY: 'chat_history',
  USER_PREFERENCES: 'user_preferences',
  TEMP_FILES: 'temp_files'
} as const;

export type ChatMode = 'general' | 'researcher' | 'coder';

export interface UserPreferences {
  audioEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
}

export interface FileUpload {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string | ArrayBuffer;
}

const MAX_HISTORY_ITEMS = 50;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Helper function to safely parse JSON with a default value
const safeJSONParse = <T>(str: string | null, defaultValue: T): T => {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
};

// Individual exports for backward compatibility
export const saveChatMode = (mode: ChatMode): void => storage.saveChatMode(mode);
export const loadChatMode = (): ChatMode => storage.loadChatMode();
export const saveTemporaryFile = async (file: File): Promise<FileUpload | null> => storage.saveTemporaryFile(file);
export const loadTemporaryFiles = async (): Promise<FileUpload[]> => storage.loadTemporaryFiles();
export const clearTemporaryFiles = (): void => storage.clearTemporaryFiles();

// Main storage object
export const storage = {
  // Chat Mode
  saveChatMode(mode: ChatMode): void {
    localStorage.setItem(STORAGE_KEYS.CHAT_MODE, mode);
  },

  loadChatMode(): ChatMode {
    return (localStorage.getItem(STORAGE_KEYS.CHAT_MODE) as ChatMode) || 'general';
  },

  // Chat History
  async saveChatHistory(history: ChatHistory): Promise<void> {
    try {
      // Trim history to prevent localStorage from getting too large
      const trimmedHistory: ChatHistory = {
        ...history,
        messages: history.messages.slice(-MAX_HISTORY_ITEMS),
        thoughtProcesses: history.thoughtProcesses.slice(-MAX_HISTORY_ITEMS),
        architectReviews: history.architectReviews.slice(-MAX_HISTORY_ITEMS)
      };

      localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(trimmedHistory));
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  },

  loadChatHistory(): ChatHistory {
    const defaultHistory: ChatHistory = {
      messages: [],
      thoughtProcesses: [],
      architectReviews: [],
      lastUpdated: Date.now()
    };

    return safeJSONParse(
      localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY),
      defaultHistory
    );
  },

  // User Preferences
  saveUserPreferences(prefs: UserPreferences): void {
    localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(prefs));
  },

  loadUserPreferences(): UserPreferences {
    const defaultPrefs: UserPreferences = {
      audioEnabled: false,
      theme: 'system',
      fontSize: 'medium'
    };

    return safeJSONParse(
      localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES),
      defaultPrefs
    );
  },

  // Temporary File Handling
  async saveTemporaryFile(file: File): Promise<FileUpload | null> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 10MB limit');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const fileUpload: FileUpload = {
            id: crypto.randomUUID(),
            name: file.name,
            type: file.type,
            size: file.size,
            content: e.target?.result || ''
          };

          const files = await this.loadTemporaryFiles();
          files.push(fileUpload);
          
          // Only keep last 5 files
          if (files.length > 5) {
            files.shift();
          }

          localStorage.setItem(STORAGE_KEYS.TEMP_FILES, JSON.stringify(files));
          resolve(fileUpload);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  },

  async loadTemporaryFiles(): Promise<FileUpload[]> {
    return safeJSONParse(localStorage.getItem(STORAGE_KEYS.TEMP_FILES), []);
  },

  clearTemporaryFiles(): void {
    localStorage.removeItem(STORAGE_KEYS.TEMP_FILES);
  },

  async saveTemporaryFiles(files: FileUpload[]): Promise<void> {
    try {
      // Only keep last 5 files
      const trimmedFiles = files.slice(-5);
      localStorage.setItem(STORAGE_KEYS.TEMP_FILES, JSON.stringify(trimmedFiles));
    } catch (error) {
      console.error('Failed to save temporary files:', error);
      throw error;
    }
  },

  // Clear all storage
  clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
};