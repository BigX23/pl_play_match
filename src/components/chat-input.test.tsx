import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fireEvent } from "@testing-library/react";
import ChatInput from "./chat-input";

describe("ChatInput", () => {
  it("types and sends on Enter, clearing the input", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByPlaceholderText("Type a message…") as HTMLInputElement;
    await user.type(input, "hello");
    await user.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledWith("hello");
    expect(input.value).toBe("");
  });

  it("sends via the send button", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput onSend={onSend} />);
    await user.type(screen.getByPlaceholderText("Type a message…"), "  hi there  ");
    // Button is the only role=button
    await user.click(screen.getByRole("button"));
    expect(onSend).toHaveBeenCalledWith("hi there");
  });

  it("does NOT send on Shift+Enter", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByPlaceholderText("Type a message…");
    await user.type(input, "hello");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does NOT send while composing (IME)", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByPlaceholderText("Type a message…");
    fireEvent.change(input, { target: { value: "こん" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send an empty/whitespace-only message on Enter", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByPlaceholderText("Type a message…");
    await user.type(input, "   ");
    await user.keyboard("{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables the send button when the input is empty", () => {
    render(<ChatInput onSend={vi.fn()} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("enables the send button once there is trimmed content", async () => {
    const user = userEvent.setup();
    render(<ChatInput onSend={vi.fn()} />);
    await user.type(screen.getByPlaceholderText("Type a message…"), "x");
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("disables input and button in the disabled state", () => {
    render(<ChatInput onSend={vi.fn()} disabled />);
    expect(screen.getByPlaceholderText("Type a message…")).toBeDisabled();
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
