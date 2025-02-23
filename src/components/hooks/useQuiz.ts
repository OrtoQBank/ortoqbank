import { useMutation, useQuery } from 'convex/react';

import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { SafeQuestion } from '../../../convex/quiz';

export type SafeQuiz = {
  _id: Id<'presetQuizzes'>;
  title: string;
  description?: string;
  questions: SafeQuestion[];
};

export function useQuiz(
  quizId: Id<'presetQuizzes'> | Id<'customQuizzes'>,
  mode: 'study' | 'exam',
) {
  const quizData = useQuery(api.quiz.getQuizData, { quizId });
  const progress = useQuery(api.quizSessions.getCurrentSession, { quizId });

  const startQuiz = useMutation(api.quizSessions.startQuizSession);
  const submitAnswer = useMutation(api.quizSessions.submitAnswerAndProgress);
  const completeQuiz = useMutation(api.quizSessions.completeQuizSession);

  return {
    quizData,
    progress,
    startQuiz: () => startQuiz({ quizId, mode }),
    submitAnswer: (selectedOptionIndex: 0 | 1 | 2 | 3) =>
      submitAnswer({ quizId, selectedOptionIndex }),
    completeQuiz: () => completeQuiz({ quizId }),
    isLoading: quizData === undefined || progress === undefined,
  };
}

export function useQuizzes() {
  const quizzes = useQuery(api.presetQuizzes.list);
  return quizzes;
}
