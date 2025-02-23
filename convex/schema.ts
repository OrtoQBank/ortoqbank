import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Users table
  users: defineTable({
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    clerkUserId: v.string(),
  }).index('by_clerkUserId', ['clerkUserId']),

  themes: defineTable({ name: v.string() }).index('by_name', ['name']),

  subthemes: defineTable({ name: v.string(), themeId: v.id('themes') }).index(
    'by_theme',
    ['themeId'],
  ),

  groups: defineTable({
    name: v.string(),
    subthemeId: v.id('subthemes'),
  }).index('by_subtheme', ['subthemeId']),

  // Tags table
  tags: defineTable({ name: v.string() }),

  questions: defineTable({
    title: v.string(),
    normalizedTitle: v.string(),
    questionText: v.object({ type: v.string(), content: v.array(v.any()) }),
    explanationText: v.object({ type: v.string(), content: v.array(v.any()) }),
    options: v.optional(v.array(v.object({ text: v.string() }))),
    optionsAsArray: v.optional(v.array(v.string())),
    correctOptionIndex: v.number(),
    themeId: v.id('themes'),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
    authorId: v.optional(v.id('users')),
    isPublic: v.optional(v.boolean()),
  })
    .index('by_title', ['normalizedTitle'])
    .searchIndex('search_by_title', { searchField: 'title' }),

  presetQuizzes: defineTable({
    name: v.string(),
    description: v.string(),
    questions: v.array(v.id('questions')),
    themeId: v.id('themes'),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
    isPublic: v.boolean(),
  }),

  customQuizzes: defineTable({
    name: v.string(),
    description: v.string(),
    questions: v.array(v.id('questions')),
    authorId: v.id('users'),
  }),

  quizSessions: defineTable({
    userId: v.id('users'),
    quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')),
    mode: v.union(v.literal('exam'), v.literal('study')),
    currentQuestionIndex: v.float64(),
    answers: v.array(v.float64()),
    answerFeedback: v.array(
      v.object({
        isCorrect: v.boolean(),
        explanation: v.optional(v.string()),
      }),
    ),
    isComplete: v.boolean(),
  })
    .index('by_quiz', ['quizId'])
    .index('by_user_quiz', ['userId', 'quizId', 'isComplete']),
});
