-- AlterTable: Add enhanced learning fields to Formula
ALTER TABLE "Formula" ADD COLUMN IF NOT EXISTS "applications" TEXT;
ALTER TABLE "Formula" ADD COLUMN IF NOT EXISTS "examples" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "Formula" ADD COLUMN IF NOT EXISTS "prerequisites" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "Formula" ADD COLUMN IF NOT EXISTS "relatedFormulas" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "Formula" ADD COLUMN IF NOT EXISTS "commonMistakes" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "Formula" ADD COLUMN IF NOT EXISTS "practiceHistory" JSONB DEFAULT '[]'::jsonb;

-- AlterTable: Add enhanced exam fields to QuizSession
ALTER TABLE "QuizSession" ADD COLUMN IF NOT EXISTS "examType" TEXT;
ALTER TABLE "QuizSession" ADD COLUMN IF NOT EXISTS "questionType" TEXT;
ALTER TABLE "QuizSession" ADD COLUMN IF NOT EXISTS "timeLimit" INTEGER;
ALTER TABLE "QuizSession" ADD COLUMN IF NOT EXISTS "timeTaken" INTEGER;
ALTER TABLE "QuizSession" ADD COLUMN IF NOT EXISTS "scope" TEXT;
ALTER TABLE "QuizSession" ADD COLUMN IF NOT EXISTS "formulaIds" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "QuizSession" ADD COLUMN IF NOT EXISTS "analysis" JSONB;

-- AlterTable: Add multi-correct and analytics to QuizQuestion
ALTER TABLE "QuizQuestion" ADD COLUMN IF NOT EXISTS "correctAnswers" JSONB;
ALTER TABLE "QuizQuestion" ADD COLUMN IF NOT EXISTS "userAnswers" JSONB;
ALTER TABLE "QuizQuestion" ADD COLUMN IF NOT EXISTS "conceptTags" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "QuizQuestion" ADD COLUMN IF NOT EXISTS "timeTaken" INTEGER;

-- CreateIndex (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'QuizQuestion_formulaId_idx') THEN
        CREATE INDEX "QuizQuestion_formulaId_idx" ON "QuizQuestion"("formulaId");
    END IF;
END $$;
