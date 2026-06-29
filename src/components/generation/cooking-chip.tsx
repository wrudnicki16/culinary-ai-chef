"use client";

import { Loader2 } from "lucide-react";
import { useGeneration } from "./generation-provider";

export function CookingChip() {
  const { job, reopenModal, isGenerating } = useGeneration();
  if (!job || !isGenerating) return null;
  return (
    <button
      type="button"
      onClick={reopenModal}
      className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
      aria-label="View recipe in progress"
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="hidden sm:inline">Cooking…</span>
    </button>
  );
}
