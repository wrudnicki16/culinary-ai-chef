"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DIETARY_FILTERS } from "@/lib/utils";

const DIET_INITIAL = 4;
const CUISINE_INITIAL = 8;
const LOAD_STEP = 10;

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
  const [dietVisible, setDietVisible] = useState(DIET_INITIAL);
  const [cuisineVisible, setCuisineVisible] = useState(CUISINE_INITIAL);

  useEffect(() => {
    if (!open) {
      setDiet([]);
      setAllergies([]);
      setCuisine("");
      setMeal("any");
      setDietVisible(DIET_INITIAL);
      setCuisineVisible(CUISINE_INITIAL);
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

  const dietShown = DIETARY_FILTERS.dietType.slice(0, dietVisible);
  const cuisineShown = DIETARY_FILTERS.cuisines.slice(0, cuisineVisible);

  // "Load more" reveals LOAD_STEP more pills; once all are shown, "See less"
  // collapses back to the initial count.
  const moreControl = (
    visible: number,
    total: number,
    initial: number,
    setVisible: (n: number) => void
  ) => {
    if (visible < total) {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-gray-600"
          onClick={() => setVisible(Math.min(visible + LOAD_STEP, total))}
        >
          Load more
        </Button>
      );
    }
    if (total > initial) {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-gray-600"
          onClick={() => setVisible(initial)}
        >
          See less
        </Button>
      );
    }
    return null;
  };

  const pill = (active: boolean, label: string, onClick: () => void) => (
    <Badge
      key={label}
      variant={active ? "default" : "outline"}
      className={active ? "cursor-pointer bg-primary hover:bg-primary/80" : "cursor-pointer hover:bg-gray-100"}
      onClick={onClick}
    >
      {label}
    </Badge>
  );

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
            <div className="flex flex-wrap gap-2">
              {dietShown.map((f) => pill(diet.includes(f.id), f.label, () => toggle(diet, setDiet, f.id)))}
              {moreControl(dietVisible, DIETARY_FILTERS.dietType.length, DIET_INITIAL, setDietVisible)}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">Cuisine</p>
            <div className="flex flex-wrap gap-2">
              {cuisineShown.map((f) => pill(cuisine === f.id, f.label, () => setCuisine(cuisine === f.id ? "" : f.id)))}
              {moreControl(cuisineVisible, DIETARY_FILTERS.cuisines.length, CUISINE_INITIAL, setCuisineVisible)}
            </div>
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
            <div className="flex flex-wrap gap-2">
              {DIETARY_FILTERS.allergies.map((f) => pill(allergies.includes(f.id), f.label, () => toggle(allergies, setAllergies, f.id)))}
            </div>
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
