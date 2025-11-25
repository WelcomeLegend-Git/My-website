import { useEffect } from "react";
import { useShellContext } from "../app/layouts/useShellContext";

export const TechnicalDeepDivePage = () => {
    const { setAiSection, setAiContext, setShowMentor } = useShellContext();

    useEffect(() => {
        setAiSection("study");
        setShowMentor(false);
        setAiContext({
            type: "vlog",
            page: "technical-deep-dive",
            title: "Technical Deep Dive: Building a Production JEE App",
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
                        <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-2">
                            Technical Deep Dive
                        </p>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-100">
                            Building a Production JEE Study App
                        </h1>
                        <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-2xl">
                            From i3 4th gen PC to production: Architecture decisions, deployment battles,
                            and real technical challenges solved during 17 days of intense development.
                        </p>
                    </div>
                    <div className="glass-card rounded-2xl border border-primary/30 px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-2 max-w-sm hover-lift">
                        <p className="text-xs font-semibold text-slate-300 uppercase tracking-[0.18em]">
                            Tech Stack
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm text-slate-300">
                            <div>
                                <p className="text-slate-400 mb-0.5">Frontend</p>
                                <p className="font-semibold">React + Vite + TS</p>
                            </div>
                            <div>
                                <p className="text-slate-400 mb-0.5">Backend</p>
                                <p className="font-semibold">Express + tRPC</p>
                            </div>
                            <div>
                                <p className="text-slate-400 mb-0.5">Database</p>
                                <p className="font-semibold">Prisma + Supabase</p>
                            </div>
                            <div>
                                <p className="text-slate-400 mb-0.5">AI</p>
                                <p className="font-semibold">Gemini 2.5 Pro × 4</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <div className="glass-card rounded-2xl border border-slate-800/60 p-4 sm:p-6 lg:p-8 space-y-10 hover-lift">

                {/* Section 1: Context & Hardware */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm text-primary font-bold">
                            01
                        </span>
                        <h2 className="text-xl sm:text-2xl font-semibold text-slate-100">
                            Context: Low-End PC, High Ambitions
                        </h2>
                    </div>

                    <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                        I'm Suraj, a Class 11 student preparing for JEE. My development setup? An <span className="text-primary font-semibold">i3 4th generation processor with Intel HD graphics</span> - far from what most would call ideal for modern web development. No dedicated GPU, no fancy M-series chip. Just VS Code, Chrome, and determination.
                    </p>

                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2">
                        <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Development Environment</p>
                        <ul className="text-sm text-slate-300 space-y-1.5">
                            <li>• <span className="font-semibold text-slate-200">Hardware:</span> i3 4th Gen + Intel HD Graphics (low-end PC)</li>
                            <li>• <span className="font-semibold text-slate-200">Editor:</span> VS Code</li>
                            <li>• <span className="font-semibold text-slate-200">Testing Devices:</span> PC, iPad, Mobile Phone</li>
                            <li>• <span className="font-semibold text-slate-200">Audio:</span> Tribit speaker (low volume, often turned off for focus)</li>
                            <li>• <span className="font-semibold text-slate-200">Time:</span> ~17 days, 12-14 hours/day</li>
                        </ul>
                    </div>

                    <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                        These constraints weren't just inconveniences - they shaped every architectural decision. I needed <span className="text-primary">fast dev server startup</span>, <span className="text-primary">predictable builds</span>, and tools that wouldn't punish my lower-spec machine. This influenced my choice of Vite over webpack, my monorepo structure, and even how I organized imports.
                    </p>
                </section>

                {/* Section 2: Monorepo Architecture */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-sm text-emerald-300 font-bold">
                            02
                        </span>
                        <h2 className="text-xl sm:text-2xl font-semibold text-slate-100">
                            Monorepo Setup: Learning Production Patterns
                        </h2>
                    </div>

                    <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                        I organized the project as a monorepo, mirroring how real production applications are structured:
                    </p>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/20 rounded-xl p-4">
                            <h3 className="text-base font-semibold text-slate-100 mb-2">apps/web</h3>
                            <p className="text-sm text-slate-300 mb-3">React + Vite + TypeScript frontend with glassmorphism UI</p>
                            <ul className="text-xs text-slate-400 space-y-1">
                                <li>• React Router for navigation</li>
                                <li>• React Query (TanStack Query) for data</li>
                                <li>• Zustand for lightweight state</li>
                                <li>• Custom glass-card components</li>
                            </ul>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 rounded-xl p-4">
                            <h3 className="text-base font-semibold text-slate-100 mb-2">apps/server</h3>
                            <p className="text-sm text-slate-300 mb-3">Node/Express backend with tRPC and Prisma ORM</p>
                            <ul className="text-xs text-slate-400 space-y-1">
                                <li>• tRPC for type-safe API</li>
                                <li>• Prisma with Supabase Postgres</li>
                                <li>• Multi-key Gemini AI client</li>
                                <li>• JWT + Guest auth middleware</li>
                            </ul>
                        </div>
                    </div>

                    <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                        The monorepo approach meant <span className="font-semibold text-primary">end-to-end TypeScript type safety</span>. When I changed a backend procedure's return type, the frontend immediately showed errors. No runtime surprises, no version mismatches.
                    </p>
                </section>

                {/* Section 3: The Hosting Saga */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-sm text-rose-300 font-bold">
                            03
                        </span>
                        <h2 className="text-xl sm:text-2xl font-semibold text-slate-100">
                            The Hosting Saga: Vercel → Render Migration
                        </h2>
                    </div>

                    <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                        As a student, my hosting budget was <span className="font-bold text-primary">exactly ₹0</span>. This constraint led to one of the most frustrating - and educational - parts of the journey.
                    </p>

                    <div className="space-y-4">
                        <div className="border-l-4 border-rose-500/50 bg-rose-500/5 rounded-r-xl p-4">
                            <h4 className="text-sm font-semibold text-rose-300 mb-2">Problem: Vercel Build Failures</h4>
                            <p className="text-sm text-slate-300 mb-3">
                                My first deployment attempts to Vercel hit multiple walls:
                            </p>
                            <ul className="text-sm text-slate-300 space-y-2">
                                <li>• <span className="font-mono text-xs bg-slate-900/70 px-1.5 py-0.5 rounded">prisma: command not found</span> during frontend build</li>
                                <li>• <span className="font-mono text-xs bg-slate-900/70 px-1.5 py-0.5 rounded">No Output Directory named "dist" found</span> for serverless functions</li>
                                <li>• Root <span className="font-mono text-xs">postinstall</span> script running in wrong contexts</li>
                            </ul>
                        </div>

                        <div className="border-l-4 border-emerald-500/50 bg-emerald-500/5 rounded-r-xl p-4">
                            <h4 className="text-sm font-semibold text-emerald-300 mb-2">Initial Fixes</h4>
                            <ul className="text-sm text-slate-300 space-y-2">
                                <li>• Removed root <span className="font-mono text-xs">postinstall: prisma generate</span></li>
                                <li>• Fixed <span className="font-mono text-xs">apps/server/vercel.json</span> serverless config</li>
                                <li>• Deleted confusing duplicate <span className="font-mono text-xs">server-deploy</span> folder</li>
                                <li>• Used <span className="font-mono text-xs">npx prisma generate</span> in backend-specific builds</li>
                            </ul>
                        </div>
                    </div>

                    <p className="text-sm sm:text-base text-slate-200 leading-relaxed mt-4">
                        Just getting the first successful deployment took <span className="font-semibold text-primary">almost a full day</span>. Then, after more local testing and another deployment attempt, things started failing again. That turned into a debugging marathon from <span className="font-semibold text-rose-300">2 PM to 3-4 AM</span>.
                    </p>

                    <div className="bg-slate-900/50 border border-amber-500/30 rounded-xl p-4 mt-4">
                        <p className="text-sm font-semibold text-amber-300 mb-2">The Decision: Moving to Render</p>
                        <p className="text-sm text-slate-300 leading-relaxed">
                            After multiple deployment issues and time lost, I made the strategic decision to <span className="font-semibold">migrate to Render</span>. The backend as a Web Service and frontend as a Static Site proved much more stable for my monorepo setup. Build commands were clearer, environment variables were straightforward, and deployments became predictable.
                        </p>
                    </div>
                </section>

                {/* Section 4: Multi-Key Gemini AI */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-sm text-purple-300 font-bold">
                            04
                        </span>
                        <h2 className="text-xl sm:text-2xl font-semibold text-slate-100">
                            Multi-Key Gemini Client: Scaling AI Reliably
                        </h2>
                    </div>

                    <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                        For AI quiz generation and the Study Guru mentor, I needed <span className="font-semibold text-primary">reliable, fast AI responses</span>. Using a single Gemini API key would hit rate limits quickly, especially during quiz generation with 10-15 questions.
                    </p>

                    <div className="bg-gradient-to-br from-purple-500/5 to-primary/5 border border-purple-500/20 rounded-xl p-5 space-y-3">
                        <h4 className="text-base font-semibold text-slate-100">Implementation Strategy</h4>

                        <div className="space-y-3">
                            <div>
                                <p className="text-sm font-semibold text-purple-300 mb-1">1. Multiple API Keys with Rotation</p>
                                <p className="text-sm text-slate-300">
                                    Set up <span className="font-mono text-xs bg-slate-900/70 px-1.5 py-0.5 rounded">GEMINI_API_KEYS</span> as comma-separated list (4 keys), parsed into array
                                </p>
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-purple-300 mb-1">2. Parallel Quiz Generation</p>
                                <p className="text-sm text-slate-300">
                                    For quizzes &gt; 5 questions: split into chunks, dispatch in parallel across different keys using <span className="font-mono text-xs">forceKeyIndex</span>
                                </p>
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-purple-300 mb-1">3. Graceful Fallbacks</p>
                                <p className="text-sm text-slate-300">
                                    Primary model: <span className="font-mono text-xs">gemini-2.5-pro</span> → Fallback: <span className="font-mono text-xs">gemini-2.5-flash</span> on errors
                                </p>
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-purple-300 mb-1">4. Per-Chunk Retry Logic</p>
                                <p className="text-sm text-slate-300">
                                    If a chunk fails with a specific key, retry without <span className="font-mono text-xs">forceKeyIndex</span> to use any available key
                                </p>
                            </div>
                        </div>
                    </div>

                    <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                        This architecture made quiz generation <span className="font-semibold text-primary">faster and more resilient</span>. Instead of sequential 10-second waits, parallel calls completed in 3-4 seconds total, and key exhaustion on one API key didn't block the entire flow.
                    </p>
                </section>

                {/* Section 5: Authentication System */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sm text-sky-300 font-bold">
                            05
                        </span>
                        <h2 className="text-xl sm:text-2xl font-semibold text-slate-100">
                            Guest Mode: 401 Errors → Synthetic Auth
                        </h2>
                    </div>

                    <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                        I wanted users to try the app without signup friction. But my first "Continue as Guest" implementation kept returning <span className="font-mono text-xs bg-red-900/30 px-1.5 py-0.5 rounded text-red-300">401 Unauthorized</span>.
                    </p>

                    <div className="space-y-4">
                        <div className="bg-red-900/10 border border-red-500/30 rounded-xl p-4">
                            <p className="text-sm font-semibold text-red-300 mb-2">Root Cause</p>
                            <p className="text-sm text-slate-300">
                                Guest tokens (<span className="font-mono text-xs">guest_token_timestamp</span>) were being treated as JWTs. The <span className="font-mono text-xs">optionalAuth</span> middleware tried to verify them, failed, and left <span className="font-mono text-xs">ctx.user</span> undefined. tRPC's <span className="font-mono text-xs">requireUser</span> middleware then rejected all requests.
                            </p>
                        </div>

                        <div className="bg-emerald-900/10 border border-emerald-500/30 rounded-xl p-4">
                            <p className="text-sm font-semibold text-emerald-300 mb-2">Solution: Synthetic User Context</p>
                            <pre className="text-xs text-slate-300 bg-slate-950/70 rounded-lg p-3 overflow-x-auto mt-2">
                                {`// In apps/server/src/auth/middleware.ts
if (token.startsWith("guest_token_")) {
  const guestId = token.replace("guest_token_", "");
  req.user = {
    id: \`guest-\${guestId}\`,
    email: \`guest-\${guestId}@temporary.local\`,
    // ... other fields
  };
  return next();
}`}
                            </pre>
                            <p className="text-sm text-slate-300 mt-2">
                                Instead of JWT verification, detect the <span className="font-mono text-xs">guest_token_</span> prefix and create a temporary user object. Guest sessions work perfectly, stored only in <span className="font-mono text-xs">sessionStorage</span>.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Section 6: Critical Bugs Fixed */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-sm text-amber-300 font-bold">
                            06
                        </span>
                        <h2 className="text-xl sm:text-2xl font-semibold text-slate-100">
                            Critical Bugs: Real Production Issues
                        </h2>
                    </div>

                    <div className="space-y-4">
                        <div className="border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors">
                            <h4 className="text-sm font-semibold text-slate-100 mb-2">Bug #1: Prisma Connection Pool Timeout</h4>
                            <p className="text-sm text-slate-300 mb-2">
                                <span className="font-semibold text-red-300">Error:</span> <span className="font-mono text-xs">Timed out fetching a new connection from the connection pool. connection limit: 1</span>
                            </p>
                            <p className="text-sm text-slate-300 mb-2">
                                <span className="font-semibold text-amber-300">Cause:</span> AI Bulk Formula Extraction used <span className="font-mono text-xs">Promise.all</span> to create multiple formulas in parallel, but free Supabase tier has connection limit of 1
                            </p>
                            <p className="text-sm text-slate-300">
                                <span className="font-semibold text-emerald-300">Fix:</span> Changed to sequential loop - <span className="font-mono text-xs">await ctx.prisma.formula.create()</span> one at a time
                            </p>
                        </div>

                        <div className="border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors">
                            <h4 className="text-sm font-semibold text-slate-100 mb-2">Bug #2: Token Refresh Not Working</h4>
                            <p className="text-sm text-slate-300 mb-2">
                                <span className="font-semibold text-red-300">Problem:</span> Users had to re-login after 15 minutes, even though refresh tokens were valid for 365 days
                            </p>
                            <p className="text-sm text-slate-300 mb-2">
                                <span className="font-semibold text-amber-300">Cause:</span> <span className="font-mono text-xs">performTokenRefresh</span> sent wrong request format - single object instead of tRPC batch array
                            </p>
                            <p className="text-sm text-slate-300">
                                <span className="font-semibold text-emerald-300">Fix:</span> Changed to proper batch format: <span className="font-mono text-xs">[{"{"} id: 1, json: {"{"} input: {"{"} refreshToken {"}"} {"}"}, method: "mutation", path: "authApi.refresh" {"}"}]</span>
                            </p>
                        </div>

                        <div className="border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors">
                            <h4 className="text-sm font-semibold text-slate-100 mb-2">Bug #3: SPA Routes 404 on Refresh</h4>
                            <p className="text-sm text-slate-300 mb-2">
                                <span className="font-semibold text-red-300">Problem:</span> Direct URLs like <span className="font-mono text-xs">/auth/login</span> returned 404 on Render static hosting
                            </p>
                            <p className="text-sm text-slate-300">
                                <span className="font-semibold text-emerald-300">Fix:</span> Added <span className="font-mono text-xs">apps/web/public/_redirects</span> with <span className="font-mono text-xs">/*    /index.html   200</span>
                            </p>
                        </div>
                    </div>
                </section>

                {/* Section 7: AI Tools Used */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-sm text-indigo-300 font-bold">
                            07
                        </span>
                        <h2 className="text-xl sm:text-2xl font-semibold text-slate-100">
                            AI as Debugger, Not Coder
                        </h2>
                    </div>

                    <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                        I used AI extensively, but <span className="font-semibold text-primary">always in VS Code manually</span>. AI was my debugging partner, not my code writer.
                    </p>

                    <div className="grid sm:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                            <h4 className="text-sm font-semibold text-emerald-300 mb-2">ChatGPT 5/5.1</h4>
                            <p className="text-xs text-slate-400 mb-2">Free in India (ChatGPT Go)</p>
                            <p className="text-sm text-slate-300">Most-used for quick debugging, explanations, and pattern suggestions</p>
                        </div>

                        <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/30 rounded-xl p-4">
                            <h4 className="text-sm font-semibold text-primary mb-2">Gemini 3</h4>
                            <p className="text-xs text-slate-400 mb-2">Student Plan Subscription</p>
                            <p className="text-sm text-slate-300">Used for analyzing complex errors and understanding framework behavior</p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500/5 to-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                            <h4 className="text-sm font-semibold text-purple-300 mb-2">Sonnet 4.5</h4>
                            <p className="text-xs text-slate-400 mb-2">Rarely (~10 messages)</p>
                            <p className="text-sm text-slate-300">"Emergency tokens" for the most stubborn, confusing bugs</p>
                        </div>
                    </div>

                    <p className="text-sm sm:text-base text-slate-200 leading-relaxed mt-4">
                        Typical workflow: Try to fix myself → Hit wall → Copy logs to AI → Ask "why is this failing?" → Read explanation → Apply fix in VS Code. <span className="font-semibold text-primary">Every final decision about architecture and code was mine.</span>
                    </p>
                </section>

            </div>
        </section>
    );
};
