import { ChatMode, FileUpload, Message } from './types';
import { ArchitectReview } from './architect';

// Interface and storage types
export type InterfaceType = 'GENERAL' | 'RESEARCHER' | 'CODER';

export interface ContextState {
  currentTopic: string;
  messages: Message[];
  previousResponses: Array<{
    type: string;
    response: any;
    timestamp: number;
  }>;
  followUpQuestions: string[];
  exampleRequests: string[];
  architectReviews: ArchitectReview[];
}

export interface StorageConfig {
  storageKey: string;
  maxHistoryItems: number;
  version: string;
}

// Storage configurations for each interface
const STORAGE_CONFIGS: Record<InterfaceType, StorageConfig> = {
  GENERAL: {
    storageKey: 'general_assistant_storage',
    maxHistoryItems: 50,
    version: '1.0.0'
  },
  RESEARCHER: {
    storageKey: 'deep_researcher_storage',
    maxHistoryItems: 100,
    version: '1.0.0'
  },
  CODER: {
    storageKey: 'deep_coder_storage',
    maxHistoryItems: 75,
    version: '1.0.0'
  }
};

// Enhanced thinking template with research and architectural review capabilities
export const ENHANCED_THINKING_TEMPLATE = {
  reasoning: {
    research: {
      methodology: [
        'Source evaluation',
        'Data collection',
        'Analysis approach'
      ],
      validation: [
        'Credibility check',
        'Cross-reference',
        'Peer review'
      ]
    },
    architecture: {
      design: [
        'System components',
        'Integration points',
        'Data flow'
      ],
      review: [
        'Performance impact',
        'Security considerations',
        'Scalability assessment'
      ]
    }
  },
  implementation: {
    code: {
      quality: [
        'Best practices',
        'Design patterns',
        'Error handling'
      ],
      security: [
        'Input validation',
        'Authentication',
        'Authorization'
      ]
    },
    documentation: {
      technical: [
        'API documentation',
        'Setup guides',
        'Usage examples'
      ],
      user: [
        'User guides',
        'FAQs',
        'Troubleshooting'
      ]
    }
  }
};

// Interface-specific storage management
export class InterfaceStorage {
  private config: StorageConfig;
  private storageKey: string;

  constructor(interfaceType: InterfaceType) {
    this.config = STORAGE_CONFIGS[interfaceType];
    this.storageKey = this.config.storageKey;
  }

  async saveContext(context: ContextState): Promise<void> {
    try {
      const currentHistory = await this.loadContext();
      
      // Update messages
      currentHistory.messages = [...currentHistory.messages, ...context.messages];
      
      // Update previous responses
      if (context.previousResponses.length > 0) {
        currentHistory.previousResponses = [
          ...currentHistory.previousResponses,
          context.previousResponses[context.previousResponses.length - 1]
        ];
      }

      // Update other state
      currentHistory.currentTopic = context.currentTopic;
      currentHistory.followUpQuestions = context.followUpQuestions;
      currentHistory.exampleRequests = context.exampleRequests;
      currentHistory.architectReviews = context.architectReviews;

      // Maintain history limits
      if (currentHistory.previousResponses.length > this.config.maxHistoryItems) {
        currentHistory.previousResponses = currentHistory.previousResponses.slice(-this.config.maxHistoryItems);
      }
      if (currentHistory.messages.length > this.config.maxHistoryItems * 2) {
        currentHistory.messages = currentHistory.messages.slice(-this.config.maxHistoryItems * 2);
      }

      localStorage.setItem(this.storageKey, JSON.stringify(currentHistory));
    } catch (error) {
      console.error('Failed to save context:', error);
      throw error;
    }
  }

  async loadContext(): Promise<ContextState> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return this.getInitialContext();
      }
      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to load context:', error);
      return this.getInitialContext();
    }
  }

  async clearContext(): Promise<void> {
    localStorage.removeItem(this.storageKey);
  }

  private getInitialContext(): ContextState {
    return {
      currentTopic: '',
      messages: [],
      previousResponses: [],
      followUpQuestions: [],
      exampleRequests: [],
      architectReviews: []
    };
  }
}

// Export interface-specific storage instances
export const generalStorage = new InterfaceStorage('GENERAL');
export const researcherStorage = new InterfaceStorage('RESEARCHER');
export const coderStorage = new InterfaceStorage('CODER');

// Original file storage functions
const CHAT_MODE_KEY = 'chat_mode';
const TEMP_FILES_KEY = 'temp_files';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const saveChatMode = (mode: ChatMode) => {
  localStorage.setItem(CHAT_MODE_KEY, mode);
};

export const loadChatMode = (): ChatMode => {
  return (localStorage.getItem(CHAT_MODE_KEY) as ChatMode) || 'default';
};

export const saveTemporaryFile = async (file: File): Promise<FileUpload | null> => {
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

        const files = await loadTemporaryFiles();
        files.push(fileUpload);
        
        // Only keep last 5 files
        if (files.length > 5) {
          files.shift();
        }

        localStorage.setItem(TEMP_FILES_KEY, JSON.stringify(files));
        resolve(fileUpload);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export const loadTemporaryFiles = async (): Promise<FileUpload[]> => {
  const stored = localStorage.getItem(TEMP_FILES_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const clearTemporaryFiles = () => {
  localStorage.removeItem(TEMP_FILES_KEY);
};