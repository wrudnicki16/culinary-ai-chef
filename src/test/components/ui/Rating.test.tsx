import { render, screen, userEvent } from "@/test/utils";
import { Rating } from "@/components/ui/rating";

describe("Rating", () => {
  it("read-only renders amber filled stars and no buttons", () => {
    render(<Rating value={3} readOnly />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".star")).toHaveLength(5);
    expect(document.querySelectorAll(".star.filled")).toHaveLength(3);
    expect(document.querySelectorAll(".fill-yellow-400")).toHaveLength(0);
  });

  it("interactive fills yellow up to the resting value", () => {
    render(<Rating value={2} readOnly={false} onChange={() => {}} />);
    expect(document.querySelectorAll(".fill-yellow-400")).toHaveLength(2);
    expect(document.querySelectorAll(".star.filled")).toHaveLength(0);
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it("fills yellow up to the hovered star, then reverts on mouse leave", async () => {
    const user = userEvent.setup();
    render(<Rating value={0} readOnly={false} onChange={() => {}} />);
    const fourth = screen.getByRole("button", { name: "Rate 4 stars" });
    await user.hover(fourth);
    expect(document.querySelectorAll(".fill-yellow-400")).toHaveLength(4);
    await user.unhover(fourth);
    expect(document.querySelectorAll(".fill-yellow-400")).toHaveLength(0);
  });

  it("calls onChange with the clicked star", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rating value={0} readOnly={false} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Rate 5 stars" }));
    expect(onChange).toHaveBeenCalledWith(5);
  });
});
