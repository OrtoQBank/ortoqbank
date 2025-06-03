/* eslint-disable unicorn/prefer-ternary */
import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';

export const getHierarchicalData = query({
  args: {},
  handler: async ctx => {
    const hierarchy = await ctx.db.query('taxonomyHierarchy').first();
    return hierarchy?.themes || [];
  },
});

export const rebuildHierarchy = internalMutation({
  args: {},
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
      children: subthemes
        .filter(subtheme => subtheme.parentId === theme._id)
        .map(subtheme => ({
          _id: subtheme._id,
          type: 'subtheme' as const,
          parentId: theme._id,
          name: subtheme.name,
          children: groups
            .filter(group => group.parentId === subtheme._id)
            .map(group => ({
              _id: group._id,
              type: 'group' as const,
              parentId: subtheme._id,
              name: group.name,
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
  },
});

export const addTaxonomyItem = mutation({
  args: {
    type: v.union(
      v.literal('theme'),
      v.literal('subtheme'),
      v.literal('group'),
    ),
    name: v.string(),
    parentId: v.optional(v.id('taxonomy')),
  },
  handler: async (ctx, args) => {
    // Insert taxonomy item
    await ctx.db.insert('taxonomy', {
      type: args.type,
      name: args.name,
      parentId: args.parentId,
    });

    // Rebuild hierarchy
    await ctx.runMutation(internal.taxonomy.rebuildHierarchy, {});
  },
});
