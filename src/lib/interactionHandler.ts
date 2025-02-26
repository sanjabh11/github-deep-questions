import { Message } from "./types";
import { ThoughtProcess, ApiResponse } from "./api";
import { callArchitectLLM } from "./architect";
import { toast } from "@/hooks/use-toast";
import { FollowUpService } from "./services/followUpService";
import { ExamplesService } from "./services/examplesService";
import { callDeepSeek } from "./api";

export interface InteractionHandlerConfig {
  messages: Message[];
  thoughtProcess: ThoughtProcess[] | null;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setIsLoading: (loading: boolean) => void;
  setArchitectReview: (review: any) => void;
  loadApiKeys: () => { [key: string]: string };
  toast: typeof toast;
  setFollowUpQuestions?: (questions: any[]) => void;
  setFollowUpLoading?: (loading: boolean) => void;
  setFollowUpError?: (error: string | null) => void;
  setExamples?: (examples: any[]) => void;
  setExamplesLoading?: (loading: boolean) => void;
  setExamplesError?: (error: string | null) => void;
  setConfirmNewTopic?: (open: boolean) => void;
  setArchitectReviewLoading?: (loading: boolean) => void;
  setArchitectReviewError?: (error: string | null) => void;
}

export class InteractionHandler {
  private config: InteractionHandlerConfig;
  private followUpService: FollowUpService;
  private examplesService: ExamplesService;
  
