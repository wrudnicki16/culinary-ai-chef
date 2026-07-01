"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Circle, AlertTriangle } from "lucide-react";
import { useGeneration } from "@/components/generation/generation-provider";
import { DISPLAY_STAGES, stageLabel, stageIndex, type GenerationStage } from "@/lib/generation/stages";

export function AILoadingModal() {
  const { job, dismissModal, cancel } = useGeneration();
  const open = !!job && !job.modalDismissed;
  const isError = job?.status === "error";

  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!open || isError) return;
    const t = setTimeout(() => setSlow(true), 20_000);
    return () => clearTimeout(t);
  }, [open, isError, job?.stage]);

  if (!job) return null;

  const currentIndex = stageIndex(job.stage as GenerationStage);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismissModal(); }}>
      <DialogContent className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="sr-only">
          <DialogTitle>Generating your recipe</DialogTitle>
          <DialogDescription>Live progress while the AI prepares your custom recipe.</DialogDescription>
        </DialogHeader>

        {isError ? (
          <div className="text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h3 className="text-xl font-heading font-semibold mb-2">Couldn&apos;t finish your recipe</h3>
            <p className="text-gray-600 mb-4">{job.error ?? "Something went wrong."}</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={dismissModal}>Close</Button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-heading font-semibold mb-1 text-center">Generating Your Recipe</h3>
            <p className="text-gray-600 mb-5 text-center">Our AI is cooking up something based on your preferences…</p>

            <ul className="space-y-3">
              {DISPLAY_STAGES.map((s) => {
                const idx = stageIndex(s);
                const done = idx < currentIndex;
                const active = idx === currentIndex;
                return (
                  <li key={s} className="flex items-center gap-3">
                    {done ? <CheckCircle className="h-5 w-5 text-primary" />
                      : active ? <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      : <Circle className="h-5 w-5 text-gray-300" />}
                    <span className={done ? "text-gray-500" : active ? "font-medium" : "text-gray-400"}>
                      {stageLabel(s)}
                    </span>
                  </li>
                );
              })}
            </ul>

            {slow && <p className="text-sm text-gray-500 pt-4 text-center">Taking a little longer than usual…</p>}

            <div className="mt-6 flex justify-center gap-2">
              <Button variant="default" onClick={dismissModal}>Continue browsing</Button>
              <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => void cancel()}>Cancel</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
