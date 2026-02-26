"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { type Conversation, getPlayerById, RALLY_USER } from "@/lib/mock-data";
import { getUser } from "@/lib/firestore";
import { Users, User, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  conversation: Conversation;
  currentUserId: string;
  onDelete?: () => void;
}

export default function ConversationCard({ conversation, currentUserId, onDelete }: Props) {
  const otherIds = conversation.participants.filter((id) => id !== currentUserId && id !== RALLY_USER.id && id !== "ai");
  const isGroup = conversation.type === "group" || conversation.participants.includes(RALLY_USER.id) || conversation.participants.includes("ai");
  const hasRally = conversation.participants.includes(RALLY_USER.id) || conversation.participants.includes("ai");
  const [displayName, setDisplayName] = useState<string>("Loading...");
  const [initial, setInitial] = useState<string>("?");

  useEffect(() => {
    let cancelled = false;
    async function loadNames() {
      // For group chats with a name, use that
      if (isGroup && conversation.name) {
        if (!cancelled) {
          setDisplayName(conversation.name);
          setInitial(conversation.name.charAt(0));
        }
        return;
      }
      const names: string[] = [];
      for (const id of otherIds) {
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
  }, [otherIds.join(","), isGroup, conversation.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="relative group">
      <a href={`/dashboard/messages/${conversation.id}/`} className="block">
        <div className={cn(
          "flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b",
          conversation.unreadCount > 0 && "bg-primary/5"
        )}>
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold",
              isGroup ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
            )}>
              {isGroup ? <Users className="h-5 w-5" /> : initial}
            </div>
            {hasRally && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-[10px]">
                🎾
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className={cn("font-medium text-sm truncate", conversation.unreadCount > 0 && "font-bold")}>
                  {displayName}
                </p>
                {isGroup && <Badge variant="secondary" className="text-[10px] h-4 px-1 flex-shrink-0">Group</Badge>}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(conversation.lastMessageAt)}</span>
            </div>
            <p className={cn("text-sm truncate", conversation.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
              {conversation.lastMessage}
            </p>
          </div>

          {/* Unread badge */}
          {conversation.unreadCount > 0 && (
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
              {conversation.unreadCount}
            </div>
          )}
        </div>
      </a>

      {/* Delete button (visible on hover / always on mobile) */}
      {onDelete && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
