import React from 'react';
import { ThoughtProcess } from '../../api/types/messages.js';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ProgressIndicatorProps {
  isLoading: boolean;
  currentThought?: ThoughtProcess;
  progressMessage?: string;
  className?: string;
}

export function ProgressIndicator({
  isLoading,
  currentThought,
  progressMessage,
  className
}: ProgressIndicatorProps) {
  if (!isLoading) return null;

  return (
    <div className={cn("flex flex-col space-y-2 p-4", className)}>
      {/* Spinner with thinking animation */}
      <div className="flex items-center space-x-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">
          {currentThought ? 'Thinking...' : 'Processing...'}
        </span>
      </div>

      {/* Thought process display */}
      {currentThought && (
        <div className="rounded-lg bg-muted p-4 text-sm">
          <div className="font-semibold mb-1">
            {currentThought.type.charAt(0).toUpperCase() + currentThought.type.slice(1)}:
          </div>
          <div className="text-muted-foreground whitespace-pre-wrap">
            {currentThought.content}
          </div>
        </div>
      )}

      {/* Progress message */}
      {progressMessage && (
        <div className="text-sm text-muted-foreground italic">
          {progressMessage}
        </div>
      )}
    </div>
  );
} 