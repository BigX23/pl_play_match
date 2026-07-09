"use client";

import { cn } from "@/lib/utils";
import { type Notification } from "@/lib/mock-data";
import { MessageSquare, UserPlus, CheckCircle, Clock, Bot } from "lucide-react";
import Link from "next/link";

const icons: Record<string, typeof MessageSquare> = {
  new_message: MessageSquare,
  match_invitation: UserPlus,
  match_request: UserPlus,
  match_confirmed: CheckCircle,
  match_accepted: CheckCircle,
  match_declined: Clock,
  match_reminder: Clock,
  ai_suggestion: Bot,
};

const colors: Record<string, string> = {
  new_message: "text-blue-500",
  match_invitation: "text-purple-500",
  match_request: "text-purple-500",
  match_confirmed: "text-green-500",
  match_accepted: "text-green-500",
  match_declined: "text-muted-foreground",
  match_reminder: "text-yellow-600",
  ai_suggestion: "text-accent",
};

interface Props {
  notification: Notification;
  onMarkRead?: (id: string) => void;
}

export default function NotificationCard({ notification, onMarkRead }: Props) {
  const Icon = icons[notification.type] || MessageSquare;
  const color = colors[notification.type] || "text-muted-foreground";

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const content = (
    <div
      role={notification.link ? undefined : "button"}
      tabIndex={notification.link ? undefined : 0}
      className={cn(
        "flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors border-b cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        !notification.read && "bg-primary/5"
      )}
      onClick={() => onMarkRead?.(notification.id)}
      onKeyDown={(e) => {
        if (!notification.link && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onMarkRead?.(notification.id);
        }
      }}
    >
      <div className={cn("flex-shrink-0 mt-0.5", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className={cn("text-sm font-medium", !notification.read && "font-bold")}>{notification.title}</p>
          {!notification.read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{notification.body}</p>
        <p className="text-xs text-muted-foreground mt-1">{timeAgo(notification.createdAt)}</p>
      </div>
    </div>
  );

  return notification.link ? <Link href={notification.link}>{content}</Link> : content;
}
