"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { type Conversation, getPlayerById } from "@/lib/mock-data";
import { getUser } from "@/lib/firestore";
import { Bot } from "lucide-react";

interface Props {
  conversation: Conversation;
  currentUserId: string;
}

export default function ConversationCard({ conversation, currentUserId }: Props) {
  const otherIds = conversation.participants.filter((id) => id !== currentUserId && id !== "ai");
  const hasAI = conversation.participants.includes("ai");
  const [displayName, setDisplayName] = useState<string>("Loading...");
  const [initial, setInitial] = useState<string>("?");

  useEffect(() => {
    let cancelled = false;
    async function loadNames() {
      const names: string[] = [];
      for (const id of otherIds) {
        // Try Firestore first, fall back to mock data
        const firestoreUser = await getUser(id);
        if (firestoreUser) {
          const name = firestoreUser.firstName
            ? `${firestoreUser.firstName} ${firestoreUser.lastName || ""}`.trim()
            : firestoreUser.name;
          names.push(name);
        } else {
          const mockPlayer = getPlayerById(id);
          if (mockPlayer) names.push(mockPlayer.name);
        }
      }
      if (!cancelled) {
        const finalName = names.join(", ") || "Unknown";
        setDisplayName(finalName);
        setInitial(finalName.charAt(0));
      }
    }
    loadNames();
    return () => { cancelled = true; };
  }, [otherIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <a href={`/dashboard/messages/${conversation.id}/`} className="block">
      <div className={cn(
        "flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b",
        conversation.unreadCount > 0 && "bg-primary/5"
      )}>
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-white font-bold">
            {initial}
          </div>
          {hasAI && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
              <Bot className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className={cn("font-medium text-sm truncate", conversation.unreadCount > 0 && "font-bold")}>
              {displayName}
            </p>
            <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(conversation.lastMessageAt)}</span>
          </div>
          <p className={cn("text-sm truncate", conversation.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
            {conversation.lastMessage}
          </p>
        </div>
        {conversation.unreadCount > 0 && (
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
            {conversation.unreadCount}
          </div>
        )}
      </div>
    </a>
  );
}
