import { Message, ApiResponse, ThoughtProcess } from './types';
import { callDeepSeek } from './api';
import { callArchitectLLM } from './architect';
import ChatStorage from './storage/chatStorage';
import { versionManager } from './version/chatVersionManager';
import { GeminiService } from './services/geminiService';
import { FollowUpService } from './services/followUpService';
import { toast } from "@/hooks/use-toast";
import { ArchitectReviewer, ArchitectReview } from './architectReviewer';

interface Handler {
  execute: (lastResponse: ApiResponse | null, messages: Message[]) => Promise<ApiResponse>;
  validate: (lastResponse: ApiResponse | null) => void;
  description: string;
}

class HandlerRegistry {
  private handlers: Map<string, Handler> = new Map();

  register(id: string, handler: Handler) {
    this.handlers.set(id, handler);
  }

  async execute(id: string, lastResponse: ApiResponse | null, messages: Message[]): Promise<ApiResponse> {
    const handler = this.handlers.get(id);
    if (!handler) {
      return {
        success: false,
        status: 'error',
        error: `No handler registered for option: ${id}`
      };
    }
    
    try {
      handler.validate(lastResponse);
      return await handler.execute(lastResponse, messages);
    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

const registry = new HandlerRegistry();

// Follow-up Question Handler
registry.register('followUp', {
  description: 'Generate dynamic follow-up questions based on conversation context',
  validate: (lastResponse) => {
    // Remove validation since we now handle empty lastResponse in the component
  },
  execute: async (lastResponse, messages) => {
    if (messages.length === 0) {
      return {
        success: false,
        status: 'error',
        error: 'No conversation history to generate follow-up questions'
      };
    }

    const followUpService = FollowUpService.getInstance();
    const apiKey = ChatStorage.getApiKey('deepseek');
    
    if (!apiKey) {
      return {
        success: false,
        status: 'error',
        error: 'DeepSeek API key is required for follow-up questions'
      };
    }

    try {
      const response = await followUpService.generateFollowUpQuestions(apiKey, messages);
      
      // Add analytics tracking
      if (window.gtag) {
        window.gtag('event', 'generate_followup', {
          'event_category': 'interaction',
          'event_label': 'follow_up_questions',
          'value': response.data?.followUpQuestions?.length || 0
        });
      }

      return response;
    } catch (error) {
      console.error('Error in follow-up handler:', error);
      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to generate follow-up questions'
      };
    }
  }
});

// Explain Reasoning Handler
registry.register('explain', {
  description: 'Generate detailed explanation of previous response',
  validate: (lastResponse) => {
    if (!lastResponse?.data?.thoughtProcess) throw new Error('No reasoning available to explain');
  },
  execute: async (lastResponse, messages) => {
    const apiKey = ChatStorage.getApiKey('deepseek');
    if (!apiKey) {
      return {
        success: false,
        status: 'error',
        error: 'DeepSeek API key is required'
      };
    }

    const response = await callDeepSeek(
      `Explain the reasoning behind: ${lastResponse!.data!.content}`,
      apiKey,
      messages
    );

    return {
      success: true,
      status: 'complete',
      data: {
        content: response.content,
        reasoning: response.content
      }
    };
  }
});

// Examples Handler
registry.register('examples', {
  description: 'Generate examples based on previous response',
  validate: (lastResponse) => {
    if (!lastResponse) throw new Error('No context available for examples');
  },
  execute: async (lastResponse, messages) => {
    const apiKey = ChatStorage.getApiKey('deepseek');
    if (!apiKey) {
      return {
        success: false,
        status: 'error',
        error: 'DeepSeek API key is required'
      };
    }

    const response = await callDeepSeek(
      `Generate practical examples for: ${lastResponse.data?.content}`,
      apiKey,
      messages
    );

    return {
      success: true,
      status: 'complete',
      data: {
        content: response.content,
        examples: response.content
      }
    };
  }
});

// New Topic Handler
registry.register('newTopic', {
  description: 'Reset conversation for new topic',
  validate: () => {}, // No validation needed
  execute: async () => {
    ChatStorage.resetConversation();
    return {
      success: true,
      status: 'complete',
      data: {
        content: 'Conversation reset for new topic'
      }
    };
  }
});

// Architect Review Handler
registry.register('architectReview', {
  description: 'Request architect review of solution',
  validate: (lastResponse) => {
    if (!lastResponse) throw new Error('No solution available for architect review');
  },
  execute: async (lastResponse, messages) => {
    const apiKey = ChatStorage.getApiKey('gemini');
    if (!apiKey) {
      return {
        success: false,
        status: 'error',
        error: 'Gemini API key is required for architect review'
      };
    }

    const review = await callArchitectLLM(messages, apiKey);
    return {
      success: true,
      status: 'complete',
      data: {
        content: 'Architect review completed',
        review
      }
    };
  }
});

export const handleInteractionOption = (
  optionId: string,
  lastResponse: ApiResponse | null,
  messages: Message[]
): Promise<ApiResponse> => {
  return registry.execute(optionId, lastResponse, messages);
};

export interface InteractionHandlerConfig {
  messages: Message[];
  thoughtProcess: ThoughtProcess[] | null;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setIsLoading: (loading: boolean) => void;
  setArchitectReview: (review: ArchitectReview | null) => void;
  loadApiKeys: () => { [key: string]: string };
  toast: typeof toast;
  apiKey: string;
}

export class InteractionHandler {
  private config: InteractionHandlerConfig;
  private architectReviewer: ArchitectReviewer;

  constructor(config: InteractionHandlerConfig) {
    this.config = config;
    this.architectReviewer = new ArchitectReviewer();
  }

  public async handleOptionSelect(choice: number): Promise<void> {
    const {
      messages,
      thoughtProcess,
      setMessages,
      setIsLoading,
      setArchitectReview,
      loadApiKeys,
      toast,
      apiKey
    } = this.config;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No previous message found",
      });
      return;
    }

    switch (choice) {
      case 1: // Ask follow-up question
        setIsLoading(true);
        try {
          // ... existing follow-up question logic ...
        } finally {
          setIsLoading(false);
        }
        break;

      case 2: // Explain reasoning
        // ... existing explain reasoning logic ...
        break;

      case 5: // Architect review
        const apiKeys = loadApiKeys();
        if (!apiKeys.gemini) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Gemini API key is required for architect review",
          });
          return;
        }

        setIsLoading(true);
        setArchitectReview(null); // Clear previous review
        try {
          const review = await this.architectReviewer.review(messages, apiKeys.gemini);
          
          if (review) {
            setArchitectReview(review);
            setMessages(prev => [
              ...prev,
              {
                role: "system",
                type: "system",
                content: `Architect review completed (Version ${review.version}). ${review.verdict === 'APPROVED' ? '✅' : '⚠️'} Check the review panel for details.`,
                timestamp: Date.now()
              }
            ]);
          }
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to get architect review",
          });
        } finally {
          setIsLoading(false);
        }
        break;
    }
  }

  public async revertToVersion(version: string): Promise<void> {
    const {
      setArchitectReview,
      setMessages,
      toast
    } = this.config;

    try {
      const review = await this.architectReviewer.revertToVersion(version);
      if (review) {
        setArchitectReview(review);
        setMessages(prev => [
          ...prev,
          {
            role: "system",
            type: "system",
            content: `Reverted to architect review version ${version}`,
            timestamp: Date.now()
          }
        ]);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: `Version ${version} not found`,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to revert to previous version",
      });
    }
  }
}
