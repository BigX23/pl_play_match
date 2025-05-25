import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import {Toaster} from '@/components/ui/toaster';
import {SidebarProvider} from '@/components/ui/sidebar'; // Keep if needed for other sidebar logic

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Pleasanton PlayMatch',
  description: 'Find Tennis and Pickleball partners in Pleasanton',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Removed flex from body, adjust if SidebarProvider requires it */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Assuming SidebarProvider is for a different sidebar or context, keep it as is */}
        <SidebarProvider> 
          {children}
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}

