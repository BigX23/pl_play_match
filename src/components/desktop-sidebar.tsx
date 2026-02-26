"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, MessageSquare, Bell, User, Settings, LogOut, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const items = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  { href: "/dashboard/open-matches", icon: Search, label: "Open Matches" },
  { href: "/dashboard/messages", icon: MessageSquare, label: "Messages", badgeKey: "messages" as const },
  { href: "/dashboard/notifications", icon: Bell, label: "Notifications", badgeKey: "notifications" as const },
  { href: "/dashboard/profile", icon: User, label: "My Profile" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export default function DesktopSidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const router = useRouter();

  const badges = {
    messages: 0,
    notifications: 0,
  };

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:border-r bg-card h-screen sticky top-0">
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <Trophy className="h-6 w-6 text-primary" />
        <span className="font-bold text-lg">PlayMatch</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const badge = item.badgeKey ? badges[item.badgeKey] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {badge > 0 && (
                <span className={cn(
                  "min-w-[20px] h-5 rounded-full text-xs flex items-center justify-center font-bold px-1.5",
                  active ? "bg-white/20 text-primary-foreground" : "bg-destructive text-white"
                )}>
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => { logout(); router.push("/"); }}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
