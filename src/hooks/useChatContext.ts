import { createContext, useContext } from 'react';
import { Message, ApiResponse, FollowUpQuestion } from '@/lib/types';

interface ChatContextType {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  lastResponse: ApiResponse | null;
  setLastResponse: React.Dispatch<React.SetStateAction<ApiResponse | null>>;
  handleFollowUpSelect: (question: FollowUpQuestion) => Promise<void>;
  clearConversation: () => void;
}

export const ChatContext = createContext<ChatContextType>({
  messages: [],
  setMessages: () => {},
  isLoading: false,
  setIsLoading: () => {},
  error: null,
  setError: () => {},
  lastResponse: null,
  setLastResponse: () => {},
  handleFollowUpSelect: async () => {},
  clearConversation: () => {}
});

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};
