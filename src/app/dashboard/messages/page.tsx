"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getConversations } from "@/lib/firestore";
import { type Conversation } from "@/lib/mock-data";
import ConversationCard from "@/components/conversation-card";
import { MessageSquare } from "lucide-react";

export default function MessagesPage() {
  const { user } = useAuth();
  const [convos, setConvos] = useState<Conversation[]>([]);

  useEffect(() => {
    if (user) getConversations(user.id).then(setConvos);
  }, [user]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6" /> Messages
        </h1>
      </div>
      {convos.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No conversations yet</p>
        </div>
      ) : (
        convos.map((c) => (
          <ConversationCard key={c.id} conversation={c} currentUserId={user?.id || "p1"} />
        ))
      )}
    </div>
  );
}
