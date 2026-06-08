import { DIETARY_FILTERS } from "./utils";

// Filterable tag vocabularies (meal type is not a filterable dietary tag).
const TAG_GROUPS = [
  DIETARY_FILTERS.dietType,
  DIETARY_FILTERS.allergies,
  DIETARY_FILTERS.cuisines,
];

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// normalized(id OR label) -> canonical id
const ID_BY_NORM: Record<string, string> = {};
// canonical id -> label
const LABEL_BY_ID: Record<string, string> = {};
for (const group of TAG_GROUPS) {
  for (const { id, label } of group) {
    ID_BY_NORM[normalize(id)] = id;
    ID_BY_NORM[normalize(label)] = id;
    LABEL_BY_ID[id] = label;
  }
}

/** Normalize any tag string to its canonical filter id; unknown tags pass through. */
export function toDietaryTagId(tag: string): string {
  return ID_BY_NORM[normalize(tag)] ?? tag;
}

/** Map a tag (id or label-shaped) to its display label; unknown tags pass through. */
export function dietaryTagLabel(tag: string): string {
  return LABEL_BY_ID[toDietaryTagId(tag)] ?? tag;
}

/** Union of existing + requested tags, normalized to canonical ids and deduped. */
export function mergeDietaryTags(existing: string[], requested: string[]): string[] {
  return Array.from(new Set([...existing, ...requested].map(toDietaryTagId)));
}
