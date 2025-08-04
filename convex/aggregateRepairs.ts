// ============================================================================
// SIMPLE AGGREGATE REPAIR FUNCTIONS
// ============================================================================

import { v } from 'convex/values';

import { internalMutation, mutation } from './_generated/server';
import {
  answeredByGroupByUser,
  answeredBySubthemeByUser,
  answeredByThemeByUser,
  answeredByUser,
  bookmarkedByGroupByUser,
  bookmarkedBySubthemeByUser,
  bookmarkedByThemeByUser,
  bookmarkedByUser,
  incorrectByGroupByUser,
  incorrectBySubthemeByUser,
  incorrectByThemeByUser,
  incorrectByUser,
  totalQuestionCount,
} from './aggregates';

/**
 * Clear all aggregates for a user
 */
export const clearUserAggregates = internalMutation({
  args: { userId: v.id('users') },
  returns: v.null(),
  handler: async (ctx, args) => {
    await Promise.all([
      // Basic aggregates
      answeredByUser.clear(ctx, { namespace: args.userId }),
      incorrectByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByUser.clear(ctx, { namespace: args.userId }),
      // Hierarchical aggregates
      incorrectByThemeByUser.clear(ctx, { namespace: args.userId }),
      incorrectBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      incorrectByGroupByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByThemeByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByGroupByUser.clear(ctx, { namespace: args.userId }),
      answeredByThemeByUser.clear(ctx, { namespace: args.userId }),
      answeredBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      answeredByGroupByUser.clear(ctx, { namespace: args.userId }),
    ]);
    return null;
  },
});

/**
 * Repair basic user aggregates (answered, incorrect, bookmarked)
 */
export const repairUserBasicAggregates = internalMutation({
  args: { userId: v.id('users') },
  returns: v.object({
    answered: v.number(),
    incorrect: v.number(),
    bookmarked: v.number(),
  }),
  handler: async (ctx, args) => {
    // Clear basic aggregates first
    await Promise.all([
      answeredByUser.clear(ctx, { namespace: args.userId }),
      incorrectByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByUser.clear(ctx, { namespace: args.userId }),
    ]);

    // Repair from userQuestionStats
    const stats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();

    let answered = 0,
      incorrect = 0;
    for (const stat of stats) {
      if (stat.hasAnswered) {
        await answeredByUser.insertIfDoesNotExist(ctx, stat);
        answered++;
      }
      if (stat.isIncorrect) {
        await incorrectByUser.insertIfDoesNotExist(ctx, stat);
        incorrect++;
      }
    }

    // Repair from userBookmarks
    const bookmarks = await ctx.db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();

    let bookmarked = 0;
    for (const bookmark of bookmarks) {
      await bookmarkedByUser.insertIfDoesNotExist(ctx, bookmark);
      bookmarked++;
    }

    return { answered, incorrect, bookmarked };
  },
});

/**
 * Repair hierarchical aggregates for a user
 */
