import { Message, ApiResponse, ThoughtProcess } from '../types';

const STORAGE_KEYS = {
  MESSAGES: 'chat_messages',
  LAST_RESPONSE: 'last_response',
  API_KEYS: 'api_keys',
  CHAT_MODE: 'chat_mode'
} as const;

class ChatStorage {
  static saveMessages(messages: Message[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to save messages:', error);
    }
  }

  static loadMessages(): Message[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      if (!stored) return [];
      const messages = JSON.parse(stored);
      return Array.isArray(messages) ? messages : [];
    } catch (error) {
      console.error('Failed to load messages:', error);
      return [];
    }
  }

  static saveLastResponse(response: ApiResponse | null): void {
    try {
      if (response) {
        localStorage.setItem(STORAGE_KEYS.LAST_RESPONSE, JSON.stringify(response));
      } else {
        localStorage.removeItem(STORAGE_KEYS.LAST_RESPONSE);
      }
    } catch (error) {
      console.error('Failed to save last response:', error);
    }
  }

  static loadLastResponse(): ApiResponse | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LAST_RESPONSE);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to load last response:', error);
      return null;
    }
  }

  static saveApiKeys(keys: Record<string, string>): void {
    try {
      localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(keys));
    } catch (error) {
      console.error('Failed to save API keys:', error);
    }
  }

  static loadApiKeys(): Record<string, string> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.API_KEYS);
      if (!stored) return {};
      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to load API keys:', error);
      return {};
    }
  }

  static resetConversation(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.LAST_RESPONSE);
    } catch (error) {
      console.error('Failed to reset conversation:', error);
    }
  }

  static getApiKey(service: 'deepseek' | 'gemini'): string | null {
    const keys = this.loadApiKeys();
    return keys[service] || null;
  }
}

export default ChatStorage;
