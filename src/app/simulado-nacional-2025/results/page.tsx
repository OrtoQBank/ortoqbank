'use client';

import { useQuery } from 'convex/react';
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Target,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import StructuredContentRenderer from '@/components/common/StructuredContentRenderer';
import QuestionContent from '@/components/quiz/QuestionContent';
import QuizProgressResults from '@/components/quiz/QuizProgressResults';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

import { api } from '../../../../convex/_generated/api';

const EVENT_NAME = 'simulado-nacional-2025';

// Helper function for styling answers
const getAlternativeClassName = (isUserAnswer: boolean, isCorrect: boolean) => {
  if (isUserAnswer && isCorrect) return 'border-green-500 bg-green-50';
  if (isUserAnswer && !isCorrect) return 'border-red-500 bg-red-50';
  if (isCorrect) return 'border-green-500 bg-green-50';
  return '';
};

export default function EventResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  // State for current question review
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Fetch event data
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

  const userScore = useQuery(
    api.eventQuiz.getEventUserScore,
    eventUser ? { eventUserId: eventUser._id, eventName: EVENT_NAME } : 'skip',
  );

  const leaderboard = useQuery(api.eventQuiz.getEventLeaderboard, {
    eventName: EVENT_NAME,
    limit: 10,
  });

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="mb-4 text-red-600">Email não fornecido</p>
            <Button onClick={() => router.push('/simulado-nacional-2025')}>
              Voltar para Inscrição
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!eventUser || !session || !quizData || !userScore) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="container mx-auto max-w-3xl pt-16">
          <Card>
            <CardContent className="p-6 text-center">
              <h1 className="mb-6 text-2xl font-bold">
                Carregando resultados...
              </h1>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!eventUser.hasCompletedExam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="mb-4 text-yellow-600">
              Você ainda não completou o exame
            </p>
            <Button
              onClick={() =>
                router.push(
                  `/simulado-nacional-2025/quiz?email=${encodeURIComponent(email)}`,
                )
              }
            >
              Continuar Exame
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Find user's rank in leaderboard
  const userRank = leaderboard?.findIndex(entry => entry.email === email) ?? -1;

  // Calculate results
  const totalQuestions = quizData.questions.length;
  const correctAnswers = session.answerFeedback.filter(
    (fb: { isCorrect: boolean }) => fb.isCorrect,
  ).length;
  const score = Math.round((correctAnswers / totalQuestions) * 100);

  // Current question data for review
  const question = quizData.questions[currentQuestionIndex];
  const userAnswer = session.answers[currentQuestionIndex];
  const feedback = session.answerFeedback[currentQuestionIndex];

  // Simple navigation functions
  const goToPrevious = () => {
    setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
  };

  const goToNext = () => {
    setCurrentQuestionIndex(prev => Math.min(totalQuestions - 1, prev + 1));
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-3xl rounded-lg border bg-white p-6">
        <div className="mb-4 flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold">
            {userRank === 0
              ? '🎉 Parabéns, Campeão!'
              : 'Simulado Nacional 2025'}
          </h1>
          <p className="text-lg text-gray-600">
            {eventUser.firstName} {eventUser.lastName}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Completado em {formatDate(session._creationTime)}
          </p>

          {userRank === 0 && (
            <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-100 p-4">
              <p className="text-lg font-bold text-yellow-800">
                🏆 Você ganhou 1 ano gratuito do app! 🏆
              </p>
              <p className="text-sm text-yellow-700">
                Entraremos em contato em breve pelos dados fornecidos.
              </p>
            </div>
          )}
        </div>

        {/* Results summary */}
        <div className="mb-6 rounded-lg p-4">
          <div className="flex items-center justify-center gap-8">
            <div className="flex flex-col items-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <span className="mt-1 font-medium">{correctAnswers}</span>
              <span className="text-muted-foreground text-sm">Corretas</span>
            </div>

            <div className="flex flex-col items-center">
              <XCircle className="h-8 w-8 text-red-500" />
              <span className="mt-1 font-medium">
                {totalQuestions - correctAnswers}
              </span>
              <span className="text-muted-foreground text-sm">Incorretas</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center rounded-full text-2xl font-bold">
                {score}%
              </div>
              <span className="mt-1">&nbsp;</span>
              <span className="text-muted-foreground text-sm">Pontuação</span>
            </div>
          </div>

          {userRank >= 0 && (
            <div className="mt-4 text-center">
              <Badge variant={userRank < 3 ? 'default' : 'outline'}>
                #{userRank + 1} no ranking geral
              </Badge>
            </div>
          )}
        </div>

        {/* Question Navigator (using QuizProgressResults) */}
        <div className="mb-6">
          <QuizProgressResults
            currentIndex={currentQuestionIndex}
            totalQuestions={totalQuestions}
            onNavigate={setCurrentQuestionIndex}
            answerFeedback={session.answerFeedback}
            visibleCount={10} // Show more questions at once for review
          />
        </div>

        {/* Question content */}
        <div className="my-6 border-t p-4">
          <h3 className="text-md my-4 font-medium">
            Questão {currentQuestionIndex + 1}
          </h3>

          <QuestionContent stringContent={question.questionTextString} />

          <div className="mt-4 space-y-2">
            {question.alternatives.map((alternative, i) => {
              const isCorrect = i === feedback?.correctAlternative;
              const isUserAnswer = i === userAnswer;

              return (
                <div
                  key={i}
                  className={`flex items-center rounded-lg border p-3 ${getAlternativeClassName(
                    isUserAnswer,
                    isCorrect,
                  )}`}
                >
                  <div className="mr-3 flex h-6 w-6 items-center justify-center rounded-full border">
                    {String.fromCodePoint(65 + i)}
                  </div>
                  <div>{alternative}</div>
                </div>
              );
            })}
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              className={`mt-4 rounded-md p-3 ${
                feedback.isCorrect
                  ? 'border-green-500 bg-green-50'
                  : 'border-red-500 bg-red-50'
              }`}
            >
              <div className="font-medium">
                {feedback.isCorrect
                  ? 'Resposta Correta!'
                  : 'Resposta Incorreta'}
              </div>
              {feedback.explanation && (
                <div className="mt-2">
                  <div className="text-sm font-medium">Explicação:</div>
                  <div className="mt-1 text-sm">
                    <StructuredContentRenderer
                      stringContent={
                        typeof feedback.explanation === 'string'
                          ? feedback.explanation
                          : JSON.stringify(feedback.explanation)
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <Button
            onClick={goToPrevious}
            disabled={currentQuestionIndex === 0}
            variant="outline"
            size="sm"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
          </Button>

          <Button
            onClick={goToNext}
            disabled={currentQuestionIndex === totalQuestions - 1}
            variant="outline"
            size="sm"
          >
            Próxima <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            onClick={() => router.push('/simulado-nacional-2025')}
          >
            Voltar ao Início
          </Button>
        </div>
      </div>
    </div>
  );
}
