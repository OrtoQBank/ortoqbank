// ============================================================================
// CUSTOM QUIZ CREATION WORKFLOW (V2 - Durable Workflow)
// ============================================================================
//
// This workflow provides:
// - Real-time progress tracking via quizCreationJobs table
// - Optimized data passing (pre-computed hierarchy maps from frontend)
// - Proper error recovery and idempotent steps
// - Production-safe implementation alongside existing create mutation
//
// ============================================================================

import { WorkflowManager } from '@convex-dev/workflow';
import { v } from 'convex/values';

import { api, components, internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { getCurrentUserOrThrow } from './users';

// Question mode type for the workflow
type QuestionMode = 'all' | 'unanswered' | 'incorrect' | 'bookmarked';

// Maximum number of questions allowed in a custom quiz
export const MAX_QUESTIONS = 120;

// Create the workflow manager (reuse from aggregateWorkflows)
export const workflow = new WorkflowManager(components.workflow);

// =============================================================================
// JOB STATUS TYPES
// =============================================================================

type JobStatus =
  | 'pending'
  | 'collecting_questions'
  | 'applying_filters'
  | 'selecting_questions'
  | 'creating_quiz'
  | 'completed'
  | 'failed';

// =============================================================================
// PUBLIC QUERIES - Job Status
// =============================================================================

/**
 * Get the current status of a quiz creation job
 */
export const getJobStatus = query({
  args: { jobId: v.id('quizCreationJobs') },
  returns: v.union(
    v.object({
      _id: v.id('quizCreationJobs'),
      status: v.string(),
      progress: v.number(),
      progressMessage: v.optional(v.string()),
      quizId: v.optional(v.id('customQuizzes')),
      questionCount: v.optional(v.number()),
      error: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    return {
      _id: job._id,
      status: job.status,
      progress: job.progress,
      progressMessage: job.progressMessage,
      quizId: job.quizId,
      questionCount: job.questionCount,
      error: job.error,
      errorMessage: job.errorMessage,
    };
  },
});

/**
 * Get the most recent job for the current user
 */
export const getLatestJob = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id('quizCreationJobs'),
      status: v.string(),
      progress: v.number(),
      progressMessage: v.optional(v.string()),
      quizId: v.optional(v.id('customQuizzes')),
      questionCount: v.optional(v.number()),
      error: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async ctx => {
    const user = await getCurrentUserOrThrow(ctx);
    const job = await ctx.db
      .query('quizCreationJobs')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .order('desc')
      .first();

    if (!job) return null;

    return {
      _id: job._id,
      status: job.status,
      progress: job.progress,
      progressMessage: job.progressMessage,
      quizId: job.quizId,
      questionCount: job.questionCount,
      error: job.error,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
    };
  },
});

// =============================================================================
// INTERNAL MUTATIONS - Progress Updates
// =============================================================================

/**
 * Update job progress
 */
export const updateJobProgress = internalMutation({
  args: {
    jobId: v.id('quizCreationJobs'),
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('collecting_questions'),
        v.literal('applying_filters'),
        v.literal('selecting_questions'),
        v.literal('creating_quiz'),
        v.literal('completed'),
        v.literal('failed'),
      ),
    ),
    progress: v.optional(v.number()),
    progressMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: Partial<{
      status: JobStatus;
      progress: number;
      progressMessage: string;
    }> = {};

    if (args.status) updates.status = args.status;
    if (args.progress !== undefined) updates.progress = args.progress;
    if (args.progressMessage) updates.progressMessage = args.progressMessage;

    await ctx.db.patch(args.jobId, updates);
    return null;
  },
});

/**
 * Mark job as completed
 */
