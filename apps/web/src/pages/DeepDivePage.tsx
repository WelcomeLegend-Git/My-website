import { useEffect } from "react";
import { useShellContext } from "../app/layouts/useShellContext";

export const DeepDivePage = () => {
  const { setAiSection, setAiContext, setShowMentor } = useShellContext();

  useEffect(() => {
    setAiSection("study");
    setShowMentor(false);
    setAiContext({
      type: "vlog",
      page: "deep-dive",
      title: "Deep Dive: Tech & Architecture",
    });

    return () => {
      setShowMentor(true);
      setAiContext(undefined);
    };
  }, [setAiContext, setAiSection, setShowMentor]);

  return (
    <section className="space-y-8">
      {/* Hero */}
      <header className="fade-in-up">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-brass font-semibold mb-2">
              Build Log
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-ink font-display">
              Deep Dive: Tech &amp; Architecture
            </h1>
            <p className="mt-2 text-sm sm:text-base text-ink-muted max-w-2xl">
              How a Class 11 student used a low-end PC, VS Code, Supabase, Render, and a careful mix of
              AI helpers to ship a production-ready JEE Study Companion in about 17 days.
            </p>
          </div>
          <div className="glass-card rounded-2xl border border-brass/30 px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-2 max-w-sm hover-lift">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-[0.18em]">
              Snapshot
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm text-ink-muted">
              <div>
                <p className="text-ink-muted mb-0.5">Stack</p>
                <p className="font-semibold">React, Vite, TS</p>
              </div>
              <div>
                <p className="text-ink-muted mb-0.5">Backend</p>
                <p className="font-semibold">Express, tRPC, Prisma</p>
              </div>
              <div>
                <p className="text-ink-muted mb-0.5">Infra</p>
                <p className="font-semibold">Supabase, Render</p>
              </div>
              <div>
                <p className="text-ink-muted mb-0.5">AI</p>
                <p className="font-semibold">Gemini 2.5 Pro (multi-key)</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Layout: TOC + Content */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] items-start">
        {/* TOC / Side panel */}
        <aside className="glass-card rounded-2xl border border-line p-4 sm:p-5 space-y-4 hover-lift">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-semibold mb-2">
              Overview
            </p>
            <p className="text-sm text-ink-muted">
              This page is written in my own voice as the builder. It explains why I chose this
              architecture, how the pieces talk to each other, and where AI helped me unblock things
              without taking over the build.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-ink-muted font-semibold">Sections</p>
            <a href="#context" className="block px-3 py-2 rounded-xl text-ink-muted hover:bg-surface-2 hover:text-brass transition-colors">
              1. Context &amp; Constraints
            </a>
            <a href="#architecture" className="block px-3 py-2 rounded-xl text-ink-muted hover:bg-surface-2 hover:text-brass transition-colors">
              2. Architecture &amp; Monorepo
            </a>
            <a href="#frontend" className="block px-3 py-2 rounded-xl text-ink-muted hover:bg-surface-2 hover:text-brass transition-colors">
              3. Frontend &amp; UX Decisions
            </a>
            <a href="#backend" className="block px-3 py-2 rounded-xl text-ink-muted hover:bg-surface-2 hover:text-brass transition-colors">
              4. Backend, Data &amp; AI System
            </a>
            <a href="#hosting" className="block px-3 py-2 rounded-xl text-ink-muted hover:bg-surface-2 hover:text-brass transition-colors">
              5. Hosting, Free Tiers &amp; Deployments
            </a>
            <a href="#ai-helpers" className="block px-3 py-2 rounded-xl text-ink-muted hover:bg-surface-2 hover:text-brass transition-colors">
              6. How I Used AI While Staying in Control
            </a>
          </div>
        </aside>

        {/* Main content */}
        <article className="glass-card rounded-2xl border border-line p-4 sm:p-6 lg:p-7 space-y-8 custom-scrollbar max-h-[min(1100px,80vh)] overflow-y-auto hover-lift">
          {/* 1. Context */}
          <section id="context" className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-ink font-display flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brass-soft flex items-center justify-center text-xs text-brass font-bold">
                1
              </span>
              Context &amp; Constraints
            </h2>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              I&apos;m Suraj, a Class 11 student preparing for JEE. My evenings are mostly Unacademy live classes,
              and in between those I decided to build a full JEE Study Companion from scratch. The idea was
              simple to say but hard to execute: a real product that I would actually use every day, not a
              small demo.
            </p>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              Hardware-wise I&apos;m on a low-end PC: an i3 4th gen processor with Intel HD graphics. No fancy
              GPU, nothing high-end. My editor is VS Code, open almost all the time. For about 17 days I
              worked roughly 12–14 hours a day, often through the night, sleeping around 7–8 AM and waking up
              near 1–2 PM.
            </p>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              These constraints shaped the architecture. I needed fast dev server startup, predictable builds,
              and tooling that would not punish a lower-spec machine. I also wanted a setup that felt
              &quot;real-world&quot; — with a proper backend, database, storage, and deployments — not just a
              single-page toy.
            </p>
          </section>

          {/* 2. Architecture */}
          <section id="architecture" className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-ink font-display flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brass-soft flex items-center justify-center text-xs text-brass font-bold">
                2
              </span>
              Architecture &amp; Monorepo Layout
            </h2>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              I organised the codebase as a monorepo. Conceptually it&apos;s split into a web app, a backend, and
              shared pieces:
            </p>
            <ul className="list-disc list-inside text-sm sm:text-base text-ink space-y-1.5">
              <li>
                <span className="font-semibold text-ink font-display">apps/web</span> – React + Vite + TypeScript frontend
              </li>
              <li>
                <span className="font-semibold text-ink font-display">apps/server</span> – Node/Express backend with tRPC and Prisma
              </li>
              <li>
                <span className="font-semibold text-ink font-display">shared/packages</span> (conceptually) – types and utilities shared between
                client and server
              </li>
            </ul>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              The monorepo approach means I can keep frontend and backend in sync, share TypeScript types
              end‑to‑end, and configure builds in one place. It also mirrors how many production apps are
              structured, which was important for me to learn.
            </p>
          </section>

          {/* 3. Frontend */}
          <section id="frontend" className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-ink font-display flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brass-soft flex items-center justify-center text-xs text-brass font-bold">
                3
              </span>
              Frontend &amp; UX Decisions
            </h2>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              The frontend is built with React, Vite, and TypeScript. I use Tailwind CSS heavily, layered with
              custom utility classes like <span className="font-mono text-xs bg-surface-2 px-1.5 py-0.5 rounded">glass-card</span>,
              <span className="font-mono text-xs bg-surface-2 px-1.5 py-0.5 rounded ml-1">hover-lift</span>, and animated gradients
              to get a premium, glassmorphism look.
            </p>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              Navigation is handled with React Router. The layout uses a Shell pattern with a consistent
              header, navigation bar, and an AI sidebar. Pages like the dashboard, formula library, mistake
              log, quiz history, and study coach all plug into this shell so the experience feels continuous.
            </p>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              For data fetching I use React Query so that network state (loading, error, cached data) is
              handled cleanly. Zustand is used for lightweight global state. Both of these keep the UI very
              responsive even on my low-end machine.
            </p>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              Mobile and tablet support were non‑negotiable. I constantly tested on my phone and iPad,
              adjusting padding, font sizes, and layout breakpoints so that the app felt natural on small
              screens, not just on a desktop monitor. The app is also installable as a PWA so it behaves more
              like a native app.
            </p>
          </section>

          {/* 4. Backend & AI */}
          <section id="backend" className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-ink font-display flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brass-soft flex items-center justify-center text-xs text-brass font-bold">
                4
              </span>
              Backend, Data Model &amp; AI System
            </h2>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              The backend is an Express server with tRPC on top. tRPC lets the frontend call typed procedures
              directly, so I don&apos;t have to keep separate REST typings in sync. Prisma sits between the server
              and Supabase PostgreSQL as the ORM.
            </p>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              Core entities include users, mistakes, formulas, quiz sessions, and questions. Mistakes can
              optionally store image references (for example, a screenshot of a notebook or solution), and
              formulas can store LaTeX‑style content so they render cleanly.
            </p>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              For AI, I use Google Gemini 2.5 Pro on the backend. I don&apos;t call the model directly from the
              browser. Instead there is a dedicated Gemini client on the server that manages:
            </p>
            <ul className="list-disc list-inside text-sm sm:text-base text-ink space-y-1.5">
              <li>Multiple API keys from environment variables</li>
              <li>Rotation between keys to avoid hitting limits too quickly</li>
              <li>Parallel generation when a quiz needs many questions</li>
              <li>Graceful fallbacks and error logging if a call fails</li>
            </ul>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              The quiz router can split a large quiz request into chunks, dispatch them in parallel to Gemini
              (optionally pinned to different API keys), then merge and parse the responses back into a clean
              list of questions. This keeps quiz generation fast even when question counts are high.
            </p>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              There is also a guest mode. Guest tokens are recognised on the backend with a dedicated branch in
              the auth middleware. Instead of trying to verify them as JWTs (which originally caused 401
              errors), guest tokens are mapped to temporary in‑memory users, which allows exploration without a
              full signup while still keeping behaviour predictable.
            </p>
          </section>

          {/* 5. Hosting & Deployments */}
          <section id="hosting" className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-ink font-display flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brass-soft flex items-center justify-center text-xs text-brass font-bold">
                5
              </span>
              Hosting, Free Tiers &amp; Deployment Lessons
            </h2>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              As a student, my budget for hosting was exactly Rs. 0. That meant serious research into which
              free database and hosting providers could realistically handle this stack. I compared options and
              finally settled on Supabase for Postgres + storage and a combination of Vercel and Render for
              hosting.
            </p>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              Supabase gave me a managed Postgres database, authentication support, and storage buckets for
              file uploads, all on a generous free tier. On the hosting side, I initially pushed the frontend
              and backend to Vercel, tweaking config files and build commands to make the monorepo cooperate.
            </p>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              At one point, just wiring the project to Vercel and the database cost me almost a full day. Later,
              after more local testing and another deployment, things started failing again — that night turned
              into a debugging marathon from around 2 PM to 3–4 AM. Eventually I moved the production backend to
              Render, which handled the long‑running server better on a free plan.
            </p>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              On the frontend side, a small but critical file is the redirects configuration. Without it, typing
              a deep link like <span className="font-mono text-xs bg-surface-2 px-1.5 py-0.5 rounded">/auth/login</span> directly
              into the browser would give a 404. With the redirect rule in place, Render always serves the
              React app, and React Router handles the route.
            </p>
          </section>

          {/* 6. AI helpers */}
          <section id="ai-helpers" className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-ink font-display flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brass-soft flex items-center justify-center text-xs text-brass font-bold">
                6
              </span>
              How I Used AI While Staying in Control
            </h2>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              I wrote the actual code in VS Code myself. But I also live in 2025, so pretending I didn&apos;t touch
              AI at all would be fake. I used AI as a helper sitting next to me, not as the main builder.
            </p>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              During development I used ChatGPT 5 / 5.1 (via the ChatGPT Go access that&apos;s currently free in
              India), Gemini 3 through my student plan, and Sonnet 4.5. Sonnet 4.5 was used very rarely — not
              because it wasn&apos;t good, but because the free account had a very small message limit (roughly
              under ten messages), so I saved it for only the most rigid, confusing errors.
            </p>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              The typical loop looked like this: I would try to fix an error myself first. If I hit a wall, I
              copied logs or a code snippet into one of these models and asked why that particular thing was
              failing, or whether there was a better pattern. Then I came back to VS Code and applied the fix
              manually, adapting it to my exact setup.
            </p>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              Across the whole journey I consumed a huge number of AI tokens, but every final decision about
              architecture, stack, and UX went through my understanding. AI helped me move faster and learn
              quicker, but it never replaced my ownership of the project.
            </p>
            <p className="text-sm sm:text-base text-ink leading-relaxed">
              If you&apos;re another student or developer reading this, my recommendation is simple: use AI as a
              super‑charged debugger and reviewer, not as a copy‑paste machine. Keep your editor open, think,
              and let the tools amplify your effort instead of replacing it.
            </p>
          </section>
        </article>
      </div>
    </section>
  );
};
