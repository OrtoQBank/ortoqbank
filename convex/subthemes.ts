import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireAdmin } from './users';
import { canSafelyDelete, generateDefaultPrefix, normalizeText } from './utils';

// Queries
export const list = query({
  args: { themeId: v.optional(v.id('themes')) },
  handler: async (context, { themeId }) => {
    if (themeId) {
      return await context.db
        .query('subthemes')
        .withIndex('by_theme', q => q.eq('themeId', themeId))
        .collect();
    }
    return await context.db.query('subthemes').collect();
  },
});

export const getById = query({
  args: { id: v.id('subthemes') },
  handler: async (context, { id }) => {
    return await context.db.get(id);
  },
});

export const listByThemes = query({
  handler: async context => {
    return await context.db.query('subthemes').collect();
  },
});

// Mutations
export const create = mutation({
  args: {
    name: v.string(),
    themeId: v.id('themes'),
    prefix: v.optional(v.string()),
  },
  handler: async (context, { name, themeId, prefix }) => {
    // Verify admin access
    await requireAdmin(context);
    // Check if theme exists
    const theme = await context.db.get(themeId);
    if (!theme) {
      throw new Error('Theme not found');
    }

    // Generate default prefix from name if not provided
    let actualPrefix = prefix || generateDefaultPrefix(name, 2);

    // Ensure the prefix is normalized (remove accents)
    actualPrefix = normalizeText(actualPrefix).toUpperCase();

    return await context.db.insert('subthemes', {
      name,
      themeId,
      prefix: actualPrefix,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id('subthemes'),
    name: v.string(),
    themeId: v.id('themes'),
    prefix: v.optional(v.string()),
  },
  handler: async (context, { id, name, themeId, prefix }) => {
    // Verify admin access
    await requireAdmin(context);
    // Check if subtheme exists
    const existing = await context.db.get(id);
    if (!existing) {
      throw new Error('Subtheme not found');
    }

    // Check if theme exists
    const theme = await context.db.get(themeId);
    if (!theme) {
      throw new Error('Theme not found');
    }

    // Normalize the prefix if one is provided
    const updates: any = { name, themeId };
    if (prefix !== undefined) {
      updates.prefix = normalizeText(prefix).toUpperCase();
    }

    return await context.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id('subthemes') },
  handler: async (context, { id }) => {
    // Verify admin access
    await requireAdmin(context);
    // Define dependencies to check
    const dependencies = [
      {
        table: 'groups',
        indexName: 'by_subtheme',
        fieldName: 'subthemeId',
        errorMessage: 'Cannot delete subtheme that has groups',
      },
      {
        table: 'questions',
        indexName: 'by_subtheme',
        fieldName: 'subthemeId',
        errorMessage: 'Cannot delete subtheme that is used by questions',
      },
      {
        table: 'presetQuizzes',
        indexName: 'by_subtheme',
        fieldName: 'subthemeId',
        errorMessage: 'Cannot delete subtheme that is used by preset quizzes',
      },
    ];

    // Check if subtheme can be safely deleted
    await canSafelyDelete(context, id, 'subthemes', dependencies);

    // If we get here, it means the subtheme can be safely deleted
    await context.db.delete(id);
  },
});
