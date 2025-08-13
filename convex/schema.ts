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
    // Payment fields from Mercado Pago
    paid: v.optional(v.boolean()),
    paymentId: v.optional(v.union(v.string(), v.number())),
    testeId: v.optional(v.string()),
    paymentDate: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    termsAccepted: v.optional(v.boolean()),
  })
    .index('by_clerkUserId', ['clerkUserId'])
    .index('by_paid', ['paid']),

  themes: defineTable({
    name: v.string(),
    prefix: v.optional(v.string()),
    displayOrder: v.optional(v.number()),
  }).index('by_name', ['name']),

  subthemes: defineTable({
    name: v.string(),
    themeId: v.id('themes'),
    prefix: v.optional(v.string()),
  }).index('by_theme', ['themeId']),

  groups: defineTable({
    name: v.string(),
    subthemeId: v.id('subthemes'),
    prefix: v.optional(v.string()),
  }).index('by_subtheme', ['subthemeId']),

  // Tags table
  tags: defineTable({ name: v.string() }),

  questions: defineTable({
    title: v.string(),
    normalizedTitle: v.string(),
    questionCode: v.optional(v.string()),
    orderedNumberId: v.optional(v.number()),
    questionText: v.optional(v.any()),
    explanationText: v.optional(v.any()),
    questionTextString: v.string(),
    explanationTextString: v.string(),
    contentMigrated: v.optional(v.boolean()),
    alternatives: v.array(v.string()),
    correctAlternativeIndex: v.number(),
    themeId: v.id('themes'),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
    authorId: v.optional(v.id('users')),
    isPublic: v.optional(v.boolean()),
    // Legacy taxonomy fields (for migration cleanup only)
    TaxThemeId: v.optional(v.string()),
    TaxSubthemeId: v.optional(v.string()),
    TaxGroupId: v.optional(v.string()),
    taxonomyPathIds: v.optional(v.array(v.string())),
  })
    .index('by_title', ['normalizedTitle'])
    .index('by_theme', ['themeId'])
    .index('by_subtheme', ['subthemeId'])
    .index('by_group', ['groupId'])
    .searchIndex('search_by_title', { searchField: 'title' })
    .searchIndex('search_by_code', { searchField: 'questionCode' }),

  presetQuizzes: defineTable({
    name: v.string(),
    description: v.string(),
    category: v.union(v.literal('trilha'), v.literal('simulado')),
    questions: v.array(v.id('questions')),
    subcategory: v.optional(v.string()),
    // Current taxonomy fields
    themeId: v.optional(v.id('themes')),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
    isPublic: v.boolean(),
    displayOrder: v.optional(v.number()),
    // Legacy taxonomy fields (for migration cleanup only)
    TaxThemeId: v.optional(v.string()),
    TaxSubthemeId: v.optional(v.string()),
    TaxGroupId: v.optional(v.string()),
    taxonomyPathIds: v.optional(v.array(v.string())),
  })
    .index('by_theme', ['themeId'])
    .index('by_subtheme', ['subthemeId'])
    .index('by_group', ['groupId'])
    .searchIndex('search_by_name', { searchField: 'name' }),

  customQuizzes: defineTable({
    name: v.string(),
    description: v.string(),
    questions: v.array(v.id('questions')),
    authorId: v.id('users'),
    testMode: v.union(v.literal('exam'), v.literal('study')),
    questionMode: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
    // Current taxonomy fields
    selectedThemes: v.optional(v.array(v.id('themes'))),
    selectedSubthemes: v.optional(v.array(v.id('subthemes'))),
    selectedGroups: v.optional(v.array(v.id('groups'))),
    // Legacy taxonomy fields (for migration cleanup only)
    selectedTaxThemes: v.optional(v.array(v.string())),
    selectedTaxSubthemes: v.optional(v.array(v.string())),
    selectedTaxGroups: v.optional(v.array(v.string())),
    taxonomyPathIds: v.optional(v.array(v.string())),
  }).searchIndex('search_by_name', { searchField: 'name' }),

  quizSessions: defineTable({
    userId: v.id('users'),
    quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')),
    mode: v.union(v.literal('exam'), v.literal('study')),
    currentQuestionIndex: v.number(),
    answers: v.array(v.number()),
    answerFeedback: v.array(
      v.object({
        isCorrect: v.boolean(),
        // Update explanation field to prefer string format
        explanation: v.union(
          v.string(), // String format (preferred)
          v.object({ type: v.string(), content: v.array(v.any()) }), // Legacy object format
        ),
        correctAlternative: v.optional(v.number()),
      }),
    ),
    isComplete: v.boolean(),
  }).index('by_user_quiz', ['userId', 'quizId', 'isComplete']),

  userBookmarks: defineTable({
    userId: v.id('users'),
    questionId: v.id('questions'),
    // Taxonomy fields for aggregates
    themeId: v.optional(v.id('themes')),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
  })
    .index('by_user_question', ['userId', 'questionId'])
    .index('by_user', ['userId'])
    .index('by_question', ['questionId']),

  // Table to track user statistics for questions
  userQuestionStats: defineTable({
    userId: v.id('users'),
    questionId: v.id('questions'),
    hasAnswered: v.boolean(), // Track if user has answered at least once
    isIncorrect: v.boolean(), // Track if the most recent answer was incorrect
    answeredAt: v.number(), // Timestamp for when the question was last answered
    // Taxonomy fields for aggregates
    themeId: v.optional(v.id('themes')),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
  })
    .index('by_user_question', ['userId', 'questionId'])
    .index('by_user', ['userId'])
    .index('by_user_incorrect', ['userId', 'isIncorrect'])
    .index('by_user_answered', ['userId', 'hasAnswered']),

  // Table for pre-computed user statistics counts (Performance optimization)
  userStatsCounts: defineTable({
    userId: v.id('users'),

    // Global counts
    totalAnswered: v.number(),
    totalIncorrect: v.number(),
    totalBookmarked: v.number(),

    // By theme counts (using Records for flexibility)
    answeredByTheme: v.record(v.id('themes'), v.number()),
    incorrectByTheme: v.record(v.id('themes'), v.number()),
    bookmarkedByTheme: v.record(v.id('themes'), v.number()),

    // By subtheme counts
    answeredBySubtheme: v.record(v.id('subthemes'), v.number()),
    incorrectBySubtheme: v.record(v.id('subthemes'), v.number()),
    bookmarkedBySubtheme: v.record(v.id('subthemes'), v.number()),

    // By group counts
    answeredByGroup: v.record(v.id('groups'), v.number()),
    incorrectByGroup: v.record(v.id('groups'), v.number()),
    bookmarkedByGroup: v.record(v.id('groups'), v.number()),

    lastUpdated: v.number(),
  }).index('by_user', ['userId']),

  // Admin-managed coupons for checkout
  coupons: defineTable({
    code: v.string(), // store uppercase
    type: v.union(
      v.literal('percentage'),
      v.literal('fixed'),
      v.literal('fixed_price'),
    ),
    value: v.number(),
    description: v.string(),
    active: v.boolean(),
    validFrom: v.optional(v.number()), // epoch ms
    validUntil: v.optional(v.number()), // epoch ms
  }).index('by_code', ['code']),

  // Event tables for special weekend exams (simulado-nacional-2025)
  eventUsers: defineTable({
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    phone: v.optional(v.string()),
    university: v.optional(v.string()),
    graduationYear: v.optional(v.number()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    socialMedia: v.optional(
      v.object({
        instagram: v.optional(v.string()),
        linkedin: v.optional(v.string()),
        whatsapp: v.optional(v.string()),
      }),
    ),
    eventName: v.string(), // "simulado-nacional-2025"
    registeredAt: v.number(),
    hasStartedExam: v.optional(v.boolean()),
    examStartedAt: v.optional(v.number()),
    hasCompletedExam: v.optional(v.boolean()),
    examCompletedAt: v.optional(v.number()),
  })
    .index('by_email_event', ['email', 'eventName'])
    .index('by_event', ['eventName'])
    .index('by_completed', ['eventName', 'hasCompletedExam']),

  eventScores: defineTable({
    eventUserId: v.id('eventUsers'),
    eventName: v.string(), // "simulado-nacional-2025"
    score: v.number(), // Number of correct answers
    totalQuestions: v.number(),
    percentage: v.number(), // score/totalQuestions * 100
    timeSpentMinutes: v.number(), // Time taken in minutes
    answers: v.array(v.number()), // User's answers
    questionIds: v.array(v.id('eventQuestions')), // Questions in the exam (now eventQuestions)
    completedAt: v.number(),
    isWinner: v.optional(v.boolean()), // To mark the winner
  })
    .index('by_event_score', ['eventName', 'score'])
    .index('by_event_time', ['eventName', 'timeSpentMinutes'])
    .index('by_event_user', ['eventUserId', 'eventName'])
    .index('by_event_leaderboard', [
      'eventName',
      'percentage',
      'timeSpentMinutes',
    ]),

  // Event-specific questions (isolated from main app)
  eventQuestions: defineTable({
    eventName: v.string(), // "simulado-nacional-2025"
    title: v.string(),
    questionTextString: v.string(),
    explanationTextString: v.string(),
    alternatives: v.array(v.string()),
    correctAlternativeIndex: v.number(),
    questionCode: v.optional(v.string()),
    themeId: v.optional(v.id('themes')), // Reference to main theme if needed
    difficulty: v.optional(
      v.union(v.literal('easy'), v.literal('medium'), v.literal('hard')),
    ),
    tags: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()), // Can disable questions
  })
    .index('by_event', ['eventName'])
    .index('by_event_active', ['eventName', 'isActive'])
    .searchIndex('search_by_title', { searchField: 'title' }),

  eventQuizSessions: defineTable({
    eventUserId: v.id('eventUsers'),
    eventName: v.string(),
    questions: v.array(v.id('eventQuestions')), // Now references eventQuestions
    currentQuestionIndex: v.number(),
    answers: v.array(v.number()),
    answerFeedback: v.array(
      v.object({
        isCorrect: v.boolean(),
        explanation: v.string(),
        correctAlternative: v.optional(v.number()),
      }),
    ),
    startedAt: v.number(),
    expiresAt: v.number(), // 4 hours from start
    isComplete: v.boolean(),
    isExpired: v.optional(v.boolean()),
  })
    .index('by_event_user', ['eventUserId', 'eventName'])
    .index('by_expiry', ['expiresAt'])
    .index('by_event_active', ['eventName', 'isComplete']),
});
