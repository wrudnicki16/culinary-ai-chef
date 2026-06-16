import { describe, it, expect } from "vitest";
import { computeRatingAggregate } from "@/lib/rating-aggregate";

const d = (s: string) => new Date(s);

describe("computeRatingAggregate", () => {
  it("returns 0/0 when there are no ratings", () => {
    expect(computeRatingAggregate([])).toEqual({ rating: 0, ratingCount: 0 });
  });

  it("counts each user once using their most recent rating", () => {
    const rows = [
      { userId: "a", rating: 2, createdAt: d("2026-01-01") },
      { userId: "a", rating: 5, createdAt: d("2026-02-01") }, // a's latest = 5
      { userId: "b", rating: 4, createdAt: d("2026-01-15") },
    ];
    // latest per user: a=5, b=4 -> avg 4.5, count 2
    expect(computeRatingAggregate(rows)).toEqual({ rating: 4.5, ratingCount: 2 });
  });

  it("keeps the average to two decimal places", () => {
    const rows = [
      { userId: "a", rating: 3, createdAt: d("2026-01-01") },
      { userId: "b", rating: 4, createdAt: d("2026-01-01") },
      { userId: "c", rating: 4, createdAt: d("2026-01-01") },
    ];
    // avg 11/3 = 3.6666... -> 3.67, count 3
    expect(computeRatingAggregate(rows)).toEqual({ rating: 3.67, ratingCount: 3 });
  });
});
