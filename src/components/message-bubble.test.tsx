import { render, screen } from "@testing-library/react";
import MessageBubble from "./message-bubble";
import type { Message } from "@/lib/mock-data";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "m1",
    conversationId: "c1",
    senderId: "u1",
    senderName: "Alice",
    text: "Hello there",
    createdAt: "2024-01-01T10:30:00Z",
    readBy: [],
    ...overrides,
  };
}

describe("MessageBubble", () => {
  it("renders own message without avatar or sender name", () => {
    render(<MessageBubble message={makeMessage()} isOwn />);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    // No avatar initial / sender label rendered for own messages
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.queryByText("A")).not.toBeInTheDocument();
  });

  it("renders other user's message with avatar initial and name", () => {
    render(<MessageBubble message={makeMessage()} isOwn={false} />);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows Rally styling when message.isAI is true", () => {
    render(<MessageBubble message={makeMessage({ isAI: true })} isOwn={false} />);
    expect(screen.getByText("Rally")).toBeInTheDocument();
    // Rally label uses accent color
    const label = screen.getByText("Rally");
    expect(label.className).toContain("text-accent");
  });

  it("shows Rally styling when senderId is 'rally'", () => {
    render(<MessageBubble message={makeMessage({ senderId: "rally" })} isOwn={false} />);
    expect(screen.getByText("Rally")).toBeInTheDocument();
  });

  it("shows Rally styling when senderId is 'ai'", () => {
    render(<MessageBubble message={makeMessage({ senderId: "ai" })} isOwn={false} />);
    expect(screen.getByText("Rally")).toBeInTheDocument();
  });

  it("formats the timestamp as a locale time string", () => {
    const message = makeMessage();
    render(<MessageBubble message={message} isOwn />);
    const expected = new Date(message.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
