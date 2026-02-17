"use client";

import DesktopSidebar from "@/components/desktop-sidebar";
import BottomNav from "@/components/bottom-nav";
import ProtectedRoute from "@/components/protected-route";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen">
        <DesktopSidebar />
        <main className="flex-1 pb-20 md:pb-0">
          {children}
        </main>
        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}
