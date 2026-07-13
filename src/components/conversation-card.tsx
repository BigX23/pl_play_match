"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { type Conversation, getPlayerById, RALLY_USER } from "@/lib/mock-data";
import { getUser } from "@/lib/data";
import { Users, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  conversation: Conversation;
  currentUserId: string;
  onDelete?: () => void;
}

export default function ConversationCard({ conversation, currentUserId, onDelete }: Props) {
  const otherIds = conversation.participants.filter((id) => id !== currentUserId && id !== RALLY_USER.id && id !== "ai");
  const isGroup = conversation.type === "group" || conversation.participants.includes(RALLY_USER.id) || conversation.participants.includes("ai");
  const hasRally = conversation.participants.includes(RALLY_USER.id) || conversation.participants.includes("ai");
  const [displayName, setDisplayName] = useState<string>("Loading…");
  const [initial, setInitial] = useState<string>("?");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const unread = conversation.unread?.[currentUserId] ?? 0;

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
        const dbUser = await getUser(id);
        if (dbUser) {
          names.push(dbUser.name); // privacy-safe "First L."
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
      <Link href={`/dashboard/messages/${conversation.id}/`} className="block">
        <div className={cn(
          "flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b",
          unread > 0 && "bg-primary/5"
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
                <p className={cn("font-medium text-sm truncate", unread > 0 && "font-bold")}>
                  {displayName}
                </p>
                {isGroup && <Badge variant="secondary" className="text-[10px] h-4 px-1 flex-shrink-0">Group</Badge>}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(conversation.lastMessageAt)}</span>
            </div>
            <p className={cn("text-sm truncate pr-6", unread > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
              {conversation.lastMessage}
            </p>
          </div>

          {/* Unread badge */}
          {unread > 0 && (
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
              {unread}
            </div>
          )}
        </div>
      </Link>

      {/* Delete button — always visible on touch, hover-reveal on desktop. */}
      {onDelete && (
        <>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Delete conversation"
            className="absolute right-2 bottom-2 h-8 w-8 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(true); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the conversation and all its messages for everyone in it. This can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { setConfirmDelete(false); onDelete(); }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
