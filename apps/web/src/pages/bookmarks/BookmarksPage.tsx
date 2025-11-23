import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShellContext } from "../../app/layouts/useShellContext";
import { trpc } from "../../lib/trpc";
import { GlowSelect, type GlowSelectOption } from "../../components/ui/GlowSelect";

 type Category = "formulas" | "mistakes" | "quizzes" | "ai";
 type FormulaView = "all" | "collections" | "formulas";
 type QuizView = "all" | "quizzes" | "questions";

 export const BookmarksPage = () => {
   const navigate = useNavigate();
   const { setAiSection, setAiContext } = useShellContext();

   const [activeCategory, setActiveCategory] = useState<Category>("formulas");
   const [formulaView, setFormulaView] = useState<FormulaView>("all");
   const [quizView, setQuizView] = useState<QuizView>("all");
   const [search, setSearch] = useState("");

   useEffect(() => {
     setAiSection("study");
     setAiContext(undefined);
     return () => {
       setAiContext(undefined);
     };
   }, [setAiContext, setAiSection]);

   const { data: formulaData, isLoading: formulasLoading } = trpc.bookmarks.listByCategory.useQuery(
     { category: "formulas", type: formulaView, search: search || undefined, limit: 80 },
     { enabled: activeCategory === "formulas" },
   );

   const { data: mistakeData, isLoading: mistakesLoading } = trpc.bookmarks.listByCategory.useQuery(
     { category: "mistakes", search: search || undefined, limit: 80 },
     { enabled: activeCategory === "mistakes" },
   );

   const { data: quizData, isLoading: quizzesLoading } = trpc.bookmarks.listByCategory.useQuery(
     { category: "quizzes", type: quizView, search: search || undefined, limit: 80 },
     { enabled: activeCategory === "quizzes" },
   );

   const { data: aiData, isLoading: aiLoading } = trpc.bookmarks.listByCategory.useQuery(
     { category: "ai", search: search || undefined, limit: 80 },
     { enabled: activeCategory === "ai" },
   );

   const isLoading =
     (activeCategory === "formulas" && formulasLoading) ||
     (activeCategory === "mistakes" && mistakesLoading) ||
     (activeCategory === "quizzes" && quizzesLoading) ||
     (activeCategory === "ai" && aiLoading);

   const formulaItems = formulaData?.items ?? [];
   const mistakeItems = mistakeData?.items ?? [];
   const quizItems = quizData?.items ?? [];
   const aiItems = aiData?.items ?? [];

   const formulaViewOptions: GlowSelectOption[] = useMemo(
     () => [
       { value: "all", label: "Collections + singles" },
       { value: "collections", label: "Collections only" },
       { value: "formulas", label: "Single formulas only" },
     ],
     [],
   );

   const quizViewOptions: GlowSelectOption[] = useMemo(
     () => [
       { value: "all", label: "Quizzes + questions" },
       { value: "quizzes", label: "Quizzes only" },
       { value: "questions", label: "Questions only" },
     ],
     [],
   );

   const handleOpenFormulaBookmark = (item: any) => {
     if (item.kind === "collection" && item.collectionId) {
       navigate(`/formulas/collections/${item.collectionId}?highlightCollection=1`);
       return;
     }
     if (item.kind === "formula" && item.collectionId && item.formulaId) {
       navigate(`/formulas/collections/${item.collectionId}?highlightFormulaId=${item.formulaId}`);
     }
   };

   const handleOpenMistakeBookmark = (item: any) => {
     if (!item.mistakeId) return;
     navigate(`/mistakes/${item.mistakeId}?highlight=1`);
   };

   const handleOpenQuizBookmark = (item: any) => {
     if (item.kind === "quiz" && item.quizId) {
       navigate(`/quiz/${item.quizId}/results?highlight=1`);
       return;
     }
     if (item.kind === "question" && item.quizId && item.questionId) {
       navigate(`/quiz/${item.quizId}/results?highlightQuestionId=${item.questionId}`);
     }
   };

   const handleOpenAiBookmark = (item: any) => {
     if (!item.conversationId) return;
     const params = new URLSearchParams();
     params.set("conversationId", item.conversationId);
     if (typeof item.messageIndex === "number") {
       params.set("messageIndex", String(item.messageIndex));
       params.set("highlight", "1");
     }
     navigate(`/study-coach?${params.toString()}`);
   };

   const renderActiveList = () => {
     if (activeCategory === "formulas") {
       if (!formulaItems.length && !isLoading) {
         return (
           <p className="text-sm text-slate-400 text-center py-8">
             No formula bookmarks yet. Use the bookmark icon on any formula collection or formula to save it here.
           </p>
         );
       }

       return (
         <div className="space-y-3">
           {formulaItems.map((item: any) => (
             <button
               key={item.bookmarkId}
               type="button"
               onClick={() => handleOpenFormulaBookmark(item)}
               className="w-full text-left glass-card rounded-2xl border border-slate-800/60 hover:border-primary/40 bg-slate-900/60 hover:bg-slate-900/80 transition-all p-4 sm:p-5 flex items-start justify-between gap-3 hover-lift"
             >
               <div className="flex items-start gap-3 min-w-0">
                 <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                   <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth={2}
                       d="M5 4a2 2 0 012-2h10a2 2 0 012 2v18l-7-4-7 4V4z"
                     />
                   </svg>
                 </div>
                 <div className="min-w-0">
                   <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-1">
                     {item.kind === "collection" ? "Collection" : "Formula"}
                   </p>
                   <p className="text-sm sm:text-base font-semibold text-slate-100 truncate">{item.title}</p>
                   <p className="text-xs text-slate-400 mt-1 truncate">
                     {item.subjectName} • {item.chapterTitle}
                   </p>
                 </div>
               </div>
               {"formulaCount" in item && (
                 <span className="px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold flex-shrink-0">
                   {item.formulaCount} formulas
                 </span>
               )}
             </button>
           ))}
         </div>
       );
     }

     if (activeCategory === "mistakes") {
       if (!mistakeItems.length && !isLoading) {
         return (
           <p className="text-sm text-slate-400 text-center py-8">
             No mistake bookmarks yet. Use the bookmark icon on any mistake card or detail view to save it here.
           </p>
         );
       }

       return (
         <div className="space-y-3">
           {mistakeItems.map((item: any) => (
             <button
               key={item.bookmarkId}
               type="button"
               onClick={() => handleOpenMistakeBookmark(item)}
               className="w-full text-left glass-card rounded-2xl border border-slate-800/60 hover:border-red-400/60 bg-slate-900/60 hover:bg-slate-900/80 transition-all p-4 sm:p-5 flex items-start justify-between gap-3 hover-lift"
             >
               <div className="flex items-start gap-3 min-w-0">
                 <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                   <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth={2}
                       d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                     />
                   </svg>
                 </div>
                 <div className="min-w-0">
                   <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-1">Mistake</p>
                   <p className="text-sm sm:text-base font-semibold text-slate-100 truncate">{item.title}</p>
                   <p className="text-xs text-slate-400 mt-1 truncate">
                     {item.subjectName} • {item.chapterTitle}
                   </p>
                 </div>
               </div>
             </button>
           ))}
         </div>
       );
     }

     if (activeCategory === "quizzes") {
       if (!quizItems.length && !isLoading) {
         return (
           <p className="text-sm text-slate-400 text-center py-8">
             No quiz bookmarks yet. Bookmark any quiz from Quiz History or an individual question from the results page.
           </p>
         );
       }

       return (
         <div className="space-y-3">
           {quizItems.map((item: any) => (
             <button
               key={item.bookmarkId}
               type="button"
               onClick={() => handleOpenQuizBookmark(item)}
               className="w-full text-left glass-card rounded-2xl border border-slate-800/60 hover:border-emerald-400/60 bg-slate-900/60 hover:bg-slate-900/80 transition-all p-4 sm:p-5 flex items-start justify-between gap-3 hover-lift"
             >
               <div className="flex items-start gap-3 min-w-0">
                 <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                   <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth={2}
                       d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                     />
                   </svg>
                 </div>
                 <div className="min-w-0">
                   <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-1">
                     {item.kind === "question" ? "Question" : "Quiz"}
                   </p>
                   <p className="text-sm sm:text-base font-semibold text-slate-100 truncate">
                     {item.kind === "question" ? item.quizTitle : item.title}
                   </p>
                   {item.kind === "question" && (
                     <p className="text-xs text-slate-400 mt-1 truncate">
                       Topic: {item.topic} • Difficulty: {item.difficulty}
                     </p>
                   )}
                 </div>
               </div>
             </button>
           ))}
         </div>
       );
     }

     if (!aiItems.length && !isLoading) {
       return (
         <p className="text-sm text-slate-400 text-center py-8">
           No Study Guru bookmarks yet. Use the bookmark icon below any AI reply to save it here.
         </p>
       );
     }

     return (
       <div className="space-y-3">
         {aiItems.map((item: any) => (
           <button
             key={item.bookmarkId}
             type="button"
             onClick={() => handleOpenAiBookmark(item)}
             className="w-full text-left glass-card rounded-2xl border border-slate-800/60 hover:border-purple-400/60 bg-slate-900/60 hover:bg-slate-900/80 transition-all p-4 sm:p-5 flex items-start justify-between gap-3 hover-lift"
           >
             <div className="flex items-start gap-3 min-w-0">
               <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                 <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path
                     strokeLinecap="round"
                     strokeLinejoin="round"
                     strokeWidth={2}
                     d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                   />
                 </svg>
               </div>
               <div className="min-w-0">
                 <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-1">Study Guru</p>
                 <p className="text-sm sm:text-base font-semibold text-slate-100 truncate">{item.title}</p>
                 {item.metadata?.chapter && (
                   <p className="text-xs text-slate-400 mt-1 truncate">{item.metadata.chapter}</p>
                 )}
               </div>
             </div>
           </button>
         ))}
       </div>
     );
   };

   const renderFilters = () => {
     if (activeCategory === "formulas") {
       return (
         <div className="flex flex-wrap gap-3 items-center mb-4">
           <GlowSelect
             value={formulaView}
             onChange={(value) => setFormulaView(value as FormulaView)}
             options={formulaViewOptions}
             placeholder="Collections + singles"
             className="min-w-[170px] md:w-64"
           />
         </div>
       );
     }

     if (activeCategory === "quizzes") {
       return (
         <div className="flex flex-wrap gap-3 items-center mb-4">
           <GlowSelect
             value={quizView}
             onChange={(value) => setQuizView(value as QuizView)}
             options={quizViewOptions}
             placeholder="Quizzes + questions"
             className="min-w-[170px] md:w-64"
           />
         </div>
       );
     }

     return null;
   };

   const activeCounts = {
     formulas: formulaItems.length,
     mistakes: mistakeItems.length,
     quizzes: quizItems.length,
     ai: aiItems.length,
   };

   return (
     <section className="space-y-6 min-w-0">
       <header className="fade-in-up">
         <div className="flex items-center gap-3 mb-3">
           <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/20 to-sky-500/20 flex items-center justify-center flex-shrink-0">
             <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path
                 strokeLinecap="round"
                 strokeLinejoin="round"
                 strokeWidth={2}
                 d="M5 4a2 2 0 012-2h10a2 2 0 012 2v18l-7-4-7 4V4z"
               />
             </svg>
           </div>
           <div>
             <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-100">Bookmarks</h1>
             <p className="mt-1 text-xs sm:text-sm text-slate-400">
               Save your most important formulas, mistakes, quizzes, and Study Guru replies in one place.
             </p>
           </div>
         </div>
       </header>

       <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
         {([
           {
             key: "formulas" as Category,
             title: "Formulas",
             subtitle: "Collections & singles",
             iconBg: "from-blue-500 to-cyan-500",
             iconPath:
               "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
           },
           {
             key: "mistakes" as Category,
             title: "Mistakes",
             subtitle: "Critical slips",
             iconBg: "from-red-500 to-orange-500",
             iconPath:
               "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
           },
           {
             key: "quizzes" as Category,
             title: "Quizzes",
             subtitle: "Sessions & questions",
             iconBg: "from-emerald-500 to-teal-500",
             iconPath:
               "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
           },
           {
             key: "ai" as Category,
             title: "AI",
             subtitle: "Study Guru replies",
             iconBg: "from-purple-500 to-pink-500",
             iconPath:
               "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z",
           },
         ] as const).map((card) => {
           const isActive = activeCategory === card.key;
           const count = activeCounts[card.key];

           return (
             <button
               key={card.key}
               type="button"
               onClick={() => setActiveCategory(card.key)}
               className={`relative text-left rounded-2xl border p-4 sm:p-5 transition-all hover-lift ${
                 isActive
                   ? "border-primary/40 bg-gradient-to-br from-primary/20 via-slate-900/80 to-purple-600/20 shadow-[0_0_40px_rgba(56,189,248,0.25)]"
                   : "border-slate-800/70 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/80"
               }`}
             >
               <div
                 className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${card.iconBg} flex items-center justify-center mb-3`}
               >
                 <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.iconPath} />
                 </svg>
               </div>
               <p className="text-sm sm:text-base font-semibold text-slate-100 flex items-center gap-2">
                 {card.title}
                 {count > 0 && (
                   <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/70">
                     {count}
                   </span>
                 )}
               </p>
               <p className="mt-1 text-xs text-slate-400">{card.subtitle}</p>
             </button>
           );
         })}
       </div>

       <div className="glass-card rounded-2xl border border-slate-800/60 p-4 sm:p-5 flex flex-col gap-3">
         <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
           <div className="flex-1 min-w-0">
             <input
               type="search"
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               placeholder="Search within your bookmarks..."
               className="w-full rounded-xl border border-slate-800/60 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none"
             />
           </div>
           <div>{renderFilters()}</div>
         </div>
       </div>

       <div className="min-w-0">
         {isLoading ? (
           <div className="flex items-center justify-center py-12">
             <div className="text-center">
               <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
               <p className="text-sm text-slate-400">Loading bookmarks...</p>
             </div>
           </div>
         ) : (
           renderActiveList()
         )}
       </div>
     </section>
   );
 };
