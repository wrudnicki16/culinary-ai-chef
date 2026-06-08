import { render, screen, userEvent } from "@/test/utils";
import { useState } from "react";
import { FilterSidebar } from "@/components/recipes/filter-sidebar";

describe("FilterSidebar", () => {
  it("renders the three filter sections", () => {
    render(<FilterSidebar activeFilters={[]} onFilterChange={() => {}} />);
    expect(screen.getByText("Dietary Filters")).toBeInTheDocument();
    expect(screen.getByText("Diet Type")).toBeInTheDocument();
    expect(screen.getByText("Allergies & Restrictions")).toBeInTheDocument();
    expect(screen.getByText("Cuisine")).toBeInTheDocument();
  });

  it("collapses the cuisine list behind Load more", async () => {
    const user = userEvent.setup();
    render(<FilterSidebar activeFilters={[]} onFilterChange={() => {}} />);
    // Cuisine shows its first 7 (mediterranean…french); "Turkish" (index 8) is hidden.
    expect(screen.queryByRole("button", { name: "Turkish" })).not.toBeInTheDocument();
    // Load-more buttons in DOM order: [0] = Diet, [1] = Cuisine — click Cuisine's.
    await user.click(screen.getAllByRole("button", { name: /load more/i })[1]);
    expect(screen.getByRole("button", { name: "Turkish" })).toBeInTheDocument();
  });

  it("syncs selection when activeFilters changes (e.g. pill removed up top)", async () => {
    function Harness() {
      const [filters, setFilters] = useState<string[]>(["vegetarian"]);
      return (
        <div>
          <button onClick={() => setFilters([])}>clear-outside</button>
          <FilterSidebar activeFilters={filters} onFilterChange={() => {}} />
        </div>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Vegetarian" }).className).toContain("bg-primary");
    await user.click(screen.getByRole("button", { name: "clear-outside" }));
    expect(screen.getByRole("button", { name: "Vegetarian" }).className).not.toContain("bg-primary");
  });
});
