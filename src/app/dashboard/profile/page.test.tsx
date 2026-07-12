import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Match, Player } from "@/lib/mock-data";
import { makePlayer, makeAuth } from "../../test-fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard/profile",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

vi.mock("@/lib/firestore", () => ({
  getMatches: vi.fn(),
  getPlayers: vi.fn(),
  updateUser: vi.fn(),
}));

const updateUserProfileMock = vi.fn();
let currentUser: Player | null;

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => makeAuth(currentUser, { updateUserProfile: updateUserProfileMock }),
}));

import { getMatches, getPlayers, updateUser } from "@/lib/firestore";
import ProfilePage from "./page";

function makeUser(): Player {
  return makePlayer({
    id: "me",
    name: "Me User",
    email: "me@example.com",
    firstName: "Me",
    lastName: "User",
    bio: "old bio",
    aboutMe: "I love tennis",
    sports: ["tennis"],
    matchFormats: ["singles"],
    weeklyAvailability: [
      { day: "Mon", enabled: true, slots: [{ start: 8, end: 12 }] },
      { day: "Wed", enabled: true, slots: [{ start: 17, end: 21 }] },
    ],
    partnerPreferences: {
      ageRange: "10",
      ntrpMin: 3.0,
      ntrpMax: 4.5,
      gameTypes: ["slightly-competitive"],
      sports: ["tennis"],
      matchFormats: ["singles"],
      genderPreference: "No Preference",
    },
  });
}

let matchesData: Match[];
let playersData: Player[];

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = makeUser();
  matchesData = [];
  playersData = [{ ...currentUser }];
  vi.mocked(getMatches).mockImplementation(async () => [...matchesData]);
  vi.mocked(getPlayers).mockImplementation(async () => [...playersData]);
  vi.mocked(updateUser).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (URL as unknown as Record<string, unknown>).createObjectURL;
  delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
});

async function switchToTab(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByRole("tab", { name }));
}

/**
 * jsdom's URL lacks the object-URL helpers; patch just those two statics so
 * `new URL(...)` (used by next/image) keeps working. Cleaned up in afterEach.
 */
function stubObjectURL() {
  const createObjectURL = vi.fn(() => "blob:preview");
  const revokeObjectURL = vi.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  return { createObjectURL, revokeObjectURL };
}

