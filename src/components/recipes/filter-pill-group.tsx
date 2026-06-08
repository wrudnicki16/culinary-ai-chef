"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/filters/filter-chip";

const LOAD_STEP = 10;

interface FilterPillGroupProps {
  items: { id: string; label: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** When set and items exceed it, the group shows this many and adds Load-more/See-less. */
  initialCount?: number;
}

export function FilterPillGroup({ items, selectedIds, onToggle, initialCount }: FilterPillGroupProps) {
  const base = initialCount ?? items.length;
  const [visible, setVisible] = useState(base);
  const hasLoadMore = items.length > base;
  const shown = items.slice(0, visible);

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((f) => (
        <FilterChip
          key={f.id}
          id={f.id}
          label={f.label}
          isActive={selectedIds.includes(f.id)}
          onClick={() => onToggle(f.id)}
        />
      ))}
      {hasLoadMore && visible < items.length && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-gray-600"
          onClick={() => setVisible((v) => Math.min(v + LOAD_STEP, items.length))}
        >
          Load more
        </Button>
      )}
      {hasLoadMore && visible >= items.length && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-gray-600"
          onClick={() => setVisible(base)}
        >
          See less
        </Button>
      )}
    </div>
  );
}
