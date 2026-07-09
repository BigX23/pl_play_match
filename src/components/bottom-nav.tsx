"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, MessageSquare, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavBadges } from "@/hooks/use-nav-badges";

const items = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/dashboard/open-matches", icon: Search, label: "Matches" },
  { href: "/dashboard/messages", icon: MessageSquare, label: "Messages", badgeKey: "messages" as const },
  { href: "/dashboard/notifications", icon: Bell, label: "Alerts", badgeKey: "notifications" as const },
  { href: "/dashboard/profile", icon: User, label: "Profile" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const badges = useNavBadges();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex items-center justify-around h-16">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const badge = item.badgeKey ? badges[item.badgeKey] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 text-xs transition-colors relative",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <item.icon className={cn("h-5 w-5", active && "text-primary")} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center font-bold px-1">
                    {badge}
                  </span>
                )}
              </div>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