  constructor(config: InteractionHandlerConfig) {
    this.config = config;
    this.followUpService = FollowUpService.getInstance();
    this.examplesService = ExamplesService.getInstance();
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
      setFollowUpQuestions,
      setFollowUpLoading,
      setFollowUpError,
      setExamples,
      setExamplesLoading,
      setExamplesError,
      setConfirmNewTopic,
      setArchitectReviewLoading,
      setArchitectReviewError
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
        // Check if we have the UI state setters
        if (!setFollowUpQuestions || !setFollowUpLoading || !setFollowUpError) {
          // Fall back to the old behavior if the UI components aren't available
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
        }

        // Use the advanced implementation
        setFollowUpLoading(true);
        setFollowUpError(null);
        
        try {
          const apiKeys = loadApiKeys();
          if (!apiKeys.gemini) {
            setFollowUpError("DeepSeek API key is required for follow-up questions");
            break;
          }
          
          const response = await this.followUpService.generateFollowUpQuestions(
            apiKeys.deepseek,
            messages
          );
          
          if (response.success && response.data?.followUpQuestions) {
            setFollowUpQuestions(response.data.followUpQuestions);
          } else {
            setFollowUpError(response.error || "Failed to generate follow-up questions");
          }
        } catch (error) {
          setFollowUpError(error instanceof Error ? error.message : "An unknown error occurred");
        } finally {
          setFollowUpLoading(false);
        }
        break;

      case 2: // Explain reasoning
        setIsLoading(true);
        try {
          if (thoughtProcess && thoughtProcess.length > 0) {
            // Format the thought process in a structured way
            const sections = {
              thinking: thoughtProcess.filter(t => t.type === 'thinking').map(t => t.content),
              planning: thoughtProcess.filter(t => t.type === 'planning').map(t => t.content),
              analyzing: thoughtProcess.filter(t => t.type === 'analyzing').map(t => t.content),
              solving: thoughtProcess.filter(t => t.type === 'solving').map(t => t.content)
            };
            
            // Create a nicely formatted explanation
            let reasoning = "# Detailed Reasoning Process\n\n";
            
            if (sections.thinking.length > 0) {
              reasoning += "## Initial Thoughts\n" + sections.thinking.join("\n\n") + "\n\n";
            }
            
            if (sections.analyzing.length > 0) {
              reasoning += "## Analysis\n" + sections.analyzing.join("\n\n") + "\n\n";
            }
            
            if (sections.planning.length > 0) {
              reasoning += "## Planning\n" + sections.planning.join("\n\n") + "\n\n";
            }
            
            if (sections.solving.length > 0) {
              reasoning += "## Solution Approach\n" + sections.solving.join("\n\n") + "\n\n";
            }
            
            // Add the explanation to messages
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
            // If no thought process is available, generate one based on the last message
            const apiKeys = loadApiKeys();
            if (!apiKeys.gemini) {
              toast({
                variant: "destructive",
                title: "Error",
                description: "DeepSeek API key is required for generating explanations",
              });
              break;
            }
            
            const lastContent = lastMessage.content;
            const prompt = `Please explain your reasoning process for the following response: "${lastContent}". 
            Break this down into key steps of your thinking process, including:
            1. How you understood the problem
            2. What approach you considered
            3. Why you chose this particular solution
            4. Any trade-offs or alternatives you considered`;
            
            const response = await callDeepSeek(
              prompt,
              apiKeys.deepseek,
              messages
            );
            
            setMessages(prev => [
              ...prev,
              {
                role: "assistant",
                type: "reasoning",
                content: response.content,
                timestamp: Date.now()
              }
            ]);
          }
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to generate reasoning explanation",
          });
        } finally {
          setIsLoading(false);
        }
        break;

      case 3: // Show examples
        // Check if we have the UI state setters
        if (!setExamples || !setExamplesLoading || !setExamplesError) {
          // Fall back to the basic behavior of adding examples to messages
          setIsLoading(true);
          try {
            const apiKeys = loadApiKeys();
            if (!apiKeys.gemini) {
              toast({
                variant: "destructive",
                title: "Error",
                description: "DeepSeek API key is required for examples",
              });
              return;
            }
            
            const response = await callDeepSeek(
              `Please provide concrete examples for: ${lastMessage.content}`,
              apiKeys.deepseek,
              messages
            );
            
            setMessages(prev => [...prev, {
              role: 'assistant',
              type: 'answer',
              content: response.content,
              timestamp: Date.now()
            }]);
          } catch (error) {
            toast({
              variant: "destructive",
              title: "Error",
              description: error instanceof Error ? error.message : "Failed to get examples",
            });
          } finally {
            setIsLoading(false);
          }
          break;
        }

        // Use the advanced implementation
        setExamplesLoading(true);
        setExamplesError(null);
        
        try {
          const apiKeys = loadApiKeys();
          if (!apiKeys.gemini) {
            setExamplesError("DeepSeek API key is required for generating examples");
            break;
          }
          
          const response = await this.examplesService.generateExamples(
            apiKeys.deepseek,
            messages
          );
          
          if (response.success && response.data?.examples) {
            setExamples(response.data.examples);
          } else {
            setExamplesError(response.error || "Failed to generate examples");
          }
        } catch (error) {
          setExamplesError(error instanceof Error ? error.message : "An unknown error occurred");
        } finally {
          setExamplesLoading(false);
        }
        break;

      case 4: // Start new topic
        // Show confirmation dialog if available
        if (setConfirmNewTopic) {
          setConfirmNewTopic(true);
          return;
        }
        
        // Otherwise just clear state directly
        setMessages([]);
        if (setFollowUpQuestions) setFollowUpQuestions([]);
        if (setExamples) setExamples([]);
        setArchitectReview(null);
        break;

      case 5: // Architect review
        if (setArchitectReviewLoading) {
          setArchitectReviewLoading(true);
          if (setArchitectReviewError) setArchitectReviewError(null);
        } else {
          setIsLoading(true);
        }
        
        try {
          const apiKeys = loadApiKeys();
          if (!apiKeys.gemini) {
            const error = "Gemini API key is required for architect review";
            if (setArchitectReviewError) {
              setArchitectReviewError(error);
            } else {
              toast({
                variant: "destructive",
                title: "Error",
                description: error,
              });
            }
            return;
          }
          
          const lastMessage = messages[messages.length - 1];
          if (!lastMessage) {
            const error = "No message to review";
            if (setArchitectReviewError) {
              setArchitectReviewError(error);
            } else {
              toast({
                variant: "destructive",
                title: "Error",
                description: error,
              });
            }
            return;
          }
          
          const review = await callArchitectLLM(messages, apiKeys.gemini);
          
          // Add version information
          const enhancedReview = {
            ...review,
            version: '1.0',
            timestamp: Date.now(),
            previousVersions: []
          };
          
          setArchitectReview(enhancedReview);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to get architect review";
          if (setArchitectReviewError) {
            setArchitectReviewError(errorMessage);
          } else {
            toast({
              variant: "destructive",
              title: "Error",
              description: errorMessage,
            });
          }
        } finally {
          if (setArchitectReviewLoading) {
            setArchitectReviewLoading(false);
          } else {
            setIsLoading(false);
          }
        }
        break;
    }
  }

  public confirmStartNewTopic(): void {
    const { 
      setMessages,
      setArchitectReview,
      setFollowUpQuestions,
      setExamples
    } = this.config;
    
    setMessages([]);
    if (setFollowUpQuestions) setFollowUpQuestions([]);
    if (setExamples) setExamples([]);
    setArchitectReview(null);
  }
}
