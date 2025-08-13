'use client';

import { useMutation, useQuery } from 'convex/react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import BookmarkButton from '@/components/common/BookmarkButton';
import QuestionContent from '@/components/quiz/QuestionContent';
import QuizAlternatives from '@/components/quiz/QuizAlternatives';
import QuizFeedback from '@/components/quiz/QuizFeedback';
import QuizNavigation from '@/components/quiz/QuizNavigation';
import QuizProgress from '@/components/quiz/QuizProgress';
import { AlternativeIndex } from '@/components/quiz/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { api } from '../../../../convex/_generated/api';
import EventTimer from '../components/EventTimer';
import { useEventSession } from '../hooks/useEventSession';

const EVENT_NAME = 'simulado-nacional-2025';

export default function EventQuizPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  // Queries and mutations
  const eventUser = useQuery(
    api.eventQuiz.getEventUser,
    email ? { email, eventName: EVENT_NAME } : 'skip',
  );
  const session = useQuery(
    api.eventQuiz.getEventQuizSession,
    eventUser ? { eventUserId: eventUser._id, eventName: EVENT_NAME } : 'skip',
  );
  const quizData = useQuery(
    api.eventQuiz.getEventQuizQuestions,
    session ? { sessionId: session._id } : 'skip',
  );

  const startQuiz = useMutation(api.eventQuiz.startEventQuiz);
  const submitAnswer = useMutation(api.eventQuiz.submitEventQuizAnswer);
  const completeQuiz = useMutation(api.eventQuiz.completeEventQuiz);

  // Redirect if no email
  useEffect(() => {
    if (!email) {
      router.push('/simulado-nacional-2025');
      return;
    }
  }, [email, router]);

  // Auto-start quiz if user doesn't have a session
  useEffect(() => {
    const autoStartQuiz = async () => {
      if (eventUser && !session && !eventUser.hasStartedExam) {
        try {
          await startQuiz({
            eventUserId: eventUser._id,
            eventName: EVENT_NAME,
            questionCount: 16, // Use all available real questions
          });
        } catch (error) {
          console.error('Error starting quiz:', error);
          alert('Erro ao iniciar o exame. Tente novamente.');
        }
      }
    };

    autoStartQuiz();
  }, [eventUser, session, startQuiz]);

  const handleTimeExpired = async () => {
    if (!session) return;

    try {
      await completeQuiz({ sessionId: session._id });
      router.push(
        `/simulado-nacional-2025/results?email=${encodeURIComponent(email!)}`,
      );
    } catch (error: any) {
      console.error('Error completing quiz on time expiry:', error);
      // Still navigate to results even if completion fails
      router.push(
        `/simulado-nacional-2025/results?email=${encodeURIComponent(email!)}`,
      );
    }
  };

  if (!email) {
    return <div>Redirecionando...</div>;
  }

  if (!eventUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="mb-4 text-red-600">Usuário não encontrado</p>
            <Button onClick={() => router.push('/simulado-nacional-2025')}>
              Voltar para Inscrição
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (eventUser.hasCompletedExam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
            <h2 className="mb-4 text-xl font-bold">Exame já finalizado!</h2>
            <p className="mb-4 text-gray-600">
              Você já completou o Simulado Nacional 2025.
            </p>
            <Button
              onClick={() =>
                router.push(
                  `/simulado-nacional-2025/results?email=${encodeURIComponent(email)}`,
                )
              }
            >
              Ver Resultados
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session || !quizData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p>Carregando exame...</p>
        </div>
      </div>
    );
  }

  if (session.isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-red-500" />
            <h2 className="mb-4 text-xl font-bold">Tempo Esgotado</h2>
            <p className="mb-4 text-gray-600">
              O tempo limite de 4 horas foi atingido.
            </p>
            <Button
              onClick={() =>
                router.push(
                  `/simulado-nacional-2025/results?email=${encodeURIComponent(email)}`,
                )
              }
            >
              Ver Resultados
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render the quiz using the same pattern as Quiz.tsx
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="mb-6 flex items-center justify-center">
        <EventTimer
          expiresAt={session.expiresAt}
          onExpired={handleTimeExpired}
        />
      </div>
      <EventQuizStepper
        session={session}
        quizData={quizData}
        eventUser={eventUser}
        submitAnswer={submitAnswer}
        completeQuiz={completeQuiz}
        router={router}
        email={email}
      />
    </div>
  );
}

