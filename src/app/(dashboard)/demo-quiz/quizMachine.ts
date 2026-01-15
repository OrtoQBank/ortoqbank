import { assign, createMachine } from 'xstate';

import { AlternativeIndex } from '@/components/quiz/types';

import { Id } from '../../../../convex/_generated/dataModel';

// Types for quiz data (matching the SafeQuestion type from convex/quiz.ts)
// Note: correctAlternativeIndex is NOT included in SafeQuestion for security
// The correct answer is only revealed after submission via answerFeedback
export interface QuizQuestion {
  _id: Id<'questions'>;
  questionTextString: string;
  alternatives: string[];
  questionCode?: string;
  title: string;
}

export interface QuizData {
  _id: Id<'presetQuizzes'> | Id<'customQuizzes'>;
  questions: QuizQuestion[];
}

export interface AnswerFeedback {
  isCorrect: boolean;
  explanation?: string;
  correctAlternative: AlternativeIndex;
}

// Machine context
export interface QuizContext {
  quizData: QuizData | null;
  currentQuestionIndex: number;
  selectedAnswer: AlternativeIndex | undefined;
  answers: Record<number, AlternativeIndex>;
  answerFeedback: Record<number, AnswerFeedback>;
  currentFeedback: AnswerFeedback | null;
  mode: 'study' | 'exam';
  error: string | null;
}

// Machine events
export type QuizEvent =
  | { type: 'LOAD'; data: QuizData }
  | { type: 'ERROR'; message: string }
  | { type: 'SELECT_ANSWER'; answer: AlternativeIndex }
  | { type: 'SUBMIT' }
  | { type: 'ANSWER_RESULT'; feedback: AnswerFeedback }
  | { type: 'NEXT' }
  | { type: 'PREVIOUS' }
  | { type: 'GO_TO_QUESTION'; index: number }
  | { type: 'COMPLETE' };

// Initial context factory
const createInitialContext = (mode: 'study' | 'exam'): QuizContext => ({
  quizData: null,
  currentQuestionIndex: 0,
  selectedAnswer: undefined,
  answers: {},
  answerFeedback: {},
  currentFeedback: null,
  mode,
  error: null,
});

// Create the quiz machine
export const createQuizMachine = (mode: 'study' | 'exam') =>
  createMachine({
    id: 'quiz',
    initial: 'loading',
    context: createInitialContext(mode),
    states: {
      loading: {
        on: {
          LOAD: {
            target: 'idle',
            actions: assign({
              quizData: ({ event }) => event.data,
              error: () => null,
            }),
          },
          ERROR: {
            target: 'error',
            actions: assign({
              error: ({ event }) => event.message,
            }),
          },
        },
      },

      error: {
        type: 'final',
      },

      idle: {
        entry: assign({
          // Restore previously selected answer and feedback when navigating
          selectedAnswer: ({ context }) => {
            const previousAnswer = context.answers[context.currentQuestionIndex];
            return previousAnswer;
          },
          currentFeedback: ({ context }) => {
            const previousFeedback =
              context.answerFeedback[context.currentQuestionIndex];
            return previousFeedback ?? null;
          },
        }),
        on: {
          SELECT_ANSWER: {
            target: 'selecting',
            actions: assign({
              selectedAnswer: ({ event }) => event.answer,
            }),
          },
          // Allow navigation only if the current question has been answered
          PREVIOUS: {
            guard: ({ context }) =>
              context.mode === 'study' && context.currentQuestionIndex > 0,
            actions: assign({
              currentQuestionIndex: ({ context }) =>
                context.currentQuestionIndex - 1,
              selectedAnswer: () => undefined,
              currentFeedback: () => null,
            }),
            target: 'idle',
            reenter: true,
          },
          NEXT: {
            guard: ({ context }) =>
              context.mode === 'study' &&
              context.answerFeedback[context.currentQuestionIndex] !==
                undefined &&
              context.currentQuestionIndex <
                (context.quizData?.questions.length ?? 0) - 1,
            actions: assign({
              currentQuestionIndex: ({ context }) =>
                context.currentQuestionIndex + 1,
              selectedAnswer: () => undefined,
              currentFeedback: () => null,
            }),
            target: 'idle',
            reenter: true,
          },
          GO_TO_QUESTION: {
            guard: ({ context, event }) =>
              context.mode === 'study' &&
              event.index >= 0 &&
              event.index < (context.quizData?.questions.length ?? 0),
            actions: assign({
              currentQuestionIndex: ({ event }) => event.index,
              selectedAnswer: () => undefined,
              currentFeedback: () => null,
            }),
            target: 'idle',
            reenter: true,
          },
          COMPLETE: {
            guard: ({ context }) => {
              const totalQuestions = context.quizData?.questions.length ?? 0;
              const answeredCount = Object.keys(context.answerFeedback).length;
              return answeredCount === totalQuestions;
            },
            target: 'completed',
          },
        },
      },

      selecting: {
        on: {
          SELECT_ANSWER: {
            actions: assign({
              selectedAnswer: ({ event }) => event.answer,
            }),
          },
          SUBMIT: {
            guard: ({ context }) => context.selectedAnswer !== undefined,
            target: 'submitting',
          },
          // Can go back to idle without selecting
          PREVIOUS: {
            guard: ({ context }) =>
              context.mode === 'study' && context.currentQuestionIndex > 0,
            actions: assign({
              currentQuestionIndex: ({ context }) =>
                context.currentQuestionIndex - 1,
              selectedAnswer: () => undefined,
              currentFeedback: () => null,
            }),
            target: 'idle',
          },
        },
      },

      submitting: {
        on: {
          ANSWER_RESULT: {
            target: 'showingFeedback',
            actions: assign({
              currentFeedback: ({ event }) => event.feedback,
              answers: ({ context }) => ({
                ...context.answers,
                [context.currentQuestionIndex]: context.selectedAnswer!,
              }),
              answerFeedback: ({ context, event }) => ({
                ...context.answerFeedback,
                [context.currentQuestionIndex]: event.feedback,
              }),
            }),
          },
        },
      },

      showingFeedback: {
        on: {
          NEXT: [
            {
              // If last question, go to completed
              guard: ({ context }) =>
                context.currentQuestionIndex ===
                (context.quizData?.questions.length ?? 0) - 1,
              target: 'completed',
            },
            {
              // Otherwise, go to next question
              actions: assign({
                currentQuestionIndex: ({ context }) =>
                  context.currentQuestionIndex + 1,
                selectedAnswer: () => undefined,
                currentFeedback: () => null,
              }),
              target: 'idle',
            },
          ],
          PREVIOUS: {
            guard: ({ context }) =>
              context.mode === 'study' && context.currentQuestionIndex > 0,
            actions: assign({
              currentQuestionIndex: ({ context }) =>
                context.currentQuestionIndex - 1,
              selectedAnswer: () => undefined,
              currentFeedback: () => null,
            }),
            target: 'idle',
          },
          GO_TO_QUESTION: {
            guard: ({ context, event }) =>
              context.mode === 'study' &&
              event.index >= 0 &&
              event.index < (context.quizData?.questions.length ?? 0),
            actions: assign({
              currentQuestionIndex: ({ event }) => event.index,
              selectedAnswer: () => undefined,
              currentFeedback: () => null,
            }),
            target: 'idle',
          },
          COMPLETE: {
            target: 'completed',
          },
        },
      },

      completed: {
        type: 'final',
      },
    },
  });

// Helper to check if we're in a specific state
export const isInState = (
  state: { value: string },
  stateName: string,
): boolean => {
  return state.value === stateName;
};
