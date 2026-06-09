import { render, screen, waitFor } from "@/test/utils";
import { useQuery } from "@tanstack/react-query";
import SearchPage from "@/app/search/page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("q=eggplant&filters=vegetarian"),
  usePathname: () => "/search",
  useParams: () => ({}),
}));

beforeAll(() => {
  // @ts-expect-error minimal jsdom stub
  global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
});

describe("SearchPage", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReturnValue({
      data: { recipes: [], total: 0 }, isLoading: false, isFetching: false, error: null,
    } as never);
  });

  it("reads the query from the URL and shows a back-to-home link + active filter", async () => {
    render(<SearchPage />);
    await waitFor(() => expect(screen.getByLabelText("Search recipes")).toHaveValue("eggplant"));
    const back = screen.getByRole("link", { name: /back to home/i });
    expect(back).toHaveAttribute("href", "/");
    expect(screen.getByText("Active filters:")).toBeInTheDocument();
  });
});
