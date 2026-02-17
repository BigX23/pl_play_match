"use client";

import { cn } from "@/lib/utils";
import { Bot } from "lucide-react";
import { type Message } from "@/lib/mock-data";

interface Props {
  message: Message;
  isOwn: boolean;
}

export default function MessageBubble({ message, isOwn }: Props) {
  const isAI = message.isAI || message.senderId === "ai";

  return (
    <div className={cn("flex gap-2 mb-3", isOwn ? "justify-end" : "justify-start")}>
      {!isOwn && (
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
          isAI ? "bg-orange-500" : "bg-gray-400"
        )}>
          {isAI ? <Bot className="h-4 w-4" /> : message.senderName.charAt(0)}
        </div>
      )}
      <div className={cn("max-w-[75%]")}>
        {!isOwn && (
          <p className={cn("text-xs mb-1 font-medium", isAI ? "text-orange-600" : "text-muted-foreground")}>
            {message.senderName}
          </p>
        )}
        <div className={cn(
          "rounded-2xl px-4 py-2 text-sm",
          isOwn
            ? "bg-green-600 text-white rounded-br-md"
            : isAI
              ? "bg-orange-100 dark:bg-orange-950 text-foreground border border-orange-200 dark:border-orange-800 rounded-bl-md"
              : "bg-muted rounded-bl-md"
        )}>
          {message.text}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
