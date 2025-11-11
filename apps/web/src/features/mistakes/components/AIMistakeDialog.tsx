import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { MultiImageUpload } from './MultiImageUpload';
import type { RouterOutputs } from '../../../types/trpc';

type Subject = RouterOutputs['subjects']['list'][number];

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  caption?: string;
}

interface AIMistakeDialogProps {
  open: boolean;
  onClose: () => void;
  subjects?: Subject[];
  onSuccess: (mistakeId: string) => void;
}

type Step = 'upload' | 'analyzing' | 'review';

interface AIAnalysisResult {
  title: string;
  errorType: 'conceptual' | 'calculation' | 'careless' | 'unknown';
  difficulty: 'easy' | 'medium' | 'hard';
  subject: string;
  suggestedChapter: string;
  analysis: {
    whatWentWrong: string;
    whyWrong: string;
    correctApproach: string;
    keyConcepts: string[];
  };
  similarTopics: string[];
  bestImageIndex: number;
  aiSummary: string;
  aiMindMap: any;
}

export const AIMistakeDialog = ({
  open,
  onClose,
  subjects = [],
  onSuccess,
}: AIMistakeDialogProps) => {
  const [step, setStep] = useState<Step>('upload');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [userContext, setUserContext] = useState('');
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');

  const analyzeWithImagesMutation = trpc.mistakes.analyzeWithImages.useMutation();
  const createMistakeMutation = trpc.mistakes.create.useMutation();
  const createChapterMutation = trpc.subjects.createChapter.useMutation();

  const handleReset = () => {
    setStep('upload');
    setImages([]);
    setUserContext('');
    setAiResult(null);
    setSelectedSubjectId('');
    setSelectedChapterId('');
    analyzeWithImagesMutation.reset();
    createMistakeMutation.reset();
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleAnalyze = async () => {
    if (images.length === 0) {
      alert('Please upload at least one image');
      return;
    }

    setStep('analyzing');

    try {
      // Convert images to base64
      const imagePromises = images.map(
        (img) =>
          new Promise<{ data: string; mimeType: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                data: reader.result as string,
                mimeType: img.file.type,
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(img.file);
          })
      );

      const imageData = await Promise.all(imagePromises);

      const result = await analyzeWithImagesMutation.mutateAsync({
        images: imageData,
        userContext: userContext || undefined,
      });

      setAiResult(result);

      // Auto-select subject if it matches
      const matchingSubject = subjects.find(
        (s) => s.name.toLowerCase() === result.subject.toLowerCase()
      );
      if (matchingSubject) {
        setSelectedSubjectId(matchingSubject.id);
      } else if (subjects.length > 0) {
        setSelectedSubjectId(subjects[0].id);
      }

      setStep('review');
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Failed to analyze images. Please try again.');
      setStep('upload');
    }
  };

  const handleCreateChapter = async (subjectId: string, chapterTitle: string) => {
    try {
      const chapter = await createChapterMutation.mutateAsync({
        subjectId,
        title: chapterTitle,
        description: null,
      });
      return chapter.id;
    } catch (error) {
      console.error('Failed to create chapter:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    if (!aiResult || !selectedSubjectId) return;

    try {
      // Find or create chapter
      let chapterId = selectedChapterId;
      
      if (!chapterId) {
        // Check if suggested chapter exists
        const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
        const existingChapter = selectedSubject?.chapters.find(
          (ch) => ch.title.toLowerCase() === aiResult.suggestedChapter.toLowerCase()
        );

        if (existingChapter) {
          chapterId = existingChapter.id;
        } else {
          // Create new chapter
          chapterId = await handleCreateChapter(selectedSubjectId, aiResult.suggestedChapter);
        }
      }

      // Upload images (placeholder URLs for now - you should implement actual upload)
      const uploadedUrls = images.map((img, idx) => ({
        id: `temp-${idx}`,
        url: img.preview, // Replace with actual uploaded URL
        kind: 'image' as const,
        caption: img.caption || `Image ${idx + 1}`,
      }));

      // Create mistake
      const mistake = await createMistakeMutation.mutateAsync({
        subjectId: selectedSubjectId,
        chapterId,
        title: aiResult.title,
        description: `What went wrong: ${aiResult.analysis.whatWentWrong}\n\nWhy it's wrong: ${aiResult.analysis.whyWrong}\n\nCorrect approach: ${aiResult.analysis.correctApproach}`,
        difficulty: aiResult.difficulty,
        status: 'new',
        errorType: aiResult.errorType,
        aiSummary: aiResult.aiSummary,
        aiMindMap: aiResult.aiMindMap,
        attachments: uploadedUrls,
      });

      onSuccess(mistake.id);
      handleClose();
    } catch (error) {
      console.error('Failed to save mistake:', error);
      alert('Failed to save mistake. Please try again.');
    }
  };

  if (!open) return null;

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const chapterOptions = selectedSubject?.chapters || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
        <div className="relative overflow-hidden rounded-3xl border border-slate-800/60 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-slate-950/95 backdrop-blur-xl shadow-2xl">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-600/5" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

          <div className="relative p-8">
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-slate-100 mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20">
                  <svg className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                AI-Powered Mistake Logging
              </h2>
              <p className="text-slate-400">
                {step === 'upload' && 'Upload photos of your mistake and let AI analyze it'}
                {step === 'analyzing' && 'Analyzing your mistake with Gemini 2.5 Pro...'}
                {step === 'review' && 'Review and confirm the AI analysis'}
              </p>
            </div>

            {/* Step Indicator */}
            <div className="mb-8 flex items-center justify-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                step === 'upload' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                1
              </div>
              <div className={`h-1 w-16 rounded ${step !== 'upload' ? 'bg-purple-500' : 'bg-slate-800'}`} />
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                step === 'analyzing' ? 'bg-purple-500 text-white' : step === 'review' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                2
              </div>
              <div className={`h-1 w-16 rounded ${step === 'review' ? 'bg-purple-500' : 'bg-slate-800'}`} />
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                step === 'review' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                3
              </div>
            </div>

            {/* Upload Step */}
            {step === 'upload' && (
              <div className="space-y-6">
                <MultiImageUpload
                  maxImages={10}
                  images={images}
                  onChange={setImages}
                  disabled={false}
                />

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-200">
                    Additional Context (Optional)
                  </label>
                  <textarea
                    value={userContext}
                    onChange={(e) => setUserContext(e.target.value)}
                    placeholder="Add any context that might help AI understand your mistake better..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    rows={4}
                  />
                </div>

                <div className="flex justify-between gap-3">
                  <button
                    onClick={handleClose}
                    className="rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAnalyze}
                    disabled={images.length === 0}
                    className="rounded-xl bg-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Analyze with AI
                  </button>
                </div>
              </div>
            )}

            {/* Analyzing Step */}
            {step === 'analyzing' && (
              <div className="py-12 text-center">
                <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-purple-500/20">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500/20 border-t-purple-500" />
                </div>
                <h3 className="text-xl font-semibold text-slate-100 mb-2">Analyzing Your Mistake</h3>
                <p className="text-sm text-slate-400">
                  Our AI is examining your images and identifying the key issues...
                </p>
              </div>
            )}

            {/* Review Step */}
            {step === 'review' && aiResult && (
              <div className="space-y-6">
                {/* Title */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-200">Title</label>
                  <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
                    <p className="text-sm text-slate-200">{aiResult.title}</p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-200">Error Type</label>
                    <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
                      <p className="text-sm text-slate-200 capitalize">{aiResult.errorType}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-200">Difficulty</label>
                    <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
                      <p className="text-sm text-slate-200 capitalize">{aiResult.difficulty}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-200">Subject</label>
                    <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
                      <p className="text-sm text-slate-200">{aiResult.subject}</p>
                    </div>
                  </div>
                </div>

                {/* Subject & Chapter Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-200">Choose Subject</label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => {
                        setSelectedSubjectId(e.target.value);
                        setSelectedChapterId('');
                      }}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Select subject</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-200">
                      Chapter <span className="text-xs text-slate-500">(or auto-create: "{aiResult.suggestedChapter}")</span>
                    </label>
                    <select
                      value={selectedChapterId}
                      onChange={(e) => setSelectedChapterId(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      disabled={!selectedSubjectId}
                    >
                      <option value="">Auto-create: {aiResult.suggestedChapter}</option>
                      {chapterOptions.map((chapter) => (
                        <option key={chapter.id} value={chapter.id}>
                          {chapter.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Analysis */}
                <div className="space-y-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
                  <h3 className="text-lg font-semibold text-purple-300">AI Analysis</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200 mb-1">What Went Wrong</h4>
                      <p className="text-sm text-slate-300">{aiResult.analysis.whatWentWrong}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200 mb-1">Why It's Wrong</h4>
                      <p className="text-sm text-slate-300">{aiResult.analysis.whyWrong}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200 mb-1">Correct Approach</h4>
                      <p className="text-sm text-slate-300">{aiResult.analysis.correctApproach}</p>
                    </div>

                    {aiResult.analysis.keyConcepts.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-200 mb-2">Key Concepts</h4>
                        <div className="flex flex-wrap gap-2">
                          {aiResult.analysis.keyConcepts.map((concept, idx) => (
                            <span
                              key={idx}
                              className="rounded-full bg-purple-500/20 px-3 py-1 text-xs text-purple-300"
                            >
                              {concept}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Similar Topics */}
                {aiResult.similarTopics.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-200">Similar Topics to Review</label>
                    <div className="flex flex-wrap gap-2">
                      {aiResult.similarTopics.map((topic, idx) => (
                        <span
                          key={idx}
                          className="rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs text-slate-300"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview Best Image */}
                {images[aiResult.bestImageIndex] && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-200">
                      Key Error Image (Image {aiResult.bestImageIndex + 1})
                    </label>
                    <div className="rounded-xl border border-slate-700 overflow-hidden">
                      <img
                        src={images[aiResult.bestImageIndex].preview}
                        alt="Best error image"
                        className="w-full h-64 object-cover"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-between gap-3 pt-4 border-t border-slate-800">
                  <button
                    onClick={() => setStep('upload')}
                    className="rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Back to Upload
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!selectedSubjectId || createMistakeMutation.isPending}
                    className="rounded-xl bg-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createMistakeMutation.isPending ? 'Saving...' : 'Save Mistake'}
                  </button>
                </div>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-6 right-6 rounded-lg p-2 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
