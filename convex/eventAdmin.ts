import { v } from 'convex/values';

import { mutation } from './_generated/server';

// Admin function to determine and mark the event winner
export const determineEventWinner = mutation({
  args: {
    eventName: v.string(),
  },
  returns: v.object({
    winner: v.object({
      userId: v.id('eventUsers'),
      name: v.string(),
      email: v.optional(v.string()),
      score: v.number(),
      percentage: v.number(),
      timeSpentMinutes: v.number(),
      university: v.optional(v.string()),
    }),
    totalParticipants: v.number(),
  }),
  handler: async (ctx, args) => {
    // Get all scores for the event
    const scores = await ctx.db
      .query('eventScores')
      .withIndex('by_event_score', q => q.eq('eventName', args.eventName))
      .collect();

    if (scores.length === 0) {
      throw new Error('No scores found for this event');
    }

    // Sort by percentage (desc) then by time (asc)
    const sortedScores = scores.sort((a, b) => {
      if (a.percentage !== b.percentage) {
        return b.percentage - a.percentage; // Higher percentage first
      }
      return a.timeSpentMinutes - b.timeSpentMinutes; // Lower time first
    });

    const winner = sortedScores[0];

    // Mark the winner
    await ctx.db.patch(winner._id, { isWinner: true });

    // Get winner's user info
    const winnerUser = await ctx.db.get(winner.eventUserId);

    return {
      winner: {
        userId: winner.eventUserId,
        name: `${winnerUser?.firstName} ${winnerUser?.lastName}`,
        email: winnerUser?.email,
        score: winner.score,
        percentage: winner.percentage,
        timeSpentMinutes: winner.timeSpentMinutes,
        university: winnerUser?.university,
      },
      totalParticipants: scores.length,
    };
  },
});

// Get event summary for admin
export const getEventSummary = mutation({
  args: {
    eventName: v.string(),
  },
  returns: v.object({
    stats: v.object({
      totalRegistered: v.number(),
      totalStarted: v.number(),
      totalCompleted: v.number(),
      averageScore: v.number(),
      averageTimeMinutes: v.number(),
      completionRate: v.number(),
    }),
    topParticipants: v.array(
      v.object({
        rank: v.number(),
        name: v.string(),
        email: v.optional(v.string()),
        university: v.optional(v.string()),
        score: v.number(),
        totalQuestions: v.number(),
        percentage: v.number(),
        timeSpentMinutes: v.number(),
        completedAt: v.number(),
        isWinner: v.optional(v.boolean()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    // Get event statistics
    const allUsers = await ctx.db
      .query('eventUsers')
      .withIndex('by_event', q => q.eq('eventName', args.eventName))
      .collect();

    const completedUsers = allUsers.filter(user => user.hasCompletedExam);
    const startedUsers = allUsers.filter(user => user.hasStartedExam);

    const scores = await ctx.db
      .query('eventScores')
      .withIndex('by_event_score', q => q.eq('eventName', args.eventName))
      .collect();

    const averageScore =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + score.percentage, 0) /
          scores.length
        : 0;

    const averageTime =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + score.timeSpentMinutes, 0) /
          scores.length
        : 0;

    const stats = {
      totalRegistered: allUsers.length,
      totalStarted: startedUsers.length,
      totalCompleted: completedUsers.length,
      averageScore: Math.round(averageScore * 100) / 100,
      averageTimeMinutes: Math.round(averageTime),
      completionRate:
        allUsers.length > 0
          ? (completedUsers.length / allUsers.length) * 100
          : 0,
    };

    // Get top 10 participants
    const sortedScores = scores
      .sort((a, b) => {
        if (a.percentage !== b.percentage) {
          return b.percentage - a.percentage; // Higher percentage first
        }
        return a.timeSpentMinutes - b.timeSpentMinutes; // Lower time first
      })
      .slice(0, 10);

    const topParticipants = await Promise.all(
      sortedScores.map(async (score, index) => {
        const eventUser = await ctx.db.get(score.eventUserId);
        return {
          rank: index + 1,
          name: `${eventUser?.firstName} ${eventUser?.lastName}`,
          email: eventUser?.email,
          university: eventUser?.university,
          score: score.score,
          totalQuestions: score.totalQuestions,
          percentage: score.percentage,
          timeSpentMinutes: score.timeSpentMinutes,
          completedAt: score.completedAt,
          isWinner: score.isWinner,
        };
      }),
    );

    return {
      stats,
      topParticipants,
    };
  },
});
