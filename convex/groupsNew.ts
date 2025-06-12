import { v } from 'convex/values';

import { internal } from './_generated/api';
import { mutation, query } from './_generated/server';
import { canSafelyDelete, generateDefaultPrefix, normalizeText } from './utils';

// This file provides the exact same API as the legacy groups.ts
// but uses the new taxonomy system underneath

// Queries
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('taxonomy'),
      _creationTime: v.number(),
      name: v.string(),
      subthemeId: v.id('taxonomy'),
      prefix: v.optional(v.string()),
    }),
  ),
  handler: async context => {
    const groups = await context.db
      .query('taxonomy')
      .withIndex('by_type', q => q.eq('type', 'group'))
      .collect();

    return groups.map(group => ({
      _id: group._id,
      _creationTime: group._creationTime,
      name: group.name,
      subthemeId: group.parentId!,
      prefix: group.prefix,
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
      subthemeId: v.id('taxonomy'),
      prefix: v.optional(v.string()),
    }),
  ),
  handler: async (context, { id }) => {
    const item = await context.db.get(id);
    if (!item || item.type !== 'group') return null;

    return {
      _id: item._id,
      _creationTime: item._creationTime,
      name: item.name,
      subthemeId: item.parentId!,
      prefix: item.prefix,
    };
  },
});

// Mutations
export const create = mutation({
  args: {
    name: v.string(),
    subthemeId: v.id('taxonomy'),
    prefix: v.optional(v.string()),
  },
  returns: v.id('taxonomy'),
  handler: async (context, { name, subthemeId, prefix }) => {
    // Verify parent subtheme exists
    const parentSubtheme = await context.db.get(subthemeId);
    if (!parentSubtheme || parentSubtheme.type !== 'subtheme') {
      throw new Error('Parent subtheme not found');
    }

    // Check if group with same name already exists under this subtheme
    const existing = await context.db
      .query('taxonomy')
      .withIndex('by_parent', q => q.eq('parentId', subthemeId))
      .filter(q => q.eq(q.field('name'), name))
      .first();

    if (existing) {
      throw new Error(`Group "${name}" already exists under this subtheme`);
    }

    // Generate default prefix from name if not provided
    let actualPrefix = prefix || generateDefaultPrefix(name, 1);

    // Ensure the prefix is normalized (remove accents)
    actualPrefix = normalizeText(actualPrefix).toUpperCase();

    // Build path information
    const pathIds = parentSubtheme.pathIds
      ? [...parentSubtheme.pathIds, subthemeId]
      : [subthemeId];
    const pathNames = parentSubtheme.pathNames
      ? [...parentSubtheme.pathNames, name]
      : [parentSubtheme.name, name];

    const id = await context.db.insert('taxonomy', {
      name,
      type: 'group',
      parentId: subthemeId,
      prefix: actualPrefix,
      pathIds,
      pathNames,
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
    // Check if group exists
    const existing = await context.db.get(id);
    if (!existing || existing.type !== 'group') {
      throw new Error('Group not found');
    }

    // Check if new name conflicts with another group under the same subtheme
    const nameConflict = await context.db
      .query('taxonomy')
      .withIndex('by_parent', q => q.eq('parentId', existing.parentId))
      .filter(q => q.eq(q.field('name'), name))
      .first();

    if (nameConflict && nameConflict._id !== id) {
      throw new Error(`Group "${name}" already exists under this subtheme`);
    }

    // Normalize the prefix if one is provided
    const updates: any = { name };
    if (prefix !== undefined) {
      updates.prefix = normalizeText(prefix).toUpperCase();
    }

    // Update group
    await context.db.patch(id, updates);

    // Update path names if name changed (groups are leaf nodes, so no descendants to update)
    if (name !== existing.name && existing.pathNames) {
      const newPathNames = [...existing.pathNames];
      newPathNames[newPathNames.length - 1] = name; // Update the last element (group name)
      await context.db.patch(id, { pathNames: newPathNames });
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
    if (!item || item.type !== 'group') {
      throw new Error('Group not found');
    }

    // Define dependencies to check
    const dependencies = [
      {
        table: 'questions',
        indexName: 'by_taxonomy_group',
        fieldName: 'TaxGroupId',
        errorMessage: 'Cannot delete group that is used by questions',
      },
      {
        table: 'presetQuizzes',
        indexName: 'by_taxonomy_group',
        fieldName: 'TaxGroupId',
        errorMessage: 'Cannot delete group that is used by preset quizzes',
      },
    ];

    // Check if group can be safely deleted
    await canSafelyDelete(context, id, 'taxonomy', dependencies);

    // If we get here, it means the group can be safely deleted
    await context.db.delete(id);

    // Rebuild hierarchy
    await context.scheduler.runAfter(0, internal.taxonomy.rebuildHierarchy, {});

    return null;
  },
});
