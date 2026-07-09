import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DesktopSidebar from "./desktop-sidebar";

const usePathnameMock = vi.fn(() => "/dashboard");
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({}),
}));

const useNavBadgesMock = vi.fn(() => ({ messages: 0, notifications: 0 }));
vi.mock("@/hooks/use-nav-badges", () => ({
  useNavBadges: () => useNavBadgesMock(),
}));

const logoutMock = vi.fn();
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ logout: logoutMock }),
}));

describe("DesktopSidebar", () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue("/dashboard");
    useNavBadgesMock.mockReturnValue({ messages: 0, notifications: 0 });
    pushMock.mockClear();
    logoutMock.mockClear();
  });

  it("renders the brand and all nav items", () => {
    render(<DesktopSidebar />);
    expect(screen.getByText("PlayMatch")).toBeInTheDocument();
    for (const label of ["Dashboard", "Open Matches", "Messages", "Notifications", "My Profile", "Settings"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks the active route by pathname", () => {
    usePathnameMock.mockReturnValue("/dashboard/settings");
    render(<DesktopSidebar />);
    const settings = screen.getByText("Settings").closest("a");
    expect(settings?.className).toContain("bg-primary");
  });

  it("shows badge counts from useNavBadges", () => {
    useNavBadgesMock.mockReturnValue({ messages: 5, notifications: 2 });
    render(<DesktopSidebar />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders an active-styled badge when the badge route is active", () => {
    usePathnameMock.mockReturnValue("/dashboard/messages");
    useNavBadgesMock.mockReturnValue({ messages: 8, notifications: 0 });
    render(<DesktopSidebar />);
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("calls logout and navigates home on Sign Out", async () => {
    const user = userEvent.setup();
    render(<DesktopSidebar />);
    await user.click(screen.getByRole("button", { name: /sign out/i }));
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/");
  });
});
