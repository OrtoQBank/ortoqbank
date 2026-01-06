import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { getCurrentUserOrThrow } from './users';

/**
 * Submit a question error report
 */
export const submitReport = mutation({
  args: {
    questionId: v.id('questions'),
    description: v.string(),
    screenshotStorageId: v.optional(v.id('_storage')),
  },
  returns: v.object({
    success: v.boolean(),
    reportId: v.id('questionErrorReports'),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);

    // Get question info for reference
    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new Error('Question not found');
    }

    const reportId = await ctx.db.insert('questionErrorReports', {
      questionId: args.questionId,
      questionCode: question.questionCode,
      reporterId: user._id,
      reporterEmail: user.email,
      description: args.description,
      screenshotStorageId: args.screenshotStorageId,
      status: 'pending',
      tenantId: question.tenantId,
    });

    return { success: true, reportId };
  },
});

/**
 * Generate upload URL for screenshot
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async ctx => {
    // Verify user is authenticated
    await getCurrentUserOrThrow(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get all reports for admin (with pagination)
 */
export const getReportsForAdmin = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('reviewed'),
        v.literal('resolved'),
        v.literal('dismissed'),
      ),
    ),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id('questionErrorReports'),
      _creationTime: v.number(),
      questionId: v.id('questions'),
      questionCode: v.optional(v.string()),
      reporterId: v.id('users'),
      reporterEmail: v.optional(v.string()),
      reporterName: v.optional(v.string()),
      description: v.string(),
      screenshotUrl: v.optional(v.string()),
      status: v.union(
        v.literal('pending'),
        v.literal('reviewed'),
        v.literal('resolved'),
        v.literal('dismissed'),
      ),
      reviewedBy: v.optional(v.id('users')),
      reviewedAt: v.optional(v.number()),
      reviewNotes: v.optional(v.string()),
      questionTitle: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const reports = args.status
      ? await ctx.db
          .query('questionErrorReports')
          .withIndex('by_status', q => q.eq('status', args.status!))
          .order('desc')
          .take(limit)
      : await ctx.db.query('questionErrorReports').order('desc').take(limit);

    // Enrich with user and question data
    const enrichedReports = await Promise.all(
      reports.map(async report => {
        const reporter = await ctx.db.get(report.reporterId);
        const question = await ctx.db.get(report.questionId);

        let screenshotUrl: string | undefined;
        if (report.screenshotStorageId) {
          screenshotUrl =
            (await ctx.storage.getUrl(report.screenshotStorageId)) ?? undefined;
        }

        return {
          _id: report._id,
          _creationTime: report._creationTime,
          questionId: report.questionId,
          questionCode: report.questionCode,
          reporterId: report.reporterId,
          reporterEmail: report.reporterEmail,
          reporterName: reporter
            ? `${reporter.firstName ?? ''} ${reporter.lastName ?? ''}`.trim()
            : undefined,
          description: report.description,
          screenshotUrl,
          status: report.status,
          reviewedBy: report.reviewedBy,
          reviewedAt: report.reviewedAt,
          reviewNotes: report.reviewNotes,
          questionTitle: question?.title,
        };
      }),
    );

    return enrichedReports;
  },
});

/**
 * Update report status (for admin)
 */
export const updateReportStatus = mutation({
  args: {
    reportId: v.id('questionErrorReports'),
    status: v.union(
      v.literal('pending'),
      v.literal('reviewed'),
      v.literal('resolved'),
      v.literal('dismissed'),
    ),
    reviewNotes: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);

    // Check if user is admin
    if (user.role !== 'admin') {
      throw new Error('Unauthorized: Only admins can update report status');
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    await ctx.db.patch(args.reportId, {
      status: args.status,
      reviewedBy: user._id,
      reviewedAt: Date.now(),
      ...(args.reviewNotes && { reviewNotes: args.reviewNotes }),
    });

    return { success: true };
  },
});

/**
 * Get report count by status (for admin dashboard)
 */
export const getReportCounts = query({
  args: {},
  returns: v.object({
    pending: v.number(),
    reviewed: v.number(),
    resolved: v.number(),
    dismissed: v.number(),
    total: v.number(),
  }),
  handler: async ctx => {
    const allReports = await ctx.db.query('questionErrorReports').collect();

    const counts = {
      pending: 0,
      reviewed: 0,
      resolved: 0,
      dismissed: 0,
      total: allReports.length,
    };

    for (const report of allReports) {
      counts[report.status]++;
    }

    return counts;
  },
});

/**
 * Check if user has already reported this question
 */
export const hasUserReportedQuestion = query({
  args: {
    questionId: v.id('questions'),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkUserId', q => q.eq('clerkUserId', identity.subject))
      .unique();

    if (!user) {
      return false;
    }

    const existingReport = await ctx.db
      .query('questionErrorReports')
      .withIndex('by_question', q => q.eq('questionId', args.questionId))
      .first();

    if (!existingReport) {
      return false;
    }

    return existingReport.reporterId === user._id;
  },
});
