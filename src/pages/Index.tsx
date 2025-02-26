import { useState, useEffect, useCallback, useMemo } from "react";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { InteractionOptions } from "@/components/InteractionOptions";
import { ApiKeyManager } from "@/components/ApiKeyManager";
import { FileUploader } from "@/components/FileUploader";
import { callDeepSeek, saveToLocalStorage, loadFromLocalStorage, saveApiKeys, loadApiKeys } from "@/lib/api";
import { Researcher } from "@/lib/researcher";
import { Coder } from "@/lib/coder";
import { AudioManager } from "@/lib/audio";
import { ChatMode, FileUpload, Message, MessageRole, MessageType, FollowUpQuestion } from "@/lib/types";
import { loadChatMode, saveChatMode, loadTemporaryFiles } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { Volume2, VolumeX, StopCircle } from "lucide-react";
import { ThoughtProcessDisplay } from "@/components/ThoughtProcess";
import { ArchitectReview } from "@/components/ArchitectReview";
import { callArchitectLLM } from "@/lib/architect";
import { InteractionHandler } from "@/lib/interactionHandler";
import { FollowUpQuestions } from "@/components/FollowUpQuestions";
import { FollowUpService } from "@/lib/services/followUpService";
import { Example } from "@/lib/services/examplesService";
import { Examples } from "@/components/Examples";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// Mode-specific components
const DefaultMode = ({ children, isActive }) => (
  <div className={`${isActive ? 'block' : 'hidden'} bg-background p-6 rounded-lg border border-border`}>
    <h2 className="text-2xl font-bold mb-4 text-primary">General Assistant</h2>
    <div className="prose dark:prose-invert max-w-none">{children}</div>
  </div>
);

const ResearcherMode = ({ children, isActive }) => (
  <div className={`${isActive ? 'block' : 'hidden'} bg-slate-900 p-6 rounded-lg border border-blue-500`}>
    <h2 className="text-2xl font-bold mb-4 text-blue-400">Deep Researcher</h2>
    <div className="prose dark:prose-invert max-w-none">{children}</div>
  </div>
);

const CoderMode = ({ children, isActive }) => (
  <div className={`${isActive ? 'block' : 'hidden'} bg-zinc-900 p-6 rounded-lg border border-green-500`}>
    <h2 className="text-2xl font-bold mb-4 text-green-400">Deep Coder</h2>
    <div className="prose dark:prose-invert max-w-none">{children}</div>
  </div>
);

