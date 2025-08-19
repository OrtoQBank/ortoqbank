'use client';

import { defineStepper } from '@stepperize/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import BookmarkButton from '@/components/common/BookmarkButton';
import { useQuiz } from '@/components/hooks/useQuiz';

import { Id } from '../../../convex/_generated/dataModel';
import QuestionContent from './QuestionContent';
import QuizAlternatives from './QuizAlternatives';
import QuizFeedback from './QuizFeedback';
import QuizNavigation from './QuizNavigation';
import QuizProgress from './QuizProgress';
import { AlternativeIndex } from './types';

interface QuizProps {
  quizId: Id<'presetQuizzes'> | Id<'customQuizzes'>;
  mode: 'study' | 'exam';
}

export default function Quiz({ quizId, mode }: QuizProps) {
  const {
    quizData,
    progress,
    submitAnswer,
    completeQuiz,
    startQuiz,
    bookmarkStatuses,
    toggleBookmark,
    isLoading,
  } = useQuiz(quizId, mode);
  const [sessionInitialized, setSessionInitialized] = useState(false);

  // Initialize a quiz session if one doesn't exist
  useEffect(() => {
    const initializeSession = async () => {
      if (!isLoading && !progress && !sessionInitialized) {
        setSessionInitialized(true);
        try {
          await startQuiz();
        } catch (error) {
          console.error('Error initializing quiz session:', error);
        }
      }
    };

    initializeSession();
  }, [progress, isLoading, startQuiz, sessionInitialized]);

  if (!quizData || !progress) return <div>Loading...</div>;

  return (
    <QuizStepper
      quizData={quizData}
      progress={progress}
      onSubmitAnswer={submitAnswer}
      mode={mode}
      completeQuiz={completeQuiz}
      bookmarkStatuses={bookmarkStatuses}
      toggleBookmark={toggleBookmark}
    />
  );
}

