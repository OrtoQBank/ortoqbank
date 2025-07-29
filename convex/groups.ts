import { v } from 'convex/values';

import { internal } from './_generated/api';
import { mutation, query } from './_generated/server';
import { canSafelyDelete, generateDefaultPrefix, normalizeText } from './utils';

// Queries
export const list = query({
  args: { subthemeId: v.optional(v.id('subthemes')) },
  handler: async (context, { subthemeId }) => {
    if (subthemeId) {
      return await context.db
        .query('groups')
        .withIndex('by_subtheme', q => q.eq('subthemeId', subthemeId))
        .collect();
    }
    return await context.db.query('groups').collect();
  },
});

export const getById = query({
  args: { id: v.id('groups') },
  handler: async (context, { id }) => {
    return await context.db.get(id);
  },
});

// Mutations
export const create = mutation({
  args: {
    name: v.string(),
    subthemeId: v.id('subthemes'),
    prefix: v.optional(v.string()),
  },
  handler: async (context, { name, subthemeId, prefix }) => {
    // Check if subtheme exists
    const subtheme = await context.db.get(subthemeId);
    if (!subtheme) {
      throw new Error('Subtheme not found');
    }

    // Generate default prefix from name if not provided
    let actualPrefix = prefix || generateDefaultPrefix(name, 1);

    // Ensure the prefix is normalized (remove accents)
    actualPrefix = normalizeText(actualPrefix).toUpperCase();

    return await context.db.insert('groups', {
      name,
      subthemeId,
      prefix: actualPrefix,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id('groups'),
    name: v.string(),
    subthemeId: v.id('subthemes'),
    prefix: v.optional(v.string()),
  },
  handler: async (context, { id, name, subthemeId, prefix }) => {
    // Check if group exists
    const existing = await context.db.get(id);
    if (!existing) {
      throw new Error('Group not found');
    }

    // Check if subtheme exists
    const subtheme = await context.db.get(subthemeId);
    if (!subtheme) {
      throw new Error('Subtheme not found');
    }

    // Normalize the prefix if one is provided
    const updates: any = { name, subthemeId };
    if (prefix !== undefined) {
      updates.prefix = normalizeText(prefix).toUpperCase();
    }

    return await context.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id('groups') },
  handler: async (context, { id }) => {
    // Define dependencies to check
    const dependencies = [
      {
        table: 'questions',
        indexName: 'by_group',
        fieldName: 'groupId',
        errorMessage: 'Cannot delete group that is used by questions',
      },
      {
        table: 'presetQuizzes',
        indexName: 'by_group',
        fieldName: 'groupId',
        errorMessage: 'Cannot delete group that is used by preset quizzes',
      },
    ];

    // Check if group can be safely deleted
    await canSafelyDelete(context, id, 'groups', dependencies);

    // Clean up question counts before deleting the group
    try {
      await context.runMutation(
        internal.questions.cleanupQuestionCountsForGroup,
        { groupId: id },
      );
    } catch (error) {
      console.warn(`Error cleaning up question counts for group ${id}:`, error);
      // Continue with deletion even if cleanup fails
    }

    // If we get here, it means the group can be safely deleted
    await context.db.delete(id);
  },
});
