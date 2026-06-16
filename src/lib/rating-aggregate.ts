export interface RatingRow {
  userId: string;
  rating: number;
  createdAt: Date;
}

/**
 * A recipe's aggregate rating from its rating-bearing comments. Each user
 * contributes one vote — their most recent rating — and the average is rounded
 * to a whole number (the recipes.rating column is an integer).
 */
export function computeRatingAggregate(
  rows: RatingRow[]
): { rating: number; ratingCount: number } {
  const latestByUser = new Map<string, RatingRow>();
  for (const row of rows) {
    const existing = latestByUser.get(row.userId);
    if (!existing || row.createdAt > existing.createdAt) {
      latestByUser.set(row.userId, row);
    }
  }
  const ratings = [...latestByUser.values()].map((r) => r.rating);
  if (ratings.length === 0) return { rating: 0, ratingCount: 0 };
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return { rating: Math.round(avg), ratingCount: ratings.length };
}
