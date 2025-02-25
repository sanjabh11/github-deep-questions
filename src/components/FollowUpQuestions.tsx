import React, { useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { FollowUpQuestion } from '@/lib/types';

interface FollowUpQuestionsProps {
  questions: FollowUpQuestion[];
  onSelect?: (question: FollowUpQuestion) => void;
  onQuestionSelect?: (question: FollowUpQuestion) => void;
  isLoading: boolean;
  error?: string;
  className?: string;
}

export function FollowUpQuestions({
  questions,
  onSelect,
  onQuestionSelect,
  isLoading,
  error,
  className = ''
}: FollowUpQuestionsProps) {
  const handleSelect = useCallback((question: FollowUpQuestion) => {
    if (onSelect) {
      onSelect(question);
    } else if (onQuestionSelect) {
      onQuestionSelect(question);
    }
  }, [onSelect, onQuestionSelect]);

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <ExclamationTriangleIcon className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="text-primary font-medium mb-2">🤔 Generating relevant follow-up questions...</div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (!questions.length) {
    return null;
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="text-primary font-medium mb-2">🔍 Select a follow-up question:</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {questions
          .sort((a, b) => b.relevance - a.relevance)
          .map((question) => (
            <Button
              key={question.id}
              variant="outline"
              onClick={() => handleSelect(question)}
              className="justify-start text-left hover:bg-accent hover:text-accent-foreground group relative overflow-hidden transition-all duration-300 min-h-[60px]"
            >
              <div className="flex flex-col w-full">
                <span className="font-medium">{question.question}</span>
                <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                  {question.context}
                </span>
              </div>
              <div className="absolute right-2 top-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 px-1 py-0.5 rounded-sm">
                {Math.round(question.relevance * 100)}%
              </div>
            </Button>
          ))}
      </div>
    </div>
  );
} 