import { renderHook } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { AllProviders, mockSession } from "@/test/utils";
import { useRatingGate } from "@/hooks/useRatingGate";

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));

describe("useRatingGate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs proceed when authenticated", () => {
    vi.mocked(useSession).mockReturnValue({ data: mockSession, status: "authenticated" } as never);
    const { result } = renderHook(() => useRatingGate(), { wrapper: AllProviders });
    const proceed = vi.fn();
    result.current(proceed);
    expect(proceed).toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("blocks and prompts sign-in when unauthenticated", () => {
    vi.mocked(useSession).mockReturnValue({ data: null, status: "unauthenticated" } as never);
    const { result } = renderHook(() => useRatingGate(), { wrapper: AllProviders });
    const proceed = vi.fn();
    result.current(proceed);
    expect(proceed).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Sign in to rate" })
    );
  });
});