describe("ProfilePage", () => {
  it("renders the header, name, email and profile summary", async () => {
    render(<ProfilePage />);
    expect(await screen.findByRole("heading", { name: "Me User" })).toBeInTheDocument();
    expect(screen.getByText("me@example.com")).toBeInTheDocument();
    expect(screen.getByText("I love tennis")).toBeInTheDocument();
    expect(screen.getByText("NTRP 3.5")).toBeInTheDocument();
  });

  it("edits Basic Info, changes fields, picks an avatar and saves", async () => {
    render(<ProfilePage />);
    const user = userEvent.setup();
    await screen.findByText("Basic Info");

    const basicCard = screen.getByText("Basic Info").closest("div")!.parentElement!.parentElement!;
    await user.click(within(basicCard).getByRole("button", { name: /Edit/i }));

    // First Name is the first text input in the card
    const firstNameInput = within(basicCard).getAllByRole("textbox")[0];
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Newfirst");

    const aboutMe = basicCard.querySelector("textarea") as HTMLTextAreaElement;
    await user.clear(aboutMe);
    await user.type(aboutMe, "updated bio");

    // Pick an avatar emoji (keyboard-accessible button)
    await user.click(screen.getByRole("button", { name: "🔥" }));

    await user.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(
        "me",
        expect.objectContaining({
          firstName: "Newfirst",
          avatar: "🔥",
          aboutMe: "updated bio",
          bio: "updated bio",
          name: "Newfirst User",
        })
      );
      expect(updateUserProfileMock).toHaveBeenCalledWith(expect.objectContaining({ firstName: "Newfirst" }));
    });
  });

  it("cancels Basic Info edit and reverts", async () => {
    render(<ProfilePage />);
    const user = userEvent.setup();
    await screen.findByText("Basic Info");
    const basicCard = screen.getByText("Basic Info").closest("div")!.parentElement!.parentElement!;
    await user.click(within(basicCard).getByRole("button", { name: /Edit/i }));

    const firstNameInput = within(basicCard).getAllByRole("textbox")[0];
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Throwaway");

    // The cancel button is the icon-only X button next to Save
    const cancelBtn = within(basicCard).getAllByRole("button").find((b) => b.querySelector("svg.lucide-x"))!;
    await user.click(cancelBtn);

    // Back to read-only view; the throwaway change was not persisted
    expect(screen.queryByLabelText("First Name")).not.toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects a non-image photo upload with a toast (no crash)", async () => {
    render(<ProfilePage />);
    // Bypass the accept="image/*" filter so the handler's own guard runs.
    const user = userEvent.setup({ applyAccept: false });
    const basicCard = screen.getByText("Basic Info").closest("div")!.parentElement!.parentElement!;
    await user.click(within(basicCard).getByRole("button", { name: /Edit/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(["hello"], "notes.txt", { type: "text/plain" });
    await user.upload(fileInput, badFile);

    // No preview image is created for a rejected file
    expect(screen.queryByAltText("Preview")).not.toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid file" }));
  });

  it("rejects an oversized image upload", async () => {
    render(<ProfilePage />);
    const user = userEvent.setup();
    const basicCard = screen.getByText("Basic Info").closest("div")!.parentElement!.parentElement!;
    await user.click(within(basicCard).getByRole("button", { name: /Edit/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" });
    await user.upload(fileInput, big);

    expect(screen.queryByAltText("Preview")).not.toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "File too large" }));
  });

  it("uploads a valid image via POST /api/me/photo, previews it, then removes it", async () => {
    // jsdom lacks createObjectURL; stub it along with the upload endpoint.
    stubObjectURL();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ photoURL: "/uploads/me.png" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfilePage />);
    const user = userEvent.setup();
    const basicCard = screen.getByText("Basic Info").closest("div")!.parentElement!.parentElement!;
    await user.click(within(basicCard).getByRole("button", { name: /Edit/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const good = new File([new Uint8Array(1024)], "avatar.png", { type: "image/png" });
    await user.upload(fileInput, good);

    // The photo is POSTed to the upload endpoint and the preview swaps to the
    // server-returned URL.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/me/photo", expect.objectContaining({ method: "POST" }));
    });
    const preview = await screen.findByAltText("Preview");
    await waitFor(() => expect(preview.getAttribute("src")).toContain(encodeURIComponent("/uploads/me.png")));
    expect(toastMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Remove photo/i }));
    await waitFor(() => expect(screen.queryByAltText("Preview")).not.toBeInTheDocument());
  });

  it("reverts the preview and shows a toast when the photo upload fails", async () => {
    stubObjectURL();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Storage unavailable" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfilePage />);
    const user = userEvent.setup();
    const basicCard = screen.getByText("Basic Info").closest("div")!.parentElement!.parentElement!;
    await user.click(within(basicCard).getByRole("button", { name: /Edit/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const good = new File([new Uint8Array(1024)], "avatar.png", { type: "image/png" });
    await user.upload(fileInput, good);

    // Preview reverts to the previous (empty) state and the failure is toasted.
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Upload failed", description: "Storage unavailable", variant: "destructive" })
      );
    });
    expect(screen.queryByAltText("Preview")).not.toBeInTheDocument();
  });

  it("triggers the file picker via the Upload Photo button", async () => {
    render(<ProfilePage />);
    const user = userEvent.setup();
    const basicCard = screen.getByText("Basic Info").closest("div")!.parentElement!.parentElement!;
    await user.click(within(basicCard).getByRole("button", { name: /Edit/i }));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");
    await user.click(screen.getByRole("button", { name: /Upload Photo/i }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("edits Play Preferences via keyboard-accessible sport/format/game buttons and saves", async () => {
    render(<ProfilePage />);
    const user = userEvent.setup();
    const playCard = screen.getByText("Play Preferences").closest("div")!.parentElement!.parentElement!;
    await user.click(within(playCard).getByRole("button", { name: /Edit/i }));

    // Toggle pickleball sport on, doubles on, recreational game type
    await user.click(screen.getByRole("button", { name: "Pickleball" }));
    await user.click(screen.getByRole("button", { name: "doubles" }));
    await user.click(screen.getByRole("button", { name: "Recreational" }));

    await user.click(within(playCard).getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(
        "me",
        expect.objectContaining({
          sports: expect.arrayContaining(["tennis", "pickleball"]),
          matchFormats: expect.arrayContaining(["singles", "doubles"]),
          gameType: "recreational",
        })
      );
      expect(updateUserProfileMock).toHaveBeenCalledWith(expect.objectContaining({ gameType: "recreational" }));
    });
  });

  it("cancels Play Preferences edit", async () => {
    render(<ProfilePage />);
    const user = userEvent.setup();
    const playCard = screen.getByText("Play Preferences").closest("div")!.parentElement!.parentElement!;
    await user.click(within(playCard).getByRole("button", { name: /Edit/i }));
    await user.click(screen.getByRole("button", { name: "Pickleball" }));
    const cancelBtn = within(playCard).getAllByRole("button").find((b) => b.querySelector("svg.lucide-x"))!;
    await user.click(cancelBtn);
    expect(within(playCard).queryByText("Recreational")).not.toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("edits Availability grid and saves (>=3 slots)", async () => {
    render(<ProfilePage />);
    const user = userEvent.setup();
    await switchToTab(user, /Availability/i);

    // Read-only shows existing enabled days
    expect(await screen.findByText("Weekly Availability")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Edit/i }));

    // Select a few slots to reach >= 3
    await user.click(screen.getByRole("button", { name: "Tue Morning" }));
    await user.click(screen.getByRole("button", { name: "Thu Afternoon" }));
    await user.click(screen.getByRole("button", { name: "Fri Evening" }));
    await user.click(screen.getByRole("button", { name: "Sat Morning" }));

    const saveBtn = screen.getByRole("button", { name: /Save/i });
    expect(saveBtn).not.toBeDisabled();
    await user.click(saveBtn);

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith("me", {
        weeklyAvailability: expect.arrayContaining([
          expect.objectContaining({ day: "Tue", enabled: true }),
        ]),
      });
      expect(updateUserProfileMock).toHaveBeenCalled();
    });
  });

  it("disables availability save with fewer than 3 slots, then cancels", async () => {
    // A user with a single availability slot so opening the editor starts < 3.
    currentUser!.weeklyAvailability = [{ day: "Mon", enabled: true, slots: [{ start: 8, end: 12 }] }];
    render(<ProfilePage />);
    const user = userEvent.setup();
    await switchToTab(user, /Availability/i);
    await user.click(await screen.findByRole("button", { name: /Edit/i }));

    expect(screen.getByRole("button", { name: /Save/i })).toBeDisabled();
    const cancelBtn = screen.getAllByRole("button").find((b) => b.querySelector("svg.lucide-x"))!;
    await user.click(cancelBtn);
    expect(screen.queryByRole("button", { name: /Save/i })).not.toBeInTheDocument();
  });

  it("shows empty availability message when none set", async () => {
    currentUser!.weeklyAvailability = [];
    render(<ProfilePage />);
    const user = userEvent.setup();
    await switchToTab(user, /Availability/i);
    expect(await screen.findByText(/No availability set yet/i)).toBeInTheDocument();
  });

  it("edits Partner Preferences pills and saves", async () => {
    render(<ProfilePage />);
    const user = userEvent.setup();
    await switchToTab(user, /Partner Prefs/i);
    await user.click(await screen.findByRole("button", { name: /Edit/i }));

    await user.click(screen.getByRole("button", { name: "Female" }));
    await user.click(screen.getByRole("button", { name: "Hardcore Competitive" }));
    await user.click(screen.getByRole("button", { name: "Pickleball" }));
    await user.click(screen.getByRole("button", { name: "doubles" }));

    await user.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith("me", {
        partnerPreferences: expect.objectContaining({
          genderPreference: "Female",
          gameTypes: expect.arrayContaining(["hardcore-competitive"]),
          sports: expect.arrayContaining(["pickleball"]),
          matchFormats: expect.arrayContaining(["doubles"]),
        }),
      });
      expect(updateUserProfileMock).toHaveBeenCalled();
    });
  });

  it("cancels Partner Preferences edit and shows the read-only summary", async () => {
    render(<ProfilePage />);
    const user = userEvent.setup();
    await switchToTab(user, /Partner Prefs/i);
    await user.click(await screen.findByRole("button", { name: /Edit/i }));
    const cancelBtn = screen.getAllByRole("button").find((b) => b.querySelector("svg.lucide-x"))!;
    await user.click(cancelBtn);
    expect(await screen.findByText(/NTRP range/i)).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("shows 'No partner preferences set yet' when unset", async () => {
    currentUser!.partnerPreferences = undefined;
    render(<ProfilePage />);
    const user = userEvent.setup();
    await switchToTab(user, /Partner Prefs/i);
    expect(await screen.findByText(/No partner preferences set yet/i)).toBeInTheDocument();
  });

  it("renders the Stats tab with win rate and match history", async () => {
    matchesData = [
      {
        id: "hist1",
        player1Id: "me",
        player2Id: "opp",
        date: "2026-05-01",
        time: "10:00",
        location: "Court A",
        sport: "tennis",
        status: "completed",
        score: "6-3, 6-2",
        compatibilityScore: 0,
        matchExplanation: "",
        participants: ["me", "opp"],
      },
    ];
    playersData.push(makePlayer({ id: "opp", name: "Opponent", email: "opp@example.com", firstName: undefined, lastName: undefined }));
    render(<ProfilePage />);
    const user = userEvent.setup();
    await switchToTab(user, /Stats/i);

    expect(await screen.findByText("Win Rate")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument(); // 3 wins / 4 played
    await waitFor(() => expect(screen.getByText(/vs Opponent/i)).toBeInTheDocument());
    expect(screen.getByText("6-3, 6-2")).toBeInTheDocument();
  });

  it("shows empty match history when no completed matches", async () => {
    render(<ProfilePage />);
    const user = userEvent.setup();
    await switchToTab(user, /Stats/i);
    expect(await screen.findByText(/No completed matches yet/i)).toBeInTheDocument();
  });

  it("renders with a sparse user, falling back to defaults across all editors", async () => {
    // Strip optional fields so every `?? default` / `|| fallback` initializer runs.
    currentUser = {
      id: "me",
      name: "",
      email: "sparse@example.com",
      ntrpRating: undefined as unknown as number,
      avatar: "",
      location: "",
      availability: [],
      preferredTimes: [],
      sport: "tennis",
      matchesPlayed: undefined as unknown as number,
      wins: undefined as unknown as number,
      losses: undefined as unknown as number,
      bio: "",
      joinedDate: "2024-01-01",
      firstName: "Solo",
      lastName: "",
    };
    playersData = [{ ...currentUser }];

    render(<ProfilePage />);
    const user = userEvent.setup();

    // Header falls back to firstName/lastName join and initials
    expect(await screen.findByRole("heading", { name: /Solo/i })).toBeInTheDocument();

    // Open Basic Info edit → reset (X) to exercise resetBasic defaults
    const basicCard = screen.getByText("Basic Info").closest("div")!.parentElement!.parentElement!;
    await user.click(within(basicCard).getByRole("button", { name: /Edit/i }));
    const basicCancel = within(basicCard).getAllByRole("button").find((b) => b.querySelector("svg.lucide-x"))!;
    await user.click(basicCancel);

    // Open Play Preferences edit → reset defaults (ntrp 3.5, empty sports/formats)
    const playCard = screen.getByText("Play Preferences").closest("div")!.parentElement!.parentElement!;
    await user.click(within(playCard).getByRole("button", { name: /Edit/i }));
    const playCancel = within(playCard).getAllByRole("button").find((b) => b.querySelector("svg.lucide-x"))!;
    await user.click(playCancel);

    // Availability: no availability set → empty message; open editor and reset
    await switchToTab(user, /Availability/i);
    expect(await screen.findByText(/No availability set yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Edit/i }));
    const availCancel = screen.getAllByRole("button").find((b) => b.querySelector("svg.lucide-x"))!;
    await user.click(availCancel);

    // Partner prefs: unset → message; open editor and reset defaults
    await switchToTab(user, /Partner Prefs/i);
    expect(await screen.findByText(/No partner preferences set yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Edit/i }));
    const partnerCancel = screen.getAllByRole("button").find((b) => b.querySelector("svg.lucide-x"))!;
    await user.click(partnerCancel);

    // Stats: win rate 0 when no matches played
    await switchToTab(user, /Stats/i);
    expect(await screen.findByText("Win Rate")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("returns null when there is no auth user", async () => {
    currentUser = null;
    const { container } = render(<ProfilePage />);
    expect(container).toBeEmptyDOMElement();
  });
});
