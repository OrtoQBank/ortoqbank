/**
 * Mock Factories
 *
 * Factory functions to create mock data for testing.
 * These help ensure consistent test data structure across tests.
 */

import { Id } from '../../convex/_generated/dataModel';

/**
 * Creates a mock user object
 */
export function createMockUser(overrides: Partial<any> = {}) {
  return {
    id: 'test-user-123',
    email: 'test@example.com',
    clerkUserId: 'clerk_test_123',
    paid: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Creates a mock theme object
 */
export function createMockTheme(overrides: Partial<any> = {}) {
  return {
    _id: 'theme1' as Id<'themes'>,
    _creationTime: Date.now(),
    name: 'Test Theme',
    ...overrides,
  };
}

/**
 * Creates a mock subtheme object
 */
export function createMockSubtheme(overrides: Partial<any> = {}) {
  return {
    _id: 'subtheme1' as Id<'subthemes'>,
    _creationTime: Date.now(),
    name: 'Test Subtheme',
    themeId: 'theme1' as Id<'themes'>,
    ...overrides,
  };
}

/**
 * Creates a mock group object
 */
export function createMockGroup(overrides: Partial<any> = {}) {
  return {
    _id: 'group1' as Id<'groups'>,
    _creationTime: Date.now(),
    name: 'Test Group',
    subthemeId: 'subtheme1' as Id<'subthemes'>,
    ...overrides,
  };
}

/**
 * Creates a mock question object
 */
export function createMockQuestion(overrides: Partial<any> = {}) {
  return {
    _id: 'question1' as Id<'questions'>,
    _creationTime: Date.now(),
    title: 'Test Question',
    questionTextString: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'What is the test question?' }],
        },
      ],
    }),
    alternatives: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAlternativeIndex: 0,
    explanationTextString: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'This is the explanation.' }],
        },
      ],
    }),
    themeId: 'theme1' as Id<'themes'>,
    subthemeId: 'subtheme1' as Id<'subthemes'>,
    groupId: 'group1' as Id<'groups'>,
    ...overrides,
  };
}

/**
 * Creates a mock preset quiz object
 */
export function createMockPresetQuiz(overrides: Partial<any> = {}) {
  return {
    _id: 'preset-quiz1' as Id<'presetQuizzes'>,
    _creationTime: Date.now(),
    name: 'Test Preset Quiz',
    description: 'A test preset quiz',
    category: 'trilha' as const,
    questions: ['question1' as Id<'questions'>],
    themeId: 'theme1' as Id<'themes'>,
    isPublic: true,
    ...overrides,
  };
}

/**
 * Creates a mock custom quiz object
 */
export function createMockCustomQuiz(overrides: Partial<any> = {}) {
  return {
    _id: 'custom-quiz1' as Id<'customQuizzes'>,
    _creationTime: Date.now(),
    name: 'Test Custom Quiz',
    description: 'A test custom quiz',
    userId: 'test-user-123',
    testMode: 'study' as const,
    questionMode: 'all' as const,
    numQuestions: 30,
    selectedThemes: [] as Id<'themes'>[],
    selectedSubthemes: [] as Id<'subthemes'>[],
    selectedGroups: [] as Id<'groups'>[],
    ...overrides,
  };
}

/**
 * Creates a mock quiz session object
 */
export function createMockQuizSession(overrides: Partial<any> = {}) {
  return {
    _id: 'session1' as Id<'quizSessions'>,
    _creationTime: Date.now(),
    userId: 'test-user-123',
    quizId: 'quiz1',
    quizType: 'preset' as const,
    testMode: 'study' as const,
    currentQuestionIndex: 0,
    answers: [] as number[],
    answerFeedback: [] as Array<{ isCorrect: boolean; explanation?: string }>,
    isCompleted: false,
    score: 0,
    ...overrides,
  };
}

/**
 * Creates a mock completed quiz session with results
 */
export function createMockCompletedSession(
  questionCount: number = 3,
  correctCount: number = 2,
) {
  const answers: number[] = [];
  const answerFeedback: Array<{ isCorrect: boolean; explanation: string }> = [];

  for (let i = 0; i < questionCount; i++) {
    answers.push(i % 2); // Alternate answers
    answerFeedback.push({
      isCorrect: i < correctCount,
      explanation: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: `Explanation for question ${i + 1}` },
            ],
          },
        ],
      }),
    });
  }

  return createMockQuizSession({
    answers,
    answerFeedback,
    isCompleted: true,
    score: Math.round((correctCount / questionCount) * 100),
  });
}

/**
 * Creates mock hierarchical data (themes, subthemes, groups)
 */
export function createMockHierarchicalData() {
  const theme1 = createMockTheme({ _id: 'theme1', name: 'Ortopedia' });
  const theme2 = createMockTheme({ _id: 'theme2', name: 'Traumatologia' });

  const sub1 = createMockSubtheme({
    _id: 'sub1',
    name: 'Mão',
    themeId: theme1._id,
  });
  const sub2 = createMockSubtheme({
    _id: 'sub2',
    name: 'Joelho',
    themeId: theme2._id,
  });

  const group1 = createMockGroup({
    _id: 'group1',
    name: 'Fraturas',
    subthemeId: sub1._id,
  });
  const group2 = createMockGroup({
    _id: 'group2',
    name: 'Ligamentos',
    subthemeId: sub2._id,
  });

  return {
    themes: [theme1, theme2],
    subthemes: [sub1, sub2],
    groups: [group1, group2],
  };
}

/**
 * Creates mock user stats/counts for quiz creation
 */
export function createMockUserCounts(overrides: Partial<any> = {}) {
  return {
    global: {
      totalAnswered: 50,
      totalIncorrect: 20,
      totalBookmarked: 10,
    },
    byTheme: {
      theme1: { answered: 25, incorrect: 10, bookmarked: 5 },
      theme2: { answered: 25, incorrect: 10, bookmarked: 5 },
    },
    bySubtheme: {
      sub1: { answered: 15, incorrect: 6, bookmarked: 3 },
      sub2: { answered: 10, incorrect: 4, bookmarked: 2 },
    },
    byGroup: {
      group1: { answered: 8, incorrect: 3, bookmarked: 2 },
      group2: { answered: 7, incorrect: 3, bookmarked: 1 },
    },
    ...overrides,
  };
}

/**
 * Creates a mock quiz with questions for results display
 */
export function createMockQuizWithQuestions(questionCount: number = 3) {
  const questions = Array.from({ length: questionCount }, (_, i) =>
    createMockQuestion({
      _id: `question${i + 1}` as Id<'questions'>,
      title: `Question ${i + 1}`,
      questionTextString: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: `What is question ${i + 1}?` }],
          },
        ],
      }),
      alternatives: ['A', 'B', 'C', 'D'],
      correctAlternativeIndex: i % 4,
    }),
  );

  return {
    _id: 'quiz1',
    name: 'Test Quiz with Questions',
    description: 'A quiz with multiple questions',
    questions,
  };
}
