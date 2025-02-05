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
  selectedMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  modes: Array<{ id: string; label: string; }>;
  disabled?: boolean;
}

export function ModeSelector({ selectedMode, onModeChange, modes, disabled }: ModeSelectorProps) {
  return (
    <Select
      value={selectedMode}
      onValueChange={(value: ChatMode) => onModeChange(value)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select Mode" />
      </SelectTrigger>
      <SelectContent>
        {modes.map(mode => (
          <SelectItem key={mode.id} value={mode.id}>{mode.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}