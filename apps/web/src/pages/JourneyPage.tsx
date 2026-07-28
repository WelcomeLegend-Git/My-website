import { useEffect } from "react";
import { useShellContext } from "../app/layouts/useShellContext";

export const JourneyPage = () => {
  const { setAiSection, setAiContext, setShowMentor } = useShellContext();

  useEffect(() => {
    setAiSection("study");
    setShowMentor(false);
    setAiContext({
      type: "vlog",
      page: "journey",
      title: "Journey: 17 Days Building the JEE Study Companion",
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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-brass font-semibold mb-2">
              Story
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-ink font-display">
              Journey: 17 Days Building the JEE Study Companion
            </h1>
            <p className="mt-2 text-sm sm:text-base text-ink-muted max-w-2xl">
              A real, human log of how I balanced JEE prep, a low-end PC, late-night VS Code sessions,
              deployment failures, and AI helpers to ship something I&apos;m genuinely proud of.
            </p>
          </div>
          <div className="glass-card rounded-2xl border border-line px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-2 max-w-xs hover-lift">
            <p className="text-xs text-ink-muted">Quick facts</p>
            <ul className="text-xs sm:text-sm text-ink space-y-1.5">
              <li>Class 11 JEE student</li>
              <li>PC: i3 4th gen + Intel HD graphics</li>
              <li>Coding editor: VS Code</li>
              <li>Approx. 17 days, ~12–14 hours/day</li>
            </ul>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] items-start">
        {/* Timeline */}
        <article className="glass-card rounded-2xl border border-line p-4 sm:p-6 space-y-6 hover-lift">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-semibold mb-2">
              Timeline
            </p>
            <p className="text-sm sm:text-base text-ink-muted">
              This isn&apos;t a day‑by‑day changelog. It&apos;s the emotional timeline: the phases I went through
              while turning a vague idea into a live app I could open on my phone.
            </p>
          </div>

          <div className="space-y-5">
            {/* Phase 1 */}
            <div className="group relative stagger-item">
              
              <div className="relative rounded-2xl border border-line bg-surface-2 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-start gap-3 mb-2">
                  <div className="mt-1 w-8 h-8 rounded-xl bg-brass-soft flex items-center justify-center text-brass text-sm font-bold">
                    1
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-ink font-display">
                      The spark: I&apos;ll build my own companion
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-ink-muted">
                      Before code, it started with a simple frustration: existing tools didn&apos;t really match how I
                      actually study for JEE.
                    </p>
                  </div>
                </div>
                <p className="text-sm sm:text-base text-ink leading-relaxed">
                  I&apos;m Suraj, a Class 11 JEE aspirant. My evenings are usually reserved for Unacademy live classes.
                  Around that schedule I had this thought: instead of just consuming tools other people make, why
                  not build one that actually matches my own way of revising, logging mistakes, and drilling
                  concepts?
                </p>
                <p className="mt-2 text-sm sm:text-base text-ink leading-relaxed">
                  That idea — a personal JEE Study Companion — refused to leave my head. I didn&apos;t want a simple
                  &quot;MCQ list&quot; site. I wanted something that feels modern, fast, and genuinely helpful, with things
                  like a mistake log, formula library, quiz generator, and an AI mentor that understands JEE‑style
                  questions.
                </p>
              </div>
            </div>

            {/* Phase 2 */}
            <div className="group relative stagger-item">
              
              <div className="relative rounded-2xl border border-line bg-surface-2 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-start gap-3 mb-2">
                  <div className="mt-1 w-8 h-8 rounded-xl bg-brass-soft flex items-center justify-center text-brass text-sm font-bold">
                    2
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-ink font-display">
                      The routine: nights, VS Code, and time disappearing
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-ink-muted">
                      When I say I worked a lot on this, it wasn&apos;t an exaggeration. Days blurred into each other.
                    </p>
                  </div>
                </div>
                <p className="text-sm sm:text-base text-ink leading-relaxed">
                  Once I committed, my schedule became intense. I usually woke up around 1–2 PM, quickly
                  freshened up, grabbed something to eat, and then opened VS Code. I coded until it was time for
                  my Unacademy classes. After classes, I went straight back into the project and often continued
                  until 7–8 AM.
                </p>
                <p className="mt-2 text-sm sm:text-base text-ink leading-relaxed">
                  In the first 4–5 days I genuinely lost track of time. I&apos;d be testing some flow — maybe logging a
                  mistake or tweaking the dashboard — and suddenly realise the sky outside wasn&apos;t dark anymore. It
                  was just morning again.
                </p>
                <p className="mt-2 text-sm sm:text-base text-ink leading-relaxed">
                  Sometimes I played music really softly on my Tribit speaker while testing. Other times I turned
                  it off mid‑song because I got so deep into debugging that any sound felt distracting.
                </p>
              </div>
            </div>

            {/* Phase 3 */}
            <div className="group relative stagger-item">
              
              <div className="relative rounded-2xl border border-line bg-surface-2 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-start gap-3 mb-2">
                  <div className="mt-1 w-8 h-8 rounded-xl bg-brass-soft flex items-center justify-center text-brass text-sm font-bold">
                    3
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-ink font-display">
                      Research mode: free hosting, databases, and what&apos;s realistic
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-ink-muted">
                      Before the app could live anywhere, I had to figure out where &quot;anywhere&quot; actually is
                      on a student budget.
                    </p>
                  </div>
                </div>
                <p className="text-sm sm:text-base text-ink leading-relaxed">
                  Because I&apos;m a student, paid infrastructure wasn&apos;t an option. I spent a good amount of time
                  reading docs and articles about free tiers — which host to use, where to keep Postgres, how to
                  handle file storage, and how all of that plays with a monorepo setup.
                </p>
                <p className="mt-2 text-sm sm:text-base text-ink leading-relaxed">
                  That&apos;s how I ended up with Supabase for database + storage and a mix of Vercel (initially) and
                  then Render when Vercel deployments started getting painful on the backend side. None of these
                  decisions were random. They came from trying something, hitting limits, reading logs, and
                  adjusting.
                </p>
              </div>
            </div>

            {/* Phase 4 */}
            <div className="group relative stagger-item">
              
              <div className="relative rounded-2xl border border-line bg-surface-2 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-start gap-3 mb-2">
                  <div className="mt-1 w-8 h-8 rounded-xl bg-brass-soft flex items-center justify-center text-brass text-sm font-bold">
                    4
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-ink font-display">
                      The deployment wall: frustration, support, and a 3–4 AM decision
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-ink-muted">
                      The lowest emotional point in the whole journey came from something that wasn&apos;t even code
                      logic: deployments.
                    </p>
                  </div>
                </div>
                <p className="text-sm sm:text-base text-ink leading-relaxed">
                  Getting everything to run on Vercel plus the database wiring took almost a full day. I finally
                  saw things working, tested some flows, and felt relieved. Then, after more local changes and
                  another deployment, errors started showing up again.
                </p>
                <p className="mt-2 text-sm sm:text-base text-ink leading-relaxed">
                  That turned into a long, frustrating night. I remember starting to seriously fight these issues
                  around 2 PM and still being at it around 3–4 AM. Build logs, environment variables, Prisma
                  commands, serverless function outputs — I went through all of it.
                </p>
                <p className="mt-2 text-sm sm:text-base text-ink leading-relaxed">
                  In that phase I reached out to two people I really respect: my brother Abhay (a software engineer
                  in Bengaluru on a strong package) and my uncle Khem Raj (also a software engineer). I also used
                  AI tools to help interpret cryptic error logs. Eventually I made the call to move the backend to
                  Render, which turned out to be the calmer choice.
                </p>
              </div>
            </div>

            {/* Phase 5 */}
            <div className="group relative stagger-item">
              
              <div className="relative rounded-2xl border border-line bg-surface-2 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-start gap-3 mb-2">
                  <div className="mt-1 w-8 h-8 rounded-xl bg-brass-soft flex items-center justify-center text-brass text-sm font-bold">
                    5
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-ink font-display">
                      Living with AI in the loop (without losing my voice)
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-ink-muted">
                      I didn&apos;t pretend we live in a no‑AI world. I used it — but I stayed in charge.
                    </p>
                  </div>
                </div>
                <p className="text-sm sm:text-base text-ink leading-relaxed">
                  Throughout the project I used ChatGPT 5 / 5.1, Gemini 3, and Sonnet 4.5 as helpers. I coded in
                  VS Code myself, and when I got stuck on errors or weird behaviour, I pasted logs or snippets into
                  these tools and asked for explanations.
                </p>
                <p className="mt-2 text-sm sm:text-base text-ink leading-relaxed">
                  Sonnet 4.5, specifically, was used very rarely. The reason wasn&apos;t quality — it was the free
                  account&apos;s low message limit (roughly under ten messages). I treated those messages like
                  &quot;emergency tokens&quot; for the really stubborn bugs where I wanted another strong perspective.
                </p>
                <p className="mt-2 text-sm sm:text-base text-ink leading-relaxed">
                  Across the whole journey I spent a huge number of tokens on AI, but it was always in the role of
                  a senior sitting next to me, not someone typing for me. The ownership of the idea, the
                  architecture, and the final code stayed with me.
                </p>
              </div>
            </div>

            {/* Phase 6 */}
            <div className="group relative stagger-item">
              
              <div className="relative rounded-2xl border border-line bg-surface-2 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-start gap-3 mb-2">
                  <div className="mt-1 w-8 h-8 rounded-xl bg-brass-soft flex items-center justify-center text-brass text-sm font-bold">
                    6
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-ink font-display">
                      The moment it felt real
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-ink-muted">
                      All the frustration made this part 10x better.
                    </p>
                  </div>
                </div>
                <p className="text-sm sm:text-base text-ink leading-relaxed">
                  There was a very specific kind of happiness the first time everything clicked together: Supabase
                  was connected, the backend on Render was healthy, the frontend loaded correctly, and the app
                  opened cleanly on my phone. I could log a mistake, generate a quiz, and talk to the AI mentor
                  from a URL that actually lived on the internet.
                </p>
                <p className="mt-2 text-sm sm:text-base text-ink leading-relaxed">
                  All the earlier nights where I felt frustrated or tired suddenly felt worth it. The same errors
                  that made me question whether I was in over my head ended up making the success feel much
                  stronger.
                </p>
                <p className="mt-2 text-sm sm:text-base text-ink leading-relaxed">
                  I did skip some live classes during this sprint because I was so deep into building. I don&apos;t
                  say that as a recommendation, just as an honest part of the story. Balancing JEE prep and a
                  serious side project is hard, but this build taught me a lot about both programming and myself.
                </p>
              </div>
            </div>
          </div>
        </article>

        {/* Sidebar: Reflection & future */}
        <aside className="glass-card rounded-2xl border border-line p-4 sm:p-6 space-y-5 hover-lift">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-semibold mb-2">
              Reflection
            </p>
            <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
              If you&apos;re another student or developer reading this, I want this page to feel less like a
              marketing story and more like someone honestly telling you what it took.
            </p>
          </div>

          <div className="space-y-3 text-sm sm:text-base text-ink leading-relaxed">
            <p>
              You don&apos;t need the &quot;perfect&quot; laptop to build something meaningful. My PC is not high‑end. What
              mattered more was showing up every day, being okay with feeling stuck for a while, and asking for
              help — from people, from AI, from documentation.
            </p>
            <p>
              I also learned that emotional ups and downs are normal in a build like this. Feeling frustrated
              doesn&apos;t mean you&apos;re not good enough. It usually means you&apos;re right at the edge of what you know,
              which is also where you learn the most.
            </p>
            <p>
              Going forward I want to keep improving this app — polishing the UI, tightening the flows, and maybe
              adding more smart features around revision planning. But even if nothing else changed, this 17‑day
              sprint would still be worth it for the experience alone.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
};
