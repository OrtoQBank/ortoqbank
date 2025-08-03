import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { canSafelyDelete, generateDefaultPrefix, normalizeText } from './utils';

// Queries
export const list = query({
  args: {},
  handler: async context => {
    return await context.db.query('themes').collect();
  },
});

export const getById = query({
  args: { id: v.id('themes') },
  handler: async (context, { id }) => {
    return await context.db.get(id);
  },
});

export const getHierarchicalData = query({
  args: {},
  handler: async context => {
    const themes = await context.db.query('themes').collect();
    const subthemes = await context.db.query('subthemes').collect();
    const groups = await context.db.query('groups').collect();

    return {
      themes,
      subthemes,
      groups,
    };
  },
});

// Mutations
export const create = mutation({
  args: {
    name: v.string(),
    prefix: v.optional(v.string()),
  },
  handler: async (context, { name, prefix }) => {
    // Check if theme with same name already exists
    const existing = await context.db
      .query('themes')
      .withIndex('by_name', q => q.eq('name', name))
      .unique();

    if (existing) {
      throw new Error(`Theme "${name}" already exists`);
    }

    // Generate default prefix from name if not provided
    let actualPrefix = prefix || generateDefaultPrefix(name, 3);

    // Ensure the prefix is normalized (remove accents)
    actualPrefix = normalizeText(actualPrefix).toUpperCase();

    return await context.db.insert('themes', {
      name,
      prefix: actualPrefix,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id('themes'),
    name: v.string(),
    prefix: v.optional(v.string()),
  },
  handler: async (context, { id, name, prefix }) => {
    // Check if theme exists
    const existing = await context.db.get(id);
    if (!existing) {
      throw new Error('Theme not found');
    }

    // Check if new name conflicts with another theme
    const nameConflict = await context.db
      .query('themes')
      .withIndex('by_name', q => q.eq('name', name))
      .unique();

    if (nameConflict && nameConflict._id !== id) {
      throw new Error(`Theme "${name}" already exists`);
    }

    // Normalize the prefix if one is provided
    const updates: any = { name };
    if (prefix !== undefined) {
      updates.prefix = normalizeText(prefix).toUpperCase();
    }

    // Update theme
    return await context.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id('themes') },
  handler: async (context, { id }) => {
    // Define dependencies to check
    const dependencies = [
      {
        table: 'subthemes',
        indexName: 'by_theme',
        fieldName: 'themeId',
        errorMessage: 'Cannot delete theme that has subthemes',
      },
      {
        table: 'questions',
        indexName: 'by_theme',
        fieldName: 'themeId',
        errorMessage: 'Cannot delete theme that is used by questions',
      },
      {
        table: 'presetQuizzes',
        indexName: 'by_theme',
        fieldName: 'themeId',
        errorMessage: 'Cannot delete theme that is used by preset quizzes',
      },
    ];

    // Check if theme can be safely deleted
    await canSafelyDelete(context, id, 'themes', dependencies);

    // If we get here, it means the theme can be safely deleted
    await context.db.delete(id);
  },
});
