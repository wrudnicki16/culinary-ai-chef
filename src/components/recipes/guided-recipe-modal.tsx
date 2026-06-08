"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FilterPillGroup } from "./filter-pill-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DIETARY_FILTERS } from "@/lib/utils";

const DIET_INITIAL = 4;
const CUISINE_INITIAL = 7;

interface GuidedRecipeModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, dietaryFilters: string[]) => void;
}

function labelFor(group: { id: string; label: string }[], id: string): string {
  return group.find((f) => f.id === id)?.label ?? id;
}

export function GuidedRecipeModal({ open, onClose, onGenerate }: GuidedRecipeModalProps) {
  const [diet, setDiet] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState<string>("");
  const [meal, setMeal] = useState<string>("any");

  useEffect(() => {
    if (!open) {
      setDiet([]);
      setAllergies([]);
      setCuisine("");
      setMeal("any");
    }
  }, [open]);

  const selectedCount = diet.length + allergies.length + (cuisine ? 1 : 0) + (meal !== "any" ? 1 : 0);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const clearAll = () => {
    setDiet([]); setAllergies([]); setCuisine(""); setMeal("any");
  };

  const buildPrompt = (): string => {
    const dietLabels = diet.map((id) => labelFor(DIETARY_FILTERS.dietType, id));
    const allergyLabels = allergies.map((id) => labelFor(DIETARY_FILTERS.allergies, id));
    const cuisineLabel = cuisine ? labelFor(DIETARY_FILTERS.cuisines, cuisine) : "";
    const mealLabel = meal !== "any" ? meal : "";
    let s = "Generate a";
    if (dietLabels.length) s += ` ${dietLabels.join(", ")}`;
    if (cuisineLabel) s += ` ${cuisineLabel}`;
    if (mealLabel) s += ` ${mealLabel}`;
    s += " recipe";
    if (allergyLabels.length) s += ` that avoids ${allergyLabels.join(", ")}`;
    s += ".";
    return s;
  };

  const handleGenerate = () => {
    if (selectedCount === 0) {
      onGenerate(
        "Generate a random, creative recipe that would surprise and delight me. Be inventive with ingredients and cooking techniques.",
        []
      );
      return;
    }
    const filters = [...diet, ...allergies, ...(cuisine ? [cuisine] : [])];
    onGenerate(buildPrompt(), filters);
  };


  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Build your recipe</DialogTitle>
          <DialogDescription className="sr-only">
            Select dietary preferences to guide recipe generation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">Diet type</p>
            <FilterPillGroup
              items={DIETARY_FILTERS.dietType}
              selectedIds={diet}
              onToggle={(id) => toggle(diet, setDiet, id)}
              initialCount={DIET_INITIAL}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">Cuisine</p>
            <FilterPillGroup
              items={DIETARY_FILTERS.cuisines}
              selectedIds={cuisine ? [cuisine] : []}
              onToggle={(id) => setCuisine(cuisine === id ? "" : id)}
              initialCount={CUISINE_INITIAL}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">Meal type</p>
            <RadioGroup value={meal} onValueChange={setMeal} className="flex flex-wrap gap-4">
              {DIETARY_FILTERS.mealType.map((f) => (
                <div key={f.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={f.id} id={`meal-${f.id}`} />
                  <Label htmlFor={`meal-${f.id}`} className="text-sm cursor-pointer">{f.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">Allergies &amp; restrictions</p>
            <FilterPillGroup
              items={DIETARY_FILTERS.allergies}
              selectedIds={allergies}
              onToggle={(id) => toggle(allergies, setAllergies, id)}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t pt-3 mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {selectedCount} selected
            {selectedCount > 0 && (
              <button className="ml-2 underline hover:text-gray-700" onClick={clearAll}>Clear</button>
            )}
          </span>
          <Button className="bg-primary hover:bg-primary/90 text-white" onClick={handleGenerate}>
            {selectedCount === 0 ? "Surprise me 🎲" : "Generate recipe →"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
