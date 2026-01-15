'use client';

import { useMutation, useQuery } from 'convex/react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AlternativeIndex } from '@/components/quiz/types';

import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import QuizDemo from '../QuizDemo';
import { QuizData, QuizQuestion } from '../quizMachine';

export default function DemoQuizPage() {
  const { id } = useParams() as { id: Id<'presetQuizzes'> | Id<'customQuizzes'> };
  const router = useRouter();
  const [sessionInitialized, setSessionInitialized] = useState(false);

  // Fetch quiz data
  const rawQuizData = useQuery(api.quiz.getQuizData, { quizId: id });

  // Fetch active session
  const session = useQuery(api.quizSessions.getActiveSession, { quizId: id });

  // Mutations
  const startQuiz = useMutation(api.quizSessions.startQuizSession);
  const submitAnswer = useMutation(api.quizSessions.submitAnswerAndProgress);
  const completeQuiz = useMutation(api.quizSessions.completeQuizSession);

  // Get mode from session or default to 'study'
  const mode = (session?.mode as 'study' | 'exam') || 'study';

  // Initialize session if needed
  useEffect(() => {
    const initializeSession = async () => {
      if (rawQuizData && !session && !sessionInitialized) {
        setSessionInitialized(true);
        try {
          await startQuiz({ quizId: id, mode: 'study' });
        } catch (error) {
          console.error('Error initializing quiz session:', error);
        }
      }
    };

    initializeSession();
  }, [rawQuizData, session, sessionInitialized, startQuiz, id]);

  // Redirect if session is complete
  useEffect(() => {
    if (session?.isComplete) {
      router.push(`/quiz-results/${id}`);
    }
  }, [session, id, router]);

  // Transform raw quiz data to the format expected by the state machine
  // Note: SafeQuestion doesn't include correctAlternativeIndex for security
  // The correct answer is revealed via answerFeedback after submission
  const quizData: QuizData | null = rawQuizData
    ? {
        _id: rawQuizData._id,
        questions: rawQuizData.questions.map(
          (q): QuizQuestion => ({
            _id: q._id,
            title: q.title,
            questionTextString: q.questionTextString,
            alternatives: q.alternatives || [],
            questionCode: q.questionCode,
          }),
        ),
      }
    : null;

  // Handle answer submission
  // The mutation updates the session's answerFeedback array with the result
  // We need to wait for Convex reactivity to provide the updated session
  const handleSubmitAnswer = useCallback(
    async (
      selectedAlternativeIndex: AlternativeIndex,
    ): Promise<{ isCorrect: boolean; explanation?: string; correctAlternative: AlternativeIndex }> => {
      try {
        await submitAnswer({
          quizId: id,
          selectedAlternativeIndex,
        });

        // The mutation updates session.answerFeedback - we need to poll/wait for it
        // For now, we'll return a placeholder and let the session update trigger the real feedback
        // This is a simplification for the demo - in production you'd want to return from the mutation
        const currentQuestionIndex = session?.currentQuestionIndex ?? 0;
        
        // Wait a bit for Convex reactivity to update the session
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get feedback from the session (will be populated by Convex reactivity)
        const feedback = session?.answerFeedback?.[currentQuestionIndex];
        
        // Handle explanation which can be string or object
        const explanation = feedback?.explanation;
        const explanationString = typeof explanation === 'string' ? explanation : undefined;
        
        return {
          isCorrect: feedback?.isCorrect ?? false,
          explanation: explanationString,
          correctAlternative: (feedback?.correctAlternative ?? 0) as AlternativeIndex,
        };
      } catch (error) {
        console.error('Error submitting answer:', error);
        throw error;
      }
    },
    [submitAnswer, id, session?.currentQuestionIndex, session?.answerFeedback],
  );

  // Handle quiz completion
  const handleComplete = useCallback(async () => {
    try {
      await completeQuiz({ quizId: id });
    } catch (error) {
      console.error('Error completing quiz:', error);
      throw error;
    }
  }, [completeQuiz, id]);

  // Loading state
  if (!quizData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg">Carregando demo do quiz...</div>
          <div className="text-sm text-gray-500">
            Este é um demo usando XState para gerenciamento de estado
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Demo header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            XState Quiz Demo
          </h1>
          <p className="text-sm text-gray-600">
            Demonstração do quiz usando XState para gerenciamento de estado
          </p>
        </div>

        {/* Quiz component */}
        <QuizDemo
          quizData={quizData}
          mode={mode}
          onSubmitAnswer={handleSubmitAnswer}
          onComplete={handleComplete}
        />
      </div>
    </div>
  );
}
