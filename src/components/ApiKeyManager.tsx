import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiKeys } from "@/lib/types";

interface ApiKeyManagerProps {
  onSubmit: (keys: ApiKeys) => void;
  initialKeys?: ApiKeys;
  show: boolean;
  setShow: (show: boolean) => void;
}

const LOCAL_STORAGE_KEY = 'api_keys';

export function ApiKeyManager({ onSubmit, initialKeys, show, setShow }: ApiKeyManagerProps) {
  // First try to get from env, then from initialKeys (localStorage), then empty string
  const [keys, setKeys] = useState<ApiKeys>({
    deepseek: import.meta.env.VITE_DEEPSEEK_API_KEY || initialKeys?.deepseek || "",
    elevenlabs: import.meta.env.VITE_ELEVENLABS_API_KEY || initialKeys?.elevenlabs || "",
    gemini: import.meta.env.VITE_GEMINI_API_KEY || initialKeys?.gemini || "",
    serpapi: import.meta.env.VITE_SERPAPI_API_KEY || initialKeys?.serpapi || "",
    jina: import.meta.env.VITE_JINA_API_KEY || initialKeys?.jina || "",
    openrouter: import.meta.env.VITE_OPENROUTER_API_KEY || initialKeys?.openrouter || ""
  });

  // Check if we have all required keys from env
  const hasAllEnvKeys = Boolean(
    import.meta.env.VITE_DEEPSEEK_API_KEY &&
    import.meta.env.VITE_ELEVENLABS_API_KEY &&
    import.meta.env.VITE_GEMINI_API_KEY &&
    import.meta.env.VITE_SERPAPI_API_KEY &&
    import.meta.env.VITE_JINA_API_KEY &&
    import.meta.env.VITE_OPENROUTER_API_KEY
  );

  // Load keys from localStorage on mount
  useEffect(() => {
    const storedKeys = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedKeys) {
      const parsedKeys = JSON.parse(storedKeys);
      setKeys(prevKeys => ({
        deepseek: import.meta.env.VITE_DEEPSEEK_API_KEY || parsedKeys.deepseek || prevKeys.deepseek,
        elevenlabs: import.meta.env.VITE_ELEVENLABS_API_KEY || parsedKeys.elevenlabs || prevKeys.elevenlabs,
        gemini: import.meta.env.VITE_GEMINI_API_KEY || parsedKeys.gemini || prevKeys.gemini,
        serpapi: import.meta.env.VITE_SERPAPI_API_KEY || parsedKeys.serpapi || prevKeys.serpapi,
        jina: import.meta.env.VITE_JINA_API_KEY || parsedKeys.jina || prevKeys.jina,
        openrouter: import.meta.env.VITE_OPENROUTER_API_KEY || parsedKeys.openrouter || prevKeys.openrouter
      }));
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Save to localStorage
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(keys));
    onSubmit(keys);
    setShow(false);
  };

  const handleChange = (key: keyof ApiKeys, value: string) => {
    setKeys((prev) => ({ ...prev, [key]: value }));
  };

  // If we have all env keys, don't show the dialog
  if (hasAllEnvKeys && !show) {
    return null;
  }

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>API Key Configuration</DialogTitle>
          <DialogDescription>
            {hasAllEnvKeys 
              ? "All API keys are configured in environment variables. You can override them here if needed."
              : "Configure missing API keys. Keys will be stored in your browser."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deepseek">
              DeepSeek API Key {!import.meta.env.VITE_DEEPSEEK_API_KEY && "(Required)"}
            </Label>
            <Input
              id="deepseek"
              type="password"
              value={keys.deepseek}
              onChange={(e) => handleChange("deepseek", e.target.value)}
              disabled={Boolean(import.meta.env.VITE_DEEPSEEK_API_KEY)}
              required={!import.meta.env.VITE_DEEPSEEK_API_KEY}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="elevenlabs">
              ElevenLabs API Key {!import.meta.env.VITE_ELEVENLABS_API_KEY && "(Optional)"}
            </Label>
            <Input
              id="elevenlabs"
              type="password"
              value={keys.elevenlabs}
              onChange={(e) => handleChange("elevenlabs", e.target.value)}
              disabled={Boolean(import.meta.env.VITE_ELEVENLABS_API_KEY)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gemini">
              Gemini API Key {!import.meta.env.VITE_GEMINI_API_KEY && "(Optional)"}
            </Label>
            <Input
              id="gemini"
              type="password"
              value={keys.gemini}
              onChange={(e) => handleChange("gemini", e.target.value)}
              disabled={Boolean(import.meta.env.VITE_GEMINI_API_KEY)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="serpapi">
              SerpAPI Key {!import.meta.env.VITE_SERPAPI_API_KEY && "(Required for Research)"}
            </Label>
            <Input
              id="serpapi"
              type="password"
              value={keys.serpapi}
              onChange={(e) => handleChange("serpapi", e.target.value)}
              disabled={Boolean(import.meta.env.VITE_SERPAPI_API_KEY)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jina">
              Jina API Key {!import.meta.env.VITE_JINA_API_KEY && "(Required for Research)"}
            </Label>
            <Input
              id="jina"
              type="password"
              value={keys.jina}
              onChange={(e) => handleChange("jina", e.target.value)}
              disabled={Boolean(import.meta.env.VITE_JINA_API_KEY)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="openrouter">
              OpenRouter API Key {!import.meta.env.VITE_OPENROUTER_API_KEY && "(Required for Research)"}
            </Label>
            <Input
              id="openrouter"
              type="password"
              value={keys.openrouter}
              onChange={(e) => handleChange("openrouter", e.target.value)}
              disabled={Boolean(import.meta.env.VITE_OPENROUTER_API_KEY)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShow(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Keys</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}