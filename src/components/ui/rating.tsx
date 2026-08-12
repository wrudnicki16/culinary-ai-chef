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

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const hovering = hoverValue !== null;
  const display = hovering ? hoverValue! : Math.round(value * 2) / 2;
  // `!text-yellow-400` beats the global `.star` grey rule.
  const fullColor = readOnly ? "filled" : "fill-yellow-400 !text-yellow-400";

  return (
    <div
      className={cn("flex items-center", className)}
      onMouseLeave={() => !readOnly && setHoverValue(null)}
    >
      <div className="star-rating">
        {stars.map((star) => {
          const isFull = star <= Math.floor(display);
          const isHalf =
            !hovering && star === Math.floor(display) + 1 && display % 1 !== 0;
          return (
            <span
              key={star}
              className={cn(
                "relative inline-flex",
                !readOnly && "cursor-pointer transition-transform hover:scale-[1.15]"
              )}
              role={!readOnly ? "button" : undefined}
              aria-label={!readOnly ? `Rate ${star} star${star > 1 ? "s" : ""}` : undefined}
              onMouseEnter={() => !readOnly && setHoverValue(star)}
              onClick={() => !readOnly && onChange?.(star)}
            >
              <Star
                className={cn(
                  "star",
                  sizeClasses[size],
                  isFull && fullColor
                )}
              />
              {isHalf && (
                <span
                  data-half
                  className="pointer-events-none absolute inset-0 w-1/2 overflow-hidden"
                >
                  <Star className={cn("star", sizeClasses[size], fullColor)} />
                </span>
              )}
            </span>
          );
        })}
      </div>
      {count !== undefined && (
        <span className="text-xs ml-1 text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
