"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getNotifications, markNotificationRead } from "@/lib/data";
import { type Notification } from "@/lib/mock-data";
import NotificationCard from "@/components/notification-card";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);

  useEffect(() => {
    if (user) getNotifications(user.id).then(setNotifs);
  }, [user]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = () => {
    notifs.filter((n) => !n.read).forEach((n) => handleMarkRead(n.id));
  };

  const unreadCount = notifs.filter((n) => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="p-4 border-b flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" /> Notifications
        </h1>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead}>
            Mark all read
          </Button>
        )}
      </div>
      {notifs.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No notifications</p>
        </div>
      ) : (
        notifs.map((n) => (
          <NotificationCard key={n.id} notification={n} onMarkRead={handleMarkRead} />
        ))
      )}
    </div>
  );
}
