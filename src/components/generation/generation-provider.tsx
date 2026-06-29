"use client";

import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useRecipeViewer } from "@/components/recipes/recipe-viewer-provider";
import { AILoadingModal } from "@/components/recipes/ai-loading-modal";
import { classifyTransition, hasActiveJob, type ClientJob } from "@/lib/generation/transitions";
import { isTerminalStatus, type GenerationStage, type GenerationStatus } from "@/lib/generation/stages";
import { Recipe } from "@/lib/types";

interface GenerationContextValue {
  job: ClientJob | null;
  isGenerating: boolean;
  start: (prompt: string, dietaryFilters: string[]) => Promise<void>;
  dismissModal: () => void;
  reopenModal: () => void;
  cancel: () => Promise<void>;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

export function useGeneration(): GenerationContextValue {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error("useGeneration must be used within GenerationProvider");
  return ctx;
}

const POLL_MS = 2000;

interface PollResponse {
  status: GenerationStatus;
  stage: GenerationStage;
  recipeId: number | null;
  error: string | null;
  recipe: Recipe | null;
}

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const [job, setJob] = useState<ClientJob | null>(null);
  const jobRef = useRef<ClientJob | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { openRecipe } = useRecipeViewer();

  const setJobState = useCallback((next: ClientJob | null) => {
    jobRef.current = next;
    setJob(next);
  }, []);

  const poll = useCallback(async (jobId: number) => {
    const res = await fetch(`/api/recipes/generate/${jobId}`, { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as PollResponse;

    const prev = jobRef.current;
    const dismissed = prev?.modalDismissed ?? false;
    const next: ClientJob = {
      jobId, status: data.status, stage: data.stage,
      recipeId: data.recipeId, error: data.error, modalDismissed: dismissed,
    };
    const effect = classifyTransition(prev?.status ?? "pending", next);

    if (isTerminalStatus(data.status)) {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
    }

    if (effect.kind === "open-viewer" && data.recipe) {
      openRecipe(data.recipe);
      setJobState(null);
    } else if (effect.kind === "toast-success" && data.recipe) {
      const r = data.recipe;
      toast({
        title: "Your recipe is ready",
        description: r.title,
        action: <ToastAction altText="View recipe" onClick={() => openRecipe(r)}>View recipe</ToastAction>,
      });
      setJobState(null);
    } else if (effect.kind === "toast-error") {
      toast({ title: "Recipe generation failed", description: effect.message, variant: "destructive" });
      setJobState(next);
    } else {
      setJobState(next);
    }
  }, [openRecipe, queryClient, setJobState, toast]);

  const activeJobId = job && hasActiveJob(job) ? job.jobId : null;
  useEffect(() => {
    if (activeJobId == null) return;
    void poll(activeJobId);
    const timer = setInterval(() => { void poll(activeJobId); }, POLL_MS);
    return () => clearInterval(timer);
  }, [activeJobId, poll]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Reconnect is best-effort: a failed/absent response must never crash the app.
      try {
        const res = await fetch(`/api/recipes/generations/active`, { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { jobs?: Array<Omit<ClientJob, "modalDismissed">> };
        const first = data.jobs?.[0];
        if (first && !jobRef.current) {
          setJobState({ ...first, modalDismissed: true });
        }
      } catch {
        // ignore — no in-flight job to resume
      }
    })();
    return () => { cancelled = true; };
  }, [setJobState]);

  const start = useCallback(async (prompt: string, dietaryFilters: string[]) => {
    if (jobRef.current && hasActiveJob(jobRef.current)) return;
    const res = await fetch(`/api/recipes/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ prompt, dietaryFilters }),
    });
    if (res.status === 401) {
      toast({ title: "Authentication required", description: "Redirecting to login…", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/auth/signin"; }, 1500);
      return;
    }
    if (res.status === 409) {
      const data = (await res.json()) as { jobId: number; status: GenerationStatus };
      setJobState({ jobId: data.jobId, status: data.status, stage: "queued", recipeId: null, error: null, modalDismissed: true });
      toast({ title: "A recipe is already cooking", description: "Hang tight — we'll notify you when it's ready." });
      return;
    }
    if (!res.ok) {
      toast({ title: "Recipe generation failed", description: "Please try again.", variant: "destructive" });
      return;
    }
    const data = (await res.json()) as { jobId: number; status: GenerationStatus };
    setJobState({ jobId: data.jobId, status: data.status, stage: "queued", recipeId: null, error: null, modalDismissed: false });
  }, [setJobState, toast]);

  const dismissModal = useCallback(() => {
    const cur = jobRef.current;
    if (cur) setJobState({ ...cur, modalDismissed: true });
  }, [setJobState]);

  const reopenModal = useCallback(() => {
    const cur = jobRef.current;
    if (cur) setJobState({ ...cur, modalDismissed: false });
  }, [setJobState]);

  const cancel = useCallback(async () => {
    const cur = jobRef.current;
    if (!cur) return;
    await fetch(`/api/recipes/generate/${cur.jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: "cancelled" }),
    }).catch(() => {});
    setJobState(null);
  }, [setJobState]);

  return (
    <GenerationContext.Provider value={{ job, isGenerating: hasActiveJob(job), start, dismissModal, reopenModal, cancel }}>
      {children}
      <AILoadingModal />
    </GenerationContext.Provider>
  );
}
