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
import { Doc, Id } from './_generated/dataModel';
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { QuestionMode } from './customQuizzes';
import { getCurrentUserOrThrow } from './users';

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
// INTERNAL MUTATIONS - Workflow Steps
// =============================================================================

/**
 * Step 1: Collect base questions based on question mode
 * Returns question IDs (not full documents) to minimize data size
 */
export const collectBaseQuestions = internalMutation({
  args: {
    jobId: v.id('quizCreationJobs'),
    userId: v.id('users'),
    questionMode: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
    maxQuestions: v.number(),
    selectedThemes: v.array(v.id('themes')),
    selectedSubthemes: v.array(v.id('subthemes')),
    selectedGroups: v.array(v.id('groups')),
    // Pre-computed hierarchy maps from frontend
    groupToSubtheme: v.record(v.id('groups'), v.id('subthemes')),
    subthemeToTheme: v.record(v.id('subthemes'), v.id('themes')),
  },
  returns: v.object({
    questionIds: v.array(v.id('questions')),
    totalFound: v.number(),
  }),
  handler: async (ctx, args) => {
    // Update progress
    await ctx.db.patch(args.jobId, {
      status: 'collecting_questions',
      progress: 10,
      progressMessage: 'Coletando questões...',
    });

    let questionIds: Id<'questions'>[] = [];

    if (args.questionMode === 'all') {
      // Use aggregate-backed random selection for 'all' mode
      questionIds = await collectAllModeQuestionIds(
        ctx,
        args.selectedThemes,
        args.selectedSubthemes,
        args.selectedGroups,
        args.maxQuestions,
        args.groupToSubtheme,
        args.subthemeToTheme,
      );
    } else {
      // OPTIMIZED: Get question IDs directly (no full document loading)
      // This avoids the 16MB limit by not fetching heavy legacy fields
      const baseQuestionIds = await getQuestionsByUserModeOptimized(
        ctx,
        args.userId,
        args.questionMode,
        args.selectedThemes,
        args.selectedSubthemes,
        args.selectedGroups,
        args.groupToSubtheme,
        args.subthemeToTheme,
      );

      // For incorrect/bookmarked modes with hierarchy filters,
      // we need to apply additional filtering based on hierarchy
      const hasFilters =
        args.selectedThemes.length > 0 ||
        args.selectedSubthemes.length > 0 ||
        args.selectedGroups.length > 0;

      // For incorrect/bookmarked with filters, apply hierarchy filtering; otherwise use base IDs directly
      questionIds =
        hasFilters &&
        (args.questionMode === 'incorrect' ||
          args.questionMode === 'bookmarked')
          ? await filterIdsByHierarchy(
              ctx,
              baseQuestionIds,
              args.selectedThemes,
              args.selectedSubthemes,
              args.selectedGroups,
              args.groupToSubtheme,
              args.subthemeToTheme,
            )
          : baseQuestionIds;
    }

    return {
      questionIds,
      totalFound: questionIds.length,
    };
  },
});

/**
 * Step 2: Select random questions and create quiz
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

    try {
      // Step 1: Collect base questions
      const collectResult: {
        questionIds: Id<'questions'>[];
        totalFound: number;
      } = await step.runMutation(
        internal.customQuizWorkflow.collectBaseQuestions,
        {
          jobId: args.jobId,
          userId: jobData.userId,
          questionMode: jobData.input.questionMode,
          maxQuestions,
          selectedThemes: jobData.input.selectedThemes || [],
          selectedSubthemes: jobData.input.selectedSubthemes || [],
          selectedGroups: jobData.input.selectedGroups || [],
          groupToSubtheme: jobData.input.groupToSubtheme || {},
          subthemeToTheme: jobData.input.subthemeToTheme || {},
        },
      );

      // Check if we found any questions
      if (collectResult.questionIds.length === 0) {
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

      // Step 2: Select questions and create quiz
      const quizResult: {
        quizId: Id<'customQuizzes'>;
        questionCount: number;
      } = await step.runMutation(
        internal.customQuizWorkflow.selectAndCreateQuiz,
        {
          jobId: args.jobId,
          userId: jobData.userId,
          tenantId: jobData.tenantId,
          questionIds: collectResult.questionIds,
          maxQuestions,
          name:
            jobData.input.name ||
            `Custom Quiz - ${new Date().toLocaleDateString()}`,
          description:
            jobData.input.description ||
            `Custom quiz with ${collectResult.questionIds.length} questions`,
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
// HELPER FUNCTIONS (Optimized versions that use pre-computed hierarchy)
// =============================================================================

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get question IDs by hierarchy filters using indexes.
 * Returns ONLY IDs to avoid loading full documents (16MB limit fix).
 */
