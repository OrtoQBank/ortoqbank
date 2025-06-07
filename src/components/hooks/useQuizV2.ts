import { useMutation, useQuery } from 'convex/react';

import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { SafeQuestion } from '../../../convex/quizV2';
import { useBookmarks } from './useBookmarks';

export type SafeQuizV2 = {
  _id: Id<'presetQuizzes'> | Id<'customQuizzes'>;
  title: string;
  description?: string;
  questions: SafeQuestion[];
};

export function useQuizV2(
  quizId: Id<'presetQuizzes'> | Id<'customQuizzes'>,
  mode: 'study' | 'exam',
) {
  const quizData = useQuery(api.quizV2.getQuizData, { quizId });
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

export function useQuizzesV2() {
  const quizzes = useQuery(api.presetQuizzes.list);
  return quizzes;
}
