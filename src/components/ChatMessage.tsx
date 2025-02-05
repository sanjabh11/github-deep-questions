import { cn } from "@/lib/utils";
import { Message } from "@/lib/types";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { role, content } = message;

  const renderContent = () => {
    if (typeof content !== 'string') {
      return 'Invalid message content';
    }

    // Split content by newlines and handle code blocks
    return content.split('\n').map((line, i) => (
      <div key={i} className="whitespace-pre-wrap">
        {line}
      </div>
    ));
  };

  return (
    <div
      className={cn(
        "p-4 rounded-lg mb-4 message-enter",
        role === "user" && "bg-secondary text-foreground",
        role === "assistant" && "bg-secondary/50 text-foreground",
        role === "system" && "bg-destructive/10 text-destructive"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {role}
        </span>
        {message.timestamp && (
          <span className="text-xs text-muted-foreground">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {renderContent()}
      </div>
    </div>
  );
}