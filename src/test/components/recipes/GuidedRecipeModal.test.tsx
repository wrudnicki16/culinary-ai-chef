import { render, screen, userEvent } from "@/test/utils";
import { GuidedRecipeModal } from "@/components/recipes/guided-recipe-modal";

beforeAll(() => {
  // @ts-expect-error minimal stub for Radix in jsdom
  global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
});

describe("GuidedRecipeModal", () => {
  it("shows Surprise me when nothing is selected", () => {
    render(<GuidedRecipeModal open onClose={() => {}} onGenerate={() => {}} />);
    expect(screen.getByRole("button", { name: /surprise me/i })).toBeInTheDocument();
  });

  it("switches to Generate and emits prompt + filters once a pill is picked", async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<GuidedRecipeModal open onClose={() => {}} onGenerate={onGenerate} />);

    await user.click(screen.getByText("Keto"));
    const generate = screen.getByRole("button", { name: /generate recipe/i });
    expect(generate).toBeInTheDocument();

    await user.click(generate);
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const [prompt, filters] = onGenerate.mock.calls[0];
    expect(prompt.toLowerCase()).toContain("keto");
    expect(filters).toEqual(["keto"]);
  });

  it("emits the surprise prompt with no filters when nothing is selected", async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<GuidedRecipeModal open onClose={() => {}} onGenerate={onGenerate} />);
    await user.click(screen.getByRole("button", { name: /surprise me/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const [prompt, filters] = onGenerate.mock.calls[0];
    expect(prompt.toLowerCase()).toContain("surprise");
    expect(filters).toEqual([]);
  });

  it("reveals more diet options in steps and collapses with See less", async () => {
    const user = userEvent.setup();
    render(<GuidedRecipeModal open onClose={() => {}} onGenerate={() => {}} />);

    // The 5th diet option is hidden behind "Load more" initially.
    expect(screen.queryByText("High Protein")).not.toBeInTheDocument();

    // Diet is the first section, so its "Load more" is the first such button.
    await user.click(screen.getAllByRole("button", { name: /load more/i })[0]);
    expect(screen.getByText("High Protein")).toBeInTheDocument();

    // Fully expanded now → "See less" collapses back to the initial 4.
    await user.click(screen.getByRole("button", { name: /see less/i }));
    expect(screen.queryByText("High Protein")).not.toBeInTheDocument();
  });
});
