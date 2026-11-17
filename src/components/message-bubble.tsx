"use client";

import { Flag, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Message, RALLY_USER } from "@/lib/mock-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  message: Message;
  isOwn: boolean;
  /** When set (others' messages only), shows a "Report message" menu. */
  onReport?: (message: Message) => void;
}

export default function MessageBubble({ message, isOwn, onReport }: Props) {
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
        <div className="flex items-center gap-1 mt-1">
          <p className="text-[10px] text-muted-foreground">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          {!isOwn && onReport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* Always visible (no hover-only affordance) so it works on touch. */}
                <button
                  type="button"
                  aria-label="Message options"
                  className="h-6 w-6 -my-1 inline-flex items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem className="text-red-600" onClick={() => onReport(message)}>
                  <Flag className="h-4 w-4 mr-2" />
                  {isRally ? "Report Rally reply" : "Report message"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
