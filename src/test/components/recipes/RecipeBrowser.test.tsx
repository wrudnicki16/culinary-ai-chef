import { render, screen, waitFor, userEvent } from "@/test/utils";
import { RecipeBrowser } from "@/components/recipes/recipe-browser";
import type { Recipe } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

beforeAll(() => {
  (global as unknown as Record<string, unknown>).ResizeObserver =
    (global as unknown as Record<string, unknown>).ResizeObserver ||
    class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
});

const recipe = {
  id: 7, title: "Eggplant Parmesan", description: "Cheesy bake.", imageUrl: null,
  ingredients: [], instructions: [], cookingTime: 30, servings: 4,
  dietaryTags: ["vegetarian", "italian"], nutritionInfo: { calories: 500, protein: 20, fat: 20, carbs: 50 },
  rating: 0, ratingCount: 0, userId: "u1", createdAt: new Date(), updatedAt: new Date(),
  isAIGenerated: true, isVerified: true,
} as unknown as Recipe;

describe("RecipeBrowser", () => {
  beforeEach(() => {
    // The global test setup mocks @tanstack/react-query; wire useQuery to return our recipe.
    vi.mocked(useQuery).mockReturnValue({
      data: { recipes: [recipe], total: 1 },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true, status: 200, json: () => Promise.resolve({ recipes: [recipe], total: 1 }),
    } as Response));
  });

  it("renders the sidebar and the fetched recipe, and shows active-filter pills", async () => {
    const onParamsChange = vi.fn();
    render(
      <RecipeBrowser
        params={{ search: "", filters: ["vegetarian"], sort: "popular" }}
        onParamsChange={onParamsChange}
        onRecipeClick={() => {}}
      />
    );
    expect(screen.getByText("Dietary Filters")).toBeInTheDocument();
    expect(screen.getByText("Active filters:")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Eggplant Parmesan")).toBeInTheDocument());
  });

  it("shows a clear button when the search has text and clears it on click", async () => {
    const user = userEvent.setup();
    render(
      <RecipeBrowser
        params={{ search: "eggplant", filters: [], sort: "popular" }}
        onParamsChange={() => {}}
        onRecipeClick={() => {}}
        showSearch
      />
    );
    const input = screen.getByLabelText("Search recipes");
    expect(input).toHaveValue("eggplant");
    await user.click(screen.getByLabelText("Clear search"));
    expect(input).toHaveValue("");
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
  });

  it("calls onRecipeClick when a card is clicked", async () => {
    const onRecipeClick = vi.fn();
    const user = userEvent.setup();
    render(
      <RecipeBrowser
        params={{ search: "", filters: [], sort: "popular" }}
        onParamsChange={() => {}}
        onRecipeClick={onRecipeClick}
      />
    );
    await waitFor(() => expect(screen.getByText("Eggplant Parmesan")).toBeInTheDocument());
    await user.click(screen.getByText("Eggplant Parmesan"));
    expect(onRecipeClick).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });
});
