import { v } from 'convex/values';

import { internal } from './_generated/api';
import { mutation, query } from './_generated/server';
import { canSafelyDelete, generateDefaultPrefix, normalizeText } from './utils';

// This file provides the exact same API as the legacy themes.ts
// but uses the new taxonomy system underneath

// Queries
export const getHierarchicalData = query({
  args: {},
  returns: v.object({
    themes: v.array(
      v.object({
        _id: v.id('taxonomy'),
        _creationTime: v.number(),
        name: v.string(),
        prefix: v.optional(v.string()),
        displayOrder: v.optional(v.number()),
      }),
    ),
    subthemes: v.array(
      v.object({
        _id: v.id('taxonomy'),
        _creationTime: v.number(),
        name: v.string(),
        themeId: v.id('taxonomy'), // This maps to parentId in taxonomy
        prefix: v.optional(v.string()),
      }),
    ),
    groups: v.array(
      v.object({
        _id: v.id('taxonomy'),
        _creationTime: v.number(),
        name: v.string(),
        subthemeId: v.id('taxonomy'), // This maps to parentId in taxonomy
        prefix: v.optional(v.string()),
      }),
    ),
  }),
  handler: async context => {
    const allTaxonomy = await context.db.query('taxonomy').collect();

    const themes = allTaxonomy
      .filter(item => item.type === 'theme')
      .map(theme => ({
        _id: theme._id,
        _creationTime: theme._creationTime,
        name: theme.name,
        prefix: theme.prefix,
        displayOrder: undefined, // Legacy field, not used in new system
      }));

    const subthemes = allTaxonomy
      .filter(item => item.type === 'subtheme')
      .map(subtheme => ({
        _id: subtheme._id,
        _creationTime: subtheme._creationTime,
        name: subtheme.name,
        themeId: subtheme.parentId!, // Required for subthemes
        prefix: subtheme.prefix,
      }));

    const groups = allTaxonomy
      .filter(item => item.type === 'group')
      .map(group => ({
        _id: group._id,
        _creationTime: group._creationTime,
        name: group.name,
        subthemeId: group.parentId!, // Required for groups
        prefix: group.prefix,
      }));

    return {
      themes,
      subthemes,
      groups,
    };
  },
});

export const getById = query({
  args: { id: v.id('taxonomy') },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('taxonomy'),
      _creationTime: v.number(),
      name: v.string(),
      prefix: v.optional(v.string()),
      displayOrder: v.optional(v.number()),
    }),
  ),
  handler: async (context, { id }) => {
    const item = await context.db.get(id);
    if (!item) return null;

    return {
      _id: item._id,
      _creationTime: item._creationTime,
      name: item.name,
      prefix: item.prefix,
      displayOrder: undefined,
    };
  },
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('taxonomy'),
      _creationTime: v.number(),
      name: v.string(),
      prefix: v.optional(v.string()),
      displayOrder: v.optional(v.number()),
    }),
  ),
  handler: async context => {
    const themes = await context.db
      .query('taxonomy')
      .withIndex('by_type', q => q.eq('type', 'theme'))
      .collect();

    return themes.map(theme => ({
      _id: theme._id,
      _creationTime: theme._creationTime,
      name: theme.name,
      prefix: theme.prefix,
      displayOrder: undefined,
    }));
  },
});

// Mutations
export const create = mutation({
  args: {
    name: v.string(),
    prefix: v.optional(v.string()),
  },
  returns: v.id('taxonomy'),
  handler: async (context, { name, prefix }) => {
    // Check if theme with same name already exists
    const existing = await context.db
      .query('taxonomy')
      .withIndex('by_type', q => q.eq('type', 'theme'))
      .filter(q => q.eq(q.field('name'), name))
      .first();

    if (existing) {
      throw new Error(`Theme "${name}" already exists`);
    }

    // Generate default prefix from name if not provided
    let actualPrefix = prefix || generateDefaultPrefix(name, 3);

    // Ensure the prefix is normalized (remove accents)
    actualPrefix = normalizeText(actualPrefix).toUpperCase();

    const id = await context.db.insert('taxonomy', {
      name,
      type: 'theme',
      prefix: actualPrefix,
      parentId: undefined,
      pathIds: [],
      pathNames: [name],
    });

    // Rebuild hierarchy
    await context.scheduler.runAfter(0, internal.taxonomy.rebuildHierarchy, {});

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id('taxonomy'),
    name: v.string(),
    prefix: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (context, { id, name, prefix }) => {
    // Check if theme exists
    const existing = await context.db.get(id);
    if (!existing || existing.type !== 'theme') {
      throw new Error('Theme not found');
    }

    // Check if new name conflicts with another theme
    const nameConflict = await context.db
      .query('taxonomy')
      .withIndex('by_type', q => q.eq('type', 'theme'))
      .filter(q => q.eq(q.field('name'), name))
      .first();

    if (nameConflict && nameConflict._id !== id) {
      throw new Error(`Theme "${name}" already exists`);
    }

    // Normalize the prefix if one is provided
    const updates: any = { name };
    if (prefix !== undefined) {
      updates.prefix = normalizeText(prefix).toUpperCase();
    }

    // Update theme
    await context.db.patch(id, updates);

    // Update path names for all descendants if name changed
    if (name !== existing.name) {
      const descendants = await context.db
        .query('taxonomy')
        .filter(q =>
          q.and(
            q.neq(q.field('pathIds'), null),
            q.neq(q.field('pathNames'), null),
          ),
        )
        .collect();

      for (const descendant of descendants) {
        if (
          descendant.pathIds &&
          descendant.pathNames &&
          descendant.pathIds.includes(id)
        ) {
          const indexInPath = descendant.pathIds.indexOf(id);
          if (indexInPath !== -1) {
            const newPathNames = [...descendant.pathNames];
            newPathNames[indexInPath] = name;
            await context.db.patch(descendant._id, { pathNames: newPathNames });
          }
        }
      }
    }

    // Rebuild hierarchy
    await context.scheduler.runAfter(0, internal.taxonomy.rebuildHierarchy, {});

    return null;
  },
});

export const remove = mutation({
  args: { id: v.id('taxonomy') },
  returns: v.null(),
  handler: async (context, { id }) => {
    const item = await context.db.get(id);
    if (!item || item.type !== 'theme') {
      throw new Error('Theme not found');
    }

    // Check for children
    const children = await context.db
      .query('taxonomy')
      .withIndex('by_parent', q => q.eq('parentId', id))
      .first();

    if (children) {
      throw new Error('Cannot delete theme that has subthemes');
    }

    // Define dependencies to check
    const dependencies = [
      {
        table: 'questions',
        indexName: 'by_taxonomy_theme',
        fieldName: 'TaxThemeId',
        errorMessage: 'Cannot delete theme that is used by questions',
      },
      {
        table: 'presetQuizzes',
        indexName: 'by_taxonomy_theme',
        fieldName: 'TaxThemeId',
        errorMessage: 'Cannot delete theme that is used by preset quizzes',
      },
    ];

    // Check if theme can be safely deleted
    await canSafelyDelete(context, id, 'taxonomy', dependencies);

    // If we get here, it means the theme can be safely deleted
    await context.db.delete(id);

    // Rebuild hierarchy
    await context.scheduler.runAfter(0, internal.taxonomy.rebuildHierarchy, {});

    return null;
  },
});
