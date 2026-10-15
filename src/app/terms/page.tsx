import type { Metadata } from "next";
import Link from "next/link";
import { legal } from "@/lib/legal";
import { LegalContact } from "@/components/legal-contact";
export const metadata: Metadata = { title: "Terms of Service" };
export default function Page() {
  return (
    <main id="main" className="legal-page">
      <span className="eyebrow">THE RULES OF THE ARCHIVE</span>
      <h1>Terms of Service</h1>
      <p className="legal-meta">
        Last updated {legal.updated} · Version {legal.version}
      </p>
      <nav className="legal-toc" aria-label="Contents">
        <a href="#scope">1. Scope</a>
        <a href="#access">2. Invitation-only access</a>
        <a href="#account">3. Your account</a>
        <a href="#content">4. Your content</a>
        <a href="#conduct">5. Acceptable use</a>
        <a href="#ai">6. AI features</a>
        <a href="#keys">7. Your own API keys</a>
        <a href="#chatgpt">8. ChatGPT integration</a>
        <a href="#third-parties">9. Third-party services</a>
        <a href="#availability">10. Availability and changes</a>
        <a href="#termination">11. Suspension and termination</a>
        <a href="#liability">12. Disclaimers and liability</a>
        <a href="#law">13. Governing law</a>
        <a href="#changes">14. Changes to these Terms</a>
        <a href="#contact">15. Contact</a>
      </nav>

      <section id="scope">
        <h2>1. Scope</h2>
        <p>
          These Terms govern your use of LoreKeeper (the &quot;Service&quot;),
          a private, invitation-only archive for collecting stories, quotes
          and discussions, playing AI-assisted interactive stories, and
          connecting those stories to ChatGPT. The Service is run by a private
          individual (the &quot;operator&quot;, &quot;we&quot;, &quot;us&quot;)
          as a private, non-commercial project for a closed circle of invited
          people, and is provided free of charge.
        </p>
        <p>
          By creating an account or using the Service you agree to these Terms
          and acknowledge our <Link href="/privacy">Privacy Policy</Link>. If
          you do not agree, do not use the Service.
        </p>
      </section>

      <section id="access">
        <h2>2. Invitation-only access</h2>
        <p>
          There is no public registration. You may only create an account
          through a valid, unexpired invitation link issued by a collection
          administrator. Invitation links expire after seven days and can be
          revoked at any time.
        </p>
        <ul>
          <li>
            An invitation is meant for the person it was sent to. Do not
            publish or pass on invitation links, and do not register using a
            link that was not intended for you.
          </li>
          <li>
            Accounts created without a valid invitation, through a forwarded or
            leaked link, or by circumventing the invitation system may be
            deleted without notice.
          </li>
          <li>
            You must be at least 16 years old, or the minimum age required to
            consent to data processing in your country if that is higher.
          </li>
          <li>
            Being invited does not entitle you to keep access. We and
            collection administrators may remove you as described below.
          </li>
        </ul>
      </section>

      <section id="account">
        <h2>3. Your account</h2>
        <p>
          Provide a truthful email address and keep your password secret. You
          are responsible for everything done through your account, including
          through apps you connect such as ChatGPT. If you suspect unauthorised
          access, change your password and tell us immediately (see section
          15). One person, one account; accounts may not be
          shared, sold or transferred.
        </p>
        <p>
          Collection administrators can invite members, manage entries and
          remove content from their collections. Administrator rights are
          assigned by the operator only.
        </p>
      </section>

      <section id="content">
        <h2>4. Your content</h2>
        <p>
          &quot;Content&quot; means anything you add to the Service: entries,
          quotes, stories, characters, chat messages, answers in interactive
          stories, names and descriptions. You keep all rights to your
          Content.
        </p>
        <p>
          You grant us a non-exclusive, royalty-free licence, limited to
          operating the Service, to store, copy, process, format and display
          your Content to you and to the other members of the collections,
          stories and chats you post it in, and to send it to the AI providers
          and connected apps you or the owner of a story choose to use (see
          sections 6 to 8). This licence ends when the Content is deleted,
          except for copies in backups, which expire on their regular
          schedule.
        </p>
        <p>
          Content you post in a shared collection, story or chat is visible to
          its members and remains under the control of its owner or
          administrator. If you delete your account, entries you created in
          collections owned by others may remain there without being linked to
          you.
        </p>
        <p>You are responsible for your Content and confirm that:</p>
        <ul>
          <li>you have the right to post it;</li>
          <li>
            quotes, stories or descriptions about real people are not
            defamatory, humiliating beyond good-natured fun, or private
            information they would reasonably object to having stored;
          </li>
          <li>
            it does not include sensitive personal data such as health
            information, political or religious views, sexual orientation,
            financial account details, passwords or government ID numbers,
            about you or anyone else.
          </li>
        </ul>
        <p>
          We do not review Content in advance, but we may remove Content or
          restrict accounts that violate these Terms or the law. If you believe
          Content in the Service infringes your rights, contact us (see
          section 15) and we will act promptly.
        </p>
      </section>

      <section id="conduct">
        <h2>5. Acceptable use</h2>
        <p>You must not use the Service to:</p>
        <ul>
          <li>
            harass, threaten, bully or discriminate against anyone, or post
            hateful, violent-extremist or sexually explicit content involving
            minors;
          </li>
          <li>
            post illegal content or content that infringes copyright,
            trademarks, privacy or other rights;
          </li>
          <li>
            create content intended to deceive or harm real people, including
            impersonation or fake statements attributed to them as genuine;
          </li>
          <li>
            probe, scan, attack or overload the Service, bypass rate limits or
            usage allowances, or access accounts, collections or data that are
            not yours;
          </li>
          <li>
            scrape the Service, resell access to it, or use it, the shared AI
            or the ChatGPT integration for commercial purposes or for anything
            other than personal, recreational storytelling;
          </li>
          <li>
            use AI features in breach of the usage policies of the AI provider
            involved.
          </li>
        </ul>
      </section>

      <section id="ai">
        <h2>6. AI features</h2>
        <p>
          Some features send your Content to an AI model, for example to
          narrate interactive stories or to transform chat messages into a
          character&apos;s voice. The text sent can include the story
          settings, earlier chapters, players&apos; names, characters and
          answers, and the chat messages being transformed.
        </p>
        <ul>
          <li>
            <strong>Shared AI.</strong> We may offer a shared AI, funded by
            the operator, so everyone can use AI features without their own
            key. It is provided as a courtesy, subject to daily allowances and
            a global limit, and may be reduced, changed to another provider or
            model, or withdrawn at any time without notice.
          </li>
          <li>
            <strong>AI output.</strong> AI-generated text is produced
            automatically. It can be inaccurate, inconsistent, offensive or
            similar to existing works. It does not reflect our views, and you
            use it at your own risk. Do not rely on it for factual, legal,
            medical or financial decisions.
          </li>
          <li>
            <strong>No sensitive data.</strong> Do not put personal secrets or
            sensitive data about anyone into stories or chats processed by AI.
          </li>
        </ul>
      </section>

      <section id="keys">
        <h2>7. Your own API keys</h2>
        <p>
          You can store your own API key for a supported provider (currently
          Groq, Google Gemini, OpenRouter, OpenAI or Anthropic). When you do:
        </p>
        <ul>
          <li>
            you must own the key or be authorised to use it, and you remain
            the provider&apos;s customer, bound by its terms and usage
            policies;
          </li>
          <li>
            all costs, rate limits and account actions on the provider&apos;s
            side are your responsibility; set spending limits with your
            provider;
          </li>
          <li>
            your key is stored encrypted and used only for AI requests for
            stories you own (including turns triggered by other players in
            them) and for your own chat messages;
          </li>
          <li>
            you can replace or delete the key at any time under Profile → AI
            access. If you suspect a key was exposed, revoke it with the
            provider.
          </li>
        </ul>
      </section>

      <section id="chatgpt">
        <h2>8. ChatGPT integration</h2>
        <p>
          You can connect your LoreKeeper account to ChatGPT, a service of
          OpenAI. After you approve the connection, ChatGPT can list and read
          the stories you own (including settings, players&apos; names,
          characters and all chapters and answers), save new chapters to them,
          and import new stories into your library.
        </p>
        <ul>
          <li>
            Your use of ChatGPT is governed by OpenAI&apos;s terms and privacy
            policy. We are not responsible for ChatGPT or for what it does
            with data it receives.
          </li>
          <li>
            In LoreKeeper, ChatGPT writes stories freely; we only store what it
            saves. Section 6 on AI output applies equally to ChatGPT.
          </li>
          <li>
            Stories you own may contain Content from other players. Only
            connect stories to ChatGPT when the other players are aware of
            this.
          </li>
          <li>
            You can disconnect at any time under Profile → Account settings.
            Disconnecting stops future access but does not delete data already
            in your ChatGPT conversations.
          </li>
        </ul>
      </section>

      <section id="third-parties">
        <h2>9. Third-party services</h2>
        <p>
          The Service relies on third-party providers, including Vercel
          (hosting), Supabase (database, sign-in and the ChatGPT connector),
          AI providers and OpenAI. Their availability and terms are outside
          our control. Our <Link href="/privacy">Privacy Policy</Link> lists
          them and explains how they process your data.
        </p>
      </section>

      <section id="availability">
        <h2>10. Availability and changes</h2>
        <p>
          The Service is a free, hobby project. We do not promise any level of
          availability, performance or support, and features may change or
          disappear at any time. We may discontinue the Service entirely; if we
          do, we will try to give at least 30 days&apos; notice so you can
          export your Content. Keep your own copies of Content that matters to
          you.
        </p>
      </section>

      <section id="termination">
        <h2>11. Suspension and termination</h2>
        <p>
          You can delete your account at any time under Profile → Your
          account. This permanently deletes your account and the collections,
          stories, chats, characters and settings you own, as described in the
          Privacy Policy.
        </p>
        <p>
          We may suspend or delete accounts, or remove Content, if you breach
          these Terms, if required by law, if your account was not created
          through a valid invitation, or if the Service is discontinued. Where
          reasonable, we will tell you why. Sections 4 (as to responsibility
          for Content), 12 and 13 survive termination.
        </p>
      </section>

      <section id="liability">
        <h2>12. Disclaimers and liability</h2>
        <p>
          The Service is provided free of charge, &quot;as is&quot; and
          &quot;as available&quot;, without warranties of any kind, express or
          implied, including fitness for a particular purpose, accuracy of AI
          output, and freedom from errors or data loss, to the extent
          permitted by law.
        </p>
        <p>
          To the extent permitted by law, we are not liable for indirect or
          consequential damages, lost data or Content, costs incurred with AI
          providers through your own API key, or the acts of other users,
          AI providers, OpenAI or other third parties. Nothing in these Terms
          limits liability that cannot be limited by law, in particular
          liability for intent, gross negligence, or injury to life, body or
          health, or your mandatory rights as a consumer.
        </p>
        <p>
          To the extent permitted by law, you will indemnify us against
          third-party claims arising from your Content or your breach of these
          Terms.
        </p>
      </section>

      <section id="law">
        <h2>13. Governing law</h2>
        <p>
          These Terms are governed by the laws of the operator&apos;s country
          of residence, excluding
          its conflict-of-law rules and the UN Convention on Contracts for the
          International Sale of Goods. If you are a consumer, you also keep the
          protection of the mandatory laws of your country of residence, and
          you may bring proceedings in its courts. If any provision is invalid,
          the rest remain in effect.
        </p>
      </section>

      <section id="changes">
        <h2>14. Changes to these Terms</h2>
        <p>
          We may update these Terms, for example when features change. We will
          announce material changes in the Service or by email before they
          take effect. If you keep using the Service after that date, the new
          Terms apply; if you do not agree, you can delete your account.
        </p>
      </section>

      <section id="contact">
        <h2>15. Contact</h2>
        <p>
          Reach the operator <LegalContact />.
        </p>
      </section>
    </main>
  );
}
