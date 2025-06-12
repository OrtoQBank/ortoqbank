import { v } from 'convex/values';

import { internal } from './_generated/api';
import { mutation, query } from './_generated/server';
import { canSafelyDelete, generateDefaultPrefix, normalizeText } from './utils';

// This file provides the exact same API as the legacy subthemes.ts
// but uses the new taxonomy system underneath

// Queries
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('taxonomy'),
      _creationTime: v.number(),
      name: v.string(),
      themeId: v.id('taxonomy'),
      prefix: v.optional(v.string()),
    }),
  ),
  handler: async context => {
    const subthemes = await context.db
      .query('taxonomy')
      .withIndex('by_type', q => q.eq('type', 'subtheme'))
      .collect();

    return subthemes.map(subtheme => ({
      _id: subtheme._id,
      _creationTime: subtheme._creationTime,
      name: subtheme.name,
      themeId: subtheme.parentId!,
      prefix: subtheme.prefix,
    }));
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
      themeId: v.id('taxonomy'),
      prefix: v.optional(v.string()),
    }),
  ),
  handler: async (context, { id }) => {
    const item = await context.db.get(id);
    if (!item || item.type !== 'subtheme') return null;

    return {
      _id: item._id,
      _creationTime: item._creationTime,
      name: item.name,
      themeId: item.parentId!,
      prefix: item.prefix,
    };
  },
});

// Mutations
export const create = mutation({
  args: {
    name: v.string(),
    themeId: v.id('taxonomy'),
    prefix: v.optional(v.string()),
  },
  returns: v.id('taxonomy'),
  handler: async (context, { name, themeId, prefix }) => {
    // Verify parent theme exists
    const parentTheme = await context.db.get(themeId);
    if (!parentTheme || parentTheme.type !== 'theme') {
      throw new Error('Parent theme not found');
    }

    // Check if subtheme with same name already exists under this theme
    const existing = await context.db
      .query('taxonomy')
      .withIndex('by_parent', q => q.eq('parentId', themeId))
      .filter(q => q.eq(q.field('name'), name))
      .first();

    if (existing) {
      throw new Error(`Subtheme "${name}" already exists under this theme`);
    }

    // Generate default prefix from name if not provided
    let actualPrefix = prefix || generateDefaultPrefix(name, 2);

    // Ensure the prefix is normalized (remove accents)
    actualPrefix = normalizeText(actualPrefix).toUpperCase();

    const id = await context.db.insert('taxonomy', {
      name,
      type: 'subtheme',
      parentId: themeId,
      prefix: actualPrefix,
      pathIds: [themeId],
      pathNames: [parentTheme.name, name],
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
    // Check if subtheme exists
    const existing = await context.db.get(id);
    if (!existing || existing.type !== 'subtheme') {
      throw new Error('Subtheme not found');
    }

    // Check if new name conflicts with another subtheme under the same theme
    const nameConflict = await context.db
      .query('taxonomy')
      .withIndex('by_parent', q => q.eq('parentId', existing.parentId))
      .filter(q => q.eq(q.field('name'), name))
      .first();

    if (nameConflict && nameConflict._id !== id) {
      throw new Error(`Subtheme "${name}" already exists under this theme`);
    }

    // Normalize the prefix if one is provided
    const updates: any = { name };
    if (prefix !== undefined) {
      updates.prefix = normalizeText(prefix).toUpperCase();
    }

    // Update subtheme
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
    if (!item || item.type !== 'subtheme') {
      throw new Error('Subtheme not found');
    }

    // Check for children
    const children = await context.db
      .query('taxonomy')
      .withIndex('by_parent', q => q.eq('parentId', id))
      .first();

    if (children) {
      throw new Error('Cannot delete subtheme that has groups');
    }

    // Define dependencies to check
    const dependencies = [
      {
        table: 'questions',
        indexName: 'by_taxonomy_subtheme',
        fieldName: 'TaxSubthemeId',
        errorMessage: 'Cannot delete subtheme that is used by questions',
      },
      {
        table: 'presetQuizzes',
        indexName: 'by_taxonomy_subtheme',
        fieldName: 'TaxSubthemeId',
        errorMessage: 'Cannot delete subtheme that is used by preset quizzes',
      },
    ];

    // Check if subtheme can be safely deleted
    await canSafelyDelete(context, id, 'taxonomy', dependencies);

    // If we get here, it means the subtheme can be safely deleted
    await context.db.delete(id);

    // Rebuild hierarchy
    await context.scheduler.runAfter(0, internal.taxonomy.rebuildHierarchy, {});

    return null;
  },
});
