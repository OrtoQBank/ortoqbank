// ============================================================================
// SIMPLE AGGREGATE REPAIR FUNCTIONS
// ============================================================================

import { v } from 'convex/values';

import { internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
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
  questionCountByGroup,
  questionCountBySubtheme,
  questionCountByTheme,
  randomQuestions,
  randomQuestionsByGroup,
  randomQuestionsBySubtheme,
  randomQuestionsByTheme,
  totalQuestionCount,
} from './aggregates';

/**
 * Clear all aggregates for a user
 */
export const internalRepairClearUserAggregates = internalMutation({
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
export const internalRepairUserBasicAggregates = internalMutation({
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
export const internalRepairUserHierarchicalAggregates = internalMutation({
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
export const repairGlobalQuestionCount = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    startCursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    totalProcessed: v.number(),
    batchCount: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isComplete: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;

    // Only clear existing aggregates if this is the first call (no startCursor)
    if (!args.startCursor) {
      await totalQuestionCount.clear(ctx, { namespace: 'global' });
    }

    // Process questions in paginated batches
    let cursor: string | null = args.startCursor || null;
    let totalProcessed = 0;
    let batchCount = 0;
    let isComplete = false;

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

      // Check if we're done with all data
      if (result.isDone) {
        isComplete = true;
        cursor = null;
        break;
      }

      // If we have more data but this is getting large, we should break
      // and let the caller call us again with the cursor
      if (batchCount >= 10) {
        console.log(
          `Processed ${batchCount} batches, stopping to prevent timeout. Resume with cursor: ${cursor}`,
        );
        break;
      }
    } while (cursor);

    const message = isComplete
      ? `Repair completed: ${totalProcessed} questions processed in ${batchCount} batches`
      : `Partial repair: ${totalProcessed} questions processed in ${batchCount} batches. Resume with returned cursor.`;

    console.log(message);

    return {
      totalProcessed,
      batchCount,
      nextCursor: cursor,
      isComplete,
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
export const internalRepairClearSection1Aggregates = internalMutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    await totalQuestionCount.clear(ctx, { namespace: 'global' });
    console.log('Section 1 aggregates cleared');
    return null;
  },
});

/**
 * Process questions batch for global count (15-second safe)
 */
export const internalRepairProcessQuestionsBatchGlobal = internalMutation({
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
export const internalRepairProcessThemeAggregatesBatch = internalMutation({
  args: {
    themeIds: v.array(v.id('themes')),
  },
  returns: v.object({
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
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
export const internalRepairProcessSubthemeAggregatesBatch = internalMutation({
  args: {
    subthemeIds: v.array(v.id('subthemes')),
  },
  returns: v.object({
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
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
export const internalRepairProcessGroupAggregatesBatch = internalMutation({
  args: {
    groupIds: v.array(v.id('groups')),
  },
  returns: v.object({
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
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
export const internalRepairGetAllThemeIds = internalMutation({
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
export const internalRepairGetAllSubthemeIds = internalMutation({
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
export const internalRepairGetAllGroupIds = internalMutation({
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
export const internalRepairClearSection2Aggregates = internalMutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    await randomQuestions.clear(ctx, { namespace: 'global' });
    console.log('Section 2 aggregates cleared');
    return null;
  },
});

/**
 * Process questions batch for random selection (15-second safe)
 */
export const internalRepairProcessQuestionsBatchRandom = internalMutation({
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
export const internalRepairProcessThemeRandomAggregatesBatch = internalMutation(
  {
    args: {
      themeIds: v.array(v.id('themes')),
    },
    returns: v.object({
      processed: v.number(),
    }),
    handler: async (ctx, args) => {
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
  },
);

/**
 * Process subtheme random aggregates batch (15-second safe)
 */
export const internalRepairProcessSubthemeRandomAggregatesBatch =
  internalMutation({
    args: {
      subthemeIds: v.array(v.id('subthemes')),
    },
    returns: v.object({
      processed: v.number(),
    }),
    handler: async (ctx, args) => {
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
export const internalRepairProcessGroupRandomAggregatesBatch = internalMutation(
  {
    args: {
      groupIds: v.array(v.id('groups')),
    },
    returns: v.object({
      processed: v.number(),
    }),
    handler: async (ctx, args) => {
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
  },
);

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
export const internalRepairGetAllUserIds = internalMutation({
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
export const internalRepairProcessUsersBatch = internalMutation({
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
 * One-click repair for a user (basic + hierarchical) - delegates to tested internal mutations
 */
export const internalRepairUserAllAggregates = internalMutation({
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
  handler: async (
    ctx,
    args,
  ): Promise<{
    basic: { answered: number; incorrect: number; bookmarked: number };
    hierarchical: { processed: number };
  }> => {
    // Call existing tested internal mutations instead of duplicating logic
    const basic: { answered: number; incorrect: number; bookmarked: number } =
      await ctx.runMutation(
        internal.aggregateRepairs.internalRepairUserBasicAggregates,
        {
          userId: args.userId,
        },
      );

    const hierarchical: { processed: number } = await ctx.runMutation(
      internal.aggregateRepairs.internalRepairUserHierarchicalAggregates,
      {
        userId: args.userId,
      },
    );

    return {
      basic,
      hierarchical,
    };
  },
});

/**
 * Repair basic user aggregates (stats) with pagination (15-second safe)
 */
export const internalRepairUserBasicStatsBatch = internalMutation({
  args: {
    userId: v.id('users'),
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    answered: v.number(),
    incorrect: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 50;

    // Only clear aggregates if this is the first call (no cursor)
    if (!args.cursor) {
      await Promise.all([
        answeredByUser.clear(ctx, { namespace: args.userId }),
        incorrectByUser.clear(ctx, { namespace: args.userId }),
      ]);
    }

    let processed = 0;
    let answered = 0;
    let incorrect = 0;

    // Process userQuestionStats in batches
    const statsQuery = ctx.db
      .query('userQuestionStats')
      .withIndex('by_user', q => q.eq('userId', args.userId));

    const stats = await statsQuery.paginate({
      numItems: batchSize,
      cursor: args.cursor || null,
    });

    for (const stat of stats.page) {
      if (stat.hasAnswered) {
        await answeredByUser.insertIfDoesNotExist(ctx, stat);
        answered++;
      }
      if (stat.isIncorrect) {
        await incorrectByUser.insertIfDoesNotExist(ctx, stat);
        incorrect++;
      }
      processed++;
    }

    return {
      processed,
      answered,
      incorrect,
      nextCursor: stats.continueCursor || null,
      isDone: stats.isDone,
    };
  },
});

/**
 * Repair basic user aggregates (bookmarks) with pagination (15-second safe)
 */
export const internalRepairUserBasicBookmarksBatch = internalMutation({
  args: {
    userId: v.id('users'),
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    bookmarked: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 50;

    // Only clear bookmarks aggregate if this is the first call (no cursor)
    if (!args.cursor) {
      await bookmarkedByUser.clear(ctx, { namespace: args.userId });
    }

    let processed = 0;
    let bookmarked = 0;

    // Process userBookmarks in batches
    const bookmarksQuery = ctx.db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', args.userId));

    const bookmarks = await bookmarksQuery.paginate({
      numItems: batchSize,
      cursor: args.cursor || null,
    });

    for (const bookmark of bookmarks.page) {
      await bookmarkedByUser.insertIfDoesNotExist(ctx, bookmark);
      bookmarked++;
      processed++;
    }

    return {
      processed,
      bookmarked,
      nextCursor: bookmarks.continueCursor || null,
      isDone: bookmarks.isDone,
    };
  },
});

/**
 * Repair hierarchical aggregates for a user with pagination (15-second safe)
 */
export const internalRepairUserHierarchicalAggregatesBatch = internalMutation({
  args: {
    userId: v.id('users'),
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 50;

    // Only clear hierarchical aggregates if this is the first call (no cursor)
    if (!args.cursor) {
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
    }

    let processed = 0;

    // Process userQuestionStats in batches
    const statsQuery = ctx.db
      .query('userQuestionStats')
      .withIndex('by_user', q => q.eq('userId', args.userId));

    const stats = await statsQuery.paginate({
      numItems: batchSize,
      cursor: args.cursor || null,
    });

    // Collect all questionIds for batch fetching
    const questionIds = new Set(stats.page.map(stat => stat.questionId));

    // Batch fetch all questions
    const questions = new Map<Id<'questions'>, Doc<'questions'>>();
    for (const questionId of questionIds) {
      const question = await ctx.db.get(questionId);
      if (question) {
        questions.set(questionId, question);
      }
    }

    // Process stats (answered and incorrect)
    for (const stat of stats.page) {
      const question = questions.get(stat.questionId);
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
          processed++;
        }
      }
    }

    return {
      processed,
      nextCursor: stats.continueCursor || null,
      isDone: stats.isDone,
    };
  },
});

/**
 * Repair hierarchical bookmarks for a user with pagination (15-second safe)
 */
export const internalRepairUserHierarchicalBookmarksBatch = internalMutation({
  args: {
    userId: v.id('users'),
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 50;

    let processed = 0;

    // Process userBookmarks in batches
    const bookmarksQuery = ctx.db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', args.userId));

    const bookmarks = await bookmarksQuery.paginate({
      numItems: batchSize,
      cursor: args.cursor || null,
    });

    // Collect all questionIds for batch fetching
    const bookmarkQuestionIds = new Set(
      bookmarks.page.map(bookmark => bookmark.questionId),
    );

    // Batch fetch all questions
    const bookmarkQuestions = new Map<Id<'questions'>, Doc<'questions'>>();
    for (const questionId of bookmarkQuestionIds) {
      const question = await ctx.db.get(questionId);
      if (question) {
        bookmarkQuestions.set(questionId, question);
      }
    }

    // Process bookmarks
    for (const bookmark of bookmarks.page) {
      const question = bookmarkQuestions.get(bookmark.questionId);
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

    return {
      processed,
      nextCursor: bookmarks.continueCursor,
      isDone: bookmarks.isDone,
    };
  },
});
