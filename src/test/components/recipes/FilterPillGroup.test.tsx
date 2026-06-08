import { render, screen, userEvent } from "@/test/utils";
import { FilterPillGroup } from "@/components/recipes/filter-pill-group";

const items = Array.from({ length: 15 }, (_, i) => ({ id: `i${i}`, label: `Item ${i}` }));

describe("FilterPillGroup", () => {
  it("calls onToggle with the id when a pill is clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<FilterPillGroup items={items.slice(0, 3)} selectedIds={[]} onToggle={onToggle} />);
    await user.click(screen.getByRole("button", { name: "Item 1" }));
    expect(onToggle).toHaveBeenCalledWith("i1");
  });

  it("shows everything and no Load more when initialCount is omitted", () => {
    render(<FilterPillGroup items={items.slice(0, 3)} selectedIds={[]} onToggle={() => {}} />);
    expect(screen.getByText("Item 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("reveals +10 per Load more, then collapses with See less", async () => {
    const user = userEvent.setup();
    render(<FilterPillGroup items={items} selectedIds={[]} onToggle={() => {}} initialCount={4} />);
    expect(screen.queryByText("Item 4")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /load more/i }));
    expect(screen.getByText("Item 4")).toBeInTheDocument();
    expect(screen.queryByText("Item 14")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /load more/i }));
    expect(screen.getByText("Item 14")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /see less/i }));
    expect(screen.queryByText("Item 4")).not.toBeInTheDocument();
  });

  it("marks selected pills active", () => {
    render(<FilterPillGroup items={items.slice(0, 3)} selectedIds={["i1"]} onToggle={() => {}} />);
    expect(screen.getByRole("button", { name: "Item 1" }).className).toContain("bg-primary");
  });
});
