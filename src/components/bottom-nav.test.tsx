import { render, screen } from "@testing-library/react";
import BottomNav from "./bottom-nav";

const usePathnameMock = vi.fn(() => "/dashboard");
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({}),
}));

const useNavBadgesMock = vi.fn(() => ({ messages: 0, notifications: 0 }));
vi.mock("@/hooks/use-nav-badges", () => ({
  useNavBadges: () => useNavBadgesMock(),
}));

describe("BottomNav", () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue("/dashboard");
    useNavBadgesMock.mockReturnValue({ messages: 0, notifications: 0 });
  });

  it("renders all nav items", () => {
    render(<BottomNav />);
    for (const label of ["Home", "Matches", "Messages", "Alerts", "Profile"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks the exact-match route active", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    render(<BottomNav />);
    const home = screen.getByText("Home").closest("a");
    expect(home?.className).toContain("text-primary");
  });

  it("marks a prefix route active (startsWith)", () => {
    usePathnameMock.mockReturnValue("/dashboard/messages/123");
    render(<BottomNav />);
    const messages = screen.getByText("Messages").closest("a");
    expect(messages?.className).toContain("text-primary");
    // Home should NOT be active because it requires exact match
    const home = screen.getByText("Home").closest("a");
    expect(home?.className).toContain("text-muted-foreground");
  });

  it("shows badge counts from useNavBadges", () => {
    useNavBadgesMock.mockReturnValue({ messages: 3, notifications: 7 });
    render(<BottomNav />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("hides badges when counts are zero", () => {
    useNavBadgesMock.mockReturnValue({ messages: 0, notifications: 0 });
    render(<BottomNav />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
