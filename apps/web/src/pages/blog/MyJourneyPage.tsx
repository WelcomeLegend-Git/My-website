import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Clock, Code2, Cpu, Heart, Music, Rocket, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useShellContext } from "../../app/layouts/useShellContext";

export const MyJourneyPage = () => {
    const navigate = useNavigate();
    const { setAiSection, setAiContext, setShowMentor } = useShellContext();

    useEffect(() => {
        setAiSection("study");
        setShowMentor(false);
        setAiContext({
            type: "vlog",
            page: "journey",
            title: "Developer Journey",
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
            <div className="relative z-10 max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
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
                            <Rocket className="w-3 h-3" />
                            <span>The Developer Journey</span>
                        </div>
                        <h1 className="text-4xl md:text-[3rem] lg:text-[3.75rem] font-bold tracking-tight leading-snug pb-1 text-ink font-display">
                            Building the JEE Companion
                        </h1>
                        <p className="max-w-2xl mx-auto text-lg text-ink-muted leading-relaxed">
                            A 17-day sprint balancing JEE prep, a low-end PC, late-night VS Code sessions, deployment
                            failures, and a careful use of AI helpers. This is the story behind the code.
                        </p>
                    </motion.header>

                    {/* About Me Section */}
                    <motion.section variants={item} className="grid gap-8 md:grid-cols-2">
                        <div className="glass-card p-8 rounded-3xl border border-line bg-surface backdrop-blur-xl relative overflow-hidden group">
                            <div className="relative space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-brass-soft text-brass">
                                        <User className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-ink font-display">Who I Am</h2>
                                        <p className="text-sm text-brass font-mono">Suraj • Class 11 Student</p>
                                    </div>
                                </div>
                                <p className="text-ink-muted leading-relaxed">
                                    I'm currently preparing for the JEE exam, balancing intense study sessions with my passion for coding.
                                    I take classes on Unacademy (usually 2-3 daily) and built this companion to match the way I actually
                                    study, revise, and track mistakes.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <span className="px-3 py-1 rounded-full bg-surface-2 border border-line text-xs text-ink-muted font-mono">JEE Aspirant</span>
                                    <span className="px-3 py-1 rounded-full bg-surface-2 border border-line text-xs text-ink-muted font-mono">Full Stack Dev</span>
                                    <span className="px-3 py-1 rounded-full bg-surface-2 border border-line text-xs text-ink-muted font-mono">Student</span>
                                </div>
                            </div>
                        </div>

                        <div className="glass-card p-8 rounded-3xl border border-line bg-surface backdrop-blur-xl relative overflow-hidden group">
                            <div className="relative space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-brass-soft text-brass">
                                        <Cpu className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-ink font-display">The Machine</h2>
                                        <p className="text-sm text-brass font-mono">Low-end Warrior</p>
                                    </div>
                                </div>
                                <p className="text-ink-muted leading-relaxed">
                                    Built entirely on a humble setup: an i3 4th Gen processor with Intel HD graphics.
                                    Proof that you don't need a supercomputer to build great software—just persistence.
                                </p>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="space-y-1">
                                        <span className="text-xs text-ink-muted uppercase tracking-wider font-mono">CPU</span>
                                        <p className="text-sm font-medium text-ink font-mono">Intel Core i3 4th Gen</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs text-ink-muted uppercase tracking-wider font-mono">GPU</span>
                                        <p className="text-sm font-medium text-ink font-mono">Intel HD Graphics</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.section>

                    {/* The Grind Stats */}
                    <motion.section variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { icon: Clock, label: "Daily Effort", value: "12-14 Hrs", color: "text-brass", bg: "bg-brass-soft" },
                            { icon: Calendar, label: "Duration", value: "17 Days", color: "text-brass", bg: "bg-brass-soft" },
                            { icon: Code2, label: "Editor", value: "VS Code", color: "text-brass", bg: "bg-brass-soft" },
                            { icon: Music, label: "Fuel", value: "Tribit Speaker", color: "text-red-500", bg: "bg-brass-soft" },
                        ].map((stat, i) => (
                            <div key={i} className="glass-card p-4 rounded-2xl border border-line bg-surface flex flex-col items-center text-center gap-3 hover:bg-surface-2 transition-colors">
                                <div className={`p-2 rounded-xl ${stat.bg} ${stat.color}`}>
                                    <stat.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-ink-muted uppercase tracking-wider font-medium font-mono">{stat.label}</p>
                                    <p className="text-lg font-bold text-ink font-mono">{stat.value}</p>
                                </div>
                            </div>
                        ))}
                    </motion.section>

                    {/* The Story Timeline */}
                    <motion.section variants={item} className="space-y-8">
                        <div className="flex items-center gap-4 mb-8">
                            <h2 className="text-2xl font-bold text-ink font-display">The Development Arc</h2>
                            <div className="h-px flex-1 bg-line" />
                        </div>

                        <div className="relative border-l-2 border-line ml-4 space-y-12 pb-12">
                            {/* Timeline Item 1 */}
                            <div className="relative pl-8 group">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-surface-2 border-2 border-brass/40 group-hover:scale-125 transition-transform" />
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                        <span className="text-brass font-mono text-sm">The Beginning</span>
                                        <h3 className="text-xl font-bold text-ink font-display">Vision & Setup</h3>
                                    </div>
                                    <p className="text-ink-muted leading-relaxed max-w-3xl">
                                        It started with a need: I wanted a better way to track my JEE preparation and see my mistakes in one
                                        place. The first few days were a blur—I don't even remember when the days started or ended. I worked
                                        through the night, sleeping at 7–8 AM and waking up at 1–2 PM to continue. My focus was so intense that
                                        sometimes I'd stop the music playing on my Tribit speaker just to concentrate harder.
                                    </p>
                                </div>
                            </div>

                            {/* Timeline Item 2 */}
                            <div className="relative pl-8 group">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-surface-2 border-2 border-brass/40 group-hover:scale-125 transition-transform" />
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                        <span className="text-brass font-mono text-sm">The Struggle</span>
                                        <h3 className="text-xl font-bold text-ink font-display">Deployment Wars</h3>
                                    </div>
                                    <p className="text-ink-muted leading-relaxed max-w-3xl">
                                        Deployment was a nightmare. I spent a full day just trying to get Vercel to connect to the database and
                                        run the backend reliably. Then another day testing on localhost, only for it to fail again in
                                        production. I was frustrated, working from around 2 PM until 3–4 AM the next morning. That long night
                                        ended with a decision to switch the backend to Render.
                                    </p>
                                    <div className="p-4 rounded-xl bg-surface-2 border border-line text-sm text-ink-muted italic">
                                        "I challenge, happy after long try when it happened... the feeling of finally seeing it live is indescribable."
                                    </div>
                                </div>
                            </div>

                            {/* Timeline Item 3 */}
                            <div className="relative pl-8 group">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-surface-2 border-2 border-brass/40 group-hover:scale-125 transition-transform" />
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                        <span className="text-brass font-mono text-sm">The Support</span>
                                        <h3 className="text-xl font-bold text-ink font-display">Family & Mentors</h3>
                                    </div>
                                    <p className="text-ink-muted leading-relaxed max-w-3xl">
                                        I wasn't alone. When things got tough, I reached out to my brother, Abhay (a software engineer in
                                        Bengaluru on a strong package), and my uncle, Khem Raj (also a software engineer). Their guidance helped
                                        me push through the technical blockers when Vercel was failing.
                                    </p>
                                </div>
                            </div>

                            {/* Timeline Item 4 */}
                            <div className="relative pl-8 group">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-surface-2 border-2 border-brass/40 group-hover:scale-125 transition-transform" />
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                        <span className="text-brass font-mono text-sm">The Result</span>
                                        <h3 className="text-xl font-bold text-ink font-display">A Complete Companion</h3>
                                    </div>
                                    <p className="text-ink-muted leading-relaxed max-w-3xl">
                                        Now, the project is complete. A fully functional website with Mistake Logs, Formula Collections, quizzes,
                                        and an AI Study Guru. I even skipped a few live classes because I was so engrossed in building this. It's
                                        not just code; it's a tool that will help me (and hopefully others) crack JEE.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.section>

                    {/* Footer Quote */}
                    <motion.footer variants={item} className="text-center pt-12 pb-8">
                        <div className="inline-block p-6 rounded-3xl bg-surface-2 border border-line shadow-2xl">
                            <Heart className="w-8 h-8 text-red-500 mx-auto mb-4 fill-red-500/20" />
                            <p className="text-lg font-medium text-ink-muted italic max-w-xl mx-auto">
                                "I only remember that I wake up, fresh up, eat, and start working till my class, and later continue till the
                                morning. Somewhere in between I used ChatGPT, Gemini 3, and a few rare Sonnet 4.5 messages—but every final
                                decision still went through my own VS Code window."
                            </p>
                            <p className="mt-4 text-sm text-ink-muted font-mono">- Suraj</p>
                        </div>
                    </motion.footer>
                </motion.div>
            </div>
        </div>
    );
};
