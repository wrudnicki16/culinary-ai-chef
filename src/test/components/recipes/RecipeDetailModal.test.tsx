import { render, screen, userEvent, fireEvent } from "@/test/utils";
import { useSession } from "next-auth/react";
import { mockSession, mockRecipe, mockUser } from "@/test/utils";
import { RecipeDetailModal } from "@/components/recipes/recipe-detail-modal";
import type { Recipe } from "@/lib/types";

beforeAll(() => {
  // @ts-expect-error minimal jsdom stubs for Radix Dialog/Select
  global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
});

describe("RecipeDetailModal ratings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens the review form pre-filled when given an initialRating", () => {
    vi.mocked(useSession).mockReturnValue({ data: mockSession, status: "authenticated" } as never);
    render(<RecipeDetailModal recipe={mockRecipe} open initialRating={4} onClose={() => {}} />);
    expect(screen.getByText("Your Review")).toBeInTheDocument();
    expect(document.querySelectorAll(".fill-yellow-400").length).toBeGreaterThanOrEqual(4);
  });

  it("opens the form when an authenticated user clicks a star", async () => {
    vi.mocked(useSession).mockReturnValue({ data: mockSession, status: "authenticated" } as never);
    const user = userEvent.setup();
    render(<RecipeDetailModal recipe={mockRecipe} open onClose={() => {}} />);
    expect(screen.queryByText("Your Review")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Rate 5 stars" })[0]);
    expect(screen.getByText("Your Review")).toBeInTheDocument();
  });

  it("does not open the form for an unauthenticated click", async () => {
    vi.mocked(useSession).mockReturnValue({ data: null, status: "unauthenticated" } as never);
    const user = userEvent.setup();
    render(<RecipeDetailModal recipe={mockRecipe} open onClose={() => {}} />);
    await user.click(screen.getAllByRole("button", { name: "Rate 5 stars" })[0]);
    expect(screen.queryByText("Your Review")).not.toBeInTheDocument();
  });

  it("top picker rests on the rounded aggregate, previews the hovered star", () => {
    vi.mocked(useSession).mockReturnValue({ data: mockSession, status: "authenticated" } as never);
    render(<RecipeDetailModal recipe={mockRecipe} open onClose={() => {}} />);
    const picker = screen.getByTestId("top-star-picker");
    fireEvent.mouseEnter(picker);
    expect(picker.querySelectorAll(".fill-yellow-400")).toHaveLength(mockRecipe.rating);
    fireEvent.mouseEnter(screen.getAllByRole("button", { name: "Rate 2 stars" })[0]);
    expect(picker.querySelectorAll(".fill-yellow-400")).toHaveLength(2);
  });

  it("lets a user who already reviewed start an updated review", async () => {
    vi.mocked(useSession).mockReturnValue({ data: mockSession, status: "authenticated" } as never);
    const user = userEvent.setup();
    const reviewed = {
      ...mockRecipe,
      comments: [
        {
          id: 1,
          content: "Great!",
          rating: 5,
          user: { id: mockUser.id, firstName: "Test", lastName: "User", profileImageUrl: null },
        },
      ],
    };
    render(<RecipeDetailModal recipe={reviewed as never} open onClose={() => {}} />);
    expect(screen.getByText("Update Your Review")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Rate 4 stars" })[0]);
    expect(screen.getByText("Your Review")).toBeInTheDocument();
  });
});

// Preserved from the original servings-control test (do not drop this coverage):
// the modal still renders allergen pills, the servings control, and base macros.
const servingsRecipe: Recipe = {
  id: 1,
  title: "Test Bowl",
  description: "A tasty test bowl.",
  imageUrl: null,
  ingredients: [{ name: "rice", quantity: "2 cups" }],
  instructions: ["Cook rice."],
  cookingTime: 30,
  servings: 4,
  dietaryTags: ["Gluten Free", "High Protein"],
  nutritionInfo: { calories: 500, protein: 40, fat: 20, carbs: 60, fiber: 5 },
  rating: 4.5,
  ratingCount: 12,
  userId: "u1",
  comments: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  isAIGenerated: true,
  isVerified: true,
};

describe("RecipeDetailModal servings control", () => {
  it("renders allergen pills, a servings control, and base per-serving macros", () => {
    render(<RecipeDetailModal recipe={servingsRecipe} open={true} onClose={() => {}} />);
    expect(screen.getByText("Gluten-Free")).toBeInTheDocument();
    expect(screen.getByLabelText("Servings")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument(); // base per-serving calories
  });
});
