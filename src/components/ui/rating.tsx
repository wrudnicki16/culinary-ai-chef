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
  className
}: RatingProps) {
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  
  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg"
  };
  
  return (
    <div className={cn("flex items-center", className)}>
      <div className="star-rating">
        {stars.map((star) => (
          <Star
            key={star}
            className={cn(
              "star", 
              star <= value ? "filled" : "",
              sizeClasses[size],
              !readOnly && "cursor-pointer hover:scale-110 transition-transform"
            )}
            onClick={() => !readOnly && onChange?.(star)}
          />
        ))}
      </div>
      {count !== undefined && (
        <span className="text-xs ml-1 text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
