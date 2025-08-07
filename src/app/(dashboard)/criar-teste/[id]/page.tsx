'use client';

import { useQuery } from 'convex-helpers/react/cache/hooks';
import { redirect, useParams } from 'next/navigation';
import { useEffect } from 'react';

import Quiz from '@/components/quiz/Quiz';

import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';

export default function QuizPage() {
  const { id } = useParams() as {
    id: Id<'customQuizzes'>;
  };

  // Fetch the quiz session using the new getActiveSession function
  const quizSession = useQuery(api.quizSessions.getActiveSession, {
    quizId: id,
  });

  // Redirect to results page if the quiz session is already complete
  useEffect(() => {
    if (quizSession?.isComplete) {
      // Redirect to results page
      redirect(`/quiz-results/${id}`);
    }
  }, [quizSession, id]);

  // Show loading state while fetching quiz data
  if (!quizSession) {
    console.log('Quiz session not found');
    return (
      <div className="flex h-screen items-center justify-center">
        Carregando quiz...
      </div>
    );
  }

  // Get the mode from the database instead of URL parameters
  const mode = quizSession.mode || 'study';

  return <Quiz quizId={id} mode={mode} />;
}
