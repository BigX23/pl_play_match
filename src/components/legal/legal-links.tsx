import Link from "next/link";
import { cn } from "@/lib/utils";

/** Public contact address — same one the Settings "Feedback & Support" card uses. */
export const CONTACT_EMAIL = "feedback@aiplaymatch.com";

export const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
] as const;

/** Privacy · Terms · Support links. Used on the landing/login pages, Settings, and the legal pages. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal and support" className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1", className)}>
      {LEGAL_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="hover:text-primary hover:underline underline-offset-4">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
