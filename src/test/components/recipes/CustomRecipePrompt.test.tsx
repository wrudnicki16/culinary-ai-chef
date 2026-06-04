import { render, screen, userEvent } from "@/test/utils";
import { CustomRecipePrompt } from "@/components/recipes/custom-recipe-prompt";

describe("CustomRecipePrompt", () => {
  it("submits the trimmed typed text", async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<CustomRecipePrompt onGenerate={onGenerate} disabled={false} />);

    await user.type(screen.getByRole("textbox"), "spicy tofu stir fry");
    await user.click(screen.getByRole("button", { name: /generate/i }));

    expect(onGenerate).toHaveBeenCalledWith("spicy tofu stir fry");
  });

  it("does not submit empty text", async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<CustomRecipePrompt onGenerate={onGenerate} disabled={false} />);
    await user.click(screen.getByRole("button", { name: /generate/i }));
    expect(onGenerate).not.toHaveBeenCalled();
  });
});
