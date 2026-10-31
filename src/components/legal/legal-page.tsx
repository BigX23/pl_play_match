import Link from "next/link";
import { Trophy } from "lucide-react";
import { CONTACT_EMAIL, LegalLinks } from "./legal-links";

/**
 * Shell for the public, static legal/support pages (/privacy, /terms, /support).
 * Server component: no auth, no client state — these must be reachable signed out
 * (app-store reviewers and the store listings link to them directly).
 */

export const LEGAL_LAST_UPDATED_ISO = "2026-10-31";
export const LEGAL_LAST_UPDATED = "October 31, 2026";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b bg-background">
        <Link href="/" className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">PlayMatch</span>
        </Link>
        <Link href="/login" className="text-sm text-muted-foreground hover:text-primary">
          Sign in
        </Link>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-10">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: <time dateTime={LEGAL_LAST_UPDATED_ISO}>{LEGAL_LAST_UPDATED}</time>
          </p>
          {intro && <div className="mt-6 text-base leading-relaxed">{intro}</div>}
          <div className="mt-2">{children}</div>
        </article>
      </main>

      <footer className="py-6 px-4 text-center text-sm text-muted-foreground border-t space-y-2">
        <LegalLinks />
        <p>© 2026 Pleasanton PlayMatch</p>
      </footer>
    </div>
  );
}

/** A titled section of a legal page. */
export function LegalSection({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-foreground/90 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_h3]:font-semibold [&_h3]:mt-5">
        {children}
      </div>
    </section>
  );
}

export function EmailLink({ subject }: { subject?: string }) {
  const href = `mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  return <a href={href}>{CONTACT_EMAIL}</a>;
}
