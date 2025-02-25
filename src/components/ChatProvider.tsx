import React, { useState, useEffect, useMemo } from 'react';
import { ChatContext } from '../hooks/useChatContext';
import { Message, ApiResponse, FollowUpQuestion, ApiKeys } from '../lib/types';
import ChatStorage from '../lib/storage/chatStorage';
import { GeminiService } from "@/lib/services/geminiService";
import { FollowUpService } from "@/lib/services/followUpService";
import { toast } from "@/components/ui/use-toast";
import { loadApiKeys } from '@/lib/api';
import { analytics } from '@/lib/analytics';

interface ChatProviderProps {
  children: React.ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<ApiResponse | null>(null);
  
  const geminiService = useMemo(() => GeminiService.getInstance(), []);
  const followUpService = useMemo(() => FollowUpService.getInstance(), []);

  // Load initial state from storage
  useEffect(() => {
    const savedMessages = ChatStorage.loadMessages();
    if (savedMessages.length > 0) {
      setMessages(savedMessages);
    }
  }, []);

  // Save messages to storage whenever they change
  useEffect(() => {
    ChatStorage.saveMessages(messages);
  }, [messages]);

  // Add function to process message content
  const processMessageContent = (content: string): string => {
    // Remove any potential truncation markers and clean up the content
    return content.replace(/----MESSAGE PARTIAL TRUNCATED/, '').trim();
  };

  const handleFollowUpSelect = async (question: FollowUpQuestion) => {
    try {
      setIsLoading(true);
      setError(null);

      // Track follow-up question selection
      analytics.trackFollowUpSelection(question);

      // Add the selected follow-up question as a user message
      const newUserMessage: Message = {
        role: "user",
        type: "user",
        content: question.question,
        timestamp: Date.now(),
        metadata: {
          version: lastResponse?.metadata?.version || '1.0.0',
          context: question.context,
          relevance: question.relevance
        }
      };

      setMessages(prev => [...prev, newUserMessage]);

      // Get API key
      const apiKeys: ApiKeys = loadApiKeys();
      if (!apiKeys?.deepseek) {
        throw new Error('DeepSeek API key is required');
      }

      // Get response from DeepSeek
      const response = await geminiService.generateContent(
        question.question,
        apiKeys.deepseek,
        [...messages, newUserMessage]
      );

      if (response.status === 'error' || !response.content) {
        throw new Error(response.error || 'Failed to get response');
      }

      // Process and add the AI's response
      const aiResponse: Message = {
        role: "assistant",
        type: "answer",
        content: processMessageContent(response.content),
        timestamp: Date.now(),
        metadata: {
          version: response.metadata?.version || '1.0.0'
        }
      };

      console.debug('Adding AI response:', aiResponse);
      setMessages(prev => [...prev, aiResponse]);
      setLastResponse({
        ...response,
        content: processMessageContent(response.content)
      });

    } catch (error) {
      console.error("Error handling follow-up question:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to process follow-up question";
      setError(errorMessage);
      
      // Track error
      if (error instanceof Error) {
        analytics.trackError(error, 'follow_up_question_handling');
      } else {
        analytics.trackError(new Error(errorMessage), 'follow_up_question_handling');
      }
      
      // Show error toast
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });

      // Add error message to chat
      setMessages(prev => [...prev, {
        role: "system",
        type: "system",
        content: `Error: ${errorMessage}`,
        timestamp: Date.now(),
        metadata: {
          version: lastResponse?.metadata?.version || '1.0.0'
        }
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Update the setMessages wrapper to process content and ensure proper message structure
  const handleSetMessages = (
    messagesOrUpdater: Message[] | ((prev: Message[]) => Message[])
  ) => {
    if (typeof messagesOrUpdater === 'function') {
      setMessages(prev => {
        const newMessages = messagesOrUpdater(prev);
        return newMessages.map(msg => ({
          ...msg,
          role: msg.role || (msg.type === 'user' ? 'user' : 'assistant'),
          type: msg.type || (msg.role === 'user' ? 'user' : 'answer'),
          content: processMessageContent(msg.content),
          timestamp: msg.timestamp || Date.now()
        }));
      });
    } else {
      setMessages(
        messagesOrUpdater.map(msg => ({
          ...msg,
          role: msg.role || (msg.type === 'user' ? 'user' : 'assistant'),
          type: msg.type || (msg.role === 'user' ? 'user' : 'answer'),
          content: processMessageContent(msg.content),
          timestamp: msg.timestamp || Date.now()
        }))
      );
    }
  };

  const clearConversation = () => {
    analytics.trackConversationReset();
    setMessages([]);
    setLastResponse(null);
    setError(null);
    followUpService.clearCache();
    ChatStorage.resetConversation();
  };

  const contextValue = {
    messages,
    setMessages: handleSetMessages,
    isLoading,
    setIsLoading,
    error,
    setError,
    lastResponse,
    setLastResponse,
    handleFollowUpSelect,
    clearConversation
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}
