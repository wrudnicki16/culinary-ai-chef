import { render, screen } from "@/test/utils";
import { FilterSidebar } from "@/components/recipes/filter-sidebar";

describe("FilterSidebar", () => {
  it("renders the three filter sections without crashing", () => {
    render(<FilterSidebar activeFilters={[]} onFilterChange={() => {}} />);
    expect(screen.getByText("Dietary Filters")).toBeInTheDocument();
    expect(screen.getByText("Diet Type")).toBeInTheDocument();
    expect(screen.getByText("Allergies & Restrictions")).toBeInTheDocument();
    expect(screen.getByText("Cuisine")).toBeInTheDocument();
  });
});
