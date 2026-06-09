import { render, screen, userEvent } from "@/test/utils";
import { SearchSection } from "@/components/sections/search-section";

describe("SearchSection", () => {
  it("submits the typed query on Enter", async () => {
    const onSearchSubmit = vi.fn();
    const user = userEvent.setup();
    render(<SearchSection onSearchSubmit={onSearchSubmit} />);
    await user.type(screen.getByRole("textbox"), "eggplant{Enter}");
    expect(onSearchSubmit).toHaveBeenCalledWith("eggplant");
  });

  it("does not submit an empty query", async () => {
    const onSearchSubmit = vi.fn();
    const user = userEvent.setup();
    render(<SearchSection onSearchSubmit={onSearchSubmit} />);
    await user.click(screen.getByRole("button"));
    expect(onSearchSubmit).not.toHaveBeenCalled();
  });
});
