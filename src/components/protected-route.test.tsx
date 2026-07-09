import { render, screen } from "@testing-library/react";

const pushMock = vi.fn();
const usePathnameMock = vi.fn(() => "/dashboard");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => usePathnameMock(),
  useParams: () => ({}),
}));

const useAuthMock = vi.fn();
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

import ProtectedRoute from "./protected-route";

function setAuth(state: { isAuthenticated: boolean; profileComplete: boolean; loading: boolean }) {
  useAuthMock.mockReturnValue(state);
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    pushMock.mockClear();
    usePathnameMock.mockReturnValue("/dashboard");
  });

  it("renders a loading spinner while loading", () => {
    setAuth({ isAuthenticated: false, profileComplete: false, loading: true });
    const { container } = render(<ProtectedRoute><div>content</div></ProtectedRoute>);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(screen.queryByText("content")).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("redirects to /login when not authenticated", () => {
    setAuth({ isAuthenticated: false, profileComplete: false, loading: false });
    render(<ProtectedRoute><div>content</div></ProtectedRoute>);
    expect(pushMock).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("redirects to /onboarding when authed but profile incomplete", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    setAuth({ isAuthenticated: true, profileComplete: false, loading: false });
    render(<ProtectedRoute><div>content</div></ProtectedRoute>);
    expect(pushMock).toHaveBeenCalledWith("/onboarding");
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("renders children on the onboarding route even if profile incomplete", () => {
    usePathnameMock.mockReturnValue("/onboarding");
    setAuth({ isAuthenticated: true, profileComplete: false, loading: false });
    render(<ProtectedRoute><div>content</div></ProtectedRoute>);
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("renders children when authenticated and profile complete", () => {
    setAuth({ isAuthenticated: true, profileComplete: true, loading: false });
    render(<ProtectedRoute><div>content</div></ProtectedRoute>);
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
