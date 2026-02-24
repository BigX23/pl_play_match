"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Zap, MapPin } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">PlayMatch</span>
        </div>
        <div className="flex gap-2">
          <Link href="/login">
            <Button variant="outline" size="sm">Login</Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">Register</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center bg-gradient-to-br from-green-50 to-orange-50 dark:from-green-950/20 dark:to-orange-950/20">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
          <Zap className="h-4 w-4" />
          AI-Powered Matchmaking
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
          Find Your Perfect<br />
          <span className="text-primary">Tennis</span> &amp; <span className="text-accent">Pickleball</span><br />
          Partner
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mb-8">
          Pleasanton PlayMatch connects you with compatible players based on skill level, availability, and play style.
        </p>
        <div className="flex gap-3">
          <Link href="/register">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8">Get Started</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="text-lg px-8">Sign In</Button>
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl w-full">
          {[
            { icon: Users, title: "Smart Matching", desc: "AI matches you with players at your skill level with compatible schedules." },
            { icon: MapPin, title: "Local Courts", desc: "Find partners right here in Pleasanton and play matches in your own neighborhood." },
            { icon: Zap, title: "Instant Matches", desc: "Ready to play right now? Post an instant match and connect with someone who's free today." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6 text-left hover:shadow-md transition-shadow">
              <f.icon className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        © 2026 Pleasanton PlayMatch. All rights reserved.
      </footer>
    </div>
  );
}
