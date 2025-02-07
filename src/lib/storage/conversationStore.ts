import { InterfaceType, QueryType } from '../../../shared/prompts';
import { Message, ThoughtProcess } from '../../../shared/types';

interface ConversationEntry {
  id: string;
  timestamp: number;
  interfaceType: InterfaceType;
  queryType: QueryType;
  messages: Message[];
  thoughtProcess?: ThoughtProcess[];
  version: string;
  parentVersion?: string;
  metadata: {
    files?: Array<{ name: string; hash: string }>;
    context?: string;
    followUpCount: number;
    hasArchitectReview: boolean;
  };
}

interface StorageConfig {
  maxConversations: number;
  maxMessagesPerConversation: number;
  retentionPeriod: number; // in milliseconds
}

class ConversationStore {
  private storage: Map<InterfaceType, Map<string, ConversationEntry>>;
  private configs: Record<InterfaceType, StorageConfig>;

  constructor() {
    this.storage = new Map();
    
    // Initialize storage for each interface
    this.storage.set('GENERAL', new Map());
    this.storage.set('RESEARCHER', new Map());
    this.storage.set('CODER', new Map());
    
    // Configure storage settings for each interface
    this.configs = {
      GENERAL: {
        maxConversations: 50,
        maxMessagesPerConversation: 100,
        retentionPeriod: 7 * 24 * 60 * 60 * 1000 // 7 days
      },
      RESEARCHER: {
        maxConversations: 200,
        maxMessagesPerConversation: 500,
        retentionPeriod: 30 * 24 * 60 * 60 * 1000 // 30 days
      },
      CODER: {
        maxConversations: 100,
        maxMessagesPerConversation: 200,
        retentionPeriod: 14 * 24 * 60 * 60 * 1000 // 14 days
      }
    };

    // Load conversations from localStorage
    this.loadFromStorage();
    
    // Start cleanup interval
    setInterval(() => this.cleanup(), 60 * 60 * 1000); // Run every hour
  }

  private generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateVersion(): string {
    return `${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
  }

  private loadFromStorage(): void {
    try {
      for (const interfaceType of this.storage.keys()) {
        const key = `conversations_${interfaceType}`;
        const stored = localStorage.getItem(key);
        
        if (stored) {
          const conversations = JSON.parse(stored);
          this.storage.set(interfaceType, new Map(Object.entries(conversations)));
        }
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }

  private saveToStorage(): void {
    try {
      for (const [interfaceType, conversations] of this.storage.entries()) {
        const key = `conversations_${interfaceType}`;
        localStorage.setItem(key, JSON.stringify(Object.fromEntries(conversations)));
      }
    } catch (error) {
      console.error('Failed to save conversations:', error);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    
    for (const [interfaceType, conversations] of this.storage.entries()) {
      const config = this.configs[interfaceType];
      
      // Remove expired conversations
      for (const [id, conversation] of conversations.entries()) {
        if (now - conversation.timestamp > config.retentionPeriod) {
          conversations.delete(id);
        }
      }
      
      // Enforce max conversations limit
      if (conversations.size > config.maxConversations) {
        const sortedConversations = Array.from(conversations.entries())
          .sort(([, a], [, b]) => b.timestamp - a.timestamp);
        
        const toRemove = sortedConversations.slice(config.maxConversations);
        for (const [id] of toRemove) {
          conversations.delete(id);
        }
      }
    }
    
    // Save changes
    this.saveToStorage();
  }

  public createConversation(
    interfaceType: InterfaceType,
    queryType: QueryType,
    initialMessage: Message,
    files?: Array<{ name: string; content: string }>
  ): string {
    const id = this.generateId();
    const conversations = this.storage.get(interfaceType)!;
    
    const entry: ConversationEntry = {
      id,
      timestamp: Date.now(),
      interfaceType,
      queryType,
      messages: [initialMessage],
      version: this.generateVersion(),
      metadata: {
        files: files?.map(f => ({
          name: f.name,
          hash: this.hashContent(f.content)
        })),
        followUpCount: 0,
        hasArchitectReview: false
      }
    };
    
    conversations.set(id, entry);
    this.saveToStorage();
    
    return id;
  }

  public addMessage(
    interfaceType: InterfaceType,
    conversationId: string,
    message: Message,
    thoughtProcess?: ThoughtProcess[]
  ): void {
    const conversations = this.storage.get(interfaceType)!;
    const conversation = conversations.get(conversationId);
    
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    const config = this.configs[interfaceType];
    
    // Enforce message limit
    if (conversation.messages.length >= config.maxMessagesPerConversation) {
      conversation.messages = conversation.messages.slice(
        -config.maxMessagesPerConversation + 1
      );
    }
    
    conversation.messages.push(message);
    conversation.timestamp = Date.now();
    
    if (thoughtProcess) {
      conversation.thoughtProcess = thoughtProcess;
    }
    
    // Create new version
    conversation.parentVersion = conversation.version;
    conversation.version = this.generateVersion();
    
    this.saveToStorage();
  }

  public getConversation(
    interfaceType: InterfaceType,
    conversationId: string
  ): ConversationEntry | undefined {
    return this.storage.get(interfaceType)?.get(conversationId);
  }

  public getConversations(
    interfaceType: InterfaceType,
    limit?: number
  ): ConversationEntry[] {
    const conversations = Array.from(this.storage.get(interfaceType)?.values() || [])
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return limit ? conversations.slice(0, limit) : conversations;
  }

  public updateMetadata(
    interfaceType: InterfaceType,
    conversationId: string,
    updates: Partial<ConversationEntry['metadata']>
  ): void {
    const conversations = this.storage.get(interfaceType)!;
    const conversation = conversations.get(conversationId);
    
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    conversation.metadata = {
      ...conversation.metadata,
      ...updates
    };
    
    this.saveToStorage();
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

// Export singleton instance
export const conversationStore = new ConversationStore(); 