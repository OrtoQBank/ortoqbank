'use client';

import { SignInButton, useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { CheckCircle, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import StructuredContentRenderer from '@/components/common/StructuredContentRenderer';
import QuestionContent from '@/components/quiz/QuestionContent';
import QuizProgressResults from '@/components/quiz/QuizProgressResults';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';

// Helper function for styling answers
const getAlternativeClassName = (isUserAnswer: boolean, isCorrect: boolean) => {
  if (isUserAnswer && isCorrect) return 'border-green-500 bg-green-50';
  if (isUserAnswer && !isCorrect) return 'border-red-500 bg-red-50';
  if (isCorrect) return 'border-green-500 bg-green-50';
  return '';
};

// Helper to determine if quiz ID is a customQuiz ID
const isCustomQuiz = (
  id: Id<'presetQuizzes'> | Id<'customQuizzes'>,
): boolean => {
  // The Id type from Convex includes table information
  // We can check if it contains the table name 'customQuizzes'
  return id.includes('customQuizzes:');
};

export default function UniversalQuizResultsPage() {
  const { id } = useParams();
  const quizId = id as Id<'presetQuizzes'> | Id<'customQuizzes'>;
  const { user, isLoaded, isSignedIn } = useUser();

  // State for current question
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Determine the quiz type and fetch the appropriate data
  const isCustom = isCustomQuiz(quizId);

  // Use lightweight queries optimized for results display
  const presetQuizResult = useQuery(
    api.quiz.getQuizDataForResults,
    isCustom ? 'skip' : { quizId: quizId as Id<'presetQuizzes'> },
  );

  const customQuizResult = useQuery(
    api.customQuizzes.getByIdForResults,
    isCustom && isLoaded && isSignedIn
      ? { id: quizId as Id<'customQuizzes'> }
      : 'skip',
  );

  // Combined quiz data - use the appropriate result based on quiz type
  const quiz = isCustom ? customQuizResult : presetQuizResult;

  // Get the completed sessions for this quiz
  const completedSessions =
    useQuery(
      api.quizSessions.getCompletedSessions,
      isLoaded && isSignedIn
        ? { quizId: quizId as Id<'presetQuizzes'> | Id<'customQuizzes'> }
        : 'skip',
    ) || [];

  // Get the most recent session (index 0)
  const session = completedSessions[0];

  // If auth state is loaded and the user is not signed in, prevent loading loop
  if (isLoaded && !isSignedIn) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="mb-2 text-2xl font-bold">Autenticação necessária</h1>
        <p className="text-muted-foreground mb-4">
          Faça login para visualizar os resultados deste teste.
        </p>
        <SignInButton forceRedirectUrl={`/quiz-results/${id}`}>
          <Button>Entrar</Button>
        </SignInButton>
      </div>
    );
  }

  if (!quiz || !user || !session || !quiz.questions[currentQuestionIndex]) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="mb-6 text-2xl font-bold">Carregando resultados...</h1>
      </div>
    );
  }

  // Calculate results
  const totalQuestions = quiz.questions.length;
  const correctAnswers = session.answerFeedback.filter(
    (fb: { isCorrect: boolean }) => fb.isCorrect,
  ).length;
  const score = Math.round((correctAnswers / totalQuestions) * 100);

  // Current question data
  const question = quiz.questions[currentQuestionIndex];
  const userAnswer = session.answers[currentQuestionIndex];
  const feedback = session.answerFeedback[currentQuestionIndex];

  // Simple navigation functions
  const goToPrevious = () => {
    setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
  };

  const goToNext = () => {
    setCurrentQuestionIndex(prev => Math.min(totalQuestions - 1, prev + 1));
  };

  // Determine the appropriate return link based on quiz type using ternary
  const getReturnLink = () => (isCustom ? '/criar-teste' : '/trilhas');

  return (
    <div className="container mx-auto max-w-3xl rounded-lg border bg-white p-6">
      <div className="mb-4 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">{quiz.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Completado em {formatDate(session._creationTime)}
        </p>
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
            const isCorrect = i === question.correctAlternativeIndex;
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
              {feedback.isCorrect ? 'Resposta Correta!' : 'Resposta Incorreta'}
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

      {/* <div className="mt-8 flex justify-center">
        <Link href={getReturnLink()}>
          <Button>Voltar</Button>
        </Link>
      </div> */}
    </div>
  );
}
