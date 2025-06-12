/* eslint-disable unicorn/prefer-ternary */
import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import { canSafelyDelete, generateDefaultPrefix, normalizeText } from './utils';

// Queries
export const getHierarchicalData = query({
  args: {},
  returns: v.object({
    themes: v.array(
      v.object({
        _id: v.id('taxonomy'),
        type: v.literal('theme'),
        parentId: v.optional(v.id('taxonomy')),
        name: v.string(),
        prefix: v.optional(v.string()),
        children: v.array(
          v.object({
            _id: v.id('taxonomy'),
            type: v.literal('subtheme'),
            parentId: v.id('taxonomy'),
            name: v.string(),
            prefix: v.optional(v.string()),
            children: v.array(
              v.object({
                _id: v.id('taxonomy'),
                type: v.literal('group'),
                parentId: v.id('taxonomy'),
                name: v.string(),
                prefix: v.optional(v.string()),
              }),
            ),
          }),
        ),
      }),
    ),
  }),
  handler: async ctx => {
    const hierarchy = await ctx.db.query('taxonomyHierarchy').first();
    return { themes: hierarchy?.themes || [] };
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
      type: v.union(
        v.literal('theme'),
        v.literal('subtheme'),
        v.literal('group'),
      ),
      parentId: v.optional(v.id('taxonomy')),
      pathIds: v.optional(v.array(v.id('taxonomy'))),
      pathNames: v.optional(v.array(v.string())),
      prefix: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('taxonomy'),
      _creationTime: v.number(),
      name: v.string(),
      type: v.union(
        v.literal('theme'),
        v.literal('subtheme'),
        v.literal('group'),
      ),
      parentId: v.optional(v.id('taxonomy')),
      pathIds: v.optional(v.array(v.id('taxonomy'))),
      pathNames: v.optional(v.array(v.string())),
      prefix: v.optional(v.string()),
    }),
  ),
  handler: async ctx => {
    return await ctx.db.query('taxonomy').collect();
  },
});

export const getByType = query({
  args: {
    type: v.union(
      v.literal('theme'),
      v.literal('subtheme'),
      v.literal('group'),
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id('taxonomy'),
      _creationTime: v.number(),
      name: v.string(),
      type: v.union(
        v.literal('theme'),
        v.literal('subtheme'),
        v.literal('group'),
      ),
      parentId: v.optional(v.id('taxonomy')),
      pathIds: v.optional(v.array(v.id('taxonomy'))),
      pathNames: v.optional(v.array(v.string())),
      prefix: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { type }) => {
    return await ctx.db
      .query('taxonomy')
      .withIndex('by_type', q => q.eq('type', type))
      .collect();
  },
});

export const getByParent = query({
  args: { parentId: v.optional(v.id('taxonomy')) },
  returns: v.array(
    v.object({
      _id: v.id('taxonomy'),
      _creationTime: v.number(),
      name: v.string(),
      type: v.union(
        v.literal('theme'),
        v.literal('subtheme'),
        v.literal('group'),
      ),
      parentId: v.optional(v.id('taxonomy')),
      pathIds: v.optional(v.array(v.id('taxonomy'))),
      pathNames: v.optional(v.array(v.string())),
      prefix: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { parentId }) => {
    return await ctx.db
      .query('taxonomy')
      .withIndex('by_parent', q => q.eq('parentId', parentId))
      .collect();
  },
});

// Internal mutation to rebuild hierarchy
export const rebuildHierarchy = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx, args) => {
    const allTaxonomy = await ctx.db.query('taxonomy').collect();

    const themes = allTaxonomy.filter(item => item.type === 'theme');
    const subthemes = allTaxonomy.filter(item => item.type === 'subtheme');
    const groups = allTaxonomy.filter(item => item.type === 'group');

    const hierarchy = themes.map(theme => ({
      _id: theme._id,
      type: 'theme' as const,
      parentId: theme.parentId,
      name: theme.name,
      prefix: theme.prefix,
      children: subthemes
        .filter(subtheme => subtheme.parentId === theme._id)
        .map(subtheme => ({
          _id: subtheme._id,
          type: 'subtheme' as const,
          parentId: theme._id,
          name: subtheme.name,
          prefix: subtheme.prefix,
          children: groups
            .filter(group => group.parentId === subtheme._id)
            .map(group => ({
              _id: group._id,
              type: 'group' as const,
              parentId: subtheme._id,
              name: group.name,
              prefix: group.prefix,
            })),
        })),
    }));

    const existing = await ctx.db.query('taxonomyHierarchy').first();
    const currentVersion = existing?.version ?? 0;

    if (existing) {
      // Update existing doc
      await ctx.db.patch(existing._id, {
        themes: hierarchy,
        lastUpdated: Date.now(),
        version: currentVersion + 1,
      });
    } else {
      // Insert new doc
      await ctx.db.insert('taxonomyHierarchy', {
        themes: hierarchy,
        lastUpdated: Date.now(),
        version: 1,
      });
    }

    return null;
  },
});

// Calculate path information
const calculatePath = async (ctx: any, parentId: string | undefined) => {
  const pathIds: any[] = [];
  const pathNames: string[] = [];

  let currentParentId = parentId;
  while (currentParentId) {
    const parent = await ctx.db.get(currentParentId);
    if (!parent) break;

    pathIds.unshift(parent._id);
    pathNames.unshift(parent.name);
    currentParentId = parent.parentId;
  }

  return { pathIds, pathNames };
};

