"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <div className="flex items-center gap-2 p-3 border-t bg-background">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message…"
        onKeyDown={(e) => {
          // Don't send mid-IME-composition (breaks CJK input).
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            handleSend();
          }
        }}
        disabled={disabled}
        className="flex-1"
      />
      <Button size="icon" onClick={handleSend} disabled={disabled || !text.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