function EventQuizStepper({
  session,
  quizData,
  eventUser,
  submitAnswer,
  completeQuiz,
  router,
  email,
}: {
  session: NonNullable<ReturnType<typeof useQuery>>;
  quizData: NonNullable<ReturnType<typeof useQuery>>;
  eventUser: NonNullable<ReturnType<typeof useQuery>>;
  submitAnswer: ReturnType<typeof useMutation>;
  completeQuiz: ReturnType<typeof useMutation>;
  router: ReturnType<typeof useRouter>;
  email: string;
}) {
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

  // Current question index - in exam mode it's from progress
  const currentStepIndex = Math.min(
    session.currentQuestionIndex,
    quizData.questions.length - 1,
  );

  useEffect(() => {
    const historicalAnswer = session.answers[currentStepIndex];
    const historicalFeedback = session.answerFeedback?.[currentStepIndex];

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
  }, [currentStepIndex, session.answers, session.answerFeedback]);

  const handleAnswerSubmit = async () => {
    if (selectedAlternative === undefined) return;

    setIsLoading(true);
    try {
      if (!session.isComplete) {
        await submitAnswer({
          sessionId: session._id,
          questionIndex: currentStepIndex,
          selectedAlternative,
        });
      }

      // Check if this was the last question in exam mode
      if (currentStepIndex === quizData.questions.length - 1) {
        await handleComplete();
      }
    } catch (error) {
      console.error('Error submitting answer:', error);

      // If we're on the last question, still try to navigate to results
      if (currentStepIndex === quizData.questions.length - 1) {
        router.push(
          `/simulado-nacional-2025/results?email=${encodeURIComponent(email)}`,
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const currentQuestion = quizData.questions[currentStepIndex];

  const handleComplete = async () => {
    try {
      if (
        session &&
        !session.isComplete &&
        session.answers &&
        session.answers.length > 0
      ) {
        try {
          await completeQuiz({ sessionId: session._id });
        } catch (error) {
          console.error('Error completing quiz (non-blocking):', error);
        }
      }

      router.push(
        `/simulado-nacional-2025/results?email=${encodeURIComponent(email)}`,
      );
    } catch (error) {
      console.error('Error in handleComplete:', error);
      router.push(
        `/simulado-nacional-2025/results?email=${encodeURIComponent(email)}`,
      );
    }
  };

  return (
    <div className="container mx-auto mt-6 max-w-3xl rounded-3xl border bg-white p-6 md:mt-16">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <QuizProgress
            currentIndex={currentStepIndex}
            totalQuestions={quizData.questions.length}
            mode="exam"
            answerFeedback={session.answerFeedback}
            onNavigate={undefined} // Disabled in exam mode
          />
        </div>

        <div className="flex flex-col items-center">
          <div className="flex items-center">
            <BookmarkButton
              questionId={currentQuestion._id}
              isBookmarked={false} // Event quiz doesn't use bookmarks
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
        <QuestionContent stringContent={currentQuestion.questionTextString} />
        <QuizAlternatives
          alternatives={currentQuestion.alternatives || []}
          selectedAlternative={selectedAlternative}
          onSelect={i => setSelectedAlternative(i)}
          disabled={!!feedback?.answered}
          showFeedback={!!feedback?.answered} // Show feedback based on answered state
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
        mode="exam"
        isFirst={currentStepIndex === 0}
        isLast={currentStepIndex === quizData.questions.length - 1}
        hasAnswered={!!feedback?.answered}
        hasSelectedOption={selectedAlternative !== undefined}
        isLoading={isLoading}
        onPrevious={() => {}} // Disabled in exam mode
        onNext={
          currentStepIndex === quizData.questions.length - 1
            ? handleComplete
            : () => {}
        }
        onSubmit={handleAnswerSubmit}
      />
    </div>
  );
}
