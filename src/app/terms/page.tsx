/*
 * ============================================================================
 * DRAFT — NOT LEGAL ADVICE. MUST BE REVIEWED BY MATT BEFORE STORE SUBMISSION.
 * ============================================================================
 * These Terms of Use double as the custom EULA for the App Store (they include
 * Apple's minimum EULA terms in section 15). They were drafted by an AI agent from
 * the app's actual features and have not been reviewed by a lawyer. Review
 * every section, especially eligibility, limitation of liability, governing law,
 * and the 24-hour moderation commitment (which must match what you can staff).
 * ============================================================================
 */
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, EmailLink } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Use · Pleasanton PlayMatch",
  description: "The rules for using Pleasanton PlayMatch, including our zero-tolerance policy for abusive content.",
};

export const dynamic = "force-static";

/** Minimum age to use PlayMatch. Keep in sync with the store age rating (see comment in the Eligibility section). */
const MIN_AGE = 17;

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro={
        <p>
          These Terms of Use (&ldquo;Terms&rdquo;) are an agreement between you and Pleasanton PlayMatch
          (&ldquo;PlayMatch&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) for using the website at aiplaymatch.com
          and the PlayMatch mobile apps (together, the &ldquo;Service&rdquo;). By creating an account or using the
          Service, you agree to these Terms and to our <Link href="/privacy">Privacy Policy</Link>. If you
          don&rsquo;t agree, don&rsquo;t use the Service.
        </p>
      }
    >
      <LegalSection id="eligibility" title="1. Eligibility">
        {/*
          AGE GATE — MUST MATCH THE FINAL STORE AGE RATING (task S2).
          17+ is chosen because PlayMatch has unmoderated, real-time chat between adults who then meet in
          person; Apple typically rates that 17+. If S2 settles on a different rating, change MIN_AGE above.
          Note: onboarding currently accepts ages >= 13 (src/app/onboarding/page.tsx, client-side min={13},
          not enforced server-side) — align it with MIN_AGE.
        */}
        <p>
          You must be at least <strong>{MIN_AGE} years old</strong> to use PlayMatch. By using the Service, you
          confirm that you meet this age requirement, that the information in your profile is accurate, and that
          you are not barred from using the Service under applicable law. You may only have one account, and you
          are responsible for activity on it.
        </p>
      </LegalSection>

      <LegalSection id="service" title="2. What PlayMatch is">
        <p>
          PlayMatch helps tennis and pickleball players find partners, send match requests, organize games, and
          chat. PlayMatch is a free community service. We do not run, own, or book courts, we do not employ or
          screen players, and we do not supervise matches.
        </p>
      </LegalSection>

      <LegalSection id="conduct" title="3. Community rules: zero tolerance">
        <p>
          PlayMatch has <strong>zero tolerance for objectionable content and abusive users</strong>. You agree not
          to post, send, or share content, and not to behave in a way, that:
        </p>
        <ul>
          <li>Harasses, bullies, threatens, stalks, intimidates, or demeans anyone</li>
          <li>Is hateful or discriminatory based on race, ethnicity, national origin, religion, sex, gender, sexual orientation, disability, age, or any other protected characteristic</li>
          <li>Is sexually explicit or pornographic, or is unwanted sexual attention</li>
          <li>Depicts or promotes violence, self-harm, or illegal activity</li>
          <li>Involves, sexualizes, or endangers minors in any way</li>
          <li>Is spam, advertising, a scam, or an attempt to get money, personal details, or passwords from others</li>
          <li>Impersonates another person, or misrepresents your identity, age, or skill</li>
          <li>Shares someone else&rsquo;s private information without their permission</li>
          <li>Infringes anyone&rsquo;s intellectual property or privacy rights</li>
        </ul>
        <p>You also agree not to:</p>
        <ul>
          <li>Use the Service if we have removed you before</li>
          <li>Scrape, harvest, or collect other players&rsquo; information</li>
          <li>Interfere with, attack, probe, or overload the Service, or get around its security or access limits</li>
          <li>Use the Service for any commercial purpose without our permission</li>
          <li>Try to make Rally, the AI assistant, produce content that breaks these rules</li>
        </ul>
      </LegalSection>

      <LegalSection id="report" title="4. Blocking, reporting, and moderation">
        <p>
          You can <strong>block</strong> another player from within the app. Once blocked, they can no longer
          contact you or see you in matches and suggestions. You can also <strong>report</strong> a profile, a
          message, or a response from Rally directly from within the app. You can also email reports to{" "}
          <EmailLink subject="Report" />.
        </p>
        {/* VERIFY: block/report UI is being built concurrently by task U1. Make sure the wording above matches
            what ships (where the Block/Report menus live). */}
        <p>
          We review reports <strong>within 24 hours</strong>. When content or behavior breaks these Terms, we
          remove the content and suspend or permanently remove the user who posted it. We may also remove
          content or accounts without a report if we find a violation. If anyone is in immediate danger, call
          911 first.
        </p>
      </LegalSection>

      <LegalSection id="safety" title="5. Meeting other players safely">
        <p>
          PlayMatch connects you with people you may not know, and you will meet them in person.{" "}
          <strong>We do not run background checks or verify identities, ages, or skill levels.</strong> You are
          solely responsible for your interactions with other players, online and in person.
        </p>
        <ul>
          <li>Meet at public courts, during daylight or in well-lit areas, with other people nearby.</li>
          <li>Tell a friend or family member where you are going and who you are meeting.</li>
          <li>Arrange your own transportation, and keep personal details private until you are comfortable.</li>
          <li>Trust your instincts. Leave if something feels wrong, and report the player.</li>
        </ul>
        <p>
          Tennis and pickleball are physical activities with a risk of injury. You play at your own risk and are
          responsible for your own health, fitness, and equipment.
        </p>
      </LegalSection>

      <LegalSection id="rally" title="6. Rally, the AI assistant">
        <p>
          Rally is an automated AI assistant. Its answers can be wrong, incomplete, or out of date, so
          don&rsquo;t rely on them for anything important. Rally <strong>cannot book, reserve, or hold courts</strong>
          and has no access to any court reservation system. To reserve a court, contact the facility directly.
          Rally is not a coach, medical professional, or safety advisor. If Rally says something inappropriate,
          please report it.
        </p>
      </LegalSection>

      <LegalSection id="content" title="7. Your content">
        <p>
          You keep ownership of what you post: your profile, photos, and messages (&ldquo;Your Content&rdquo;).
          You give us a limited, non-exclusive, royalty-free license to store, display, and transmit Your Content
          only as needed to operate the Service, for example showing your profile to other players and delivering
          your messages. This license ends when you delete Your Content or your account, except for copies other
          players already received (such as messages in their conversations) and backups that rotate out over
          time.
        </p>
        <p>
          You are responsible for Your Content and confirm you have the right to post it. Don&rsquo;t upload
          photos of other people without their permission.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="8. Ending your account">
        <p>
          You can stop using PlayMatch and delete your account at any time in{" "}
          <strong>Settings → Delete Account</strong>. We may suspend or end your access at any time, with or
          without notice, if you break these Terms, if we must for legal reasons, or if we stop offering the
          Service. Sections 7 and 9 through 14 continue to apply after your account ends.
        </p>
      </LegalSection>

      <LegalSection id="warranty" title="9. No warranty">
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;, WITHOUT WARRANTIES OF ANY
          KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, AND NON-INFRINGEMENT. We do not promise that the Service will be uninterrupted, error-free, or
          secure, that matches or compatibility scores will be accurate, or anything about the conduct of other
          players.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="10. Limitation of liability">
        <p>
          TO THE FULLEST EXTENT ALLOWED BY LAW, PLAYMATCH AND ITS OPERATOR WILL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF DATA, OR FOR PERSONAL INJURY
          OR PROPERTY DAMAGE ARISING FROM YOUR USE OF THE SERVICE OR YOUR INTERACTIONS WITH OTHER PLAYERS. OUR
          TOTAL LIABILITY FOR ANY CLAIM RELATED TO THE SERVICE IS LIMITED TO US$50. Some places don&rsquo;t allow
          these limits, so they may not fully apply to you.
        </p>
      </LegalSection>

      <LegalSection id="indemnity" title="11. Indemnity">
        <p>
          You agree to defend and hold harmless PlayMatch and its operator from claims and costs arising from
          Your Content, your breach of these Terms, or your interactions with other players.
        </p>
      </LegalSection>

      <LegalSection id="law" title="12. Governing law">
        <p>
          These Terms are governed by the laws of the State of California, without regard to its conflict of law
          rules. Any dispute will be handled in the state or federal courts located in Alameda County,
          California, and you and we consent to their jurisdiction.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="13. Changes to these Terms">
        <p>
          We may update these Terms. We will change the &ldquo;Last updated&rdquo; date above and, for significant
          changes, tell you in the app. If you keep using the Service after a change takes effect, you accept the
          updated Terms.
        </p>
      </LegalSection>

      <LegalSection id="general" title="14. General">
        <p>
          These Terms and the Privacy Policy are the whole agreement between you and us about the Service. If a
          part of these Terms can&rsquo;t be enforced, the rest still applies. If we don&rsquo;t enforce a right,
          we haven&rsquo;t waived it. You may not transfer these Terms to anyone else.
        </p>
      </LegalSection>

      <LegalSection id="app-stores" title="15. Apple App Store and Google Play">
        <p>If you downloaded PlayMatch from the Apple App Store or Google Play, these terms also apply:</p>
        <ul>
          <li>
            These Terms are between you and PlayMatch only, <strong>not with Apple or Google</strong>. PlayMatch,
            not Apple or Google, is solely responsible for the app and its content.
          </li>
          <li>
            Your license to use the app is a limited, non-transferable license to use it on Apple- or
            Android-branded devices that you own or control, as allowed by the App Store or Google Play usage
            rules.
          </li>
          <li>Apple and Google have no obligation to provide maintenance or support for the app.</li>
          <li>
            If the app fails to meet an applicable warranty, you may notify Apple, and Apple may refund the
            purchase price (if any). To the extent allowed by law, Apple has no other warranty obligation for the
            app. Any other claims, losses, or costs from a failure to meet a warranty are our responsibility, to
            the extent these Terms don&rsquo;t disclaim them.
          </li>
          <li>
            We, not Apple, are responsible for handling any claims about the app, including product liability
            claims, claims that the app fails to meet a legal or regulatory requirement, and claims under consumer
            protection, privacy, or similar laws.
          </li>
          <li>
            If anyone claims the app or your use of it infringes their intellectual property, we, not Apple, are
            responsible for investigating, defending, settling, and resolving that claim.
          </li>
          <li>
            You confirm that you are not located in a country subject to a U.S. Government embargo or designated
            as a &ldquo;terrorist supporting&rdquo; country, and that you are not on any U.S. Government list of
            prohibited or restricted parties.
          </li>
          <li>You must also follow any third-party terms that apply when you use the app (for example, your mobile carrier&rsquo;s terms).</li>
          <li>
            Apple and its subsidiaries are third-party beneficiaries of these Terms. Once you accept them, Apple
            has the right to enforce these Terms against you as a third-party beneficiary.
          </li>
        </ul>
        <p>Questions, complaints, or claims about the app go to us at the contact below.</p>
      </LegalSection>

      <LegalSection id="contact" title="16. Contact">
        <p>
          Pleasanton PlayMatch, Pleasanton, California, USA · <EmailLink subject="Terms question" />
          {/* VERIFY: Apple's EULA terms ask for the developer's name and address. Decide what legal name and
              postal address to list here (matches the App Store seller name, H3). */}
        </p>
        <p>
          For help using the app, see our <Link href="/support">Support page</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
