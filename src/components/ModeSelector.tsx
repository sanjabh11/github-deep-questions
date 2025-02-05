import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChatMode } from "@/lib/types";

interface ModeSelectorProps {
  currentMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  disabled?: boolean;
}

export function ModeSelector({ currentMode, onModeChange, disabled }: ModeSelectorProps) {
  return (
    <Select
      value={currentMode}
      onValueChange={(value: ChatMode) => onModeChange(value)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select Mode" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">Default Chat</SelectItem>
        <SelectItem value="researcher">Deep Researcher</SelectItem>
        <SelectItem value="coder">Deep Coder</SelectItem>
      </SelectContent>
    </Select>
  );
}