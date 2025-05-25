import React from 'react';
import SidebarNav from '@/components/sidebar-nav';

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex">
      <SidebarNav />
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}

