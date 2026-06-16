import { render, screen, userEvent } from "@/test/utils";
import { useSession } from "next-auth/react";
import { mockSession, mockRecipe } from "@/test/utils";
import { RecipeDetailModal } from "@/components/recipes/recipe-detail-modal";

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
});
