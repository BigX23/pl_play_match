import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { players, type Player } from "@/lib/mock-data";
import * as fs from "@/lib/firestore";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => "/onboarding",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

const updateUserProfileMock = vi.fn();
const setProfileCompleteMock = vi.fn();

function makeUser(): Player {
  return {
    id: "me",
    name: "",
    email: "me@example.com",
    ntrpRating: 3.5,
    avatar: "",
    location: "",
    availability: [],
    preferredTimes: [],
    sport: "tennis",
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    bio: "",
    joinedDate: "2024-01-01",
    firstName: "",
    lastName: "",
  };
}

let currentUser: Player | null = makeUser();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: currentUser,
    firebaseUser: null,
    isAuthenticated: true,
    profileComplete: false,
    loading: false,
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    resetPassword: vi.fn(),
    deleteAccount: vi.fn(),
    setProfileComplete: setProfileCompleteMock,
    updateUserProfile: updateUserProfileMock,
  }),
}));

import OnboardingPage from "./page";

beforeEach(() => {
  players.length = 0;
  pushMock.mockClear();
  updateUserProfileMock.mockClear();
  setProfileCompleteMock.mockClear();
  fs.__resetMockState();
  currentUser = makeUser();
  players.push({ ...currentUser });
});

/** Fill out step 1 fields and click Next. */
async function completeStep1(user: ReturnType<typeof userEvent.setup>) {
  const textboxes = screen.getAllByRole("textbox"); // first, last, about (age is spinbutton)
  await user.type(textboxes[0], "Alex");
  await user.type(textboxes[1], "Rivera");
  await user.type(screen.getByRole("spinbutton"), "28");

  // Radix gender Select
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: "Male" }));

  // Pick an avatar emoji
  await user.click(screen.getByRole("button", { name: "🎾" }));

  const next = screen.getByRole("button", { name: "Next" });
  await waitFor(() => expect(next).not.toBeDisabled());
  await user.click(next);
}

async function completeStep2(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Tennis" }));
  await user.click(screen.getByRole("button", { name: "singles" }));
  // gameType default is already set (slightly-competitive); still click to be explicit
  await user.click(screen.getByRole("button", { name: "Recreational" }));
  const next = screen.getByRole("button", { name: "Next" });
  await waitFor(() => expect(next).not.toBeDisabled());
  await user.click(next);
}

async function completeStep3(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Mon Morning" }));
  await user.click(screen.getByRole("button", { name: "Tue Afternoon" }));
  await user.click(screen.getByRole("button", { name: "Wed Evening" }));
  const next = screen.getByRole("button", { name: "Next" });
  await waitFor(() => expect(next).not.toBeDisabled());
  await user.click(next);
}

async function completeStep4(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Female" }));
  await user.click(screen.getByRole("button", { name: "Slightly Competitive" }));
  await user.click(screen.getByRole("button", { name: "Tennis" }));
  await user.click(screen.getByRole("button", { name: "singles" }));
}

describe("OnboardingPage", () => {
  it("renders step 1 with the progress heading", () => {
    render(<OnboardingPage />);
    expect(screen.getByText("Set Up Your Profile")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    // Next is disabled until step 1 is valid
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("gates Next on step 1 until all required fields are filled", async () => {
    render(<OnboardingPage />);
    const user = userEvent.setup();
    const textboxes = screen.getAllByRole("textbox");
    await user.type(textboxes[0], "Alex");
    // still disabled without lastName/age/gender/avatar
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("opens the NTRP info dialog on step 2", async () => {
    render(<OnboardingPage />);
    const user = userEvent.setup();
    await completeStep1(user);

    expect(await screen.findByText("Play Preferences")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /What is NTRP/i }));
    expect(await screen.findByText("NTRP Skill Levels")).toBeInTheDocument();
  });

  it("navigates back from step 2 to step 1", async () => {
    render(<OnboardingPage />);
    const user = userEvent.setup();
    await completeStep1(user);
    await screen.findByText("Play Preferences");
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("Basic Info")).toBeInTheDocument();
  });

  it("walks all four steps and completes the profile", async () => {
    render(<OnboardingPage />);
    const user = userEvent.setup();

    await completeStep1(user);
    expect(await screen.findByText("Play Preferences")).toBeInTheDocument();

    await completeStep2(user);
    expect(await screen.findByText("Your Availability")).toBeInTheDocument();

    await completeStep3(user);
    expect(await screen.findByText("Partner Preferences")).toBeInTheDocument();

    await completeStep4(user);
    const complete = screen.getByRole("button", { name: /Complete Profile/i });
    await waitFor(() => expect(complete).not.toBeDisabled());
    await user.click(complete);

    await waitFor(() => {
      expect(updateUserProfileMock).toHaveBeenCalled();
      expect(setProfileCompleteMock).toHaveBeenCalledWith(true);
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });

    // Persisted to the mock player store
    const p = players.find((x) => x.id === "me")!;
    expect(p.firstName).toBe("Alex");
    expect(p.profileComplete).toBe(true);
  });

  it("toggles an availability slot off again (branch coverage)", async () => {
    render(<OnboardingPage />);
    const user = userEvent.setup();
    await completeStep1(user);
    await completeStep2(user);
    await screen.findByText("Your Availability");

    const slot = screen.getByRole("button", { name: "Mon Morning" });
    await user.click(slot); // on
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    await user.click(slot); // off again
    expect(screen.getByText("0 selected")).toBeInTheDocument();
  });

  it("completes even when no auth user is present (guards the updateUser call)", async () => {
    currentUser = null;
    render(<OnboardingPage />);
    const user = userEvent.setup();
    await completeStep1(user);
    await completeStep2(user);
    await completeStep3(user);
    await completeStep4(user);
    const complete = screen.getByRole("button", { name: /Complete Profile/i });
    await waitFor(() => expect(complete).not.toBeDisabled());
    await user.click(complete);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });
});
