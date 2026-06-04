"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CustomRecipePromptProps {
  onGenerate: (prompt: string) => void;
  disabled: boolean;
}

export function CustomRecipePrompt({ onGenerate, disabled }: CustomRecipePromptProps) {
  const [prompt, setPrompt] = useState("");

  const submit = () => {
    const text = prompt.trim();
    if (!text) return;
    onGenerate(text);
  };

  return (
    <div>
      <label htmlFor="custom-recipe-prompt" className="block text-sm font-medium text-gray-700 mb-1">
        Describe what you&apos;d like to make
      </label>
      <div className="flex items-end gap-2">
        <Textarea
          id="custom-recipe-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Pure English — ingredients you have, a cuisine, presentation, any constraints…"
          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary h-24"
        />
        <Button
          onClick={submit}
          disabled={disabled || !prompt.trim()}
          aria-label="Generate from description"
          className="bg-primary hover:bg-primary/90 text-white h-10 w-10 p-0 rounded-lg flex-shrink-0"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
