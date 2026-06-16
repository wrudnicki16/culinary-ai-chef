"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
  onChange?: (value: number) => void;
  count?: number;
  className?: string;
}

export function Rating({
  value,
  max = 5,
  size = "md",
  readOnly = true,
  onChange,
  count,
  className,
}: RatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  const threshold = hoverValue ?? value;

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div
      className={cn("flex items-center", className)}
      onMouseLeave={() => !readOnly && setHoverValue(null)}
    >
      <div className="star-rating">
        {stars.map((star) => {
          const filled = star <= threshold;
          return (
            <Star
              key={star}
              role={!readOnly ? "button" : undefined}
              aria-label={!readOnly ? `Rate ${star} star${star > 1 ? "s" : ""}` : undefined}
              className={cn(
                "star",
                sizeClasses[size],
                filled && (readOnly ? "filled" : "fill-yellow-400 text-yellow-400"),
                !readOnly && "cursor-pointer hover:scale-110 transition-transform"
              )}
              onMouseEnter={() => !readOnly && setHoverValue(star)}
              onClick={() => !readOnly && onChange?.(star)}
            />
          );
        })}
      </div>
      {count !== undefined && (
        <span className="text-xs ml-1 text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
