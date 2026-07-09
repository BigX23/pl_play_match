"use client";

import { cn } from "@/lib/utils";
import { type Message, RALLY_USER } from "@/lib/mock-data";

interface Props {
  message: Message;
  isOwn: boolean;
}

export default function MessageBubble({ message, isOwn }: Props) {
  const isRally = message.isAI || message.senderId === RALLY_USER.id || message.senderId === "ai";

  return (
    <div className={cn("flex gap-2 mb-3", isOwn ? "justify-end" : "justify-start")}>
      {!isOwn && (
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
          isRally ? "bg-accent" : "bg-muted-foreground"
        )}>
          {message.senderName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className={cn("max-w-[75%]")}>
        {!isOwn && (
          <p className={cn("text-xs mb-1 font-medium", isRally ? "text-accent" : "text-muted-foreground")}>
            {isRally ? "Rally" : message.senderName}
          </p>
        )}
        <div className={cn(
          "rounded-2xl px-4 py-2 text-sm",
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-md"
            : isRally
              ? "bg-accent/10 text-foreground border border-accent/20 rounded-bl-md"
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