async function getQuestionIdsByHierarchy(
  ctx: any,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  groupToSubtheme: Record<Id<'groups'>, Id<'subthemes'>>,
  subthemeToTheme: Record<Id<'subthemes'>, Id<'themes'>>,
): Promise<Id<'questions'>[]> {
  const questionIds = new Set<Id<'questions'>>();

  // Compute overrides (same logic as applyHierarchyFiltersOptimized)
  const overriddenSubthemes = new Set<Id<'subthemes'>>();
  const overriddenThemes = new Set<Id<'themes'>>();

  for (const groupId of selectedGroups) {
    const subthemeId = groupToSubtheme[groupId];
    if (subthemeId) {
      overriddenSubthemes.add(subthemeId);
      const themeId = subthemeToTheme[subthemeId];
      if (themeId) {
        overriddenThemes.add(themeId);
      }
    }
  }

  for (const subthemeId of selectedSubthemes) {
    const themeId = subthemeToTheme[subthemeId];
    if (themeId) {
      overriddenThemes.add(themeId);
    }
  }

  // 1. Query by groups (highest priority) - returns only IDs
  for (const groupId of selectedGroups) {
    const docs = await ctx.db
      .query('questions')
      .withIndex('by_group', (q: any) => q.eq('groupId', groupId))
      .collect();
    for (const doc of docs) {
      questionIds.add(doc._id);
    }
  }

  // 2. Query by subthemes (only if not overridden by groups)
  for (const subthemeId of selectedSubthemes) {
    if (!overriddenSubthemes.has(subthemeId)) {
      const docs = await ctx.db
        .query('questions')
        .withIndex('by_subtheme', (q: any) => q.eq('subthemeId', subthemeId))
        .collect();
      for (const doc of docs) {
        questionIds.add(doc._id);
      }
    }
  }

  // 3. Query by themes (only if not overridden by subthemes)
  for (const themeId of selectedThemes) {
    if (!overriddenThemes.has(themeId)) {
      const docs = await ctx.db
        .query('questions')
        .withIndex('by_theme', (q: any) => q.eq('themeId', themeId))
        .collect();
      for (const doc of docs) {
        questionIds.add(doc._id);
      }
    }
  }

  return [...questionIds];
}

/**
 * Get questions filtered by user mode (incorrect, unanswered, bookmarked)
 * OPTIMIZED: Returns IDs instead of full documents to avoid 16MB limit.
 * For unanswered mode, requires hierarchy parameters to avoid full table scan.
 */
async function getQuestionsByUserModeOptimized(
  ctx: any,
  userId: Id<'users'>,
  questionMode: QuestionMode,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  groupToSubtheme: Record<Id<'groups'>, Id<'subthemes'>>,
  subthemeToTheme: Record<Id<'subthemes'>, Id<'themes'>>,
): Promise<Id<'questions'>[]> {
  switch (questionMode) {
    case 'incorrect': {
      // userQuestionStats already stores themeId, subthemeId, groupId for filtering
      const incorrectStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user_incorrect', (q: any) =>
          q.eq('userId', userId).eq('isIncorrect', true),
        )
        .collect();

      // Return just the question IDs - no need to fetch full question documents
      return incorrectStats.map(
        (stat: any) => stat.questionId as Id<'questions'>,
      );
    }

    case 'unanswered': {
      // Get answered question IDs from userQuestionStats (lightweight)
      const answeredStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user_answered', (q: any) =>
          q.eq('userId', userId).eq('hasAnswered', true),
        )
        .collect();

      const answeredQuestionIds = new Set<Id<'questions'>>(
        answeredStats.map((s: any) => s.questionId as Id<'questions'>),
      );

      const hasFilters =
        selectedThemes.length > 0 ||
        selectedSubthemes.length > 0 ||
        selectedGroups.length > 0;

      let allQuestionIds: Id<'questions'>[];

      // OPTIMIZED: Use indexed queries for hierarchy filters, or aggregate for global random selection
      allQuestionIds = hasFilters
        ? await getQuestionIdsByHierarchy(
            ctx,
            selectedThemes,
            selectedSubthemes,
            selectedGroups,
            groupToSubtheme,
            subthemeToTheme,
          )
        : await ctx.runQuery(api.aggregateQueries.getRandomQuestions, {
            count: 10_000, // Get a large pool of random IDs
          });

      // Filter out answered questions
      return allQuestionIds.filter(id => !answeredQuestionIds.has(id));
    }

    case 'bookmarked': {
      // userBookmarks already stores themeId, subthemeId, groupId for filtering
      const bookmarks = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user', (q: any) => q.eq('userId', userId))
        .collect();

      // Return just the question IDs - no need to fetch full question documents
      return bookmarks.map((b: any) => b.questionId as Id<'questions'>);
    }

    default: {
      throw new Error(`Unknown question mode: ${questionMode}`);
    }
  }
}

