import { useMutation, useQuery } from 'convex/react';

import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { SafeQuestion } from '../../../convex/quiz';
import { useBookmarks } from './useBookmarks';

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
  //using new function
  const progress = useQuery(api.quizSessions.getActiveSession, { quizId });

  // Get bookmark statuses for all questions in this quiz
  const questionIds = quizData?.questions.map(q => q._id);
  const { bookmarkStatuses, toggleBookmark } = useBookmarks(questionIds);

  const startQuiz = useMutation(api.quizSessions.startQuizSession);
  const submitAnswer = useMutation(api.quizSessions.submitAnswerAndProgress);
  const completeQuiz = useMutation(api.quizSessions.completeQuizSession);

  return {
    quizData,
    progress,
    bookmarkStatuses,
    toggleBookmark,
    startQuiz: () => startQuiz({ quizId, mode }),
    submitAnswer: (selectedAlternativeIndex: 0 | 1 | 2 | 3) =>
      submitAnswer({ quizId, selectedAlternativeIndex }),
    completeQuiz: () => completeQuiz({ quizId }),
    isLoading: quizData === undefined || progress === undefined,
  };
}

export function useQuizzes() {
  // Note: This returns all preset quizzes; tenant filtering is not applied here
  // as quizzes are fetched by ID in most cases
  const quizzes = useQuery(api.presetQuizzes.list, {});
  return quizzes;
}
