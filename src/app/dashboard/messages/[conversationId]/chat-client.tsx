"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getMessages, sendMessage, getUser, getConversation, addContact, deleteConversation } from "@/lib/firestore";
import { type Message, type Conversation, getPlayerById, RALLY_USER } from "@/lib/mock-data";
import { getAIResponse, AI_SENDER_ID, AI_SENDER_NAME } from "@/lib/ai-assistant";
import MessageBubble from "@/components/message-bubble";
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

export default function ChatPage() {
  const pathname = usePathname();
  // Extract conversation ID from URL pathname instead of useParams
  // (useParams returns "placeholder" on static-export full-page loads)
  const segments = pathname.replace(/\/+$/, "").split("/");
  const conversationId = segments[segments.length - 1] || "";
  const { user } = useAuth();
  const router = useRouter();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});

  console.log("[ChatPage] render — conversationId:", conversationId, "user:", user?.id, "loading:", loading, "conversation:", conversation?.id);

  // Load conversation
  useEffect(() => {
    console.log("[ChatPage] useEffect[loadConversation] — conversationId:", conversationId);
    if (!conversationId || conversationId === "placeholder") {
      console.log("[ChatPage] skipping load — placeholder or missing id");
      return;
    }
    setLoading(true);
    getConversation(conversationId).then((conv) => {
      console.log("[ChatPage] getConversation result:", conv ? { id: conv.id, type: conv.type, participants: conv.participants, name: conv.name } : "NOT FOUND");
      if (conv) setConversation(conv);
      setLoading(false);
    }).catch((err) => {
      console.error("[ChatPage] getConversation error:", err);
      setLoading(false);
    });
  }, [conversationId]);

  // Load participant names
  useEffect(() => {
    if (!conversation || !user) {
      console.log("[ChatPage] useEffect[loadNames] — skipping, conversation:", !!conversation, "user:", !!user);
      return;
    }
    let cancelled = false;
    const otherIds = conversation.participants.filter((id) => id !== user.id);
    console.log("[ChatPage] useEffect[loadNames] — loading names for:", otherIds);

    async function loadNames() {
      const names: Record<string, string> = {};
      // Always include Rally
      names[RALLY_USER.id] = RALLY_USER.name;
      for (const id of otherIds) {
        if (id === RALLY_USER.id || id === "ai") {
          names[id] = RALLY_USER.name;
          continue;
        }
        const firestoreUser = await getUser(id);
        if (firestoreUser) {
          names[id] = firestoreUser.firstName
            ? `${firestoreUser.firstName} ${firestoreUser.lastName || ""}`.trim()
            : firestoreUser.name;
        } else {
          const mockPlayer = getPlayerById(id);
          if (mockPlayer) names[id] = mockPlayer.name;
          else names[id] = "Unknown";
        }
      }
      if (!cancelled) setParticipantNames(names);
      console.log("[ChatPage] participant names loaded:", names);
    }
    loadNames();
    return () => { cancelled = true; };
  }, [conversation, user]);

  // Load messages
  useEffect(() => {
    console.log("[ChatPage] useEffect[loadMessages] — conversationId:", conversationId);
    if (!conversationId || conversationId === "placeholder") return;
    getMessages(conversationId).then((m) => {
      console.log("[ChatPage] getMessages result:", m.length, "messages");
      setMsgs(m);
    }).catch((err) => {
      console.error("[ChatPage] getMessages error:", err);
    });
  }, [conversationId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const isGroup = conversation?.type === "group" || conversation?.participants?.includes("rally") || conversation?.participants?.includes("ai");
  const hasRally = conversation?.participants?.includes(RALLY_USER.id) || conversation?.participants?.includes("ai");
  const otherHumanIds = conversation?.participants?.filter((id) => id !== user?.id && id !== RALLY_USER.id && id !== "ai") ?? [];

  // Build display title
  const title = conversation?.name
    || (otherHumanIds.length > 0
      ? otherHumanIds.map((id) => participantNames[id] || "...").join(", ")
      : "Chat");

  const handleSend = async (text: string) => {
    if (!user || !conversationId) return;
    console.log("[ChatPage] handleSend:", { text: text.substring(0, 50), userId: user.id, conversationId });
    const msg = await sendMessage(conversationId, text, user.id, user.firstName || user.name);
    console.log("[ChatPage] message sent:", msg.id);
    setMsgs((prev) => [...prev, msg]);

    // If Rally is in conversation, maybe respond
    if (hasRally) {
      const aiReply = getAIResponse(text);
      if (aiReply) {
        setTimeout(async () => {
          const aiMsg = await sendMessage(conversationId, aiReply, AI_SENDER_ID, AI_SENDER_NAME);
          aiMsg.isAI = true;
          setMsgs((prev) => [...prev, aiMsg]);
        }, 1000);
      }
    }
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
        <p className="text-sm text-muted-foreground mt-2">Loading conversation...</p>
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
          style={{ backgroundColor: isGroup ? "#f97316" : "#9ca3af" }}
        >
          {isGroup ? <Users className="h-5 w-5" /> : (participantNames[otherHumanIds[0]]?.charAt(0) || <User className="h-5 w-5" />)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{title}</p>
          <div className="flex items-center gap-1.5">
            {isGroup && <Badge variant="secondary" className="text-[10px] h-4 px-1">Group</Badge>}
            {hasRally && <Badge variant="outline" className="text-[10px] h-4 px-1 border-orange-300 text-orange-600">🎾 Rally</Badge>}
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
            <DropdownMenuItem className="text-red-600" onClick={handleDelete}>
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
        {msgs.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.senderId === user?.id}
          />
        ))}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} />
    </div>
  );
}