// Mutations
export const create = internalMutation({
  args: {
    type: v.union(
      v.literal('theme'),
      v.literal('subtheme'),
      v.literal('group'),
    ),
    name: v.string(),
    parentId: v.optional(v.id('taxonomy')),
    prefix: v.optional(v.string()),
  },
  returns: v.id('taxonomy'),
  handler: async (ctx, args) => {
    // Check if item with same name and parent already exists
    const existing = await ctx.db
      .query('taxonomy')
      .withIndex('by_parent', q => q.eq('parentId', args.parentId))
      .filter(q => q.eq(q.field('name'), args.name))
      .first();

    if (existing) {
      throw new Error(
        `${args.type} "${args.name}" already exists in this location`,
      );
    }

    // Validate parent relationship
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent) {
        throw new Error('Parent not found');
      }

      // Validate hierarchy rules
      if (args.type === 'theme' && parent.type !== 'theme') {
        throw new Error('Themes can only have theme parents or no parent');
      }
      if (args.type === 'subtheme' && parent.type !== 'theme') {
        throw new Error('Subthemes must have a theme parent');
      }
      if (args.type === 'group' && parent.type !== 'subtheme') {
        throw new Error('Groups must have a subtheme parent');
      }
    } else if (args.type !== 'theme') {
      throw new Error('Only themes can be root level items');
    }

    // Calculate path information
    const { pathIds, pathNames } = await calculatePath(ctx, args.parentId);

    // Generate default prefix if not provided
    let actualPrefix = args.prefix;
    if (!actualPrefix) {
      const prefixLength =
        args.type === 'theme' ? 3 : args.type === 'subtheme' ? 2 : 1;
      actualPrefix = generateDefaultPrefix(args.name, prefixLength);
    }

    // Normalize the prefix
    actualPrefix = normalizeText(actualPrefix).toUpperCase();

    // Insert taxonomy item
    const id = await ctx.db.insert('taxonomy', {
      type: args.type,
      name: args.name,
      parentId: args.parentId,
      pathIds,
      pathNames,
      prefix: actualPrefix,
    });

    // Rebuild hierarchy
    await ctx.scheduler.runAfter(0, internal.taxonomy.rebuildHierarchy, {});

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
  handler: async (ctx, { id, name, prefix }) => {
    // Check if item exists
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error('Item not found');
    }

    // Check if new name conflicts with siblings
    const nameConflict = await ctx.db
      .query('taxonomy')
      .withIndex('by_parent', q => q.eq('parentId', existing.parentId))
      .filter(q => q.eq(q.field('name'), name))
      .first();

    if (nameConflict && nameConflict._id !== id) {
      throw new Error(
        `${existing.type} "${name}" already exists in this location`,
      );
    }

    // Prepare updates
    const updates: any = { name };
    if (prefix !== undefined) {
      updates.prefix = normalizeText(prefix).toUpperCase();
    }

    // Update the item
    await ctx.db.patch(id, updates);

    // Update path names for all descendants if name changed
    if (name !== existing.name) {
      const descendants = await ctx.db
        .query('taxonomy')
        .filter(q =>
          q.and(
            q.neq(q.field('pathIds'), null),
            q.neq(q.field('pathNames'), null),
          ),
        )
        .collect();

      for (const descendant of descendants) {
        if (descendant.pathIds && descendant.pathNames) {
          const indexInPath = descendant.pathIds.indexOf(id);
          if (indexInPath !== -1) {
            const newPathNames = [...descendant.pathNames];
            newPathNames[indexInPath] = name;
            await ctx.db.patch(descendant._id, { pathNames: newPathNames });
          }
        }
      }
    }

    // Rebuild hierarchy
    await ctx.scheduler.runAfter(0, internal.taxonomy.rebuildHierarchy, {});

    return null;
  },
});

export const remove = mutation({
  args: { id: v.id('taxonomy') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const item = await ctx.db.get(id);
    if (!item) {
      throw new Error('Item not found');
    }

    // Check for children
    const children = await ctx.db
      .query('taxonomy')
      .withIndex('by_parent', q => q.eq('parentId', id))
      .first();

    if (children) {
      throw new Error(`Cannot delete ${item.type} that has children`);
    }

    // Define dependencies to check based on type
    const dependencies: any[] = [];

    switch (item.type) {
      case 'theme': {
        dependencies.push(
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
        );

        break;
      }
      case 'subtheme': {
        dependencies.push(
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
            errorMessage:
              'Cannot delete subtheme that is used by preset quizzes',
          },
        );

        break;
      }
      case 'group': {
        dependencies.push(
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
        );

        break;
      }
      // No default
    }

    // Check if item can be safely deleted
    await canSafelyDelete(ctx, id, 'taxonomy', dependencies);

    // Delete the item
    await ctx.db.delete(id);

    // Rebuild hierarchy
    await ctx.scheduler.runAfter(0, internal.taxonomy.rebuildHierarchy, {});

    return null;
  },
});

// Migration utilities
export const migrateLegacyToTaxonomy = internalMutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    // This function would migrate data from legacy tables to taxonomy
    // Implementation depends on your specific migration strategy
    console.log('Migration function - implement based on your needs');
    return null;
  },
});