export const markJobCompleted = internalMutation({
  args: {
    jobId: v.id('quizCreationJobs'),
    quizId: v.id('customQuizzes'),
    questionCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: 'completed',
      progress: 100,
      progressMessage: 'Quiz criado com sucesso!',
      quizId: args.quizId,
      questionCount: args.questionCount,
      completedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Mark job as failed
 */
export const markJobFailed = internalMutation({
  args: {
    jobId: v.id('quizCreationJobs'),
    error: v.string(),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: 'failed',
      error: args.error,
      errorMessage: args.errorMessage,
      completedAt: Date.now(),
    });
    return null;
  },
});

// =============================================================================
// INTERNAL QUERIES - Data Fetching
// =============================================================================

/**
 * Get job input data
 */
export const getJobInput = internalQuery({
  args: { jobId: v.id('quizCreationJobs') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error('Job not found');
    return {
      userId: job.userId,
      tenantId: job.tenantId,
      input: job.input,
    };
  },
});

// =============================================================================
// INTERNAL MUTATIONS - Workflow Steps (Paginated for 15-second safety)
// =============================================================================

// Batch size for paginated operations (safe for 15-second limit)
const PAGINATION_BATCH_SIZE = 500;

/**
 * Collect question IDs by hierarchy filters in paginated batches.
 * Used when hierarchy filters are applied (must get ALL matching questions).
 */
export const collectFilteredQuestionsBatch = internalMutation({
  args: {
    jobId: v.id('quizCreationJobs'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.number(),
    // Hierarchy filters
    selectedThemes: v.array(v.id('themes')),
    selectedSubthemes: v.array(v.id('subthemes')),
    selectedGroups: v.array(v.id('groups')),
    // Pre-computed hierarchy maps
    groupToSubtheme: v.record(v.id('groups'), v.id('subthemes')),
    subthemeToTheme: v.record(v.id('subthemes'), v.id('themes')),
    // Track which hierarchy level we're processing
    currentLevel: v.union(
      v.literal('groups'),
      v.literal('subthemes'),
      v.literal('themes'),
    ),
    currentIndex: v.number(), // Index within the current level's array
  },
  returns: v.object({
    questionIds: v.array(v.id('questions')),
    nextCursor: v.union(v.string(), v.null()),
    nextLevel: v.union(
      v.literal('groups'),
      v.literal('subthemes'),
      v.literal('themes'),
      v.literal('done'),
    ),
    nextIndex: v.number(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const questionIds: Id<'questions'>[] = [];

    // Compute overrides for hierarchy
    const overriddenSubthemes = new Set<Id<'subthemes'>>();
    const overriddenThemes = new Set<Id<'themes'>>();

    for (const groupId of args.selectedGroups) {
      const subthemeId = args.groupToSubtheme[groupId];
      if (subthemeId) {
        overriddenSubthemes.add(subthemeId);
        const themeId = args.subthemeToTheme[subthemeId];
        if (themeId) overriddenThemes.add(themeId);
      }
    }

    for (const subthemeId of args.selectedSubthemes) {
      const themeId = args.subthemeToTheme[subthemeId];
      if (themeId) overriddenThemes.add(themeId);
    }

    let currentLevel: 'groups' | 'subthemes' | 'themes' | 'done' =
      args.currentLevel;
    let currentIndex = args.currentIndex;
    let nextCursor: string | null = args.cursor;

    // Process based on current level
    if (
      currentLevel === 'groups' &&
      currentIndex < args.selectedGroups.length
    ) {
      const groupId = args.selectedGroups[currentIndex];
      const result = await ctx.db
        .query('questions')
        .withIndex('by_group', q => q.eq('groupId', groupId))
        .paginate({ cursor: nextCursor, numItems: args.batchSize });

      for (const doc of result.page) {
        questionIds.push(doc._id);
      }

      if (result.isDone) {
        // Move to next group or next level
        currentIndex++;
        nextCursor = null;
        if (currentIndex >= args.selectedGroups.length) {
          currentLevel = 'subthemes';
          currentIndex = 0;
        }
      } else {
        nextCursor = result.continueCursor;
      }
    } else if (
      currentLevel === 'subthemes' &&
      currentIndex < args.selectedSubthemes.length
    ) {
      const subthemeId = args.selectedSubthemes[currentIndex];

      // Skip if overridden by groups
      if (overriddenSubthemes.has(subthemeId)) {
        currentIndex++;
        if (currentIndex >= args.selectedSubthemes.length) {
          currentLevel = 'themes';
          currentIndex = 0;
        }
      } else {
        const result = await ctx.db
          .query('questions')
          .withIndex('by_subtheme', q => q.eq('subthemeId', subthemeId))
          .paginate({ cursor: nextCursor, numItems: args.batchSize });

        for (const doc of result.page) {
          questionIds.push(doc._id);
        }

        if (result.isDone) {
          currentIndex++;
          nextCursor = null;
          if (currentIndex >= args.selectedSubthemes.length) {
            currentLevel = 'themes';
            currentIndex = 0;
          }
        } else {
          nextCursor = result.continueCursor;
        }
      }
    } else if (
      currentLevel === 'themes' &&
      currentIndex < args.selectedThemes.length
    ) {
      const themeId = args.selectedThemes[currentIndex];

      // Skip if overridden by subthemes
      if (overriddenThemes.has(themeId)) {
        currentIndex++;
      } else {
        const result = await ctx.db
          .query('questions')
          .withIndex('by_theme', q => q.eq('themeId', themeId))
          .paginate({ cursor: nextCursor, numItems: args.batchSize });

        for (const doc of result.page) {
          questionIds.push(doc._id);
        }

        if (result.isDone) {
          currentIndex++;
          nextCursor = null;
        } else {
          nextCursor = result.continueCursor;
        }
      }
    }

    // Determine if we're done
    const isDone =
      (currentLevel === 'groups' &&
        currentIndex >= args.selectedGroups.length &&
        args.selectedSubthemes.length === 0 &&
        args.selectedThemes.length === 0) ||
      (currentLevel === 'subthemes' &&
        currentIndex >= args.selectedSubthemes.length &&
        args.selectedThemes.length === 0) ||
      (currentLevel === 'themes' && currentIndex >= args.selectedThemes.length);

    const nextLevel: 'groups' | 'subthemes' | 'themes' | 'done' = isDone
      ? 'done'
      : currentLevel;

    return {
      questionIds,
      nextCursor,
      nextLevel,
      nextIndex: currentIndex,
      isDone,
    };
  },
});

/**
 * Get user's answered question IDs (for unanswered mode filtering).
 * Paginated to handle users with many answered questions.
 */
export const getAnsweredQuestionIdsBatch = internalMutation({
  args: {
    userId: v.id('users'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.number(),
  },
  returns: v.object({
    questionIds: v.array(v.id('questions')),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_answered', q =>
        q.eq('userId', args.userId).eq('hasAnswered', true),
      )
      .paginate({ cursor: args.cursor, numItems: args.batchSize });

    return {
      questionIds: result.page.map(stat => stat.questionId),
      nextCursor: result.isDone ? null : result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Get user's incorrect question IDs.
 * Paginated to handle users with many incorrect answers.
 */
export const getIncorrectQuestionIdsBatch = internalMutation({
  args: {
    userId: v.id('users'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.number(),
  },
  returns: v.object({
    questionIds: v.array(v.id('questions')),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_incorrect', q =>
        q.eq('userId', args.userId).eq('isIncorrect', true),
      )
      .paginate({ cursor: args.cursor, numItems: args.batchSize });

    return {
      questionIds: result.page.map(stat => stat.questionId),
      nextCursor: result.isDone ? null : result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Get user's bookmarked question IDs.
 * Paginated to handle users with many bookmarks.
 */
export const getBookmarkedQuestionIdsBatch = internalMutation({
  args: {
    userId: v.id('users'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.number(),
  },
  returns: v.object({
    questionIds: v.array(v.id('questions')),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .paginate({ cursor: args.cursor, numItems: args.batchSize });

    return {
      questionIds: result.page.map(bookmark => bookmark.questionId),
      nextCursor: result.isDone ? null : result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Sample random questions and filter by mode (for no-filter scenarios).
 * Uses aggregate-based random selection for O(log n) performance.
 */
export const sampleAndFilterByMode = internalMutation({
  args: {
    userId: v.id('users'),
    questionMode: v.union(
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
    sampleSize: v.number(),
    targetCount: v.number(),
    excludeIds: v.array(v.id('questions')), // Already collected IDs
  },
  returns: v.object({
    validIds: v.array(v.id('questions')),
    exhausted: v.boolean(), // True if we've checked the whole pool
  }),
  handler: async (ctx, args) => {
    const excludeSet = new Set(args.excludeIds);

    // Get a random sample from the global pool
    const randomSample: Id<'questions'>[] = await ctx.runQuery(
      api.aggregateQueries.getRandomQuestions,
      { count: args.sampleSize },
    );

    // Filter out already-collected IDs
    const candidateIds = randomSample.filter(id => !excludeSet.has(id));

    if (candidateIds.length === 0) {
      return { validIds: [], exhausted: true };
    }

    // Check each candidate against the mode filter
    const validIds: Id<'questions'>[] = [];

    switch (args.questionMode) {
    case 'unanswered': {
      // For unanswered: check userQuestionStats for each candidate
      for (const questionId of candidateIds) {
        if (validIds.length >= args.targetCount) break;

        const stat = await ctx.db
          .query('userQuestionStats')
          .withIndex('by_user_question', q =>
            q.eq('userId', args.userId).eq('questionId', questionId),
          )
          .first();

        // If no stat exists or hasAnswered is false, it's unanswered
        if (!stat || !stat.hasAnswered) {
          validIds.push(questionId);
        }
      }
    
    break;
    }
    case 'incorrect': {
      // For incorrect: check if question is in user's incorrect stats
      for (const questionId of candidateIds) {
        if (validIds.length >= args.targetCount) break;

        const stat = await ctx.db
          .query('userQuestionStats')
          .withIndex('by_user_question', q =>
            q.eq('userId', args.userId).eq('questionId', questionId),
          )
          .first();

        if (stat?.isIncorrect) {
          validIds.push(questionId);
        }
      }
    
    break;
    }
    case 'bookmarked': {
      // For bookmarked: check if question is in user's bookmarks
      for (const questionId of candidateIds) {
        if (validIds.length >= args.targetCount) break;

        const bookmark = await ctx.db
          .query('userBookmarks')
          .withIndex('by_user_question', q =>
            q.eq('userId', args.userId).eq('questionId', questionId),
          )
          .first();

        if (bookmark) {
          validIds.push(questionId);
        }
      }
    
    break;
    }
    // No default
    }

    // Exhausted if we checked all candidates but didn't find enough
    const exhausted = candidateIds.length < args.sampleSize;

    return { validIds, exhausted };
  },
});

/**
 * Filter question IDs by hierarchy in batches.
 * Used after collecting mode-filtered IDs to apply hierarchy filters.
 */
export const filterIdsByHierarchyBatch = internalMutation({
  args: {
    questionIds: v.array(v.id('questions')),
    selectedThemes: v.array(v.id('themes')),
    selectedSubthemes: v.array(v.id('subthemes')),
    selectedGroups: v.array(v.id('groups')),
    groupToSubtheme: v.record(v.id('groups'), v.id('subthemes')),
    subthemeToTheme: v.record(v.id('subthemes'), v.id('themes')),
  },
  returns: v.object({
    validIds: v.array(v.id('questions')),
  }),
  handler: async (ctx, args) => {
    // Create sets for O(1) lookup
    const groupSet = new Set(args.selectedGroups);
    const subthemeSet = new Set(args.selectedSubthemes);
    const themeSet = new Set(args.selectedThemes);

    // Compute overrides
    const overriddenSubthemes = new Set<Id<'subthemes'>>();
    const overriddenThemes = new Set<Id<'themes'>>();

    for (const groupId of args.selectedGroups) {
      const subthemeId = args.groupToSubtheme[groupId];
      if (subthemeId) {
        overriddenSubthemes.add(subthemeId);
        const themeId = args.subthemeToTheme[subthemeId];
        if (themeId) overriddenThemes.add(themeId);
      }
    }

    for (const subthemeId of args.selectedSubthemes) {
      const themeId = args.subthemeToTheme[subthemeId];
      if (themeId) overriddenThemes.add(themeId);
    }

    const validIds: Id<'questions'>[] = [];

    // Process all IDs (batch size is controlled by caller)
    const questions = await Promise.all(
      args.questionIds.map(id => ctx.db.get(id)),
    );

    for (const question of questions) {
      if (!question) continue;

      let matches = false;

      // Priority 1: Check groups
      if (question.groupId && groupSet.has(question.groupId)) {
        matches = true;
      }
      // Priority 2: Check subthemes (only if not overridden by groups)
      else if (
        question.subthemeId &&
        subthemeSet.has(question.subthemeId) &&
        !overriddenSubthemes.has(question.subthemeId)
      ) {
        matches = true;
      }
      // Priority 3: Check themes (only if not overridden by subthemes)
      else if (
        question.themeId &&
        themeSet.has(question.themeId) &&
        !overriddenThemes.has(question.themeId)
      ) {
        matches = true;
      }

      if (matches) {
        validIds.push(question._id);
      }
    }

    return { validIds };
  },
});

/**
 * Update job progress (used within workflow loop)
 */
export const updateCollectionProgress = internalMutation({
  args: {
    jobId: v.id('quizCreationJobs'),
    progress: v.number(),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: 'collecting_questions',
      progress: args.progress,
      progressMessage: args.message,
    });
    return null;
  },
});

/**
 * Select random questions and create quiz
 */
export const selectAndCreateQuiz = internalMutation({
  args: {
    jobId: v.id('quizCreationJobs'),
    userId: v.id('users'),
    tenantId: v.optional(v.id('apps')),
    questionIds: v.array(v.id('questions')),
    maxQuestions: v.number(),
    name: v.string(),
    description: v.string(),
    testMode: v.union(v.literal('study'), v.literal('exam')),
    questionMode: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
    selectedThemes: v.optional(v.array(v.id('themes'))),
    selectedSubthemes: v.optional(v.array(v.id('subthemes'))),
    selectedGroups: v.optional(v.array(v.id('groups'))),
  },
  returns: v.object({
    quizId: v.id('customQuizzes'),
    questionCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // Update progress
    await ctx.db.patch(args.jobId, {
      status: 'selecting_questions',
      progress: 60,
      progressMessage: 'Selecionando questões aleatórias...',
    });

    // Randomly select questions if we have more than requested
    let selectedQuestionIds = args.questionIds;
    if (selectedQuestionIds.length > args.maxQuestions) {
      selectedQuestionIds = shuffleArray(selectedQuestionIds).slice(
        0,
        args.maxQuestions,
      );
    }

    // Update progress
    await ctx.db.patch(args.jobId, {
      status: 'creating_quiz',
      progress: 80,
      progressMessage: 'Criando quiz...',
    });

    // Get default tenant if not provided
    let tenantId = args.tenantId;
    if (!tenantId) {
      const defaultApp = await ctx.db
        .query('apps')
        .withIndex('by_slug', q => q.eq('slug', 'ortoqbank'))
        .first();
      tenantId = defaultApp?._id;
    }

    // Create the custom quiz
    const quizId = await ctx.db.insert('customQuizzes', {
      name: args.name,
      description: args.description,
      questions: selectedQuestionIds,
      authorId: args.userId,
      testMode: args.testMode,
      questionMode: args.questionMode,
      selectedThemes: args.selectedThemes,
      selectedSubthemes: args.selectedSubthemes,
      selectedGroups: args.selectedGroups,
      tenantId,
    });

    // Create quiz session
    await ctx.db.insert('quizSessions', {
      userId: args.userId,
      quizId,
      mode: args.testMode,
      currentQuestionIndex: 0,
      answers: [],
      answerFeedback: [],
      isComplete: false,
      tenantId,
    });

    return {
      quizId,
      questionCount: selectedQuestionIds.length,
    };
  },
});

// =============================================================================
// WORKFLOW DEFINITION
// =============================================================================

/**
 * Quiz creation workflow - orchestrates the multi-step quiz creation process
 * Uses paginated mutations to stay within 15-second limit per step.
 */
export const quizCreationWorkflow = workflow.define({
  args: {
    jobId: v.id('quizCreationJobs'),
  },
  returns: v.object({
    success: v.boolean(),
    quizId: v.optional(v.id('customQuizzes')),
    questionCount: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (step, args) => {
    // Get job input data
    const jobData: {
      userId: Id<'users'>;
      tenantId: Id<'apps'> | undefined;
      input: {
        name: string;
        description: string;
        testMode: 'study' | 'exam';
        questionMode: QuestionMode;
        numQuestions?: number;
        selectedThemes?: Id<'themes'>[];
        selectedSubthemes?: Id<'subthemes'>[];
        selectedGroups?: Id<'groups'>[];
        groupToSubtheme?: Record<Id<'groups'>, Id<'subthemes'>>;
        subthemeToTheme?: Record<Id<'subthemes'>, Id<'themes'>>;
      };
    } = await step.runQuery(internal.customQuizWorkflow.getJobInput, {
      jobId: args.jobId,
    });

    const maxQuestions = jobData.input.numQuestions
      ? Math.min(jobData.input.numQuestions, MAX_QUESTIONS)
      : MAX_QUESTIONS;

    const selectedThemes = jobData.input.selectedThemes || [];
    const selectedSubthemes = jobData.input.selectedSubthemes || [];
    const selectedGroups = jobData.input.selectedGroups || [];
    const groupToSubtheme = jobData.input.groupToSubtheme || {};
    const subthemeToTheme = jobData.input.subthemeToTheme || {};

    const hasFilters =
      selectedThemes.length > 0 ||
      selectedSubthemes.length > 0 ||
      selectedGroups.length > 0;

    try {
      let questionIds: Id<'questions'>[] = [];

      // =====================================================================
      // SCENARIO A: Mode 'all' - Use aggregate-based random selection
      // =====================================================================
      if (jobData.input.questionMode === 'all') {
        if (hasFilters) {
          // Filters applied: Collect ALL matching questions, then random sample
          await step.runMutation(
            internal.customQuizWorkflow.updateCollectionProgress,
            {
              jobId: args.jobId,
              progress: 10,
              message: 'Coletando questões por tema...',
            },
            { name: 'progress_filtered' },
          );

          // Use paginated collection for filtered questions
          let cursor: string | null = null;
          let currentLevel: 'groups' | 'subthemes' | 'themes' | 'done' =
            'groups';
          let currentIndex = 0;
          let batchCount = 0;
          const allIds: Id<'questions'>[] = [];

          while (currentLevel !== 'done') {
            const batch: {
              questionIds: Id<'questions'>[];
              nextCursor: string | null;
              nextLevel: 'groups' | 'subthemes' | 'themes' | 'done';
              nextIndex: number;
              isDone: boolean;
            } = await step.runMutation(
              internal.customQuizWorkflow.collectFilteredQuestionsBatch,
              {
                jobId: args.jobId,
                cursor,
                batchSize: PAGINATION_BATCH_SIZE,
                selectedThemes,
                selectedSubthemes,
                selectedGroups,
                groupToSubtheme,
                subthemeToTheme,
                currentLevel,
                currentIndex,
              },
              { name: `collectFiltered_${batchCount}` },
            );

            allIds.push(...batch.questionIds);
            cursor = batch.nextCursor;
            currentLevel = batch.nextLevel;
            currentIndex = batch.nextIndex;
            batchCount++;

            if (batch.isDone) break;
          }

          // Deduplicate and shuffle
          questionIds = [...new Set(allIds)];
        } else {
          // Fast path: No filters, just get random questions from global pool
          await step.runMutation(
            internal.customQuizWorkflow.updateCollectionProgress,
            {
              jobId: args.jobId,
              progress: 10,
              message: 'Selecionando questões aleatórias...',
            },
            { name: 'progress_random' },
          );

          questionIds = await step.runQuery(
            api.aggregateQueries.getRandomQuestions,
            { count: maxQuestions },
          );
        }
      }
      // =====================================================================
      // SCENARIO B: Mode with filters - Collect ALL matching, then filter by mode
      // =====================================================================
      else if (hasFilters) {
        await step.runMutation(
          internal.customQuizWorkflow.updateCollectionProgress,
          {
            jobId: args.jobId,
            progress: 10,
            message: 'Coletando questões filtradas...',
          },
          { name: 'progress_mode_filtered' },
        );

        // Step 1: Collect ALL questions matching hierarchy filters
        let cursor: string | null = null;
        let currentLevel: 'groups' | 'subthemes' | 'themes' | 'done' = 'groups';
        let currentIndex = 0;
        let batchCount = 0;
        const allHierarchyIds: Id<'questions'>[] = [];

        while (currentLevel !== 'done') {
          const batch: {
            questionIds: Id<'questions'>[];
            nextCursor: string | null;
            nextLevel: 'groups' | 'subthemes' | 'themes' | 'done';
            nextIndex: number;
            isDone: boolean;
          } = await step.runMutation(
            internal.customQuizWorkflow.collectFilteredQuestionsBatch,
            {
              jobId: args.jobId,
              cursor,
              batchSize: PAGINATION_BATCH_SIZE,
              selectedThemes,
              selectedSubthemes,
              selectedGroups,
              groupToSubtheme,
              subthemeToTheme,
              currentLevel,
              currentIndex,
            },
            { name: `collectHierarchy_${batchCount}` },
          );

          allHierarchyIds.push(...batch.questionIds);
          cursor = batch.nextCursor;
          currentLevel = batch.nextLevel;
          currentIndex = batch.nextIndex;
          batchCount++;

          if (batch.isDone) break;
        }

        const uniqueHierarchyIds = [...new Set(allHierarchyIds)];

        // Step 2: Filter by question mode (unanswered/incorrect/bookmarked)
        await step.runMutation(
          internal.customQuizWorkflow.updateCollectionProgress,
          {
            jobId: args.jobId,
            progress: 40,
            message: 'Aplicando filtro de modo...',
          },
          { name: 'progress_mode' },
        );

        switch (jobData.input.questionMode) {
        case 'unanswered': {
          // Get all answered IDs for this user (paginated)
          let answerCursor: string | null = null;
          const answeredIds = new Set<Id<'questions'>>();
          let answerBatch = 0;

          do {
            const batch: {
              questionIds: Id<'questions'>[];
              nextCursor: string | null;
              isDone: boolean;
            } = await step.runMutation(
              internal.customQuizWorkflow.getAnsweredQuestionIdsBatch,
              { userId: jobData.userId, cursor: answerCursor, batchSize: 1000 },
              { name: `getAnswered_${answerBatch}` },
            );

            batch.questionIds.forEach(id => answeredIds.add(id));
            answerCursor = batch.nextCursor;
            answerBatch++;
          } while (answerCursor);

          // Filter out answered questions
          questionIds = uniqueHierarchyIds.filter(id => !answeredIds.has(id));
        
        break;
        }
        case 'incorrect': {
          // Get all incorrect IDs for this user (paginated)
          let incorrectCursor: string | null = null;
          const incorrectIds = new Set<Id<'questions'>>();
          let incorrectBatch = 0;

          do {
            const batch: {
              questionIds: Id<'questions'>[];
              nextCursor: string | null;
              isDone: boolean;
            } = await step.runMutation(
              internal.customQuizWorkflow.getIncorrectQuestionIdsBatch,
              {
                userId: jobData.userId,
                cursor: incorrectCursor,
                batchSize: 1000,
              },
              { name: `getIncorrect_${incorrectBatch}` },
            );

            batch.questionIds.forEach(id => incorrectIds.add(id));
            incorrectCursor = batch.nextCursor;
            incorrectBatch++;
          } while (incorrectCursor);

          // Keep only incorrect questions from hierarchy
          questionIds = uniqueHierarchyIds.filter(id => incorrectIds.has(id));
        
        break;
        }
        case 'bookmarked': {
          // Get all bookmarked IDs for this user (paginated)
          let bookmarkCursor: string | null = null;
          const bookmarkedIds = new Set<Id<'questions'>>();
          let bookmarkBatch = 0;

          do {
            const batch: {
              questionIds: Id<'questions'>[];
              nextCursor: string | null;
              isDone: boolean;
            } = await step.runMutation(
              internal.customQuizWorkflow.getBookmarkedQuestionIdsBatch,
              {
                userId: jobData.userId,
                cursor: bookmarkCursor,
                batchSize: 1000,
              },
              { name: `getBookmarked_${bookmarkBatch}` },
            );

            batch.questionIds.forEach(id => bookmarkedIds.add(id));
            bookmarkCursor = batch.nextCursor;
            bookmarkBatch++;
          } while (bookmarkCursor);

          // Keep only bookmarked questions from hierarchy
          questionIds = uniqueHierarchyIds.filter(id => bookmarkedIds.has(id));
        
        break;
        }
        // No default
        }
      }
      // =====================================================================
      // SCENARIO C: Mode without filters - Iterative sampling (large pool)
      // =====================================================================
      else {
        await step.runMutation(
          internal.customQuizWorkflow.updateCollectionProgress,
          {
            jobId: args.jobId,
            progress: 10,
            message: 'Selecionando questões...',
          },
          { name: 'progress_sampling' },
        );

        // For modes without filters, use iterative sampling
        // This avoids fetching all 5k+ questions when we only need 120
        const collectedIds: Id<'questions'>[] = [];
        let attempts = 0;
        const MAX_ATTEMPTS = 10;
        const SAMPLE_SIZE = 500;

        while (collectedIds.length < maxQuestions && attempts < MAX_ATTEMPTS) {
          const result: {
            validIds: Id<'questions'>[];
            exhausted: boolean;
          } = await step.runMutation(
            internal.customQuizWorkflow.sampleAndFilterByMode,
            {
              userId: jobData.userId,
              questionMode: jobData.input.questionMode as
                | 'unanswered'
                | 'incorrect'
                | 'bookmarked',
              sampleSize: SAMPLE_SIZE,
              targetCount: maxQuestions - collectedIds.length,
              excludeIds: collectedIds,
            },
            { name: `sample_${attempts}` },
          );

          collectedIds.push(...result.validIds);
          attempts++;

          // Update progress
          const progress = Math.min(10 + attempts * 5, 50);
          await step.runMutation(
            internal.customQuizWorkflow.updateCollectionProgress,
            {
              jobId: args.jobId,
              progress,
              message: `Encontradas ${collectedIds.length} questões...`,
            },
            { name: `progress_sample_${attempts}` },
          );

          if (result.exhausted || collectedIds.length >= maxQuestions) break;
        }

        questionIds = collectedIds;
      }

      // =====================================================================
      // Check if we found any questions
      // =====================================================================
      if (questionIds.length === 0) {
        const isQuestionModeFiltering = jobData.input.questionMode !== 'all';
        const error = isQuestionModeFiltering
          ? 'NO_QUESTIONS_FOUND_AFTER_FILTER'
          : 'NO_QUESTIONS_FOUND';
        const errorMessage = isQuestionModeFiltering
          ? 'Nenhuma questão encontrada com os filtros selecionados. Tente ajustar os filtros ou selecionar temas diferentes.'
          : 'Nenhuma questão encontrada com os critérios selecionados. Tente ajustar os filtros ou selecionar temas diferentes.';

        await step.runMutation(internal.customQuizWorkflow.markJobFailed, {
          jobId: args.jobId,
          error,
          errorMessage,
        });

        return { success: false, error, questionCount: 0 };
      }

      // =====================================================================
      // Step Final: Select questions and create quiz
      // =====================================================================
      const quizResult: {
        quizId: Id<'customQuizzes'>;
        questionCount: number;
      } = await step.runMutation(
        internal.customQuizWorkflow.selectAndCreateQuiz,
        {
          jobId: args.jobId,
          userId: jobData.userId,
          tenantId: jobData.tenantId,
          questionIds,
          maxQuestions,
          name:
            jobData.input.name ||
            `Custom Quiz - ${new Date().toLocaleDateString()}`,
          description:
            jobData.input.description ||
            `Custom quiz with ${questionIds.length} questions`,
          testMode: jobData.input.testMode,
          questionMode: jobData.input.questionMode,
          selectedThemes: jobData.input.selectedThemes,
          selectedSubthemes: jobData.input.selectedSubthemes,
          selectedGroups: jobData.input.selectedGroups,
        },
      );

      // Mark job as completed
      await step.runMutation(internal.customQuizWorkflow.markJobCompleted, {
        jobId: args.jobId,
        quizId: quizResult.quizId,
        questionCount: quizResult.questionCount,
      });

      return {
        success: true,
        quizId: quizResult.quizId,
        questionCount: quizResult.questionCount,
      };
    } catch (error) {
      // Mark job as failed
      await step.runMutation(internal.customQuizWorkflow.markJobFailed, {
        jobId: args.jobId,
        error: 'WORKFLOW_ERROR',
        errorMessage:
          error instanceof Error ? error.message : 'Erro desconhecido',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// =============================================================================
// PUBLIC MUTATION - Start Quiz Creation
// =============================================================================

/**
 * Start a new quiz creation workflow with optimized hierarchy data
 */
export const createWithWorkflow = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    testMode: v.union(v.literal('study'), v.literal('exam')),
    questionMode: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
    numQuestions: v.optional(v.number()),
    selectedThemes: v.optional(v.array(v.id('themes'))),
    selectedSubthemes: v.optional(v.array(v.id('subthemes'))),
    selectedGroups: v.optional(v.array(v.id('groups'))),
    // OPTIMIZED: Frontend passes pre-computed hierarchy relationships
    groupToSubtheme: v.optional(v.record(v.id('groups'), v.id('subthemes'))),
    subthemeToTheme: v.optional(v.record(v.id('subthemes'), v.id('themes'))),
  },
  returns: v.object({
    jobId: v.id('quizCreationJobs'),
    workflowId: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ jobId: Id<'quizCreationJobs'>; workflowId: string }> => {
    const user = await getCurrentUserOrThrow(ctx);

    // Get default tenant
    const defaultApp = await ctx.db
      .query('apps')
      .withIndex('by_slug', q => q.eq('slug', 'ortoqbank'))
      .first();

    // Create job record
    const jobId = await ctx.db.insert('quizCreationJobs', {
      userId: user._id,
      tenantId: defaultApp?._id,
      status: 'pending',
      progress: 0,
      progressMessage: 'Iniciando criação do quiz...',
      input: {
        name: args.name,
        description: args.description,
        testMode: args.testMode,
        questionMode: args.questionMode,
        numQuestions: args.numQuestions,
        selectedThemes: args.selectedThemes,
        selectedSubthemes: args.selectedSubthemes,
        selectedGroups: args.selectedGroups,
        groupToSubtheme: args.groupToSubtheme,
        subthemeToTheme: args.subthemeToTheme,
      },
      createdAt: Date.now(),
    });

    // Start the workflow
    const workflowId: any = await workflow.start(
      ctx,
      internal.customQuizWorkflow.quizCreationWorkflow,
      { jobId },
    );

    // Update job with workflow ID
    await ctx.db.patch(jobId, { workflowId });

    return { jobId, workflowId };
  },
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Fisher-Yates shuffle algorithm for random question selection
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
