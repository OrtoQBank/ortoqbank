'use client';

import { useMutation, useQuery } from 'convex/react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AlternativeIndex } from '@/components/quiz/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { api } from '../../../../convex/_generated/api';
import EventQuestionContent from '../components/EventQuestionContent';
import EventQuizAlternatives from '../components/EventQuizAlternatives';
import EventTimer from '../components/EventTimer';
import { useEventSession } from '../hooks/useEventSession';

const EVENT_NAME = 'simulado-nacional-2025';

export default function EventQuizPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  // Use event session hook
  const eventSession = useEventSession(EVENT_NAME);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAlternative, setSelectedAlternative] = useState<
    AlternativeIndex | undefined
  >();
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(
    new Set(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);

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

  // Redirect if no email or create session
  useEffect(() => {
    if (!email) {
      router.push('/simulado-nacional-2025');
      return;
    }

    // Create session if none exists
    if (!eventSession.isLoading && !eventSession.session) {
      eventSession.createSession(email);
    }
  }, [email, router, eventSession]);

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

  // Load previous answers
  useEffect(() => {
    if (session && session.answers) {
      const answered = new Set<number>();
      session.answers.forEach((answer, index) => {
        if (answer !== undefined) answered.add(index);
      });
      setAnsweredQuestions(answered);

      // Set current question to first unanswered or last question
      const firstUnanswered = session.answers.findIndex(
        (answer, index) =>
          answer === undefined && index < session.questions.length,
      );
      setCurrentQuestionIndex(
        firstUnanswered === -1
          ? Math.min(session.currentQuestionIndex, session.questions.length - 1)
          : firstUnanswered,
      );
    }
  }, [session]);

  // Load selected answer for current question
  useEffect(() => {
    if (
      session &&
      session.answers &&
      session.answers[currentQuestionIndex] !== undefined
    ) {
      setSelectedAlternative(
        session.answers[currentQuestionIndex] as AlternativeIndex,
      );
    } else {
      setSelectedAlternative(undefined);
    }
  }, [currentQuestionIndex, session]);

  const handleSubmitAnswer = async () => {
    if (selectedAlternative === undefined || !session) return;

    setIsSubmitting(true);
    try {
      await submitAnswer({
        sessionId: session._id,
        questionIndex: currentQuestionIndex,
        selectedAlternative,
      });

      setAnsweredQuestions(prev => new Set([...prev, currentQuestionIndex]));

      // Move to next unanswered question
      const nextUnanswered = session.questions.findIndex(
        (_, index) =>
          index > currentQuestionIndex && !answeredQuestions.has(index),
      );

      if (nextUnanswered === -1) {
        // All questions answered, go to next question or stay at last
        setCurrentQuestionIndex(
          Math.min(currentQuestionIndex + 1, session.questions.length - 1),
        );
      } else {
        setCurrentQuestionIndex(nextUnanswered);
      }
    } catch (error: any) {
      alert(error.message || 'Erro ao enviar resposta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishExam = async () => {
    if (!session) return;

    try {
      const result = await completeQuiz({ sessionId: session._id });
      router.push(
        `/simulado-nacional-2025/results?email=${encodeURIComponent(email!)}`,
      );
    } catch (error: any) {
      alert(error.message || 'Erro ao finalizar exame');
    }
  };

  const handleTimeExpired = () => {
    handleFinishExam();
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

  const currentQuestion = quizData.questions[currentQuestionIndex];
  const totalQuestions = quizData.questions.length;
  const answeredCount = answeredQuestions.size;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Simulado Nacional 2025
              </h1>
              <p className="text-sm text-gray-600">
                Questão {currentQuestionIndex + 1} de {totalQuestions} •
                {answeredCount} respondidas
              </p>
            </div>

            <div className="flex items-center gap-4">
              <EventTimer
                expiresAt={session.expiresAt}
                onExpired={handleTimeExpired}
              />
              <Badge
                variant={
                  answeredCount === totalQuestions ? 'default' : 'secondary'
                }
              >
                {Math.round((answeredCount / totalQuestions) * 100)}% completo
              </Badge>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Progresso</span>
            <span className="text-sm text-gray-600">
              {answeredCount}/{totalQuestions}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Navigation */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {quizData.questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`h-10 w-10 rounded-lg text-sm font-medium transition-colors ${
                  index === currentQuestionIndex
                    ? 'bg-blue-600 text-white'
                    : answeredQuestions.has(index)
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Question Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Questão {currentQuestionIndex + 1}</span>
              {currentQuestion.questionCode && (
                <Badge variant="outline">
                  Código: {currentQuestion.questionCode}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <EventQuestionContent
              stringContent={currentQuestion.questionTextString}
            />

            <EventQuizAlternatives
              alternatives={currentQuestion.alternatives}
              selectedAlternative={selectedAlternative}
              onSelect={setSelectedAlternative}
              disabled={false}
              showFeedback={false}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))
                }
                disabled={currentQuestionIndex === 0}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  setCurrentQuestionIndex(
                    Math.min(totalQuestions - 1, currentQuestionIndex + 1),
                  )
                }
                disabled={currentQuestionIndex === totalQuestions - 1}
              >
                Próxima
              </Button>
            </div>

            <div className="flex gap-2">
              {answeredQuestions.has(currentQuestionIndex) ? (
                <Button
                  variant="outline"
                  onClick={handleSubmitAnswer}
                  disabled={selectedAlternative === undefined || isSubmitting}
                >
                  {isSubmitting ? 'Salvando...' : 'Alterar Resposta'}
                </Button>
              ) : (
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={selectedAlternative === undefined || isSubmitting}
                >
                  {isSubmitting ? 'Salvando...' : 'Responder'}
                </Button>
              )}

              {answeredCount === totalQuestions && (
                <Button
                  variant="default"
                  onClick={() => setShowConfirmFinish(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Finalizar Exame
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Finish Confirmation Dialog */}
        {showConfirmFinish && (
          <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>Finalizar Exame</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  Tem certeza que deseja finalizar o exame? Esta ação não pode
                  ser desfeita.
                </p>
                <p className="mb-6 text-sm text-gray-600">
                  Você respondeu {answeredCount} de {totalQuestions} questões.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirmFinish(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleFinishExam}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Confirmar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
