-- Add enhanced fields to Formula table for better learning experience
ALTER TABLE "Formula" ADD COLUMN IF NOT EXISTS "applications" TEXT;
ALTER TABLE "Formula" ADD COLUMN IF NOT EXISTS "examples" JSONB DEFAULT '[]';
ALTER TABLE "Formula" ADD COLUMN IF NOT EXISTS "prerequisites" JSONB DEFAULT '[]';
ALTER TABLE "Formula" ADD COLUMN IF NOT EXISTS "relatedFormulas" JSONB DEFAULT '[]';
ALTER TABLE "Formula" ADD COLUMN IF NOT EXISTS "commonMistakes" JSONB DEFAULT '[]';
ALTER TABLE "Formula" ADD COLUMN IF NOT EXISTS "practiceHistory" JSONB DEFAULT '[]';

-- Add exam/quiz enhancements
ALTER TABLE "QuizSession" ADD COLUMN IF NOT EXISTS "examType" TEXT; -- 'jee_mains', 'jee_advanced'
ALTER TABLE "QuizSession" ADD COLUMN IF NOT EXISTS "questionType" TEXT; -- 'single_correct', 'multi_correct'
ALTER TABLE "QuizSession" ADD COLUMN IF NOT EXISTS "timeLimit" INTEGER; -- in seconds
ALTER TABLE "QuizSession" ADD COLUMN IF NOT EXISTS "timeTaken" INTEGER; -- in seconds
ALTER TABLE "QuizSession" ADD COLUMN IF NOT EXISTS "scope" TEXT; -- 'single_formula', 'chapter', 'cross_chapter'
ALTER TABLE "QuizSession" ADD COLUMN IF NOT EXISTS "formulaIds" JSONB DEFAULT '[]';
ALTER TABLE "QuizSession" ADD COLUMN IF NOT EXISTS "analysis" JSONB; -- Detailed performance analysis

-- Add support for multi-correct questions
ALTER TABLE "QuizQuestion" ADD COLUMN IF NOT EXISTS "correctAnswers" JSONB; -- Array of correct indices for multi-correct
ALTER TABLE "QuizQuestion" ADD COLUMN IF NOT EXISTS "userAnswers" JSONB; -- Array of user-selected indices
ALTER TABLE "QuizQuestion" ADD COLUMN IF NOT EXISTS "conceptTags" JSONB DEFAULT '[]'; -- For adaptive learning
