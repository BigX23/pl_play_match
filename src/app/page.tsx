"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, Send, MapPin, CalendarClock } from "lucide-react";

const mockMatches = [
  {
    name: "Maya Okonkwo",
    initial: "M",
    ntrp: "4.0",
    meta: "Age 31 · Tennis · singles",
    score: 92,
  },
  {
    name: "Sam Tan",
    initial: "S",
    ntrp: "3.5",
    meta: "Age 27 · Pickleball · doubles",
    score: 78,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
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
            <Button size="sm">Register</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="px-6 py-16 md:py-24">
          <div className="mx-auto max-w-5xl grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Left copy column — off-center, left-aligned */}
            <div className="max-w-xl text-left">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                Find a tennis and pickleball partner in{" "}
                <span className="text-primary">Pleasanton</span>
              </h1>
              <p className="mt-5 text-lg text-muted-foreground">
                PlayMatch pairs you with nearby players who fit your skill
                level, schedule, and the way you like to play. See who lines up,
                send a request, and get on court.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link href="/register" className="sm:w-auto w-full">
                  <Button size="lg" className="w-full sm:w-auto px-8">
                    Get Started
                  </Button>
                </Link>
                <Link href="/login" className="sm:w-auto w-full">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto px-8">
                    Sign In
                  </Button>
                </Link>
              </div>

              <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary shrink-0" />
                  Compatibility scored by skill, sport, and availability
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  Players and courts right here in Pleasanton
                </li>
                <li className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                  Post an open match when you want to play today
                </li>
              </ul>
            </div>

            {/* Right visual anchor — static mock of the real match card */}
            <div className="lg:justify-self-end w-full max-w-sm">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Your Top Matches</span>
                </div>
                <div className="space-y-3" aria-hidden="true">
                  {mockMatches.map((m) => (
                    <div
                      key={m.name}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-secondary/30"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {m.initial}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {m.name}{" "}
                            <span className="text-xs text-muted-foreground">
                              NTRP {m.ntrp}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {m.meta}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-primary">{m.score}%</p>
                        <Progress value={m.score} className="h-1.5 w-14" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs text-muted-foreground">
                  <Send className="h-3 w-3" />
                  Send a match request to start a chat
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        © 2026 Pleasanton PlayMatch
      </footer>
    </div>
  );
}
