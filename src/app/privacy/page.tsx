import type { Metadata } from "next";
import Link from "next/link";
import { legal } from "@/lib/legal";
import { LegalContact } from "@/components/legal-contact";
export const metadata: Metadata = { title: "Privacy Policy" };
export default function Page() {
  return (
    <main id="main" className="legal-page">
      <span className="eyebrow">HOW THE ARCHIVE KEEPS YOUR SECRETS</span>
      <h1>Privacy Policy</h1>
      <p className="legal-meta">
        Last updated {legal.updated} · Version {legal.version}
      </p>
      <p className="legal-summary">
        <strong>In short:</strong> LoreKeeper is a private, invitation-only
        hobby project. We collect only what is needed to run your account and
        your stories. There is no advertising, no analytics and no tracking.
        Your Content is shared with the members of the spaces you post in, and
        with an AI provider or ChatGPT only when an AI feature or the ChatGPT
        connection is used. You can export and delete your data at any time.
      </p>
      <nav className="legal-toc" aria-label="Contents">
        <a href="#controller">1. Who is responsible</a>
        <a href="#data">2. What we collect</a>
        <a href="#purposes">3. Why we use it</a>
        <a href="#visibility">4. Who can see your Content</a>
        <a href="#ai">5. AI processing</a>
        <a href="#chatgpt">6. ChatGPT integration</a>
        <a href="#processors">7. Service providers and transfers</a>
        <a href="#storage">8. Browser storage and cookies</a>
        <a href="#retention">9. How long we keep data</a>
        <a href="#security">10. Security</a>
        <a href="#rights">11. Your rights</a>
        <a href="#children">12. Children</a>
        <a href="#changes">13. Changes</a>
      </nav>

      <section id="controller">
        <h2>1. Who is responsible</h2>
        <p>
          LoreKeeper is run by a private individual (the &quot;operator&quot;)
          for a closed circle of invited people, and the operator is
          responsible for your personal data here. Every member joins through
          an invitation from someone they know. You can reach the operator{" "}
          <LegalContact />, for any privacy question or request.
        </p>
        <p>
          This policy follows the EU and UK General Data Protection Regulation
          (GDPR) and the Swiss Federal Act on Data Protection (FADP).
        </p>
      </section>

      <section id="data">
        <h2>2. What we collect</h2>
        <h3>Account data</h3>
        <ul>
          <li>
            your name, email address and password (stored only as a salted
            hash by our sign-in provider, Supabase Auth);
          </li>
          <li>
            your role (member or administrator), the collections, stories and
            chats you belong to, and the invitation you registered with
            (invitation links are stored only as a hash);
          </li>
          <li>
            the date and version of the Terms and Privacy Policy you accepted.
          </li>
        </ul>
        <h3>Content you create</h3>
        <ul>
          <li>
            collection entries (quotes, stories, discussions, remarks,
            attributed authors), favorites and reading designs;
          </li>
          <li>
            characters (name, kind, personality, avatar, voice settings),
            interactive stories (settings, world, chapters, questions, your
            answers and your player character) and chat messages, including
            the AI-transformed versions.
          </li>
        </ul>
        <p>
          Content may contain personal data about you or about others, such as
          friends you quote. Please only add what those people would be
          comfortable with, and never sensitive data (see the{" "}
          <Link href="/terms#content">Terms</Link>).
        </p>
        <h3>AI settings and usage</h3>
        <ul>
          <li>
            the AI provider and model you chose, and your own API key if you
            store one (encrypted);
          </li>
          <li>
            a daily counter of your AI usage (allowance units, number of calls
            and the time of the last call), used to enforce fair-use limits.
          </li>
        </ul>
        <h3>ChatGPT connection</h3>
        <ul>
          <li>
            if you connect ChatGPT: the OAuth authorisation you granted, the
            registered client (ChatGPT) and the access and refresh tokens
            issued, managed by Supabase Auth.
          </li>
        </ul>
        <h3>Technical data</h3>
        <ul>
          <li>
            when you use the Service, our hosting and database providers
            automatically process technical data such as your IP address,
            browser user agent, requested URLs, timestamps and error messages
            in short-lived server logs, to deliver the Service and keep it
            secure.
          </li>
        </ul>
      </section>

      <section id="purposes">
        <h2>3. Why we use it, and on what legal basis</h2>
        <ul>
          <li>
            <strong>To provide the Service</strong> (account, sign-in,
            collections, stories, chats, exports, AI features you trigger, the
            ChatGPT connection): performance of our contract with you, Art.
            6(1)(b) GDPR.
          </li>
          <li>
            <strong>To keep the Service secure and fair</strong> (logs, rate
            limits, AI allowances, invitation checks, abuse prevention): our
            legitimate interests, Art. 6(1)(f) GDPR.
          </li>
          <li>
            <strong>To connect ChatGPT</strong>: your consent, given on the
            connection screen, Art. 6(1)(a) GDPR, which you can withdraw by
            disconnecting.
          </li>
          <li>
            <strong>Personal data of others in Content</strong> (e.g. a quoted
            friend): our and our users&apos; legitimate interest in keeping a
            private, shared archive among the people involved, Art. 6(1)(f)
            GDPR. Anyone mentioned can ask us to remove it.
          </li>
          <li>
            <strong>To comply with the law</strong> and handle legal claims:
            Art. 6(1)(c) and (f) GDPR.
          </li>
        </ul>
        <p>
          We do not sell your data, use it for advertising, build profiles,
          make automated decisions with legal effect about you, or use your
          Content to train AI models.
        </p>
      </section>

      <section id="visibility">
        <h2>4. Who can see your Content</h2>
        <ul>
          <li>
            <strong>Collections:</strong> all members of a collection can see
            its entries and the names of other members. The collection
            administrator can edit and delete entries and manage members.
          </li>
          <li>
            <strong>Interactive stories and chats:</strong> everyone who joined
            through the invitation link can see the story or chat, other
            players&apos; names, characters, answers and messages.
          </li>
          <li>
            <strong>The operator</strong> has technical access to the database
            and the encryption key and will only look at Content when needed to
            run, secure or repair the Service, to answer your request, or when
            required by law.
          </li>
        </ul>
      </section>

      <section id="ai">
        <h2>5. AI processing</h2>
        <p>
          When an AI feature is used, for example a narrated story turn or a
          chat voice transformation, the text needed for it is sent to an AI
          provider: story settings and world, earlier chapters and a story
          summary, players&apos; names, characters and answers, or the chat
          message to be transformed. Your email address and password are never
          sent.
        </p>
        <ul>
          <li>
            <strong>Shared AI.</strong> If you have no key of your own, the
            request uses the operator&apos;s account with the configured
            provider (currently Groq, Inc., USA). The provider processes the
            request to generate the response under its own terms and privacy
            policy.
          </li>
          <li>
            <strong>Your own key.</strong> If you store your own key, requests
            go to the provider you chose (Groq, Google Gemini, OpenRouter,
            OpenAI or Anthropic) under your account and that provider&apos;s
            terms and privacy policy, which you accepted with them. The
            provider is responsible for how it handles that data.
          </li>
          <li>
            <strong>Whose key is used.</strong> Story turns use the AI settings
            of the story&apos;s owner, so if you play in a story someone else
            owns, your answers are sent to the provider that person chose.
            Chat voice transformations use the settings of the person sending
            the message.
          </li>
        </ul>
        <p>
          Some providers, especially free tiers (for example Google
          Gemini&apos;s free tier or free models on OpenRouter), may keep
          requests or use them to improve their models. Check your
          provider&apos;s policy and choose a paid tier or opt out where you
          need to. Providers&apos; policies:{" "}
          <a href="https://groq.com/privacy-policy" rel="noreferrer">
            Groq
          </a>
          ,{" "}
          <a href="https://policies.google.com/privacy" rel="noreferrer">
            Google
          </a>
          ,{" "}
          <a href="https://openrouter.ai/privacy" rel="noreferrer">
            OpenRouter
          </a>
          ,{" "}
          <a
            href="https://openai.com/policies/privacy-policy"
            rel="noreferrer"
          >
            OpenAI
          </a>
          ,{" "}
          <a
            href="https://www.anthropic.com/legal/privacy"
            rel="noreferrer"
          >
            Anthropic
          </a>
          .
        </p>
      </section>

      <section id="chatgpt">
        <h2>6. ChatGPT integration</h2>
        <p>
          If you connect LoreKeeper to ChatGPT, you sign in and approve the
          connection on our consent screen. ChatGPT can then, on your behalf,
          read the stories you own (settings, players&apos; names and
          characters, every chapter, question and answer), save chapters to
          them, and import or save stories into your library.
        </p>
        <p>
          Data that ChatGPT reads from LoreKeeper becomes part of your ChatGPT
          conversation and is processed by OpenAI as an independent controller
          under the{" "}
          <a
            href="https://openai.com/policies/privacy-policy"
            rel="noreferrer"
          >
            OpenAI Privacy Policy
          </a>{" "}
          and your ChatGPT settings, including whether conversations are used
          for training. We have no control over this. Stories you own may
          include other players&apos; Content, so let them know before you
          connect a shared story.
        </p>
        <p>
          You can disconnect under Profile → Account settings at any time.
          This revokes ChatGPT&apos;s access tokens; data already in your
          ChatGPT conversations must be deleted in ChatGPT.
        </p>
      </section>

      <section id="processors">
        <h2>7. Service providers and international transfers</h2>
        <p>
          We use the following providers, which process data on our behalf
          under data processing agreements:
        </p>
        <ul>
          <li>
            <strong>Vercel Inc.</strong> (USA) hosts the web application and
            processes request data and logs.
          </li>
          <li>
            <strong>Supabase Inc.</strong> (USA) provides the database,
            sign-in, OAuth server and the ChatGPT connector (an Edge Function),
            and stores all account data and Content. Data is stored in the
            region selected for our project.
          </li>
          <li>
            <strong>Groq, Inc.</strong> (USA) provides the shared AI, when it
            is enabled.
          </li>
        </ul>
        <p>
          AI providers you choose with your own key, and OpenAI when you use
          ChatGPT, act under their own terms with you as described above.
        </p>
        <p>
          Some of these providers are located in, or access data from, the
          USA and other countries that may not offer the same level of
          protection as your own. Transfers rely on the EU-U.S. Data Privacy
          Framework (and its UK and Swiss extensions) where the provider is
          certified, and otherwise on the European Commission&apos;s Standard
          Contractual Clauses.
        </p>
      </section>

      <section id="storage">
        <h2>8. Browser storage and cookies</h2>
        <p>
          We use no advertising or analytics cookies and no tracking. The app
          stores the following in your browser&apos;s local storage, which is
          strictly necessary for the features you use and does not require
          consent:
        </p>
        <ul>
          <li>your sign-in session (managed by Supabase Auth);</li>
          <li>
            your reading preferences, how far you have revealed an interactive
            story, and unsent answer drafts.
          </li>
        </ul>
        <p>
          Clearing your browser data removes these and signs you out. Fonts
          and textures are served by the app itself, not by third parties.
        </p>
      </section>

      <section id="retention">
        <h2>9. How long we keep data</h2>
        <ul>
          <li>
            Account data and Content: until you delete it or your account, or
            until the owner of a collection, story or chat deletes it.
          </li>
          <li>
            When you delete your account, we immediately delete your account,
            profile, AI settings and usage counters, the collections,
            interactive stories, chats and characters you own (including other
            members&apos; Content in them), the chat messages you sent, and
            your memberships and favorites. Entries you created in collections
            owned by others remain in those collections, no longer linked to
            your account; ask the administrator or us if you want them
            removed.
          </li>
          <li>
            Invitation links: until they expire (seven days) or the
            collection is deleted.
          </li>
          <li>
            AI usage counters: one record per day, deleted with your account.
          </li>
          <li>
            ChatGPT tokens: until they expire, you disconnect, or you delete
            your account.
          </li>
          <li>
            Server logs at our providers: typically a few days up to 30 days.
          </li>
          <li>
            Database backups: deleted data can remain in backups until they
            are overwritten under our provider&apos;s backup schedule.
          </li>
        </ul>
        <p>
          AI providers and OpenAI keep data under their own retention
          policies.
        </p>
      </section>

      <section id="security">
        <h2>10. Security</h2>
        <p>
          All connections use HTTPS. Database access is restricted per user
          with row-level security. Collection entries and your own API keys
          are additionally encrypted with AES-256-GCM before they are stored,
          using a key held only by the server. Passwords are hashed by
          Supabase Auth. Invitation links are stored only as hashes. No system
          is perfectly secure; if a breach affects your data, we will inform
          you and the authorities as required by law.
        </p>
      </section>

      <section id="rights">
        <h2>11. Your rights</h2>
        <p>Depending on where you live, you have the right to:</p>
        <ul>
          <li>access the personal data we hold about you;</li>
          <li>correct inaccurate data;</li>
          <li>
            delete your data (you can delete your account yourself under
            Profile → Your account);
          </li>
          <li>
            receive your data in a portable format (you can export collections
            and stories from the app);
          </li>
          <li>
            restrict or object to processing based on legitimate interests;
          </li>
          <li>
            withdraw consent at any time, for example by disconnecting
            ChatGPT, without affecting earlier processing;
          </li>
          <li>
            lodge a complaint with a data protection authority, such as the one
            in your country of residence (in Switzerland, the FDPIC).
          </li>
        </ul>
        <p>
          To exercise your rights, contact the operator <LegalContact />. We will reply within one month. People who are
          not users but appear in Content can also contact us to have it
          removed.
        </p>
      </section>

      <section id="children">
        <h2>12. Children</h2>
        <p>
          The Service is not intended for anyone under 16. We do not knowingly
          collect data from children. If you believe a child has an account,
          contact us and we will delete it.
        </p>
      </section>

      <section id="changes">
        <h2>13. Changes</h2>
        <p>
          We will update this policy when the Service or our providers change,
          and announce material changes in the Service or by email before they
          take effect. The date at the top shows the latest version. See also
          our <Link href="/terms">Terms of Service</Link>.
        </p>
      </section>
    </main>
  );
}
