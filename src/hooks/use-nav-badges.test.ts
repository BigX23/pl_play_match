import { renderHook, waitFor, act } from "@testing-library/react";
import type { Conversation, Notification } from "@/lib/mock-data";

const useAuthMock = vi.fn();
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

const subscribeConversationsMock = vi.fn();
const getNotificationsMock = vi.fn();
vi.mock("@/lib/data", () => ({
  subscribeConversations: (...args: unknown[]) => subscribeConversationsMock(...args),
  getNotifications: (...args: unknown[]) => getNotificationsMock(...args),
}));

import { useNavBadges } from "./use-nav-badges";

function makeConversation(unread: Record<string, number>): Conversation {
  return {
    id: "c" + Math.random(),
    participants: ["me"],
    type: "direct",
    lastMessage: "",
    lastMessageAt: "",
    unread,
    createdAt: "",
  };
}

function makeNotification(read: boolean): Notification {
  return { id: "n" + Math.random(), userId: "me", type: "new_message", title: "", body: "", read, createdAt: "" };
}

describe("useNavBadges", () => {
  beforeEach(() => {
    subscribeConversationsMock.mockReset();
    getNotificationsMock.mockReset();
    useAuthMock.mockReset();
  });

  it("returns zeros and does not subscribe when there is no user", () => {
    useAuthMock.mockReturnValue({ user: null });
    const { result } = renderHook(() => useNavBadges());
    expect(result.current).toEqual({ messages: 0, notifications: 0 });
    expect(subscribeConversationsMock).not.toHaveBeenCalled();
  });

  it("sums unread messages for the current user and counts unread notifications", async () => {
    useAuthMock.mockReturnValue({ user: { id: "me" } });
    let cb: (convs: Conversation[]) => void = () => {};
    subscribeConversationsMock.mockImplementation((userId: string, callback: typeof cb) => {
      expect(userId).toBe("me");
      cb = callback;
      return vi.fn();
    });
    getNotificationsMock.mockResolvedValue([
      makeNotification(false),
      makeNotification(false),
      makeNotification(true),
    ]);

    const { result } = renderHook(() => useNavBadges());

    act(() => {
      cb([makeConversation({ me: 2, other: 5 }), makeConversation({ me: 3 })]);
    });

    expect(result.current.messages).toBe(5);
    await waitFor(() => expect(result.current.notifications).toBe(2));
  });

  it("handles conversations missing unread entries for the user", async () => {
    useAuthMock.mockReturnValue({ user: { id: "me" } });
    let cb: (convs: Conversation[]) => void = () => {};
    subscribeConversationsMock.mockImplementation((_id: string, callback: typeof cb) => {
      cb = callback;
      return vi.fn();
    });
    getNotificationsMock.mockResolvedValue([]);

    const { result } = renderHook(() => useNavBadges());
    act(() => {
      cb([makeConversation({ other: 9 }), makeConversation({})]);
    });
    expect(result.current.messages).toBe(0);
    await waitFor(() => expect(result.current.notifications).toBe(0));
  });

  it("calls the unsubscribe function on unmount", () => {
    useAuthMock.mockReturnValue({ user: { id: "me" } });
    const unsub = vi.fn();
    subscribeConversationsMock.mockReturnValue(unsub);
    getNotificationsMock.mockResolvedValue([]);
    const { unmount } = renderHook(() => useNavBadges());
    unmount();
    expect(unsub).toHaveBeenCalled();
  });
});
