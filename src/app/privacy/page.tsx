/*
 * ============================================================================
 * DRAFT — NOT LEGAL ADVICE. MUST BE REVIEWED BY MATT BEFORE STORE SUBMISSION.
 * ============================================================================
 * This privacy policy was drafted from the code (src/db/schema.ts, src/server/*,
 * src/app/api/*, deploy/Caddyfile, deploy/docker-compose.yml) as of the
 * "Last updated" date. It is not legal advice and has not been reviewed by a
 * lawyer. Every time data collection changes (new table/column, new processor,
 * new logging), update this page and bump LEGAL_LAST_UPDATED.
 *
 * Items marked "VERIFY" below are statements that describe intended behavior
 * the code does not fully meet yet, or facts that cannot be checked from the
 * repo. Resolve them before submission.
 * ============================================================================
 */
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, EmailLink } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy · Pleasanton PlayMatch",
  description: "What Pleasanton PlayMatch collects, why, who can see it, and how to delete it.",
};

export const dynamic = "force-static";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          Pleasanton PlayMatch (&ldquo;PlayMatch&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) helps tennis and
          pickleball players in the Pleasanton, California area find partners, set up matches, and chat. This
          policy explains what we collect when you use the website at aiplaymatch.com and the PlayMatch mobile
          apps, why we collect it, who can see it, and how to delete it. The short version: we collect only what
          the app needs to match you with players, we run everything on our own server, and we never sell your
          data or show you ads.
        </p>
      }
    >
      <LegalSection id="collect" title="1. Information we collect">
        <h3>Information from your sign-in provider</h3>
        <p>
          You sign in with Google (and, in the iOS app, Sign in with Apple). We do not use passwords. When you sign
          in, we receive and store your <strong>name, email address, and profile photo URL</strong> from your
          provider, plus the technical sign-in records the provider returns (your provider account ID and the
          sign-in tokens issued to us). We use these only to sign you in.
        </p>

        <h3>Your player profile</h3>
        <p>When you set up your profile, you give us:</p>
        <ul>
          <li>First and last name, age, and gender</li>
          <li>An avatar or a profile photo you upload</li>
          <li>Sports (tennis, pickleball), skill level (NTRP rating), singles/doubles preference, and how competitive you like to play</li>
          <li>Your weekly availability (the days and times you can play)</li>
          <li>Partner preferences (age range, skill range, gender preference, sports, and formats)</li>
          <li>An optional bio / &ldquo;about me&rdquo;</li>
        </ul>
        <p>
          We do <strong>not</strong> collect your device&rsquo;s GPS or precise location. PlayMatch is a local
          Pleasanton community, and the only places we store are the court or venue names that players type into
          match details.
        </p>

        <h3>Matches and activity</h3>
        <ul>
          <li>Match requests you send and receive, and their compatibility scores</li>
          <li>Matches you create or join: sport, date, time, court/location, notes, status, and cancellation reasons</li>
          <li>Reported scores and results, and your matches-played, wins, and losses</li>
          <li>Your contacts list (players you have added) and players you have hidden from your suggestions</li>
          <li>Players you have blocked and reports you submit</li>
          {/* VERIFY: block/report storage is being added by task U1 (user_blocks, user_reports). */}
        </ul>

        <h3>Messages</h3>
        <p>
          We store the messages you send in direct and group conversations, along with who is in each
          conversation and read/unread status, so they can be delivered to the other participants and shown in
          your history. Messages are not end-to-end encrypted. They are encrypted in transit (HTTPS) and stored on
          our server.
        </p>

        <h3>Notifications</h3>
        <ul>
          <li>In-app notifications we create for you (for example, new match requests or messages).</li>
          <li>
            If you turn on push notifications, a push subscription or device token that lets us deliver them.
            Your notification preferences and quiet hours are saved only on your device.
          </li>
        </ul>

        <h3>Technical and log data</h3>
        <ul>
          <li>
            <strong>Session cookie:</strong> a single sign-in cookie that keeps you logged in. We do not use
            advertising or tracking cookies.
          </li>
          <li>
            <strong>Server access logs:</strong> like most websites, our web server records each request: your IP
            address, the date and time, the page or API address requested, your browser&rsquo;s user-agent, and the
            response status. Cookies and authorization headers are removed from these logs. We use them for
            security and troubleshooting, and keep them for up to 90 days.
          </li>
          <li>Application error logs, used only to diagnose problems.</li>
        </ul>
      </LegalSection>

      <LegalSection id="use" title="2. How we use it">
        <ul>
          <li>To create and secure your account and keep you signed in.</li>
          <li>To match you with compatible players by sport, skill, availability, and your preferences.</li>
          <li>To run matches, match requests, scores, and stats.</li>
          <li>To deliver your messages and send you notifications you have turned on.</li>
          <li>To power Rally, the in-app assistant (see below).</li>
          <li>To keep the service safe: investigating reports, enforcing our <Link href="/terms">Terms of Use</Link>, and protecting against abuse and attacks.</li>
          <li>To respond to you when you contact us.</li>
        </ul>
        <p>
          We do not use your data for advertising, and we do not build profiles of you for anyone else.
        </p>
      </LegalSection>

      <LegalSection id="visibility" title="3. Who can see your information">
        <p>Other signed-in PlayMatch players can see a limited version of your profile:</p>
        <ul>
          <li>Your first name and last initial (for example, &ldquo;Jill W.&rdquo;), not your full last name</li>
          <li>A five-year age bracket (for example, &ldquo;45 - 50&rdquo;), not your exact age</li>
          <li>Gender, avatar or profile photo, sports, skill level, formats, play style, and bio</li>
          <li>Your matches played, wins, and losses, and your compatibility score with them</li>
        </ul>
        <p>
          Other players <strong>cannot</strong> see your email address, full last name, exact age, weekly
          availability, or partner preferences. Your email is shown to another player only if they already know
          it and look you up by that exact address to add you as a contact. When Rally suggests times to play, it
          uses the overlap between two players&rsquo; schedules without showing either full schedule.
        </p>
        <p>
          People in a conversation with you see the messages in that conversation. Players in a match with you see
          that match&rsquo;s details. Photos you upload are only served to signed-in users.
        </p>
        <p>
          We (the PlayMatch operator) can access stored data when needed to run the service, investigate a
          report, or fix a problem.
        </p>
      </LegalSection>

      <LegalSection id="rally" title="4. Rally, the AI assistant">
        <p>
          Rally is an AI assistant that answers when someone in a conversation mentions <strong>@rally</strong>.
          To reply, Rally reads that conversation&rsquo;s recent messages, the participants&rsquo; first names, and
          (in two-player chats) the times both players are available.
        </p>
        <p>
          Rally runs on an open-source language model that we host <strong>on our own server</strong>. Your messages
          are processed there and are <strong>not sent to or shared with any third-party AI provider</strong>
          (such as OpenAI, Google, or Anthropic), and they are not used to train any AI model. Rally&rsquo;s replies
          are stored in the conversation like any other message.
        </p>
      </LegalSection>

      <LegalSection id="sharing" title="5. Service providers and sharing">
        <p>
          We do not sell, rent, or trade your personal information, and we do not share it for advertising. We
          do not use third-party analytics, advertising SDKs, or tracking pixels. We share data only with the
          providers needed to run the service:
        </p>
        <ul>
          <li>
            <strong>Hosting:</strong> PlayMatch runs on a server we manage ourselves, rented from OVHcloud in the
            United States. Our database, uploaded photos, and the Rally AI model all live on that server.
            {/* VERIFY: US region is from the brief / VPS IP (docs/OPERATIONS.md), not checkable in code. */}
          </li>
          <li>
            <strong>Google</strong> provides sign-in. Google&rsquo;s handling of your Google account is covered by
            Google&rsquo;s own privacy policy.
          </li>
          <li>
            <strong>Web push services.</strong> If you enable notifications in a web browser, the notification is
            delivered through your browser maker&rsquo;s push service (for example Google for Chrome, Apple for
            Safari, or Mozilla for Firefox). Notifications can include a short preview, such as the sender&rsquo;s
            name and the first part of a message.
          </li>
          <li>
            <strong>Mobile apps only:</strong> in the iOS and Android apps, <strong>Apple</strong> provides Sign in
            with Apple and delivers push notifications (Apple Push Notification service), and{" "}
            <strong>Google Firebase Cloud Messaging</strong> delivers push notifications. These providers receive
            the device token and the notification content needed to deliver each notification.
            {/* VERIFY: forward-looking — Sign in with Apple (A3), APNs/FCM (P1–P3) are not built yet. Remove or
                adjust if the shipped apps differ. If Sign in with Apple's "Hide My Email" is used, the stored
                email is an Apple relay address. */}
          </li>
          <li>
            <strong>Legal reasons:</strong> we may disclose information if required by law, or if needed to protect
            the safety of a person or the security of the service.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="retention" title="6. How long we keep it">
        <ul>
          <li>Your account, profile, matches, and messages: for as long as your account is active, or until you delete them.</li>
          <li>Sign-in sessions: they expire automatically, and signing out ends your session.</li>
          <li>Server access logs: up to 90 days, then automatically deleted.</li>
          <li>
            Backups: our hosting provider keeps encrypted whole-server backups for disaster recovery. Deleted data
            disappears from backups as they rotate out.
            {/* VERIFY: OVH automated-backup retention period and whether backups are encrypted are not in the
                repo (docs/OPERATIONS.md only says the add-on is enabled). State the real number of days. */}
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="delete" title="7. Deleting your account">
        <p>
          You can delete your account at any time inside the app: <strong>Settings → Delete Account</strong>. This
          permanently deletes your account and profile, your sign-in connection, your sessions, your
          notifications and push subscriptions, your match requests, your contacts list and hidden-player list,
          and your membership in conversations. Messages you sent may remain visible in the other
          participants&rsquo; conversation history, and past matches may remain in the other players&rsquo; match
          history.
          {/* VERIFY — CODE GAPS (see U2 report):
              1. DELETE /api/me only deletes the users row. messages.sender_id and matches.player1_id reference
                 users with ON DELETE NO ACTION (drizzle/0001_domain-tables.sql), so deletion FAILS for any user
                 who has sent a message or created a match. Fix before submission (Apple 5.1.1(v)).
              2. The uploaded photo file in UPLOAD_DIR is not removed on delete — this text lists "profile" as
                 deleted, which should include the photo file.
              Decide whether sent messages are deleted, anonymized, or kept, and make this paragraph match. */}
        </p>
        <p>
          If you can&rsquo;t access the app, email <EmailLink subject="Delete my PlayMatch account" /> from the
          address on your account and we will delete it for you. Deleting PlayMatch does not delete your Google or
          Apple account.
        </p>
      </LegalSection>

      <LegalSection id="choices" title="8. Your choices">
        <ul>
          <li>Edit your profile at any time in the app.</li>
          <li>Turn push notifications on or off in Settings or in your device settings.</li>
          <li>Hide players from your suggestions, or block players so they can no longer contact you.</li>
          <li>Ask us for a copy of your data, or to correct or delete it, by emailing <EmailLink />.</li>
        </ul>
      </LegalSection>

      <LegalSection id="california" title="9. California privacy rights">
        <p>
          If you live in California, the California Consumer Privacy Act (as amended by the CPRA) gives you the
          right to know what personal information we collect, use, and disclose (this policy describes it), to get
          a copy of it, to correct it, and to delete it. You also have the right not to be discriminated against
          for exercising these rights.
        </p>
        <p>
          We do <strong>not sell</strong> your personal information and do <strong>not share</strong> it for
          cross-context behavioral advertising, and we have not done so in the past 12 months. We do not use
          sensitive personal information to infer characteristics about you.
        </p>
        <p>
          To make a request, email <EmailLink subject="California privacy request" />. We will verify your request
          by confirming it comes from the email address on your account, and respond within 45 days.
        </p>
      </LegalSection>

      <LegalSection id="security" title="10. Security">
        <p>
          All traffic to PlayMatch uses HTTPS. Sign-in is handled by Google or Apple, so we never store a password.
          Access to our server is limited to the operator. We take reasonable measures to protect your
          information, but no system is perfectly secure. If a security incident affects your personal
          information, we will notify you as required by law.
          {/* VERIFY: deploy/Caddyfile and docker-compose.yml reference a 2026-08-10 RCE compromise. Matt should
              confirm whether user data was exposed and whether any notification obligation applied. */}
        </p>
      </LegalSection>

      <LegalSection id="children" title="11. Children">
        <p>
          PlayMatch is not directed to children under 13, and we do not knowingly collect personal information
          from children under 13. You must meet the minimum age in our <Link href="/terms">Terms of Use</Link> to
          use PlayMatch. If you believe a child has given us personal information, email <EmailLink /> and we will
          delete it.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="12. Changes to this policy">
        <p>
          If we change this policy, we will update the &ldquo;Last updated&rdquo; date above. If the change is
          significant, we will tell you in the app before it takes effect.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="13. Contact us">
        <p>
          Questions or requests about your privacy: <EmailLink subject="Privacy question" />. See also our{" "}
          <Link href="/support">Support page</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
