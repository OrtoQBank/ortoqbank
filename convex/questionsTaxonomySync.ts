import { GenericMutationCtx } from 'convex/server';

import { DataModel, Doc, Id } from './_generated/dataModel';

// =============================================================================
// TAXONOMY DENORMALIZATION HELPERS
// =============================================================================
// These functions handle denormalization of taxonomy fields when a question's
// theme/subtheme/group changes. This updates related tables:
// - userQuestionStats: denormalized taxonomy IDs
// - userBookmarks: denormalized taxonomy IDs
// - userStatsCounts: pre-computed aggregate counts per user
//
// NOTE: Question aggregates (totalQuestionCount, questionCountByTheme, etc.)
// are now handled automatically via triggers in functions.ts
// =============================================================================

/**
 * Updates denormalized taxonomy fields in related tables when a question's
 * taxonomy (theme/subtheme/group) changes.
 *
 * Call this after patching a question when taxonomy fields are updated.
 */
export async function updateTaxonomyDenormalization(
  ctx: GenericMutationCtx<DataModel>,
  questionId: Id<'questions'>,
  oldDoc: Doc<'questions'>,
  newDoc: Doc<'questions'>,
) {
  // Check if any taxonomy fields changed
  const themeChanged = oldDoc.themeId !== newDoc.themeId;
  const subthemeChanged = oldDoc.subthemeId !== newDoc.subthemeId;
  const groupChanged = oldDoc.groupId !== newDoc.groupId;

  const taxonomyChanged = themeChanged || subthemeChanged || groupChanged;

  if (!taxonomyChanged) {
    return; // No taxonomy changes, nothing to denormalize
  }

  console.log(
    `Question ${questionId} taxonomy changed, updating denormalized fields...`,
  );

  // ============================================================================
  // UPDATE DENORMALIZED TAXONOMY FIELDS IN RELATED TABLES
  // ============================================================================

  // Update userQuestionStats records for this question
  const questionStats = await ctx.db
    .query('userQuestionStats')
    .withIndex('by_question', q => q.eq('questionId', questionId))
    .collect();

  if (questionStats.length > 0) {
    console.log(
      `Updating ${questionStats.length} userQuestionStats records for question ${questionId}`,
    );
    for (const stat of questionStats) {
      await ctx.db.patch(stat._id, {
        themeId: newDoc.themeId,
        subthemeId: newDoc.subthemeId,
        groupId: newDoc.groupId,
      });
    }
  }

  // Update userBookmarks records for this question
  const questionBookmarks = await ctx.db
    .query('userBookmarks')
    .withIndex('by_question', q => q.eq('questionId', questionId))
    .collect();

  if (questionBookmarks.length > 0) {
    console.log(
      `Updating ${questionBookmarks.length} userBookmarks records for question ${questionId}`,
    );
    for (const bookmark of questionBookmarks) {
      await ctx.db.patch(bookmark._id, {
        themeId: newDoc.themeId,
        subthemeId: newDoc.subthemeId,
        groupId: newDoc.groupId,
      });
    }
  }

  // ============================================================================
  // UPDATE USER STATS COUNTS (Pre-computed aggregates)
  // ============================================================================
  // When a question moves between themes/subthemes/groups, we need to update
  // the pre-computed counts in userStatsCounts for all affected users

  // Collect all affected user IDs (from both stats and bookmarks)
  const affectedUserIds = new Set<Id<'users'>>();
  for (const stat of questionStats) {
    affectedUserIds.add(stat.userId);
  }
  for (const bookmark of questionBookmarks) {
    affectedUserIds.add(bookmark.userId);
  }

  if (affectedUserIds.size === 0) {
    return; // No users affected
  }

  console.log(
    `Updating userStatsCounts for ${affectedUserIds.size} affected users`,
  );

  const tenantId = newDoc.tenantId;

  for (const userId of affectedUserIds) {
    // Query tenant-specific userStatsCounts record
    const userCounts = tenantId
      ? await ctx.db
          .query('userStatsCounts')
          .withIndex('by_tenant_and_user', q =>
            q.eq('tenantId', tenantId).eq('userId', userId),
          )
          .first()
      : await ctx.db
          .query('userStatsCounts')
          .withIndex('by_user', q => q.eq('userId', userId))
          .first();

    if (!userCounts) {
      // No counts record for this user, nothing to update
      continue;
    }

    const updates: Record<string, any> = {
      lastUpdated: Date.now(),
    };

    // Find this user's stat for this question
    const userStat = questionStats.find(s => s.userId === userId);
    const userBookmark = questionBookmarks.find(b => b.userId === userId);

    // Update theme counts if theme changed
    if (themeChanged && oldDoc.themeId && newDoc.themeId) {
      const oldThemeId = oldDoc.themeId;
      const newThemeId = newDoc.themeId;

      // Move answered counts
      if (userStat?.hasAnswered) {
        const newAnsweredByTheme = { ...userCounts.answeredByTheme };
        newAnsweredByTheme[oldThemeId] = Math.max(
          0,
          (newAnsweredByTheme[oldThemeId] || 0) - 1,
        );
        newAnsweredByTheme[newThemeId] =
          (newAnsweredByTheme[newThemeId] || 0) + 1;
        updates.answeredByTheme = newAnsweredByTheme;
      }

      // Move incorrect counts
      if (userStat?.isIncorrect) {
        const newIncorrectByTheme = { ...userCounts.incorrectByTheme };
        newIncorrectByTheme[oldThemeId] = Math.max(
          0,
          (newIncorrectByTheme[oldThemeId] || 0) - 1,
        );
        newIncorrectByTheme[newThemeId] =
          (newIncorrectByTheme[newThemeId] || 0) + 1;
        updates.incorrectByTheme = newIncorrectByTheme;
      }

      // Move bookmark counts
      if (userBookmark) {
        const newBookmarkedByTheme = { ...userCounts.bookmarkedByTheme };
        newBookmarkedByTheme[oldThemeId] = Math.max(
          0,
          (newBookmarkedByTheme[oldThemeId] || 0) - 1,
        );
        newBookmarkedByTheme[newThemeId] =
          (newBookmarkedByTheme[newThemeId] || 0) + 1;
        updates.bookmarkedByTheme = newBookmarkedByTheme;
      }
    }

    // Update subtheme counts if subtheme changed
    if (subthemeChanged) {
      const oldSubthemeId = oldDoc.subthemeId;
      const newSubthemeId = newDoc.subthemeId;

      // Move answered counts
      if (userStat?.hasAnswered) {
        const newAnsweredBySubtheme = { ...userCounts.answeredBySubtheme };
        if (oldSubthemeId) {
          newAnsweredBySubtheme[oldSubthemeId] = Math.max(
            0,
            (newAnsweredBySubtheme[oldSubthemeId] || 0) - 1,
          );
        }
        if (newSubthemeId) {
          newAnsweredBySubtheme[newSubthemeId] =
            (newAnsweredBySubtheme[newSubthemeId] || 0) + 1;
        }
        updates.answeredBySubtheme = newAnsweredBySubtheme;
      }

      // Move incorrect counts
      if (userStat?.isIncorrect) {
        const newIncorrectBySubtheme = { ...userCounts.incorrectBySubtheme };
        if (oldSubthemeId) {
          newIncorrectBySubtheme[oldSubthemeId] = Math.max(
            0,
            (newIncorrectBySubtheme[oldSubthemeId] || 0) - 1,
          );
        }
        if (newSubthemeId) {
          newIncorrectBySubtheme[newSubthemeId] =
            (newIncorrectBySubtheme[newSubthemeId] || 0) + 1;
        }
        updates.incorrectBySubtheme = newIncorrectBySubtheme;
      }

      // Move bookmark counts
      if (userBookmark) {
        const newBookmarkedBySubtheme = { ...userCounts.bookmarkedBySubtheme };
        if (oldSubthemeId) {
          newBookmarkedBySubtheme[oldSubthemeId] = Math.max(
            0,
            (newBookmarkedBySubtheme[oldSubthemeId] || 0) - 1,
          );
        }
        if (newSubthemeId) {
          newBookmarkedBySubtheme[newSubthemeId] =
            (newBookmarkedBySubtheme[newSubthemeId] || 0) + 1;
        }
        updates.bookmarkedBySubtheme = newBookmarkedBySubtheme;
      }
    }

    // Update group counts if group changed
    if (groupChanged) {
      const oldGroupId = oldDoc.groupId;
      const newGroupId = newDoc.groupId;

      // Move answered counts
      if (userStat?.hasAnswered) {
        const newAnsweredByGroup = { ...userCounts.answeredByGroup };
        if (oldGroupId) {
          newAnsweredByGroup[oldGroupId] = Math.max(
            0,
            (newAnsweredByGroup[oldGroupId] || 0) - 1,
          );
        }
        if (newGroupId) {
          newAnsweredByGroup[newGroupId] =
            (newAnsweredByGroup[newGroupId] || 0) + 1;
        }
        updates.answeredByGroup = newAnsweredByGroup;
      }

      // Move incorrect counts
      if (userStat?.isIncorrect) {
        const newIncorrectByGroup = { ...userCounts.incorrectByGroup };
        if (oldGroupId) {
          newIncorrectByGroup[oldGroupId] = Math.max(
            0,
            (newIncorrectByGroup[oldGroupId] || 0) - 1,
          );
        }
        if (newGroupId) {
          newIncorrectByGroup[newGroupId] =
            (newIncorrectByGroup[newGroupId] || 0) + 1;
        }
        updates.incorrectByGroup = newIncorrectByGroup;
      }

      // Move bookmark counts
      if (userBookmark) {
        const newBookmarkedByGroup = { ...userCounts.bookmarkedByGroup };
        if (oldGroupId) {
          newBookmarkedByGroup[oldGroupId] = Math.max(
            0,
            (newBookmarkedByGroup[oldGroupId] || 0) - 1,
          );
        }
        if (newGroupId) {
          newBookmarkedByGroup[newGroupId] =
            (newBookmarkedByGroup[newGroupId] || 0) + 1;
        }
        updates.bookmarkedByGroup = newBookmarkedByGroup;
      }
    }

    // Apply updates if any changes were made
    if (Object.keys(updates).length > 1) {
      // More than just lastUpdated
      await ctx.db.patch(userCounts._id, updates);
    }
  }

  console.log(`Taxonomy denormalization complete for question ${questionId}`);
}
