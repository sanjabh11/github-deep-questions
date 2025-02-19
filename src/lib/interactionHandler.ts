import { Message, ThoughtProcess } from "./types";
import { callArchitectLLM } from "./architect";
import { toast } from "@/hooks/use-toast";

export interface InteractionHandlerConfig {
  messages: Message[];
  thoughtProcess: ThoughtProcess[] | null;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setIsLoading: (loading: boolean) => void;
  setArchitectReview: (review: any) => void;
  loadApiKeys: () => { [key: string]: string };
  toast: typeof toast;
}

export class InteractionHandler {
  private config: InteractionHandlerConfig;
  
  constructor(config: InteractionHandlerConfig) {
    this.config = config;
  }

  public async handleOptionSelect(choice: number): Promise<void> {
    const { 
      messages, 
      thoughtProcess, 
      setMessages, 
      setIsLoading, 
      setArchitectReview,
      loadApiKeys,
      toast 
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
        setMessages(prev => [
          ...prev,
          {
            role: "system",
            type: "system",
            content: "What would you like to know more about?",
            timestamp: Date.now()
          }
        ]);
        break;

      case 2: // Explain reasoning
        if (thoughtProcess && thoughtProcess.length > 0) {
          const reasoning = thoughtProcess
            .map(t => `${t.type.toUpperCase()}: ${t.content}`)
            .join('\n\n');
          setMessages(prev => [
            ...prev,
            {
              role: "assistant",
              type: "reasoning",
              content: reasoning,
              timestamp: Date.now()
            }
          ]);
        } else {
          setMessages(prev => [
            ...prev,
            {
              role: "system",
              type: "system",
              content: "No detailed reasoning available for this response.",
              timestamp: Date.now()
            }
          ]);
        }
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
        try {
          const review = await callArchitectLLM(messages, apiKeys.gemini);
          if (review) {
            setArchitectReview(review);
            setMessages(prev => [
              ...prev,
              {
                role: "system",
                type: "system",
                content: "Architect review completed. Check the review panel for details.",
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
}
