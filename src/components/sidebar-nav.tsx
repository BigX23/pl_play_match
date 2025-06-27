"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils'; // Assuming cn utility is available
import React from 'react';

const navItems = [
  { name: 'My Matches', href: '/dashboard' }, // Updated path
  { name: 'My Profile', href: '/dashboard/profile' }, // Updated path
  { name: 'My Partner Settings', href: '/dashboard/settings' }, // Updated path
  { name: 'Open Matches', href: '/dashboard/open-matches' }, // Updated path
];

function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      // Call the new logout API endpoint
      const response = await fetch('/api/logout', { method: 'POST' });
      if (response.ok) {
        // Redirect to the main page after sign out
        router.push('/');
      } else {
        console.error('Error signing out:', await response.text());
        // Optionally, display an error message to the user
      }
    } catch (error) {
      console.error('Error signing out:', error);
      // Optionally, display an error message to the user
    }
  };

  return (
    <nav className="flex flex-col p-4 bg-gray-100 w-64 h-screen">
      <h2 className="text-xl font-semibold mb-6">Navigation</h2>
      <ul className="space-y-2 flex-grow"> {/* flex-grow to push sign out to bottom */}
        {navItems.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>
              <div
                className={cn(
                  'block py-2 px-3 rounded-md transition-colors',
                  pathname === item.href
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                )}
              >
                {item.name}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {/* Sign Out Button */}
      <div className="mt-auto"> {/* mt-auto to push it to the bottom */}
        <button
          onClick={handleSignOut}
          className="block w-full text-left py-2 px-3 rounded-md text-red-600 hover:bg-red-100 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}

export default SidebarNav;