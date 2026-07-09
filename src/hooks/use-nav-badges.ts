"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { subscribeConversations, getNotifications } from "@/lib/firestore";

/**
 * Live unread counts for the nav badges: total unread messages across
 * conversations, and unread notifications.
 */
export function useNavBadges() {
  const { user } = useAuth();
  const [messages, setMessages] = useState(0);
  const [notifications, setNotifications] = useState(0);

  useEffect(() => {
    if (!user) { setMessages(0); setNotifications(0); return; }
    const unsub = subscribeConversations(user.id, (convs) => {
      setMessages(convs.reduce((sum, c) => sum + (c.unread?.[user.id] || 0), 0));
    });
    getNotifications(user.id).then((ns) => setNotifications(ns.filter((n) => !n.read).length));
    return unsub;
  }, [user]);

  return { messages, notifications };
}
