import { motion } from "framer-motion";
import { ArrowLeft, Bot, Box, Cloud, Code, Database, Layers, Server, Shield, Terminal, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const MyTechDeepDivePage = () => {
    const navigate = useNavigate();

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
        <div className="min-h-screen bg-[#0a0a0b] text-slate-200 selection:bg-blue-500/30">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/5 blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
                <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => navigate(-1)}
                    className="group mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors"
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
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                            <Terminal className="w-3 h-3" />
                            <span>Technical Deep Dive</span>
                        </div>
                        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-200 to-violet-400">
                            Under the Hood
                        </h1>
                        <p className="max-w-2xl mx-auto text-lg text-slate-400 leading-relaxed">
                            A comprehensive look at the architecture, stack, and engineering challenges behind the JEE Study Companion.
                        </p>
                    </motion.header>

                    {/* Tech Stack Grid */}
                    <motion.section variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-card p-6 rounded-2xl border border-slate-800/60 bg-slate-900/40 hover:bg-slate-800/40 transition-colors group">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 text-blue-400 group-hover:scale-110 transition-transform">
                                <Box className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-100 mb-2">Monorepo Structure</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Built using Turborepo with a clear separation of concerns:
                                <code className="mx-1 px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 text-xs">apps/web</code> for the frontend and
                                <code className="mx-1 px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 text-xs">apps/server</code> for the backend API.
                            </p>
                        </div>

                        <div className="glass-card p-6 rounded-2xl border border-slate-800/60 bg-slate-900/40 hover:bg-slate-800/40 transition-colors group">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 text-purple-400 group-hover:scale-110 transition-transform">
                                <Server className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-100 mb-2">Type-Safe API</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                End-to-end type safety with <span className="text-purple-300">tRPC</span>.
                                The frontend knows exactly what the backend returns, eliminating runtime errors and making refactoring a breeze.
                            </p>
                        </div>

                        <div className="glass-card p-6 rounded-2xl border border-slate-800/60 bg-slate-900/40 hover:bg-slate-800/40 transition-colors group">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 text-emerald-400 group-hover:scale-110 transition-transform">
                                <Database className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-100 mb-2">Data Layer</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Powered by <span className="text-emerald-300">Prisma ORM</span> and Supabase (PostgreSQL).
                                Complex relations between Subjects, Chapters, Mistakes, and Quizzes are handled effortlessly.
                            </p>
                        </div>
                    </motion.section>

                    {/* AI Integration Section */}
                    <motion.section variants={item} className="relative overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900/40 p-8 md:p-12">
                        <div className="absolute top-0 right-0 p-12 opacity-10">
                            <Bot className="w-64 h-64 text-blue-500" />
                        </div>
                        <div className="relative z-10 max-w-3xl">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-100">AI-Powered Learning</h2>
                            </div>
                            <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                                The core of the companion is its intelligence. I integrated multiple AI models to handle different tasks,
                                ensuring reliability and quality.
                            </p>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/60">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-semibold text-slate-200">Gemini 2.5 Pro</h4>
                                        <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 font-medium">Primary</span>
                                    </div>
                                    <p className="text-sm text-slate-400">
                                        Used for complex reasoning, quiz generation, and detailed mistake analysis.
                                        I implemented a multi-key rotation system to handle rate limits.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/60">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-semibold text-slate-200">ChatGPT & Sonnet</h4>
                                        <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 font-medium">Coding Assistants</span>
                                    </div>
                                    <p className="text-sm text-slate-400">
                                        Used Sonnet 3.5 (rarely due to limits) and ChatGPT for debugging rigid errors and generating boilerplate code.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.section>

                    {/* Deployment Story */}
                    <motion.section variants={item} className="space-y-6">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-bold text-slate-100">The Deployment Saga</h2>
                            <div className="h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent" />
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-red-400">
                                    <Cloud className="w-5 h-5" />
                                    <h3 className="font-bold">The Vercel Struggle</h3>
                                </div>
                                <p className="text-slate-400 leading-relaxed">
                                    Initially, I tried deploying to Vercel. It seemed perfect, but connecting to the database and handling serverless function timeouts became a nightmare.
                                    I spent an entire day debugging "Function Invocation Failed" errors.
                                </p>
                                <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/10 font-mono text-xs text-red-300">
                                    Error: Task timed out after 10.00 seconds
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-emerald-400">
                                    <Shield className="w-5 h-5" />
                                    <h3 className="font-bold">The Render Solution</h3>
                                </div>
                                <p className="text-slate-400 leading-relaxed">
                                    I switched to Render, and it was a game-changer.
                                    Hosting the backend as a dedicated web service (instead of serverless functions) solved the timeout issues.
                                    It allowed for persistent connections and a much more stable environment for the API.
                                </p>
                                <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10 font-mono text-xs text-emerald-300">
                                    Build successful. Service is live.
                                </div>
                            </div>
                        </div>
                    </motion.section>

                    {/* Features Deep Dive */}
                    <motion.section variants={item} className="space-y-6">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-bold text-slate-100">Key Technical Features</h2>
                            <div className="h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent" />
                        </div>

                        <div className="grid gap-4">
                            {[
                                {
                                    title: "Mistake Log & Analysis",
                                    desc: "Upload images of mistakes, and the AI analyzes them to identify gaps in understanding. Uses Supabase Storage for images and Gemini for vision analysis.",
                                    icon: Layers
                                },
                                {
                                    title: "Rich Diagram Rendering",
                                    desc: "Implemented a custom JSXGraph renderer to display physics and math diagrams generated by AI. This was crucial for realistic JEE questions.",
                                    icon: Code
                                },
                                {
                                    title: "Secure Authentication",
                                    desc: "JWT-based auth with access and refresh tokens. Includes a robust 'Guest Mode' that creates temporary sessions without polluting the main database.",
                                    icon: Shield
                                }
                            ].map((feature, i) => (
                                <div key={i} className="flex gap-4 p-4 rounded-xl bg-slate-900/20 border border-slate-800/40">
                                    <div className="mt-1">
                                        <feature.icon className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-200">{feature.title}</h4>
                                        <p className="text-sm text-slate-400 mt-1">{feature.desc}</p>
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
