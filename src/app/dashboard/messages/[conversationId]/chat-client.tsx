"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeMessages,
  sendMessage,
  getUser,
  getConversation,
  addContact,
  deleteConversation,
  markConversationRead,
} from "@/lib/data";
import { type Message, type Conversation, getPlayerById, RALLY_USER } from "@/lib/mock-data";
import { shouldRallyRespond } from "@/lib/ai-assistant";
import MessageBubble from "@/components/message-bubble";
import RallyTyping from "@/components/rally-typing";
import ChatInput from "@/components/chat-input";
import { ArrowLeft, Users, User, Trash2, UserPlus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/** Group messages by calendar day for date separators. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export default function ChatPage() {
  const pathname = usePathname();
  // Extract conversation ID from the URL (useParams returns "placeholder" on
  // static-export full-page loads; trailing slash is stripped for trailingSlash:true).
  const segments = pathname.replace(/\/+$/, "").split("/");
  const conversationId = segments[segments.length - 1] || "";
  const { user } = useAuth();
  const router = useRouter();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rallyTyping, setRallyTyping] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const stopTyping = () => {
    setRallyTyping(false);
    if (typingTimeout.current) { clearTimeout(typingTimeout.current); typingTimeout.current = null; }
  };
  useEffect(() => () => { if (typingTimeout.current) clearTimeout(typingTimeout.current); }, []);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});

  // Load conversation metadata
  useEffect(() => {
    if (!conversationId || conversationId === "placeholder") return;
    setLoading(true);
    getConversation(conversationId)
      .then((conv) => { if (conv) setConversation(conv); })
      .finally(() => setLoading(false));
  }, [conversationId]);

  // Load participant names
  useEffect(() => {
    if (!conversation || !user) return;
    let cancelled = false;
    const otherIds = conversation.participants.filter((id) => id !== user.id);

    async function loadNames() {
      const names: Record<string, string> = { [RALLY_USER.id]: RALLY_USER.name };
      for (const id of otherIds) {
        if (id === RALLY_USER.id || id === "ai") { names[id] = RALLY_USER.name; continue; }
        const dbUser = await getUser(id);
        if (dbUser) {
          names[id] = dbUser.name; // privacy-safe "First L."
        } else {
          names[id] = getPlayerById(id)?.name || "Unknown";
        }
      }
      if (!cancelled) setParticipantNames(names);
    }
    loadNames();
    return () => { cancelled = true; };
  }, [conversation, user]);

  // Live-subscribe to messages
  useEffect(() => {
    if (!conversationId || conversationId === "placeholder") return;
    const unsub = subscribeMessages(conversationId, setMsgs);
    return unsub;
  }, [conversationId]);

  // Mark read whenever this conversation is open and new messages arrive
  useEffect(() => {
    if (!user || !conversationId || conversationId === "placeholder") return;
    markConversationRead(conversationId, user.id);
  }, [user, conversationId, msgs.length]);

  // Clear the "Rally is typing" indicator once Rally's reply actually arrives.
  useEffect(() => {
    if (rallyTyping && msgs.length && msgs[msgs.length - 1].senderId === RALLY_USER.id) {
      stopTyping();
    }
  }, [msgs, rallyTyping]);

  // Auto-scroll (also when the typing indicator appears)
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, rallyTyping]);

  const isGroup = conversation?.type === "group" || conversation?.participants?.includes("rally") || conversation?.participants?.includes("ai");
  const hasRally = conversation?.participants?.includes(RALLY_USER.id) || conversation?.participants?.includes("ai");
  const otherHumanIds = conversation?.participants?.filter((id) => id !== user?.id && id !== RALLY_USER.id && id !== "ai") ?? [];

  const title = conversation?.name
    || (otherHumanIds.length > 0
      ? otherHumanIds.map((id) => participantNames[id] || "…").join(", ")
      : "Chat");

  const handleSend = async (text: string) => {
    if (!user || !conversationId) return;
    // If Rally will reply (server-side), show a typing indicator right away so
    // the user knows a response is coming. Cleared when the reply arrives, or
    // after a timeout if generation fails silently.
    if (hasRally && shouldRallyRespond(text)) {
      setRallyTyping(true);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setRallyTyping(false), 90_000);
    }
    const sent = await sendMessage(conversationId, text);
    // Show immediately; the poll/stream refresh keeps it consistent.
    setMsgs((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
  };

  const handleDelete = async () => {
    if (!conversationId) return;
    await deleteConversation(conversationId);
    router.push("/dashboard/messages");
  };

  const handleAddContactFromChat = async (contactId: string) => {
    if (!user) return;
    const name = participantNames[contactId] || "Unknown";
    const player = getPlayerById(contactId) || (await getUser(contactId));
    await addContact(user.id, {
      id: contactId,
      name,
      email: player?.email,
      avatar: player?.avatar,
      addedAt: new Date().toISOString(),
    });
  };

  if (conversationId === "placeholder") return null;

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-5rem)] md:h-screen max-w-2xl mx-auto items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground mt-2">Loading conversation…</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-col h-[calc(100vh-5rem)] md:h-screen max-w-2xl mx-auto items-center justify-center">
        <p className="text-muted-foreground">Conversation not found</p>
        <Button variant="ghost" className="mt-2" onClick={() => router.push("/dashboard/messages")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Messages
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] md:h-screen max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-background">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/messages")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold relative flex-shrink-0"
          style={{ backgroundColor: isGroup ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
        >
          {isGroup ? <Users className="h-5 w-5" /> : (participantNames[otherHumanIds[0]]?.charAt(0) || <User className="h-5 w-5" />)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{title}</p>
          <div className="flex items-center gap-1.5">
            {isGroup && <Badge variant="secondary" className="text-[10px] h-4 px-1">Group</Badge>}
            {hasRally && <Badge variant="outline" className="text-[10px] h-4 px-1 border-primary/40 text-primary">Rally</Badge>}
            {!isGroup && <span className="text-xs text-muted-foreground">Direct Message</span>}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isGroup && otherHumanIds.map((id) => (
              <DropdownMenuItem key={id} onClick={() => handleAddContactFromChat(id)}>
                <UserPlus className="h-4 w-4 mr-2" />Add {participantNames[id] || "user"} to contacts
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem className="text-red-600" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4 mr-2" />Delete conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {msgs.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">No messages yet. Say hello! 👋</p>
          </div>
        )}
        {msgs.map((msg, i) => {
          const showDate = i === 0 || dayLabel(msgs[i - 1].createdAt) !== dayLabel(msg.createdAt);
          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex justify-center my-3">
                  <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-3 py-0.5">
                    {dayLabel(msg.createdAt)}
                  </span>
                </div>
              )}
              <MessageBubble message={msg} isOwn={msg.senderId === user?.id} />
            </div>
          );
        })}
        {rallyTyping && <RallyTyping />}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} />

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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