export const repairUserHierarchicalAggregates = internalMutation({
  args: { userId: v.id('users') },
  returns: v.object({
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    // Clear hierarchical aggregates
    await Promise.all([
      incorrectByThemeByUser.clear(ctx, { namespace: args.userId }),
      incorrectBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      incorrectByGroupByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByThemeByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByGroupByUser.clear(ctx, { namespace: args.userId }),
      answeredByThemeByUser.clear(ctx, { namespace: args.userId }),
      answeredBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      answeredByGroupByUser.clear(ctx, { namespace: args.userId }),
    ]);

    // Get user stats and bookmarks
    const [stats, bookmarks] = await Promise.all([
      ctx.db
        .query('userQuestionStats')
        .withIndex('by_user', q => q.eq('userId', args.userId))
        .collect(),
      ctx.db
        .query('userBookmarks')
        .withIndex('by_user', q => q.eq('userId', args.userId))
        .collect(),
    ]);

    let processed = 0;

    // Process stats (answered and incorrect)
    for (const stat of stats) {
      const question = await ctx.db.get(stat.questionId);
      if (question) {
        // Answered stats
        if (stat.hasAnswered) {
          if (question.themeId) {
            await answeredByThemeByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              themeId: question.themeId,
            });
          }
          if (question.subthemeId) {
            await answeredBySubthemeByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              subthemeId: question.subthemeId,
            });
          }
          if (question.groupId) {
            await answeredByGroupByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              groupId: question.groupId,
            });
          }
        }

        // Incorrect stats
        if (stat.isIncorrect) {
          if (question.themeId) {
            await incorrectByThemeByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              themeId: question.themeId,
            });
          }
          if (question.subthemeId) {
            await incorrectBySubthemeByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              subthemeId: question.subthemeId,
            });
          }
          if (question.groupId) {
            await incorrectByGroupByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              groupId: question.groupId,
            });
          }
        }
        processed++;
      }
    }

    // Process bookmarks
    for (const bookmark of bookmarks) {
      const question = await ctx.db.get(bookmark.questionId);
      if (question) {
        if (question.themeId) {
          await bookmarkedByThemeByUser.insertIfDoesNotExist(ctx, {
            ...bookmark,
            themeId: question.themeId,
          });
        }
        if (question.subthemeId) {
          await bookmarkedBySubthemeByUser.insertIfDoesNotExist(ctx, {
            ...bookmark,
            subthemeId: question.subthemeId,
          });
        }
        if (question.groupId) {
          await bookmarkedByGroupByUser.insertIfDoesNotExist(ctx, {
            ...bookmark,
            groupId: question.groupId,
          });
        }
        processed++;
      }
    }

    return { processed };
  },
});

/**
 * Repair global question count with pagination (memory-safe)
 */
export const repairGlobalQuestionCount = mutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    totalProcessed: v.number(),
    batchCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;

    // Clear existing aggregates
    await totalQuestionCount.clear(ctx, { namespace: 'global' });

    // Process questions in paginated batches
    let cursor: string | null = null;
    let totalProcessed = 0;
    let batchCount = 0;

    do {
      const result = await ctx.db.query('questions').paginate({
        cursor,
        numItems: batchSize,
      });

      // Process this batch
      for (const question of result.page) {
        await totalQuestionCount.insertIfDoesNotExist(ctx, question);
      }

      totalProcessed += result.page.length;
      cursor = result.continueCursor;
      batchCount++;

      console.log(
        `Processed batch ${batchCount}: ${result.page.length} questions`,
      );

      // If we have more data but this is getting large, we should break
      // and let the caller call us again with the cursor
      if (!result.isDone && batchCount >= 10) {
        console.log(
          `Processed ${batchCount} batches, stopping to prevent timeout`,
        );
        break;
      }
    } while (cursor);

    console.log(
      `Repair completed: ${totalProcessed} questions processed in ${batchCount} batches`,
    );

    return {
      totalProcessed,
      batchCount,
    };
  },
});

// ============================================================================
// SECTION 1: GLOBAL QUESTION COUNT AGGREGATES REPAIR
// ============================================================================

// ============================================================================
// SECTION 1: PAGINATED REPAIR FUNCTIONS (15-second safe)
// ============================================================================

/**
 * Clear Section 1 aggregates (fast operation)
 */
export const clearSection1Aggregates = internalMutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    const { totalQuestionCount } = await import('./aggregates');
    await totalQuestionCount.clear(ctx, { namespace: 'global' });
    console.log('Section 1 aggregates cleared');
    return null;
  },
});

/**
 * Process questions batch for global count (15-second safe)
 */
