import React, { useCallback, useState, useEffect } from 'react';
import { Message, ThoughtProcess } from '../../api/types/messages.js';
import { FileUpload, storage } from '@/lib/storage';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/ui/use-toast';
import { FileUploader } from '@/components/FileUploader';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Loader2, Volume2, VolumeX } from 'lucide-react';

interface InteractionOption {
  id: number;
  label: string;
  disabled?: boolean;
}

// Add validation helper
const isValidInterfaceType = (type: string): type is 'GENERAL' | 'RESEARCHER' | 'CODER' => {
  return ['GENERAL', 'RESEARCHER', 'CODER'].includes(type);
};

export default function Index() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentThought, setCurrentThought] = useState<ThoughtProcess | undefined>();
  const [progressMessage, setProgressMessage] = useState<string | undefined>();
  const [attachedFiles, setAttachedFiles] = useState<FileUpload[]>([]);
  const [selectedMode, setSelectedMode] = useState<'general' | 'researcher' | 'coder'>('general');
  const { toast } = useToast();
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [selectedQueryType, setSelectedQueryType] = useState<'CODE'|'EXPLANATION'|'RESEARCH'>('CODE');

  // Load initial state
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const history = await storage.loadChatHistory();
        setMessages(history?.messages || []);
        
        const mode = storage.loadChatMode();
        setSelectedMode(mode || 'general');
        
        const files = await storage.loadTemporaryFiles();
        setAttachedFiles(files || []);
      } catch (error) {
        console.error('Failed to load initial state:', error);
        toast({
          title: 'Error',
          description: 'Failed to load chat history',
          variant: 'destructive'
        });
      }
    };

    loadInitialState();
  }, [toast]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() && attachedFiles.length === 0) return;

    setIsLoading(true);
    setCurrentThought(undefined);
    setProgressMessage(undefined);

    const userMessage: Message = {
      type: 'user',
      content,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const interfaceType = selectedMode.toUpperCase();
      if (!isValidInterfaceType(interfaceType)) {
        throw new Error(`Invalid interface type: ${interfaceType}`);
      }

      const response = await apiClient.process(
        {
          query: content,
          interfaceType: interfaceType,
          queryType: selectedQueryType,
          files: attachedFiles.map(file => ({
            name: file.name,
            content: typeof file.content === 'string' ? file.content : 'Binary content not supported'
          }))
        },
        // Thinking callback
        (thought) => {
          setCurrentThought(thought);
        },
        // Progress callback
        (message) => {
          setProgressMessage(message);
        }
      );

      if (response.success && response.data) {
        const assistantMessage: Message = {
          type: 'answer',
          content: response.data.thinking || response.data.analysis || '',
          timestamp: Date.now()
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        // Save to history
        await storage.saveChatHistory({
          messages: [...messages, userMessage, assistantMessage],
          thoughtProcesses: currentThought ? [currentThought] : [],
          architectReviews: [],
          lastUpdated: Date.now()
        });
      } else {
        throw new Error(response.error || 'Failed to process request');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process your request',
        variant: 'destructive'
      });

      setMessages(prev => [
        ...prev,
        {
          type: 'system',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsLoading(false);
      setCurrentThought(undefined);
      setProgressMessage(undefined);
    }
  }, [messages, selectedMode, attachedFiles, currentThought, toast, selectedQueryType]);

  const handleModeChange = useCallback((mode: typeof selectedMode) => {
    setSelectedMode(mode);
    storage.saveChatMode(mode);
  }, []);

  const handleFilesChange = useCallback((files: FileUpload[]) => {
    setAttachedFiles(files);
  }, []);

  // Interaction options
  const interactionOptions: InteractionOption[] = [
    { id: 1, label: 'Ask follow-up question' },
    { id: 2, label: 'Explain reasoning', disabled: !currentThought },
    { id: 3, label: 'Show examples', disabled: !messages?.length },
    { id: 4, label: 'Start new topic' },
    { id: 5, label: 'Let architect review', disabled: !messages?.length }
  ];

  const handleInteractionOption = useCallback(async (optionId: number) => {
    if (isLoading || !messages) return;

    switch (optionId) {
      case 1: // Follow-up question
        // Just enable input
        break;
      
      case 2: // Explain reasoning
        if (currentThought) {
          setMessages(prev => [
            ...(prev || []),
            {
              type: 'reasoning',
              content: `Here's my thought process:\n${currentThought.content}`,
              timestamp: Date.now()
            }
          ]);
        }
        break;
      
      case 3: // Show examples
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          setIsLoading(true);
          try {
            const response = await apiClient.process(
              {
                query: `Please provide concrete examples for: ${lastMessage.content}`,
                interfaceType: selectedMode.toUpperCase() as 'GENERAL' | 'RESEARCHER' | 'CODER',
                queryType: 'EXPLANATION'
              },
              setCurrentThought,
              setProgressMessage
            );
            
            if (response.success && response.data) {
              setMessages(prev => [
                ...(prev || []),
                {
                  type: 'answer',
                  content: response.data.thinking || response.data.analysis || '',
                  timestamp: Date.now()
                }
              ]);
            }
          } catch (error) {
            toast({
              title: 'Error',
              description: error instanceof Error ? error.message : 'Failed to get examples',
              variant: 'destructive'
            });
          } finally {
            setIsLoading(false);
          }
        }
        break;
      
      case 4: // Start new topic
        setMessages([]);
        setCurrentThought(undefined);
        setProgressMessage(undefined);
        break;
      
      case 5: // Architect review
        if (messages.length > 0) {
          setIsLoading(true);
          try {
            const review = await apiClient.architectReview(messages, 'CODE');
            setMessages(prev => [
              ...(prev || []),
              {
                type: 'answer',
                content: `Architecture Review:\n\n${
                  review.criticalIssues?.length > 0 
                    ? `Critical Issues:\n${review.criticalIssues.join('\n')}\n\n` 
                    : ''
                }${
                  review.potentialProblems?.length > 0
                    ? `Potential Problems:\n${review.potentialProblems.join('\n')}\n\n`
                    : ''
                }${
                  review.improvements?.length > 0
                    ? `Suggested Improvements:\n${review.improvements.join('\n')}\n\n`
                    : ''
                }Verdict: ${review.verdict}`,
                timestamp: Date.now()
              }
            ]);
          } catch (error) {
            toast({
              title: 'Error',
              description: error instanceof Error ? error.message : 'Failed to get architect review',
              variant: 'destructive'
            });
          } finally {
            setIsLoading(false);
          }
        }
        break;
    }
  }, [isLoading, messages, currentThought, selectedMode, toast]);

  return (
    <ErrorBoundary>
      <div className="container mx-auto p-4 space-y-4 bg-background text-foreground">
        {/* Mode selector */}
        <div className="flex space-x-4">
          <button
            onClick={() => handleModeChange('general')}
            className={`px-4 py-2 rounded ${
              selectedMode === 'general' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            General Assistant
          </button>
          <button
            onClick={() => handleModeChange('researcher')}
            className={`px-4 py-2 rounded ${
              selectedMode === 'researcher' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            Deep Researcher
          </button>
          <button
            onClick={() => handleModeChange('coder')}
            className={`px-4 py-2 rounded ${
              selectedMode === 'coder' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            Deep Coder
          </button>
        </div>

        {/* Query type selector */}
        <div className="flex space-x-4">
          <button
            onClick={() => setSelectedQueryType('CODE')}
            className={`px-4 py-2 rounded ${
              selectedQueryType === 'CODE' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            Code Generation
          </button>
          <button
            onClick={() => setSelectedQueryType('EXPLANATION')}
            className={`px-4 py-2 rounded ${
              selectedQueryType === 'EXPLANATION' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            Explanation
          </button>
          <button
            onClick={() => setSelectedQueryType('RESEARCH')}
            className={`px-4 py-2 rounded ${
              selectedQueryType === 'RESEARCH' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            Research
          </button>
        </div>

        {/* File uploader */}
        <FileUploader
          onFilesChange={handleFilesChange}
          className="mb-4"
        />

        {/* Progress indicator */}
        <ProgressIndicator
          isLoading={isLoading}
          currentThought={currentThought}
          progressMessage={progressMessage}
          className="mb-4"
        />

        {/* Messages */}
        <div className="space-y-4">
          {messages?.map((message, index) => (
            <div
              key={index}
              className={`p-4 rounded ${
                message.type === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : message.type === 'system'
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <div className="font-semibold mb-1">
                {message.type.charAt(0).toUpperCase() + message.type.slice(1)}:
              </div>
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          ))}
        </div>

        {/* Interaction options */}
        <div className="flex flex-wrap gap-2 mt-4">
          {interactionOptions.map(option => (
            <Button
              key={option.id}
              variant="outline"
              disabled={option.disabled || isLoading}
              onClick={() => handleInteractionOption(option.id)}
              className="flex-1"
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Audio toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="w-10 h-10"
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
        </div>

        {/* Input */}
        <div className="mt-4">
          <textarea
            className="w-full p-2 rounded border bg-background text-foreground"
            rows={3}
            placeholder="Type your message..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}