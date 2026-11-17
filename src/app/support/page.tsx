import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, EmailLink } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Support · Pleasanton PlayMatch",
  description: "Help with signing in, notifications, blocking and reporting, Rally, and deleting your account.",
};

export const dynamic = "force-static";

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: "How do I sign in?",
    a: (
      <p>
        Tap <strong>Continue with Google</strong> on the <Link href="/login">sign-in page</Link> (the iOS app also
        offers Sign in with Apple). There are no PlayMatch passwords. New players are set up automatically and
        then walk through a short profile setup. Manage your password and security in your Google or Apple
        account.
      </p>
    ),
  },
  {
    q: "How do I get notifications on my iPhone?",
    a: (
      <>
        <p>
          If you use the PlayMatch iPhone app, allow notifications when asked, or turn them on in the iPhone
          Settings app under Notifications → PlayMatch.
        </p>
        <p>
          If you use PlayMatch in Safari, iPhone and iPad notifications only work once PlayMatch is on your Home
          Screen: tap the <strong>Share</strong> button in Safari, choose <strong>&ldquo;Add to Home
          Screen&rdquo;</strong>, then open PlayMatch from your Home Screen and go to{" "}
          <strong>Settings → Enable Push Notifications</strong>. This requires iOS 16.4 or newer.
        </p>
        <p>
          If you blocked notifications earlier, re-enable them in your device or browser settings for PlayMatch,
          then try again.
        </p>
      </>
    ),
  },
  {
    q: "How do I block or report someone?",
    a: (
      <p>
        You can block another player and report profiles, messages, and Rally responses from within the app. A
        blocked player can no longer contact you or appear in your matches and suggestions. We review every
        report within 24 hours. You can also email reports to <EmailLink subject="Report" />. If anyone is in
        immediate danger, call 911.
      </p>
    ),
  },
  {
    q: "What is Rally?",
    a: (
      <p>
        Rally is PlayMatch&rsquo;s AI assistant. Mention <strong>@rally</strong> in a chat to get help picking a
        time that works for both players, warm-up tips, or local court info. Rally runs on our own server, and
        your messages are not sent to any third-party AI company. Rally can be wrong, and it{" "}
        <strong>cannot book or reserve courts</strong>, so contact the facility directly to reserve.
      </p>
    ),
  },
  {
    q: "How do I delete my account?",
    a: (
      <p>
        Go to <strong>Settings → Delete Account</strong> and confirm. This permanently deletes your PlayMatch
        account and profile. If you can&rsquo;t sign in, email <EmailLink subject="Delete my PlayMatch account" />{" "}
        from the address on your account and we&rsquo;ll delete it for you. See the{" "}
        <Link href="/privacy#delete">Privacy Policy</Link> for what is deleted.
      </p>
    ),
  },
  {
    q: "How do I stay safe when meeting a new player?",
    a: (
      <p>
        Meet at public courts, tell someone where you&rsquo;re going, and keep personal details private until
        you&rsquo;re comfortable. PlayMatch doesn&rsquo;t run background checks. See the safety section of our{" "}
        <Link href="/terms#safety">Terms of Use</Link>.
      </p>
    ),
  },
];

export default function SupportPage() {
  return (
    <LegalPage
      title="Support"
      intro={
        <p>
          PlayMatch helps tennis and pickleball players in Pleasanton, California find partners at their skill
          level, line up schedules, and chat to set up a game. It&rsquo;s free, with no ads.
        </p>
      }
    >
      <LegalSection id="contact" title="Contact us">
        <p>
          Questions, bugs, ideas, or a problem with another player? Email <EmailLink subject="PlayMatch support" />.
          We read every message and usually reply within a day or two.
        </p>
      </LegalSection>

      <LegalSection id="faq" title="Frequently asked questions">
        {faqs.map((f) => (
          <div key={f.q} className="space-y-2">
            <h3>{f.q}</h3>
            {f.a}
          </div>
        ))}
      </LegalSection>

      <LegalSection id="legal" title="Policies">
        <ul>
          <li><Link href="/privacy">Privacy Policy</Link></li>
          <li><Link href="/terms">Terms of Use</Link></li>
        </ul>
      </LegalSection>
    </LegalPage>
  );
}