function QuizStepper({
  quizData,
  progress,
  onSubmitAnswer,
  mode,
  completeQuiz,
  bookmarkStatuses,
}: {
  quizData: NonNullable<ReturnType<typeof useQuiz>['quizData']>;
  progress: NonNullable<ReturnType<typeof useQuiz>['progress']>;
  onSubmitAnswer: ReturnType<typeof useQuiz>['submitAnswer'];
  mode: 'study' | 'exam';
  completeQuiz: ReturnType<typeof useQuiz>['completeQuiz'];
  bookmarkStatuses: ReturnType<typeof useQuiz>['bookmarkStatuses'];
  toggleBookmark: ReturnType<typeof useQuiz>['toggleBookmark'];
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAlternative, setSelectedAlternative] = useState<
    AlternativeIndex | undefined
  >();
  const [feedback, setFeedback] = useState<
    | {
        isCorrect: boolean;
        message: string;
        explanation?: string;
        answered: boolean;
        correctAlternative?: AlternativeIndex;
      }
    | undefined
  >();

  const { useStepper } = defineStepper(
    ...quizData.questions.map((q, index) => ({
      id: `question-${index}`,
      questionText: q.questionTextString,
      alternatives: q.alternatives || [],
    })),
  );

  const stepper = useStepper();

  // Only sync with Convex in exam mode
  useEffect(() => {
    if (
      mode === 'exam' &&
      !progress.isComplete &&
      progress.currentQuestionIndex < quizData.questions.length
    ) {
      const questionId = `question-${progress.currentQuestionIndex}`;
      stepper.goTo(questionId);
    }
  }, [
    mode,
    stepper,
    progress.currentQuestionIndex,
    progress.isComplete,
    quizData.questions.length,
  ]);

  // Use local state for current question in study mode
  const currentStepIndex = Math.min(
    mode === 'exam'
      ? progress.currentQuestionIndex
      : stepper.all.indexOf(stepper.current),
    quizData.questions.length - 1,
  );

  useEffect(() => {
    const historicalAnswer = progress.answers[currentStepIndex];
    const historicalFeedback = progress.answerFeedback?.[currentStepIndex];

    if (historicalAnswer !== undefined && historicalFeedback) {
      setSelectedAlternative(historicalAnswer as AlternativeIndex);
      setFeedback({
        isCorrect: historicalFeedback.isCorrect,
        message: historicalFeedback.isCorrect ? 'Correto!' : 'Incorreto',
        explanation:
          typeof historicalFeedback.explanation === 'string'
            ? historicalFeedback.explanation
            : JSON.stringify(historicalFeedback.explanation),
        answered: true,
        correctAlternative:
          historicalFeedback.correctAlternative as AlternativeIndex,
      });
    } else {
      setSelectedAlternative(undefined);
      setFeedback(undefined);
    }
  }, [currentStepIndex, progress.answers, progress.answerFeedback]);

  const handleAnswerSubmit = async () => {
    if (selectedAlternative === undefined) return;

    setIsLoading(true);
    try {
      // If the quiz is already complete, don't try to submit another answer
      if (!progress.isComplete) {
        await onSubmitAnswer(selectedAlternative);
      }

      // Check if this was the last question in exam mode
      if (
        mode === 'exam' &&
        currentStepIndex === quizData.questions.length - 1
      ) {
        await handleComplete();
      }
    } catch (error) {
      console.error('Error submitting answer:', error);

      // If we're on the last question in exam mode, still try to navigate to results
      if (
        mode === 'exam' &&
        currentStepIndex === quizData.questions.length - 1
      ) {
        router.push(`/quiz-results/${quizData._id}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation only allowed in study mode
  const handlePrevious = () => {
    if (mode === 'exam') return;
    stepper.prev();
  };

  const handleNext = async () => {
    if (mode === 'exam') return;

    setIsLoading(true);
    try {
      if (stepper.isLast) {
        // Handle quiz completion
        await handleComplete();
      } else {
        stepper.next();
      }
    } catch (error) {
      console.error('Error navigating:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentQuestion = quizData.questions[currentStepIndex];

  // Add keyboard navigation for quiz navigation (left/right arrows and space)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if user is typing in an input or textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        isLoading
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          // Go to previous question (only in study mode)
          if (mode === 'study' && !stepper.isFirst) {
            event.preventDefault();
            handlePrevious();
          }
          break;

        case 'ArrowRight':
          // Go to next question or submit (based on context)
          if (feedback?.answered) {
            event.preventDefault();
            handleNext();
          }
          break;

        // Space is already handled by QuizAlternatives for submit/next
        // We only handle it here for next question when already answered
        case ' ':
          if (feedback?.answered && mode === 'study') {
            event.preventDefault();
            handleNext();
          }
          break;
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    mode,
    stepper.isFirst,
    feedback?.answered,
    isLoading,
    handlePrevious,
    handleNext,
  ]);

  const handleComplete = async () => {
    try {
      // Only call completeQuiz if the session exists, is not already complete,
      // and the quiz is in progress (has some answers)
      if (
        progress &&
        !progress.isComplete &&
        progress.answers &&
        progress.answers.length > 0
      ) {
        try {
          await completeQuiz();
        } catch (error) {
          // Catch and log the error, but continue to navigate
          console.error('Error completing quiz (non-blocking):', error);
        }
      } else {
        console.log(
          'Quiz already complete or no answers, skipping completion API call',
        );
      }

      // Always navigate to results regardless of completion status
      router.push(`/quiz-results/${quizData._id}`);
    } catch (error) {
      console.error('Error in handleComplete:', error);
      // If completing the quiz fails but we can still navigate, go to results anyway
      router.push(`/quiz-results/${quizData._id}`);
    }
  };

  return (
    <div className="container mx-auto mt-6 max-w-3xl rounded-3xl border bg-white p-6 md:mt-16">
      {stepper.switch({
        ...Object.fromEntries(
          quizData.questions.map((_, index) => [
            `question-${index}`,
            step => (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <QuizProgress
                      currentIndex={currentStepIndex}
                      totalQuestions={quizData.questions.length}
                      mode={mode}
                      answerFeedback={progress.answerFeedback}
                      onNavigate={index => {
                        if (mode === 'study') {
                          stepper.goTo(`question-${index}`);
                        }
                      }}
                    />
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="flex items-center">
                      <BookmarkButton
                        questionId={currentQuestion._id}
                        isBookmarked={
                          bookmarkStatuses[currentQuestion._id] || false
                        }
                      />
                    </div>
                    {currentQuestion.questionCode && (
                      <span className="text-muted-foreground text-xs opacity-70">
                        Código: {currentQuestion.questionCode}
                      </span>
                    )}
                  </div>
                </div>

                <div className="my-6">
                  {' '}
                  <QuestionContent stringContent={step.questionText} />
                  <QuizAlternatives
                    alternatives={step.alternatives || []}
                    selectedAlternative={selectedAlternative}
                    onSelect={i => setSelectedAlternative(i)}
                    onSubmit={handleAnswerSubmit}
                    onNext={handleNext}
                    hasAnswered={!!feedback?.answered}
                    disabled={!!feedback?.answered}
                    showFeedback={!!feedback?.answered && mode === 'study'}
                    correctAlternative={feedback?.correctAlternative}
                  />
                </div>

                {feedback && (
                  <QuizFeedback
                    isCorrect={feedback.isCorrect}
                    message={feedback.message}
                    explanation={feedback.explanation}
                  />
                )}

                <QuizNavigation
                  mode={mode}
                  isFirst={stepper.isFirst}
                  isLast={stepper.isLast}
                  hasAnswered={!!feedback?.answered}
                  hasSelectedOption={selectedAlternative !== undefined}
                  isLoading={isLoading}
                  onPrevious={handlePrevious}
                  onNext={handleNext}
                  onSubmit={handleAnswerSubmit}
                />
              </>
            ),
          ]),
        ),
      })}
    </div>
  );
}
