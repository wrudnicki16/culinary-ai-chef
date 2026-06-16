import { describe, it, expect } from "vitest";
import { commentSchema } from "@/lib/types";

describe("commentSchema", () => {
  it("accepts a rating with no comment", () => {
    expect(commentSchema.safeParse({ rating: 4 }).success).toBe(true);
  });
  it("accepts a rating with a comment", () => {
    expect(commentSchema.safeParse({ comment: "Great recipe", rating: 5 }).success).toBe(true);
  });
  it("rejects a comment with no rating", () => {
    expect(commentSchema.safeParse({ comment: "Great recipe" }).success).toBe(false);
  });
  it("rejects an empty submission", () => {
    expect(commentSchema.safeParse({}).success).toBe(false);
  });
  it("rejects an out-of-range rating", () => {
    expect(commentSchema.safeParse({ rating: 6 }).success).toBe(false);
  });
});
