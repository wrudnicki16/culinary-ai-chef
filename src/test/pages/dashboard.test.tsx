import { render, screen } from "@/test/utils";
import { useSession } from "next-auth/react";
import { mockSession } from "@/test/utils";
import Dashboard from "@/app/dashboard/page";

beforeAll(() => {
  // @ts-expect-error minimal jsdom stub for Radix Tabs
  global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
});

describe("Dashboard", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({ data: mockSession, status: "authenticated" } as never);
  });

  it("renders one top tab bar, the profile, and no sidebar nav buttons", () => {
    render(<Dashboard />);
    expect(screen.getByRole("tab", { name: "Saved" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    // the old sidebar's "Generated History" button text no longer exists
    expect(screen.queryByText("Generated History")).not.toBeInTheDocument();
  });
});
