"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getMessages, sendMessage } from "@/lib/firestore";
import { type Message, conversations, getPlayerById } from "@/lib/mock-data";
import { getAIResponse, AI_SENDER_ID, AI_SENDER_NAME } from "@/lib/ai-assistant";
import MessageBubble from "@/components/message-bubble";
import ChatInput from "@/components/chat-input";
import { ArrowLeft, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find((c) => c.id === conversationId);
  const otherIds = conversation?.participants.filter((id) => id !== user?.id && id !== "ai") || [];
  const otherPlayers = otherIds.map((id) => getPlayerById(id)).filter(Boolean);
  const hasAI = conversation?.participants.includes("ai");
  const title = otherPlayers.map((p) => p!.name).join(", ") || "Chat";

  useEffect(() => {
    if (conversationId) getMessages(conversationId).then(setMsgs);
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const handleSend = async (text: string) => {
    if (!user) return;
    const msg = await sendMessage(conversationId, text, user.id, user.name);
    setMsgs((prev) => [...prev, msg]);

    // If AI is in conversation, maybe respond
    if (hasAI) {
      const aiReply = getAIResponse(text);
      if (aiReply) {
        setTimeout(async () => {
          const aiMsg: Message = {
            id: `msg${Date.now()}`,
            conversationId,
            senderId: AI_SENDER_ID,
            senderName: AI_SENDER_NAME,
            text: aiReply,
            createdAt: new Date().toISOString(),
            readBy: [AI_SENDER_ID],
            isAI: true,
          };
          setMsgs((prev) => [...prev, aiMsg]);
        }, 1000);
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] md:h-screen max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-background">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/messages")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-white font-bold relative">
          {otherPlayers[0]?.name.charAt(0) || "?"}
          {hasAI && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
              <Bot className="h-2.5 w-2.5 text-white" />
            </div>
          )}
        </div>
        <div>
          <p className="font-medium text-sm">{title}</p>
          {hasAI && <p className="text-xs text-orange-500">PlayMatch AI assisted</p>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {msgs.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.senderId === user?.id} />
        ))}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} />
    </div>
  );
}
