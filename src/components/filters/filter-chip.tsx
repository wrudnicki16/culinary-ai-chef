import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface FilterChipProps {
  id: string;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  onRemove?: () => void;
  className?: string;
}

export function FilterChip({
  id,
  label,
  isActive = false,
  onClick,
  onRemove,
  className,
}: FilterChipProps) {
  return (
    <button
      className={cn(
        "filter-chip px-3 py-1 text-sm rounded-full transition-colors flex items-center",
        isActive
          ? "bg-primary text-white"
          : "bg-gray-100 hover:bg-gray-200 text-gray-800",
        className
      )}
      onClick={onClick}
      data-filter={id}
    >
      {label}
      {isActive && onRemove && (
        <span className="ml-1 cursor-pointer" onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}>
          <X className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}
