import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ConversationPage, { generateStaticParams } from "./page";

vi.mock("./chat-client", () => ({ default: () => <div data-testid="chat-client" /> }));

describe("ConversationPage wrapper", () => {
  it("renders the chat client", () => {
    render(<ConversationPage />);
    expect(screen.getByTestId("chat-client")).toBeInTheDocument();
  });

  it("generateStaticParams returns the placeholder param", async () => {
    expect(await generateStaticParams()).toEqual([{ conversationId: "placeholder" }]);
  });
});