/**
 * Filter question IDs by hierarchy using the taxonomy fields stored in userQuestionStats/userBookmarks.
 * This is used for incorrect/bookmarked modes when hierarchy filters are applied.
 * Uses lightweight queries on userQuestionStats which has themeId, subthemeId, groupId fields.
 */
async function filterIdsByHierarchy(
  ctx: any,
  questionIds: Id<'questions'>[],
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  groupToSubtheme: Record<Id<'groups'>, Id<'subthemes'>>,
  subthemeToTheme: Record<Id<'subthemes'>, Id<'themes'>>,
): Promise<Id<'questions'>[]> {
  // Create sets for O(1) lookup
  const groupSet = new Set(selectedGroups);
  const subthemeSet = new Set(selectedSubthemes);
  const themeSet = new Set(selectedThemes);

  // Compute overrides
  const overriddenSubthemes = new Set<Id<'subthemes'>>();
  const overriddenThemes = new Set<Id<'themes'>>();

  for (const groupId of selectedGroups) {
    const subthemeId = groupToSubtheme[groupId];
    if (subthemeId) {
      overriddenSubthemes.add(subthemeId);
      const themeId = subthemeToTheme[subthemeId];
      if (themeId) {
        overriddenThemes.add(themeId);
      }
    }
  }

  for (const subthemeId of selectedSubthemes) {
    const themeId = subthemeToTheme[subthemeId];
    if (themeId) {
      overriddenThemes.add(themeId);
    }
  }

  // Batch fetch question metadata using ctx.db.get (lightweight - only returns what's needed)
  // We need to check each question's themeId, subthemeId, groupId
  const validIds: Id<'questions'>[] = [];

  // Process in batches to avoid overwhelming the database
  const BATCH_SIZE = 100;
  for (let i = 0; i < questionIds.length; i += BATCH_SIZE) {
    const batch = questionIds.slice(i, i + BATCH_SIZE);
    const questions = await Promise.all(batch.map(id => ctx.db.get(id)));

    for (const question of questions) {
      if (!question) continue;

      // Check if question matches any of the selected hierarchy levels
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
  }

  return validIds;
}

/**
 * Apply hierarchy-based filtering using pre-computed maps (NO DB reads)
 */
function applyHierarchyFiltersOptimized(
  baseQuestions: Doc<'questions'>[],
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  groupToSubtheme: Record<Id<'groups'>, Id<'subthemes'>>,
  subthemeToTheme: Record<Id<'subthemes'>, Id<'themes'>>,
): Doc<'questions'>[] {
  const validQuestionIds = new Set<Id<'questions'>>();

  // Compute overridden subthemes (subthemes that have selected groups)
  const overriddenSubthemes = new Set<Id<'subthemes'>>();
  for (const groupId of selectedGroups) {
    const subthemeId = groupToSubtheme[groupId];
    if (subthemeId) {
      overriddenSubthemes.add(subthemeId);
    }
  }

  // Compute overridden themes (themes that have selected subthemes or groups)
  const overriddenThemes = new Set<Id<'themes'>>();
  for (const subthemeId of selectedSubthemes) {
    const themeId = subthemeToTheme[subthemeId];
    if (themeId) {
      overriddenThemes.add(themeId);
    }
  }
  // Also override themes from groups
  for (const groupId of selectedGroups) {
    const subthemeId = groupToSubtheme[groupId];
    if (subthemeId) {
      const themeId = subthemeToTheme[subthemeId];
      if (themeId) {
        overriddenThemes.add(themeId);
      }
    }
  }

  // Step 1: Process groups (highest priority)
  if (selectedGroups.length > 0) {
    const groupSet = new Set(selectedGroups);
    baseQuestions.forEach(question => {
      if (question.groupId && groupSet.has(question.groupId)) {
        validQuestionIds.add(question._id);
      }
    });
  }

  // Step 2: Process subthemes (only if not overridden by groups)
  if (selectedSubthemes.length > 0) {
    const subthemeSet = new Set(selectedSubthemes);
    baseQuestions.forEach(question => {
      if (
        question.subthemeId &&
        subthemeSet.has(question.subthemeId) &&
        (!overriddenSubthemes.has(question.subthemeId) || !question.groupId)
      ) {
        validQuestionIds.add(question._id);
      }
    });
  }

  // Step 3: Process themes (only if not overridden by subthemes)
  if (selectedThemes.length > 0) {
    const themeSet = new Set(selectedThemes);
    baseQuestions.forEach(question => {
      if (
        question.themeId &&
        themeSet.has(question.themeId) &&
        !overriddenThemes.has(question.themeId)
      ) {
        validQuestionIds.add(question._id);
      }
    });
  }

  return baseQuestions.filter(q => validQuestionIds.has(q._id));
}

/**
 * Aggregate-backed random selection for questionMode 'all' (optimized version)
 */
async function collectAllModeQuestionIds(
  ctx: any,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  maxQuestions: number,
  groupToSubtheme: Record<Id<'groups'>, Id<'subthemes'>>,
  subthemeToTheme: Record<Id<'subthemes'>, Id<'themes'>>,
): Promise<Array<Id<'questions'>>> {
  // No filters: grab random questions globally
  if (
    selectedThemes.length === 0 &&
    selectedSubthemes.length === 0 &&
    selectedGroups.length === 0
  ) {
    return await ctx.runQuery(api.aggregateQueries.getRandomQuestions, {
      count: maxQuestions,
    });
  }

  // Determine overrides using pre-computed maps (NO DB reads!)
  const overriddenSubthemes = new Set<Id<'subthemes'>>();
  const overriddenThemesByGroups = new Set<Id<'themes'>>();
  const groupsBySubtheme = new Map<Id<'subthemes'>, Set<Id<'groups'>>>();

  for (const groupId of selectedGroups) {
    const subthemeId = groupToSubtheme[groupId];
    if (subthemeId) {
      overriddenSubthemes.add(subthemeId);
      if (!groupsBySubtheme.has(subthemeId)) {
        groupsBySubtheme.set(subthemeId, new Set());
      }
      groupsBySubtheme.get(subthemeId)!.add(groupId);

      // Get theme from subtheme
      const themeId = subthemeToTheme[subthemeId];
      if (themeId) {
        overriddenThemesByGroups.add(themeId);
      }
    }
  }

  // Themes overridden by selected subthemes
  const overriddenThemes = new Set<Id<'themes'>>();
  for (const subthemeId of selectedSubthemes) {
    const themeId = subthemeToTheme[subthemeId];
    if (themeId) {
      overriddenThemes.add(themeId);
    }
  }

  // Apply overrides to selections
  const effectiveSubthemesSet = new Set(
    selectedSubthemes.filter(st => !overriddenSubthemes.has(st)),
  );
  const effectiveThemes = selectedThemes.filter(
    th => !overriddenThemes.has(th) && !overriddenThemesByGroups.has(th),
  );

  // 1) Always include selected groups via random aggregate
  const groupResults = await Promise.all(
    selectedGroups.map(groupId =>
      ctx.runQuery(api.aggregateQueries.getRandomQuestionsByGroup, {
        groupId,
        count: maxQuestions,
      }),
    ),
  );

  // 2) For each selected subtheme:
  //    - If it has selected groups, include ONLY the complement
  //    - Otherwise include random-by-subtheme aggregate
  const subthemeResults: Array<Array<Id<'questions'>>> = [];
  for (const subthemeId of selectedSubthemes) {
    const selectedGroupsForSubtheme = groupsBySubtheme.get(subthemeId);
    if (selectedGroupsForSubtheme && selectedGroupsForSubtheme.size > 0) {
      // Fetch complement via indexed query
      const qDocs = await ctx.db
        .query('questions')
        .withIndex('by_subtheme', (q: any) => q.eq('subthemeId', subthemeId))
        .collect();
      const complementIds = qDocs
        .filter(
          (q: Doc<'questions'>) =>
            !q.groupId || !selectedGroupsForSubtheme.has(q.groupId),
        )
        .map((q: Doc<'questions'>) => q._id as Id<'questions'>);
      subthemeResults.push(complementIds);
    } else if (effectiveSubthemesSet.has(subthemeId)) {
      const ids = await ctx.runQuery(
        api.aggregateQueries.getRandomQuestionsBySubtheme,
        { subthemeId, count: maxQuestions },
      );
      subthemeResults.push(ids);
    }
  }

  // 3) Include any themes that aren't covered by selected subthemes
  const themeResults = await Promise.all(
    effectiveThemes.map(themeId =>
      ctx.runQuery(api.aggregateQueries.getRandomQuestionsByTheme, {
        themeId,
        count: maxQuestions,
      }),
    ),
  );

  // Combine, dedupe, and downsample
  const combined = [
    ...groupResults.flat(),
    ...subthemeResults.flat(),
    ...themeResults.flat(),
  ];
  const uniqueIds = [...new Set(combined)];

  if (uniqueIds.length <= maxQuestions) return uniqueIds;

  // Fisher-Yates shuffle then slice
  return shuffleArray(uniqueIds).slice(0, maxQuestions);
}
