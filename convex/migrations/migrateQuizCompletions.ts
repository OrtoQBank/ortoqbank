import { internalMutation } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Migration: Populate quizCompletions table with existing completed sessions
 * 
 * Run this once to backfill the quizCompletions table with all existing
 * completed quiz sessions. This enables the lightweight completion checking
 * without loading heavy answerFeedback data.
 * 
 * Usage:
 * Run from Convex dashboard or CLI:
 * npx convex run migrations/migrateQuizCompletions:migrate
 */
export const migrate = internalMutation({
  args: {},
  returns: v.object({
    totalProcessed: v.number(),
    alreadyMigrated: v.number(),
    newCompletions: v.number(),
  }),
  handler: async ctx => {
    let totalProcessed = 0;
    let alreadyMigrated = 0;
    let newCompletions = 0;

    // Get all completed sessions
    const completedSessions = await ctx.db
      .query('quizSessions')
      .withIndex('by_user_complete')
      .collect();

    console.log(`Found ${completedSessions.length} completed sessions to process`);

    for (const session of completedSessions) {
      totalProcessed++;

      if (!session.isComplete) continue;

      // Check if completion already exists
      const existingCompletion = await ctx.db
        .query('quizCompletions')
        .withIndex('by_user_quiz', q =>
          q.eq('userId', session.userId).eq('quizId', session.quizId),
        )
        .filter(q => q.eq(q.field('sessionId'), session._id))
        .first();

      if (existingCompletion) {
        alreadyMigrated++;
        continue;
      }

      // Create completion entry
      await ctx.db.insert('quizCompletions', {
        userId: session.userId,
        quizId: session.quizId,
        sessionId: session._id,
        completedAt: session._creationTime, // Use session creation time as fallback
        mode: session.mode,
      });

      newCompletions++;

      // Log progress every 100 completions
      if (newCompletions % 100 === 0) {
        console.log(`Migrated ${newCompletions} completions...`);
      }
    }

    console.log('Migration complete!');
    console.log(`Total processed: ${totalProcessed}`);
    console.log(`Already migrated: ${alreadyMigrated}`);
    console.log(`New completions: ${newCompletions}`);

    return {
      totalProcessed,
      alreadyMigrated,
      newCompletions,
    };
  },
});

