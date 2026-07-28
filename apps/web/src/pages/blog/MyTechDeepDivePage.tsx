import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Box, Cloud, Code, Database, Layers, Server, Shield, Terminal, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useShellContext } from "../../app/layouts/useShellContext";

export const MyTechDeepDivePage = () => {
    const navigate = useNavigate();
    const { setAiSection, setAiContext, setShowMentor } = useShellContext();

    useEffect(() => {
        setAiSection("study");
        setShowMentor(false);
        setAiContext({
            type: "vlog",
            page: "technical-deep-dive",
            title: "Tech Deep Dive",
        });

        return () => {
            setShowMentor(true);
            setAiContext(undefined);
        };
    }, [setAiContext, setAiSection, setShowMentor]);

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
    };

    return (
        <div className="min-h-screen bg-paper text-ink">
            <div className="relative z-10 max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
                <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => navigate(-1)}
                    className="group mb-8 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-brass transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                    Back
                </motion.button>

                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="space-y-16"
                >
                    {/* Header Section */}
                    <motion.header variants={item} className="space-y-6 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brass-soft border border-brass/20 text-brass text-xs font-medium font-mono">
                            <Terminal className="w-3 h-3" />
                            <span>Technical Deep Dive</span>
                        </div>
                        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-ink font-display">
                            Under the Hood
                        </h1>
                        <p className="max-w-2xl mx-auto text-lg text-ink-muted leading-relaxed">
                            A comprehensive look at the architecture, stack, and engineering challenges behind the JEE Study Companion.
                        </p>
                    </motion.header>

                    {/* Tech Stack Grid */}
                    <motion.section variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-card p-6 rounded-2xl border border-line bg-surface hover:bg-surface-2 transition-colors group">
                            <div className="w-12 h-12 rounded-xl bg-brass-soft flex items-center justify-center mb-4 text-brass group-hover:scale-110 transition-transform">
                                <Box className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-ink mb-2 font-display">Monorepo Structure</h3>
                            <p className="text-sm text-ink-muted leading-relaxed">
                                The project follows a monorepo layout with clear separation:
                                <code className="mx-1 px-1.5 py-0.5 rounded bg-surface-2 text-brass text-xs font-mono">apps/web</code> for the React + Vite frontend and
                                <code className="mx-1 px-1.5 py-0.5 rounded bg-surface-2 text-brass text-xs font-mono">apps/server</code> for the Express + tRPC backend API.
                            </p>
                        </div>

                        <div className="glass-card p-6 rounded-2xl border border-line bg-surface hover:bg-surface-2 transition-colors group">
                            <div className="w-12 h-12 rounded-xl bg-brass-soft flex items-center justify-center mb-4 text-brass group-hover:scale-110 transition-transform">
                                <Server className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-ink mb-2 font-display">Type-Safe API</h3>
                            <p className="text-sm text-ink-muted leading-relaxed">
                                End-to-end type safety with <span className="text-brass font-mono">tRPC</span>.
                                The frontend knows exactly what the backend returns, eliminating runtime errors and making refactoring a breeze.
                            </p>
                        </div>

                        <div className="glass-card p-6 rounded-2xl border border-line bg-surface hover:bg-surface-2 transition-colors group">
                            <div className="w-12 h-12 rounded-xl bg-brass-soft flex items-center justify-center mb-4 text-brass group-hover:scale-110 transition-transform">
                                <Database className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-ink mb-2 font-display">Data Layer</h3>
                            <p className="text-sm text-ink-muted leading-relaxed">
                                Powered by <span className="text-brass font-mono">Prisma ORM</span> and Supabase (PostgreSQL). Core entities like
                                formulas, mistakes, quiz sessions, and questions are modelled with relations that make it easy to add
                                new features without rewriting the database.
                            </p>
                        </div>
                    </motion.section>

                    {/* AI Integration Section */}
                    <motion.section variants={item} className="relative overflow-hidden rounded-3xl border border-line bg-surface p-8 md:p-12">
                        <div className="absolute top-0 right-0 p-12 opacity-10">
                            <Bot className="w-64 h-64 text-brass" />
                        </div>
                        <div className="relative z-10 max-w-3xl">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 rounded-lg bg-brass-soft text-brass">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <h2 className="text-2xl font-bold text-ink font-display">AI-Powered Learning</h2>
                            </div>
                            <p className="text-ink-muted text-lg mb-8 leading-relaxed">
                                The core of the companion is its intelligence. I integrated multiple AI models to handle different tasks,
                                but always with a clear rule: they help me reason and generate content; they never fully own the product.
                            </p>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="p-4 rounded-xl bg-surface-2 border border-line">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-semibold text-ink">Gemini 2.5 Pro</h4>
                                        <span className="px-2 py-0.5 rounded text-[10px] bg-brass-soft text-brass font-medium font-mono">Primary</span>
                                    </div>
                                    <p className="text-sm text-ink-muted">
                                        Used on the backend for complex reasoning, quiz generation, and detailed mistake analysis.
                                        I implemented a multi-key rotation system (multiple API keys parsed from env) so large quizzes are
                                        generated in parallel without constantly hitting rate limits.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-surface-2 border border-line">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-semibold text-ink">ChatGPT, Gemini 3 & Sonnet 4.5</h4>
                                        <span className="px-2 py-0.5 rounded text-[10px] bg-brass-soft text-brass font-medium font-mono">Coding Assistants</span>
                                    </div>
                                    <p className="text-sm text-ink-muted">
                                        During development I used ChatGPT 5/5.1 (via ChatGPT Go, which is currently free in India) and Gemini 3 to
                                        understand tricky errors and compare approaches. Sonnet 4.5 was used very rarely, not because it was weak,
                                        but because the free account had a very small message limit (roughly under ten messages), so I saved it for
                                        the most stubborn bugs.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.section>

                    {/* Deployment Story */}
                    <motion.section variants={item} className="space-y-6">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-bold text-ink font-display">The Deployment Saga</h2>
                            <div className="h-px flex-1 bg-line" />
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-red-500">
                                    <Cloud className="w-5 h-5" />
                                    <h3 className="font-bold text-ink font-display">The Vercel Struggle</h3>
                                </div>
                                <p className="text-ink-muted leading-relaxed">
                                    Initially, I tried deploying to Vercel. It seemed perfect, but connecting to the database and handling serverless function timeouts became a nightmare.
                                    I spent an entire day debugging "Function Invocation Failed" errors.
                                </p>
                                <div className="p-4 rounded-lg bg-surface-2 border border-line font-mono text-xs text-red-500">
                                    Error: Task timed out after 10.00 seconds
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-brass">
                                    <Shield className="w-5 h-5" />
                                    <h3 className="font-bold text-ink font-display">The Render Solution</h3>
                                </div>
                                <p className="text-ink-muted leading-relaxed">
                                    I switched to Render, and it was a game-changer.
                                    Hosting the backend as a dedicated web service (instead of serverless functions) solved the timeout issues.
                                    It allowed for persistent connections and a much more stable environment for the API.
                                </p>
                                <div className="p-4 rounded-lg bg-surface-2 border border-line font-mono text-xs text-brass">
                                    Build successful. Service is live.
                                </div>
                            </div>
                        </div>
                    </motion.section>

                    {/* Features Deep Dive */}
                    <motion.section variants={item} className="space-y-6">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-bold text-ink font-display">Key Technical Features</h2>
                            <div className="h-px flex-1 bg-line" />
                        </div>

                        <div className="grid gap-4">
                            {[
                                {
                                    title: "Mistake Log & Formula Library",
                                    desc: "Structured tracking of mistakes and formulas so JEE revision is not just random questions but a clear history of what you got wrong and how you fixed it.",
                                    icon: Layers
                                },
                                {
                                    title: "Type-Safe Full Stack",
                                    desc: "End-to-end TypeScript with tRPC and Prisma means the frontend and backend share types, reducing entire classes of runtime bugs.",
                                    icon: Code
                                },
                                {
                                    title: "Secure Authentication",
                                    desc: "JWT-based auth with access and refresh tokens. Includes a robust 'Guest Mode' that creates temporary sessions without polluting the main database.",
                                    icon: Shield
                                }
                            ].map((feature, i) => (
                                <div key={i} className="flex gap-4 p-4 rounded-xl bg-surface-2 border border-line">
                                    <div className="mt-1">
                                        <feature.icon className="w-5 h-5 text-ink-muted" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-ink font-display">{feature.title}</h4>
                                        <p className="text-sm text-ink-muted mt-1">{feature.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.section>
                </motion.div>
            </div>
        </div>
    );
};
