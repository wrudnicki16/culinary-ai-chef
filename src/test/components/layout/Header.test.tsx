import { render, screen } from "@/test/utils";
import { useSession } from "next-auth/react";
import { mockSession } from "@/test/utils";
import { Header } from "@/components/layout/header";

describe("Header", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({ data: mockSession, status: "authenticated" } as never);
  });

  it("shows a heart link to the dashboard and no bookmark", () => {
    render(<Header />);
    const heart = screen.getByRole("link", { name: /saved recipes/i });
    expect(heart).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("button", { name: /bookmark/i })).not.toBeInTheDocument();
  });
});