const ModeSelector = ({ currentMode, onModeChange }) => (
  <div className="flex gap-2 mb-6">
    {[
      { id: 'default', label: 'General Assistant', color: 'border-primary' },
      { id: 'researcher', label: 'Deep Researcher', color: 'border-blue-500' },
      { id: 'coder', label: 'Deep Coder', color: 'border-green-500' }
    ].map(mode => (
      <Button
        key={mode.id}
        variant={currentMode === mode.id ? "default" : "outline"}
        className={`flex-1 ${currentMode === mode.id ? mode.color : ''}`}
        onClick={() => onModeChange(mode.id)}
      >
        {mode.label}
      </Button>
    ))}
  </div>
);

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ChatMode>("default");
  const [attachedFiles, setAttachedFiles] = useState<FileUpload[]>([]);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [thoughtProcess, setThoughtProcess] = useState(null);
  const [architectReview, setArchitectReview] = useState(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [examples, setExamples] = useState<Example[]>([]);
  const [examplesLoading, setExamplesLoading] = useState<boolean>(false);
  const [examplesError, setExamplesError] = useState<string | null>(null);
  const { toast } = useToast();
  const audioManager = useMemo(() => new AudioManager(), []);
  const [confirmNewTopic, setConfirmNewTopic] = useState<boolean>(false);
  const [architectReviewLoading, setArchitectReviewLoading] = useState<boolean>(false);
  const [architectReviewError, setArchitectReviewError] = useState<string | null>(null);
  
  const interactionHandler = useMemo(() => {
    return new InteractionHandler({
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
    });
  }, [messages, thoughtProcess, setMessages, setIsLoading, setArchitectReview, toast]);

  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const savedMessages = loadFromLocalStorage();
        const savedMode = loadChatMode();
        const savedFiles = await loadTemporaryFiles();
        
        if (Array.isArray(savedMessages)) {
          const convertedMessages = savedMessages.map(msg => ({
            role: (msg.type === 'user' ? 'user' : msg.type === 'system' ? 'system' : 'assistant') as MessageRole,
            type: msg.type,
            content: msg.content,
            timestamp: Date.now()
          }));
          setMessages(convertedMessages);
        }
        setSelectedMode(savedMode);
        setAttachedFiles(savedFiles || []);
      } catch (error) {
        console.error("Error loading initial state:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load previous chat history.",
        });
      }
    };

    loadInitialState();
  }, [toast]);

  const handleApiKeys = useCallback((keys: { [key: string]: string }) => {
    try {
      saveApiKeys(keys);
      setShowApiKeys(false);
      toast({
        title: "Success",
        description: "API keys have been saved successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save API keys",
      });
    }
  }, [toast]);

  const handleModeChange = useCallback((mode: ChatMode) => {
    setSelectedMode(mode);
    saveChatMode(mode);
    // Reset thought process and architect review when changing modes
    setThoughtProcess(null);
    setArchitectReview(null);
  }, []);

  const handleFileUpload = useCallback(async (files: FileUpload[]) => {
    setAttachedFiles((prev) => [...prev, ...files]);
  }, []);

  const handleFileRemove = useCallback((fileId: string) => {
    setAttachedFiles((prev) => prev.filter((file) => file.id !== fileId));
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() && attachedFiles.length === 0) return;

    setIsLoading(true);
    setThoughtProcess(null);
    setArchitectReview(null);

    const userMessage: Message = { 
      role: "user", 
      type: "user",
      content,
      timestamp: Date.now()
    };
    
    setMessages((prev) => [...prev, userMessage]);

    try {
      let response: string;
      let newThoughtProcess = null;

      switch (selectedMode) {
        case "researcher":
          const researcher = new Researcher();
          response = await researcher.analyze(content, attachedFiles);
          break;

        case "coder":
          const apiKeys = loadApiKeys();
          if (!apiKeys.gemini) {
            throw new Error("Gemini API key is required for coder mode");
          }
          const coder = new Coder(apiKeys.gemini);
          const coderResponse = await coder.analyze(content, attachedFiles.map(f => ({
            name: f.name,
            content: typeof f.content === 'string' ? f.content : 'Binary content not supported'
          })));
          response = coderResponse.map(msg => msg.content).join('\n\n');
          break;

        default:
          const apiKey = loadApiKeys().deepseek;
          if (!apiKey) {
            throw new Error("DeepSeek API key is required");
          }
          
          // Process file attachments for the default mode
          const fileContents = attachedFiles.map(file => ({
            name: file.name,
            content: typeof file.content === 'string' ? file.content : 'Binary content not supported'
          }));
          
          const result = await callDeepSeek(
            content, 
            apiKey, 
            messages, 
            (thought) => {
              setThoughtProcess(prev => prev ? [...prev, thought] : [thought]);
            },
            fileContents // Pass file attachments to the API
          );
          response = result.content;
          newThoughtProcess = result.thoughtProcess;
      }

      const assistantMessage: Message = { 
        role: "assistant", 
        type: "answer",
        content: response,
        timestamp: Date.now()
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
      saveToLocalStorage([...messages, userMessage, assistantMessage]);

      if (newThoughtProcess) {
        setThoughtProcess(newThoughtProcess);
      }

      if (audioEnabled) {
        await audioManager.generateAndPlaySpeech(response, loadApiKeys().elevenlabs);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to process your request";
      
      setMessages((prev) => [
        ...prev,
        { 
          role: "system", 
          type: "system",
          content: `Error: ${errorMessage}`,
          timestamp: Date.now()
        }
      ]);
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
        action: <ToastAction altText="Try again">Try again</ToastAction>,
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, selectedMode, attachedFiles, audioEnabled, audioManager, toast]);

  const handleInterrupt = useCallback(() => {
    setIsLoading(false);
    audioManager.stop();
  }, [audioManager]);

  const handleOptionSelect = useCallback(async (choice: number) => {
    await interactionHandler.handleOptionSelect(choice);
  }, [interactionHandler]);

  const handleConfirmNewTopic = useCallback(() => {
    interactionHandler.confirmStartNewTopic();
  }, [interactionHandler]);

  const handleFollowUpSelect = useCallback((question: FollowUpQuestion) => {
    // First add the question to the messages
    const userMessage: Message = {
      role: 'user',
      type: 'user',
      content: question.question,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Clear the follow-up questions
    setFollowUpQuestions([]);
    
    // Then process the question
    handleSendMessage(question.question);
  }, [handleSendMessage, setMessages]);

  const handleApplyImprovement = useCallback((improvement) => {
    // Add the improvement suggestion as a user message
    const userMessage: Message = {
      role: 'user' as MessageRole,
      type: 'user' as MessageType,
      content: `Please apply this improvement: ${improvement.title}\n\n${improvement.description}`,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    handleSendMessage(userMessage.content);
  }, [handleSendMessage]);

  const renderModeContent = (children) => {
    switch (selectedMode) {
      case 'researcher':
        return <ResearcherMode isActive={true}>{children}</ResearcherMode>;
      case 'coder':
        return <CoderMode isActive={true}>{children}</CoderMode>;
      default:
        return <DefaultMode isActive={true}>{children}</DefaultMode>;
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <ApiKeyManager 
        onSubmit={handleApiKeys}
        initialKeys={loadApiKeys()}
        show={showApiKeys}
        setShow={setShowApiKeys}
      />
      
      <ModeSelector currentMode={selectedMode} onModeChange={handleModeChange} />

      {renderModeContent(
        <>
          <div className="mb-4">
            <FileUploader
              onUpload={handleFileUpload}
              onRemove={handleFileRemove}
              files={attachedFiles}
              acceptedTypes={import.meta.env.VITE_ALLOWED_FILE_TYPES}
              maxSize={Number(import.meta.env.VITE_MAX_FILE_SIZE)}
            />
          </div>

          {thoughtProcess && (
            <div className="mb-4">
              {thoughtProcess.map((thought, index) => (
                <ThoughtProcessDisplay key={index} thought={thought} />
              ))}
            </div>
          )}

          <div className="space-y-4 mb-4">
            {Array.isArray(messages) && messages.map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))}
          </div>

          {examples.length > 0 && !isLoading && (
            <div className="mb-4">
              <Examples 
                examples={examples}
                isLoading={examplesLoading}
                error={examplesError}
              />
            </div>
          )}

          {architectReview && (
            <div className="mb-4">
              <ArchitectReview 
                review={architectReview} 
                isLoading={architectReviewLoading}
                error={architectReviewError}
                onApplyImprovement={handleApplyImprovement}
              />
            </div>
          )}

          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setAudioEnabled(!audioEnabled)}
            >
              {audioEnabled ? <Volume2 /> : <VolumeX />}
            </Button>
            {isLoading && (
              <Button
                variant="destructive"
                size="icon"
                onClick={handleInterrupt}
              >
                <StopCircle />
              </Button>
            )}
          </div>

          {followUpQuestions.length > 0 && !isLoading && (
            <div className="mb-4">
              <FollowUpQuestions
                questions={followUpQuestions}
                onSelect={handleFollowUpSelect}
                isLoading={followUpLoading}
                error={followUpError}
                className="mb-2"
              />
            </div>
          )}

          <ChatInput 
            onSend={handleSendMessage}
            disabled={isLoading}
          />

          <InteractionOptions 
            onSelect={handleOptionSelect}
            disabled={isLoading || messages.length === 0}
          />
        </>
      )}

      <ConfirmDialog
        open={confirmNewTopic}
        onOpenChange={setConfirmNewTopic}
        onConfirm={handleConfirmNewTopic}
        title="Start a new topic?"
        description="This will clear the current conversation. Are you sure you want to start a new topic?"
        confirmText="Start new topic"
        cancelText="Keep current conversation"
      />
    </div>
  );
};

export default Index;