export const processQuestionsBatchGlobal = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;
    const { totalQuestionCount } = await import('./aggregates');

    const result = await ctx.db.query('questions').paginate({
      cursor: args.cursor,
      numItems: batchSize,
    });

    // Process this batch
    for (const question of result.page) {
      await totalQuestionCount.insertIfDoesNotExist(ctx, question);
    }

    console.log(`Processed ${result.page.length} questions for global count`);

    return {
      processed: result.page.length,
      nextCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Process theme aggregates batch (15-second safe)
 */
export const processThemeAggregatesBatch = internalMutation({
  args: {
    themeIds: v.array(v.id('themes')),
  },
  returns: v.object({
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    const { questionCountByTheme } = await import('./aggregates');
    let processed = 0;

    for (const themeId of args.themeIds) {
      // Clear theme aggregate
      await questionCountByTheme.clear(ctx, { namespace: themeId });
      // Get questions for this theme
      const questions = await ctx.db
        .query('questions')
        .withIndex('by_theme', q => q.eq('themeId', themeId))
        .collect();

      // Insert all questions for this theme
      for (const question of questions) {
        await questionCountByTheme.insertIfDoesNotExist(ctx, question);
      }

      processed++;
      console.log(`Processed theme ${themeId}: ${questions.length} questions`);
    }

    return { processed };
  },
});

/**
 * Process subtheme aggregates batch (15-second safe)
 */
export const processSubthemeAggregatesBatch = internalMutation({
  args: {
    subthemeIds: v.array(v.id('subthemes')),
  },
  returns: v.object({
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    const { questionCountBySubtheme } = await import('./aggregates');
    let processed = 0;

    for (const subthemeId of args.subthemeIds) {
      // Clear subtheme aggregate
      await questionCountBySubtheme.clear(ctx, { namespace: subthemeId });

      // Get questions for this subtheme
      const questions = await ctx.db
        .query('questions')
        .withIndex('by_subtheme', q => q.eq('subthemeId', subthemeId))
        .collect();

      // Insert all questions for this subtheme
      for (const question of questions) {
        await questionCountBySubtheme.insertIfDoesNotExist(ctx, question);
      }

      processed++;
      console.log(
        `Processed subtheme ${subthemeId}: ${questions.length} questions`,
      );
    }

    return { processed };
  },
});

/**
 * Process group aggregates batch (15-second safe)
 */
export const processGroupAggregatesBatch = internalMutation({
  args: {
    groupIds: v.array(v.id('groups')),
  },
  returns: v.object({
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    const { questionCountByGroup } = await import('./aggregates');
    let processed = 0;

    for (const groupId of args.groupIds) {
      // Clear group aggregate
      await questionCountByGroup.clear(ctx, { namespace: groupId });

      // Get questions for this group
      const questions = await ctx.db
        .query('questions')
        .withIndex('by_group', q => q.eq('groupId', groupId))
        .collect();

      // Insert all questions for this group
      for (const question of questions) {
        await questionCountByGroup.insertIfDoesNotExist(ctx, question);
      }

      processed++;
      console.log(`Processed group ${groupId}: ${questions.length} questions`);
    }

    return { processed };
  },
});

/**
 * Get all theme IDs for batch processing
 */
export const getAllThemeIds = internalMutation({
  args: {},
  returns: v.array(v.id('themes')),
  handler: async ctx => {
    const themes = await ctx.db.query('themes').collect();
    return themes.map(t => t._id);
  },
});

/**
 * Get all subtheme IDs for batch processing
 */
export const getAllSubthemeIds = internalMutation({
  args: {},
  returns: v.array(v.id('subthemes')),
  handler: async ctx => {
    const subthemes = await ctx.db.query('subthemes').collect();
    return subthemes.map(s => s._id);
  },
});

/**
 * Get all group IDs for batch processing
 */
export const getAllGroupIds = internalMutation({
  args: {},
  returns: v.array(v.id('groups')),
  handler: async ctx => {
    const groups = await ctx.db.query('groups').collect();
    return groups.map(g => g._id);
  },
});

// ============================================================================
// SECTION 2: RANDOM QUESTION SELECTION AGGREGATES REPAIR (15-second safe)
// ============================================================================

/**
 * Clear Section 2 aggregates (fast operation)
 */
export const clearSection2Aggregates = internalMutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    const { randomQuestions } = await import('./aggregates');
    await randomQuestions.clear(ctx, { namespace: 'global' });
    console.log('Section 2 aggregates cleared');
    return null;
  },
});

/**
 * Process questions batch for random selection (15-second safe)
 */
export const processQuestionsBatchRandom = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;
    const { randomQuestions } = await import('./aggregates');

    const result = await ctx.db.query('questions').paginate({
      cursor: args.cursor,
      numItems: batchSize,
    });

    // Process this batch
    for (const question of result.page) {
      await randomQuestions.insertIfDoesNotExist(ctx, question);
    }

    console.log(
      `Processed ${result.page.length} questions for random selection`,
    );

    return {
      processed: result.page.length,
      nextCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Process theme random aggregates batch (15-second safe)
 */
export const processThemeRandomAggregatesBatch = internalMutation({
  args: {
    themeIds: v.array(v.id('themes')),
  },
  returns: v.object({
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    const { randomQuestionsByTheme } = await import('./aggregates');
    let processed = 0;

    for (const themeId of args.themeIds) {
      // Clear theme random aggregate
      await randomQuestionsByTheme.clear(ctx, { namespace: themeId });
      // Get questions for this theme
      const questions = await ctx.db
        .query('questions')
        .withIndex('by_theme', q => q.eq('themeId', themeId))
        .collect();

      // Insert all questions for this theme
      for (const question of questions) {
        await randomQuestionsByTheme.insertIfDoesNotExist(ctx, question);
      }

      processed++;
      console.log(
        `Processed theme random ${themeId}: ${questions.length} questions`,
      );
    }

    return { processed };
  },
});

/**
 * Process subtheme random aggregates batch (15-second safe)
 */
export const processSubthemeRandomAggregatesBatch = internalMutation({
  args: {
    subthemeIds: v.array(v.id('subthemes')),
  },
  returns: v.object({
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    const { randomQuestionsBySubtheme } = await import('./aggregates');
    let processed = 0;

    for (const subthemeId of args.subthemeIds) {
      // Clear subtheme random aggregate
      await randomQuestionsBySubtheme.clear(ctx, { namespace: subthemeId });

      // Get questions for this subtheme
      const questions = await ctx.db
        .query('questions')
        .withIndex('by_subtheme', q => q.eq('subthemeId', subthemeId))
        .collect();

      // Insert all questions for this subtheme
      for (const question of questions) {
        await randomQuestionsBySubtheme.insertIfDoesNotExist(ctx, question);
      }

      processed++;
      console.log(
        `Processed subtheme random ${subthemeId}: ${questions.length} questions`,
      );
    }

    return { processed };
  },
});

/**
 * Process group random aggregates batch (15-second safe)
 */
export const processGroupRandomAggregatesBatch = internalMutation({
  args: {
    groupIds: v.array(v.id('groups')),
  },
  returns: v.object({
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    const { randomQuestionsByGroup } = await import('./aggregates');
    let processed = 0;

    for (const groupId of args.groupIds) {
      // Clear group random aggregate
      await randomQuestionsByGroup.clear(ctx, { namespace: groupId });

      // Get questions for this group
      const questions = await ctx.db
        .query('questions')
        .withIndex('by_group', q => q.eq('groupId', groupId))
        .collect();

      // Insert all questions for this group
      for (const question of questions) {
        await randomQuestionsByGroup.insertIfDoesNotExist(ctx, question);
      }

      processed++;
      console.log(
        `Processed group random ${groupId}: ${questions.length} questions`,
      );
    }

    return { processed };
  },
});

// ============================================================================
// SECTION 3: USER-SPECIFIC AGGREGATES REPAIR
// ============================================================================

/**
 * Repair all user-specific aggregates (Section 3) - optimized batch processing
 * Repairs: Basic user aggregates + Hierarchical user aggregates for ALL users
 */
export const repairSection3UserSpecificAggregates = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    usersProcessed: v.number(),
    totalStats: v.number(),
    totalBookmarks: v.number(),
    hierarchicalEntries: v.number(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 50; // Process users in batches
    console.log(
      `Starting Section 3: User-Specific Aggregates Repair (batch size: ${batchSize})...`,
    );

    const {
      answeredByUser,
      incorrectByUser,
      bookmarkedByUser,
      answeredByThemeByUser,
      answeredBySubthemeByUser,
      answeredByGroupByUser,
      incorrectByThemeByUser,
      incorrectBySubthemeByUser,
      incorrectByGroupByUser,
      bookmarkedByThemeByUser,
      bookmarkedBySubthemeByUser,
      bookmarkedByGroupByUser,
    } = await import('./aggregates');

    let usersProcessed = 0;
    let totalStats = 0;
    let totalBookmarks = 0;
    let hierarchicalEntries = 0;
    let lastProcessedTime: number | undefined;
    let batchCount = 0;

    // Process users in batches using pagination to avoid loading all users into memory
    while (true) {
      batchCount++;
      console.log(`Processing user batch ${batchCount}...`);

      // Fetch batch using cursor-based pagination with creation time
      const query = ctx.db.query('users').order('asc');
      const userBatch = lastProcessedTime
        ? await query
            .filter(q => q.gt(q.field('_creationTime'), lastProcessedTime!))
            .take(batchSize)
        : await query.take(batchSize);

      if (userBatch.length === 0) {
        console.log('No more users to process');
        break;
      }

      console.log(
        `Processing ${userBatch.length} users in batch ${batchCount}`,
      );

      for (const user of userBatch) {
        // Clear all user aggregates
        await Promise.all([
          answeredByUser.clear(ctx, { namespace: user._id }),
          incorrectByUser.clear(ctx, { namespace: user._id }),
          bookmarkedByUser.clear(ctx, { namespace: user._id }),
        ]);

        // Get user data
        const [userStats, userBookmarks] = await Promise.all([
          ctx.db
            .query('userQuestionStats')
            .withIndex('by_user', q => q.eq('userId', user._id))
            .collect(),
          ctx.db
            .query('userBookmarks')
            .withIndex('by_user', q => q.eq('userId', user._id))
            .collect(),
        ]);

        // Process basic user aggregates
        for (const stat of userStats) {
          if (stat.hasAnswered) {
            await answeredByUser.insertIfDoesNotExist(ctx, stat);
          }
          if (stat.isIncorrect) {
            await incorrectByUser.insertIfDoesNotExist(ctx, stat);
          }
        }

        for (const bookmark of userBookmarks) {
          await bookmarkedByUser.insertIfDoesNotExist(ctx, bookmark);
        }

        // Process hierarchical aggregates
        for (const stat of userStats) {
          const question = await ctx.db.get(stat.questionId);
          if (question) {
            // Answered hierarchical
            if (stat.hasAnswered) {
              if (question.themeId) {
                await answeredByThemeByUser.insertIfDoesNotExist(ctx, {
                  ...stat,
                  themeId: question.themeId,
                });
                hierarchicalEntries++;
              }
              if (question.subthemeId) {
                await answeredBySubthemeByUser.insertIfDoesNotExist(ctx, {
                  ...stat,
                  subthemeId: question.subthemeId,
                });
                hierarchicalEntries++;
              }
              if (question.groupId) {
                await answeredByGroupByUser.insertIfDoesNotExist(ctx, {
                  ...stat,
                  groupId: question.groupId,
                });
                hierarchicalEntries++;
              }
            }

            // Incorrect hierarchical
            if (stat.isIncorrect) {
              if (question.themeId) {
                await incorrectByThemeByUser.insertIfDoesNotExist(ctx, {
                  ...stat,
                  themeId: question.themeId,
                });
                hierarchicalEntries++;
              }
              if (question.subthemeId) {
                await incorrectBySubthemeByUser.insertIfDoesNotExist(ctx, {
                  ...stat,
                  subthemeId: question.subthemeId,
                });
                hierarchicalEntries++;
              }
              if (question.groupId) {
                await incorrectByGroupByUser.insertIfDoesNotExist(ctx, {
                  ...stat,
                  groupId: question.groupId,
                });
                hierarchicalEntries++;
              }
            }
          }
        }

        // Process bookmark hierarchical aggregates
        for (const bookmark of userBookmarks) {
          const question = await ctx.db.get(bookmark.questionId);
          if (question) {
            if (question.themeId) {
              await bookmarkedByThemeByUser.insertIfDoesNotExist(ctx, {
                ...bookmark,
                themeId: question.themeId,
              });
              hierarchicalEntries++;
            }
            if (question.subthemeId) {
              await bookmarkedBySubthemeByUser.insertIfDoesNotExist(ctx, {
                ...bookmark,
                subthemeId: question.subthemeId,
              });
              hierarchicalEntries++;
            }
            if (question.groupId) {
              await bookmarkedByGroupByUser.insertIfDoesNotExist(ctx, {
                ...bookmark,
                groupId: question.groupId,
              });
              hierarchicalEntries++;
            }
          }
        }

        totalStats += userStats.length;
        totalBookmarks += userBookmarks.length;
        usersProcessed++;
      }

      // Update lastProcessedTime for pagination
      if (userBatch.length > 0) {
        lastProcessedTime = userBatch.at(-1)!._creationTime;
      }

      console.log(
        `Batch ${batchCount} completed. Processed ${userBatch.length} users. Total processed: ${usersProcessed}`,
      );

      // Safety check to prevent infinite loops and avoid timeouts
      if (batchCount >= 20) {
        console.log(
          `Processed ${batchCount} batches, stopping to prevent timeout. Resume by calling again.`,
        );
        break;
      }

      // If we got fewer users than requested, we've reached the end
      if (userBatch.length < batchSize) {
        console.log('Reached end of users');
        break;
      }
    }

    const result = {
      usersProcessed,
      totalStats,
      totalBookmarks,
      hierarchicalEntries,
    };

    console.log(
      `Section 3 repair completed: processed ${usersProcessed} users in ${batchCount} batches`,
      result,
    );
    return result;
  },
});

// ============================================================================
// SECTION 3: USER-SPECIFIC AGGREGATES REPAIR (15-second safe)
// ============================================================================

/**
 * Get all user IDs for batch processing
 */
export const getAllUserIds = internalMutation({
  args: {},
  returns: v.array(v.id('users')),
  handler: async ctx => {
    const users = await ctx.db.query('users').collect();
    return users.map(u => u._id);
  },
});

/**
 * Process a small batch of users for user-specific aggregates (15-second safe)
 */
export const processUsersBatch = internalMutation({
  args: {
    userIds: v.array(v.id('users')),
  },
  returns: v.object({
    usersProcessed: v.number(),
    totalStats: v.number(),
    totalBookmarks: v.number(),
    hierarchicalEntries: v.number(),
  }),
  handler: async (ctx, args) => {
    const {
      answeredByUser,
      incorrectByUser,
      bookmarkedByUser,
      answeredByThemeByUser,
      answeredBySubthemeByUser,
      answeredByGroupByUser,
      incorrectByThemeByUser,
      incorrectBySubthemeByUser,
      incorrectByGroupByUser,
      bookmarkedByThemeByUser,
      bookmarkedBySubthemeByUser,
      bookmarkedByGroupByUser,
    } = await import('./aggregates');

    let usersProcessed = 0;
    let totalStats = 0;
    let totalBookmarks = 0;
    let hierarchicalEntries = 0;

    for (const userId of args.userIds) {
      // Clear all user aggregates
      await Promise.all([
        answeredByUser.clear(ctx, { namespace: userId }),
        incorrectByUser.clear(ctx, { namespace: userId }),
        bookmarkedByUser.clear(ctx, { namespace: userId }),
      ]);

      // Get user data with pagination to avoid large queries
      const userStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user', q => q.eq('userId', userId))
        .collect();

      const userBookmarks = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user', q => q.eq('userId', userId))
        .collect();

      // Process basic user aggregates
      for (const stat of userStats) {
        if (stat.hasAnswered) {
          await answeredByUser.insertIfDoesNotExist(ctx, stat);
        }
        if (stat.isIncorrect) {
          await incorrectByUser.insertIfDoesNotExist(ctx, stat);
        }
      }

      for (const bookmark of userBookmarks) {
        await bookmarkedByUser.insertIfDoesNotExist(ctx, bookmark);
      }

      // Process hierarchical aggregates efficiently
      const questionIds = new Set([
        ...userStats.map(s => s.questionId),
        ...userBookmarks.map(b => b.questionId),
      ]);

      // Batch get questions to avoid individual lookups
      const questions = new Map();
      for (const questionId of questionIds) {
        const question = await ctx.db.get(questionId);
        if (question) {
          questions.set(questionId, question);
        }
      }

      // Process hierarchical stats
      for (const stat of userStats) {
        const question = questions.get(stat.questionId);
        if (question) {
          // Answered hierarchical
          if (stat.hasAnswered) {
            if (question.themeId) {
              await answeredByThemeByUser.insertIfDoesNotExist(ctx, {
                ...stat,
                themeId: question.themeId,
              });
              hierarchicalEntries++;
            }
            if (question.subthemeId) {
              await answeredBySubthemeByUser.insertIfDoesNotExist(ctx, {
                ...stat,
                subthemeId: question.subthemeId,
              });
              hierarchicalEntries++;
            }
            if (question.groupId) {
              await answeredByGroupByUser.insertIfDoesNotExist(ctx, {
                ...stat,
                groupId: question.groupId,
              });
              hierarchicalEntries++;
            }
          }

          // Incorrect hierarchical
          if (stat.isIncorrect) {
            if (question.themeId) {
              await incorrectByThemeByUser.insertIfDoesNotExist(ctx, {
                ...stat,
                themeId: question.themeId,
              });
              hierarchicalEntries++;
            }
            if (question.subthemeId) {
              await incorrectBySubthemeByUser.insertIfDoesNotExist(ctx, {
                ...stat,
                subthemeId: question.subthemeId,
              });
              hierarchicalEntries++;
            }
            if (question.groupId) {
              await incorrectByGroupByUser.insertIfDoesNotExist(ctx, {
                ...stat,
                groupId: question.groupId,
              });
              hierarchicalEntries++;
            }
          }
        }
      }

      // Process bookmark hierarchical aggregates
      for (const bookmark of userBookmarks) {
        const question = questions.get(bookmark.questionId);
        if (question) {
          if (question.themeId) {
            await bookmarkedByThemeByUser.insertIfDoesNotExist(ctx, {
              ...bookmark,
              themeId: question.themeId,
            });
            hierarchicalEntries++;
          }
          if (question.subthemeId) {
            await bookmarkedBySubthemeByUser.insertIfDoesNotExist(ctx, {
              ...bookmark,
              subthemeId: question.subthemeId,
            });
            hierarchicalEntries++;
          }
          if (question.groupId) {
            await bookmarkedByGroupByUser.insertIfDoesNotExist(ctx, {
              ...bookmark,
              groupId: question.groupId,
            });
            hierarchicalEntries++;
          }
        }
      }

      totalStats += userStats.length;
      totalBookmarks += userBookmarks.length;
      usersProcessed++;

      console.log(
        `Processed user ${userId}: ${userStats.length} stats, ${userBookmarks.length} bookmarks`,
      );
    }

    const result = {
      usersProcessed,
      totalStats,
      totalBookmarks,
      hierarchicalEntries,
    };

    console.log(`Batch completed: ${usersProcessed} users processed`);
    return result;
  },
});

/**
 * One-click repair for a user (basic + hierarchical) - inline implementation
 */
export const repairUserAllAggregates = mutation({
  args: { userId: v.id('users') },
  returns: v.object({
    basic: v.object({
      answered: v.number(),
      incorrect: v.number(),
      bookmarked: v.number(),
    }),
    hierarchical: v.object({
      processed: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    // Clear all aggregates first
    await Promise.all([
      // Basic aggregates
      answeredByUser.clear(ctx, { namespace: args.userId }),
      incorrectByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByUser.clear(ctx, { namespace: args.userId }),
      // Hierarchical aggregates
      incorrectByThemeByUser.clear(ctx, { namespace: args.userId }),
      incorrectBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      incorrectByGroupByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByThemeByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByGroupByUser.clear(ctx, { namespace: args.userId }),
      answeredByThemeByUser.clear(ctx, { namespace: args.userId }),
      answeredBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      answeredByGroupByUser.clear(ctx, { namespace: args.userId }),
    ]);

    // Repair basic aggregates
    const stats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();

    let answered = 0,
      incorrect = 0;
    for (const stat of stats) {
      if (stat.hasAnswered) {
        await answeredByUser.insertIfDoesNotExist(ctx, stat);
        answered++;
      }
      if (stat.isIncorrect) {
        await incorrectByUser.insertIfDoesNotExist(ctx, stat);
        incorrect++;
      }
    }

    const bookmarks = await ctx.db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();

    let bookmarked = 0;
    for (const bookmark of bookmarks) {
      await bookmarkedByUser.insertIfDoesNotExist(ctx, bookmark);
      bookmarked++;
    }

    // Repair hierarchical aggregates
    let processed = 0;

    // Process stats for hierarchical
    for (const stat of stats) {
      const question = await ctx.db.get(stat.questionId);
      if (question) {
        // Answered hierarchical
        if (stat.hasAnswered) {
          if (question.themeId) {
            await answeredByThemeByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              themeId: question.themeId,
            });
          }
          if (question.subthemeId) {
            await answeredBySubthemeByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              subthemeId: question.subthemeId,
            });
          }
          if (question.groupId) {
            await answeredByGroupByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              groupId: question.groupId,
            });
          }
        }

        // Incorrect hierarchical
        if (stat.isIncorrect) {
          if (question.themeId) {
            await incorrectByThemeByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              themeId: question.themeId,
            });
          }
          if (question.subthemeId) {
            await incorrectBySubthemeByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              subthemeId: question.subthemeId,
            });
          }
          if (question.groupId) {
            await incorrectByGroupByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              groupId: question.groupId,
            });
          }
        }
        processed++;
      }
    }

    // Process bookmarks for hierarchical
    for (const bookmark of bookmarks) {
      const question = await ctx.db.get(bookmark.questionId);
      if (question) {
        if (question.themeId) {
          await bookmarkedByThemeByUser.insertIfDoesNotExist(ctx, {
            ...bookmark,
            themeId: question.themeId,
          });
        }
        if (question.subthemeId) {
          await bookmarkedBySubthemeByUser.insertIfDoesNotExist(ctx, {
            ...bookmark,
            subthemeId: question.subthemeId,
          });
        }
        if (question.groupId) {
          await bookmarkedByGroupByUser.insertIfDoesNotExist(ctx, {
            ...bookmark,
            groupId: question.groupId,
          });
        }
      }
    }

    return {
      basic: { answered, incorrect, bookmarked },
      hierarchical: { processed },
    };
  },
});
