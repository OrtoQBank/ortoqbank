'use client';

import { useMachine } from '@xstate/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';

import QuestionContent from '@/components/quiz/QuestionContent';
import QuizAlternatives from '@/components/quiz/QuizAlternatives';
import QuizFeedback from '@/components/quiz/QuizFeedback';
import QuizNavigation from '@/components/quiz/QuizNavigation';
import QuizProgress from '@/components/quiz/QuizProgress';
import { AlternativeIndex } from '@/components/quiz/types';

import {
  AnswerFeedback,
  createQuizMachine,
  QuizData,
} from './quizMachine';

interface QuizDemoProps {
  quizData: QuizData;
  mode: 'study' | 'exam';
  onSubmitAnswer: (
    selectedAlternativeIndex: AlternativeIndex,
  ) => Promise<{ isCorrect: boolean; explanation?: string; correctAlternative: AlternativeIndex }>;
  onComplete: () => Promise<void>;
}

export default function QuizDemo({
  quizData,
  mode,
  onSubmitAnswer,
  onComplete,
}: QuizDemoProps) {
  const router = useRouter();

  // Create machine instance with the correct mode - memoize to avoid recreating
  const quizMachine = useMemo(() => createQuizMachine(mode), [mode]);
  const [state, send] = useMachine(quizMachine);

  // Load quiz data when component mounts
  useEffect(() => {
    if (quizData && state.value === 'loading') {
      send({ type: 'LOAD', data: quizData });
    }
  }, [quizData, send, state.value]);

  // Handle answer submission
  const handleSubmit = useCallback(async () => {
    if (state.context.selectedAnswer === undefined) return;

    send({ type: 'SUBMIT' });

    try {
      const result = await onSubmitAnswer(state.context.selectedAnswer);

      const feedback: AnswerFeedback = {
        isCorrect: result.isCorrect,
        explanation: result.explanation,
        correctAlternative: result.correctAlternative,
      };

      send({ type: 'ANSWER_RESULT', feedback });
    } catch (error) {
      console.error('Error submitting answer:', error);
      // Stay in submitting state or handle error
    }
  }, [state.context.selectedAnswer, send, onSubmitAnswer]);

  // Handle completion
  const handleComplete = useCallback(async () => {
    try {
      await onComplete();
      send({ type: 'COMPLETE' });
    } catch (error) {
      console.error('Error completing quiz:', error);
    }
  }, [onComplete, send]);

  // Redirect when completed
  useEffect(() => {
    if (state.value === 'completed' && state.context.quizData) {
      router.push(`/quiz-results/${state.context.quizData._id}`);
    }
  }, [state.value, state.context.quizData, router]);

  // Handle next button
  const handleNext = useCallback(async () => {
    const isLast =
      state.context.currentQuestionIndex ===
      (state.context.quizData?.questions.length ?? 0) - 1;

    if (isLast) {
      await handleComplete();
    } else {
      send({ type: 'NEXT' });
    }
  }, [state.context, send, handleComplete]);

  // Handle previous button
  const handlePrevious = useCallback(() => {
    send({ type: 'PREVIOUS' });
  }, [send]);

  // Handle answer selection
  const handleSelectAnswer = useCallback(
    (answer: AlternativeIndex) => {
      send({ type: 'SELECT_ANSWER', answer });
    },
    [send],
  );

  // Handle question navigation (study mode progress bar)
  const handleNavigateToQuestion = useCallback(
    (index: number) => {
      if (mode === 'study') {
        send({ type: 'GO_TO_QUESTION', index });
      }
    },
    [mode, send],
  );

  // Loading state
  if (state.value === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        Carregando quiz...
      </div>
    );
  }

  // Error state
  if (state.value === 'error') {
    return (
      <div className="flex h-screen items-center justify-center text-red-500">
        Erro: {state.context.error}
      </div>
    );
  }

  const { quizData: data, currentQuestionIndex, selectedAnswer, currentFeedback, answerFeedback } =
    state.context;

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center">
        Dados do quiz não encontrados
      </div>
    );
  }

  const currentQuestion = data.questions[currentQuestionIndex];
  const isFirst = currentQuestionIndex === 0;
  const isLast = currentQuestionIndex === data.questions.length - 1;
  const hasAnswered = currentFeedback !== null;
  const isSubmitting = state.value === 'submitting';

  // Convert answerFeedback Record to array format for QuizProgress
  const answerFeedbackArray: Array<{ isCorrect: boolean } | undefined> = 
    data.questions.map((_, index) => {
      const feedback = answerFeedback[index];
      return feedback ? { isCorrect: feedback.isCorrect } : undefined;
    });

  return (
    <div className="container mx-auto max-w-3xl rounded-3xl border bg-white p-6">
      {/* Header with progress and question info */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <QuizProgress
            currentIndex={currentQuestionIndex}
            totalQuestions={data.questions.length}
            mode={mode}
            answerFeedback={answerFeedbackArray}
            onNavigate={handleNavigateToQuestion}
          />
        </div>

        <div className="flex flex-col items-center">
          {currentQuestion.questionCode && (
            <span className="text-muted-foreground text-xs opacity-70">
              Código: {currentQuestion.questionCode}
            </span>
          )}
          {/* XState Demo Badge */}
          <span className="mt-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
            XState Demo
          </span>
        </div>
      </div>

      {/* Question content */}
      <div className="my-6">
        <QuestionContent stringContent={currentQuestion.questionTextString} />

        <QuizAlternatives
          alternatives={currentQuestion.alternatives}
          selectedAlternative={selectedAnswer}
          onSelect={handleSelectAnswer}
          onSubmit={handleSubmit}
          onNext={handleNext}
          hasAnswered={hasAnswered}
          disabled={hasAnswered || isSubmitting}
          showFeedback={hasAnswered && mode === 'study'}
          correctAlternative={currentFeedback?.correctAlternative}
        />
      </div>

      {/* Feedback section */}
      {currentFeedback && (
        <QuizFeedback
          isCorrect={currentFeedback.isCorrect}
          message={currentFeedback.isCorrect ? 'Correto!' : 'Incorreto'}
          explanation={currentFeedback.explanation}
        />
      )}

      {/* Navigation */}
      <QuizNavigation
        mode={mode}
        isFirst={isFirst}
        isLast={isLast}
        hasAnswered={hasAnswered}
        hasSelectedOption={selectedAnswer !== undefined}
        isLoading={isSubmitting}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onSubmit={handleSubmit}
      />

      {/* Debug panel - shows current state */}
      <div className="mt-6 rounded-lg bg-gray-100 p-4 text-xs text-gray-600">
        <div className="font-semibold">XState Debug:</div>
        <div>
          State: <code className="rounded bg-gray-200 px-1">{String(state.value)}</code>
        </div>
        <div>
          Question: {currentQuestionIndex + 1}/{data.questions.length}
        </div>
        <div>
          Answered: {Object.keys(answerFeedback).length}/{data.questions.length}
        </div>
      </div>
    </div>
  );
}
