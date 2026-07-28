import { useEffect } from "react";
import { useShellContext } from "../app/layouts/useShellContext";

export const DevelopmentJourneyPage = () => {
    const { setAiSection, setAiContext, setShowMentor } = useShellContext();

    useEffect(() => {
        setAiSection("study");
        setShowMentor(false);
        setAiContext({
            type: "vlog",
            page: "development-journey",
            title: "Journey: 17 Days of Building",
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
                            Personal Story
                        </p>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-ink font-display">
                            17 Days, 0 Budget, Infinite Learning
                        </h1>
                        <p className="mt-2 text-sm sm:text-base text-ink-muted max-w-2xl">
                            The unfiltered story of a Class 11 student balancing JEE prep with a passion for code.
                            From frustration to deployment, powered by determination and family support.
                        </p>
                    </div>
                    <div className="glass-card rounded-2xl border border-brass/30 px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-2 max-w-sm hover-lift">
                        <p className="text-xs font-semibold text-ink-muted uppercase tracking-[0.18em]">
                            The Stats
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm text-ink-muted">
                            <div>
                                <p className="text-ink-muted mb-0.5">Duration</p>
                                <p className="font-semibold">17 Days</p>
                            </div>
                            <div>
                                <p className="text-ink-muted mb-0.5">Daily Effort</p>
                                <p className="font-semibold">12-14 Hours</p>
                            </div>
                            <div>
                                <p className="text-ink-muted mb-0.5">Budget</p>
                                <p className="font-semibold">₹0 (Student)</p>
                            </div>
                            <div>
                                <p className="text-ink-muted mb-0.5">Sleep</p>
                                <p className="font-semibold">7 AM - 2 PM</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <div className="glass-card rounded-2xl border border-line p-4 sm:p-6 lg:p-8 space-y-12 hover-lift">

                {/* Phase 1: The Spark */}
                <section className="relative pl-8 border-l border-line space-y-4">
                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-brass-soft"></div>
                    <h2 className="text-xl font-semibold text-ink font-display">Phase 1: The Spark</h2>
                    <p className="text-sm sm:text-base text-ink leading-relaxed">
                        It started with frustration. As a JEE Class 11 student, I was tired of scattered notes, lost formulas, and generic practice apps. I wanted something that understood <em>my</em> mistakes. I had an idea for a "Study Companion" - but I had no budget, just an old i3 PC and a lot of determination.
                    </p>
                </section>

                {/* Phase 2: The Grind */}
                <section className="relative pl-8 border-l border-line space-y-4">
                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-brass-soft"></div>
                    <h2 className="text-xl font-semibold text-ink font-display">Phase 2: The Grind</h2>
                    <p className="text-sm sm:text-base text-ink leading-relaxed">
                        For the first 4-5 days, I completely lost track of time. My schedule flipped upside down:
                    </p>
                    <ul className="list-disc list-inside text-sm text-ink-muted space-y-1 ml-2">
                        <li>Code all night until 7-8 AM</li>
                        <li>Sleep until 1-2 PM</li>
                        <li>Wake up, attend Unacademy classes</li>
                        <li>Back to coding</li>
                    </ul>
                    <p className="text-sm sm:text-base text-ink leading-relaxed mt-2">
                        My companion was my Tribit speaker - sometimes blasting music for energy, but often turned off for hours of deep focus. I admit, I skipped a few live classes (sorry, teachers!) but the learning velocity was addictive.
                    </p>
                </section>

                {/* Phase 3: Research Detective */}
                <section className="relative pl-8 border-l border-line space-y-4">
                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-brass-soft"></div>
                    <h2 className="text-xl font-semibold text-ink font-display">Phase 3: The Research Detective</h2>
                    <p className="text-sm sm:text-base text-ink leading-relaxed">
                        With exactly ₹0 to spend, I had to be a detective. I spent days comparing free tiers: Supabase vs Firebase, Vercel vs Render vs Railway. I needed a database, auth, and hosting without hitting a credit card wall. Supabase + Render became the winning combo, but not before...
                    </p>
                </section>

                {/* Phase 4: The Deployment Wall */}
                <section className="relative pl-8 border-l border-line space-y-4">
                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-brass-soft"></div>
                    <h2 className="text-xl font-semibold text-ink font-display">Phase 4: The Deployment Wall</h2>
                    <p className="text-sm sm:text-base text-ink leading-relaxed">
                        This was the emotional low point. I spent an entire day just trying to get Vercel to talk to my database. Errors like <span className="font-mono text-xs bg-red-500/10 text-red-500 px-1 rounded">prisma: command not found</span> haunted me.
                    </p>
                    <div className="bg-surface-2 border border-line rounded-xl p-4 italic text-ink-muted text-sm">
                        "I remember a debugging session that went from 2 PM to 4 AM. I was exhausted, frustrated, and ready to quit. I reached out to Abhay bhaiya in Bangalore and Khem Raj uncle (a software engineer) for guidance. Their support kept me going."
                    </div>
                    <p className="text-sm sm:text-base text-ink leading-relaxed mt-2">
                        The breakthrough came when I decided to switch to Render. It was slower to build, but it <em>worked</em>. Seeing that first successful deployment was pure euphoria.
                    </p>
                </section>

                {/* Phase 5: AI in the Loop */}
                <section className="relative pl-8 border-l border-line space-y-4">
                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-brass-soft"></div>
                    <h2 className="text-xl font-semibold text-ink font-display">Phase 5: AI as a Mentor</h2>
                    <p className="text-sm sm:text-base text-ink leading-relaxed">
                        I used AI extensively, but not to write the code for me. I used ChatGPT (free version) and Gemini (Student Plan) as my senior developers.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4 mt-2">
                        <div className="bg-surface-2 p-3 rounded-lg border border-line">
                            <h4 className="text-sm font-semibold text-brass mb-1">My Rule</h4>
                            <p className="text-xs text-ink-muted">"Explain why this is failing, don't just fix it."</p>
                        </div>
                        <div className="bg-surface-2 p-3 rounded-lg border border-line">
                            <h4 className="text-sm font-semibold text-brass mb-1">The Result</h4>
                            <p className="text-xs text-ink-muted">I learned 10x faster. I understand every line of code in this repo because I typed it and debugged it.</p>
                        </div>
                    </div>
                </section>

                {/* Phase 6: Victory */}
                <section className="relative pl-8 border-l border-line space-y-4">
                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-brass-soft"></div>
                    <h2 className="text-xl font-semibold text-ink font-display">Phase 6: It Works!</h2>
                    <p className="text-sm sm:text-base text-ink leading-relaxed">
                        Opening the app on my phone via a real URL for the first time was magical. The glassmorphism UI looked beautiful, the AI responded instantly, and my mistake log was ready to help me study.
                    </p>
                    <p className="text-sm sm:text-base text-ink leading-relaxed font-medium text-brass">
                        17 days. 0 budget. One fully functional production app. And I'm just getting started.
                    </p>
                </section>

            </div>
        </section>
    );
};
