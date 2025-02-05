import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useCallback } from "react";

interface ChatInputProps {
  onSend: (message: string) => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
}

export function ChatInput({ 
  onSend, 
  disabled = false,
  loading = false,
  placeholder = "Ask a question..."
}: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (trimmedInput && !disabled && !loading) {
      try {
        await onSend(trimmedInput);
        setInput("");
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  }, [input, onSend, disabled, loading]);

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || loading}
        className="flex-1"
      />
      <Button 
        type="submit" 
        disabled={disabled || loading || !input.trim()}
        variant="default"
      >
        {loading ? "Sending..." : "Send"}
      </Button>
    </form>
  );
}