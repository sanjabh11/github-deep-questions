import { Message, ThoughtProcess, FollowUpQuestion, ApiResponse } from '@/lib/types';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { InteractionOptions } from './InteractionOptions';
import { ThoughtProcessDisplay } from './ThoughtProcess';
import { ChatComponent } from './ChatComponent';

interface ChatProps {
  messages: Message[];
  thoughtProcess: ThoughtProcess[] | null;
  isLoading: boolean;
  onOptionSelect: (choice: number) => void;
  onSendMessage?: (message: string) => void;
  onFollowUpSelect: (question: FollowUpQuestion) => void;
  lastResponse: ApiResponse | null;
}

export function Chat({
  messages,
  thoughtProcess,
  isLoading,
  onOptionSelect,
  onSendMessage,
  onFollowUpSelect,
  lastResponse
}: ChatProps) {
  const handleFollowUpSelect = (question: string) => {
    onFollowUpSelect({
      id: Date.now().toString(),
      question,
      relevance: 1,
      context: 'User selected follow-up question'
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {thoughtProcess && thoughtProcess.map((thought, index) => (
          <ThoughtProcessDisplay key={index} thought={thought} />
        ))}

        {messages.map((message, index) => (
          <ChatMessage 
            key={index} 
            message={message} 
            onFollowUpSelect={handleFollowUpSelect}
          />
        ))}
      </div>

      <div className="p-4 border-t">
        <div className="space-y-4">
          <ChatInput
            onSend={onSendMessage}
            disabled={isLoading}
          />

          <InteractionOptions
            onSelect={onOptionSelect}
            onFollowUpSelect={onFollowUpSelect}
            disabled={isLoading || messages.length === 0}
            messages={messages}
            lastResponse={lastResponse}
          />
        </div>
      </div>
    </div>
  );
}