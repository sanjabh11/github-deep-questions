import { useState, useEffect, useCallback } from "react";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { InteractionOptions } from "@/components/InteractionOptions";
import { ApiKeyManager } from "@/components/ApiKeyManager";
import { FileUploader } from "@/components/FileUploader";
import { ModeSelector } from "@/components/ModeSelector";
import { callDeepSeek, saveToLocalStorage, loadFromLocalStorage, saveApiKeys, loadApiKeys } from "@/lib/api";
import { Researcher } from "@/lib/researcher";
import { Coder } from "@/lib/coder";
import { AudioManager } from "@/lib/audio";
import { ChatMode, FileUpload, Message, MessageRole } from "@/lib/types";
import { loadChatMode, saveChatMode, loadTemporaryFiles } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { Volume2, VolumeX, StopCircle } from "lucide-react";

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ChatMode>("default");
  const [attachedFiles, setAttachedFiles] = useState<FileUpload[]>([]);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const { toast } = useToast();
  const audioManager = new AudioManager();

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
    const userMessage: Message = { 
      role: "user", 
      type: "user",
      content,
      timestamp: Date.now()
    };
    
    setMessages((prev) => [...prev, userMessage]);

    try {
      let response: string;
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
          const result = await callDeepSeek(content, apiKey, messages);
          response = result.content;
      }

      const assistantMessage: Message = { 
        role: "assistant", 
        type: "answer",
        content: response,
        timestamp: Date.now()
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
      saveToLocalStorage([...messages, userMessage, assistantMessage]);

      if (audioEnabled) {
        await audioManager.speak(response);
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

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <ApiKeyManager 
        onSubmit={handleApiKeys}
        initialKeys={loadApiKeys()}
        show={showApiKeys}
        setShow={setShowApiKeys}
      />
      
      <div className="mb-4">
        <ModeSelector 
          selectedMode={selectedMode} 
          onModeChange={handleModeChange}
          modes={[
            { id: "default", label: "General Assistant (DeepSeek)" },
            { id: "researcher", label: "Deep Researcher (Gemini)" },
            { id: "coder", label: "Deep Coder (Gemini)" }
          ]}
        />
      </div>

      <div className="mb-4">
        <FileUploader
          onUpload={handleFileUpload}
          onRemove={handleFileRemove}
          files={attachedFiles}
          acceptedTypes={import.meta.env.VITE_ALLOWED_FILE_TYPES}
          maxSize={Number(import.meta.env.VITE_MAX_FILE_SIZE)}
        />
      </div>

      <div className="space-y-4 mb-4">
        {Array.isArray(messages) && messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}
      </div>

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

      <ChatInput 
        onSend={handleSendMessage}
        disabled={isLoading}
      />

      <InteractionOptions 
        onSelect={(choice) => {
          // Handle interaction choice
          console.log('Selected choice:', choice);
        }}
        disabled={isLoading}
      />
    </div>
  );
};

export default Index;