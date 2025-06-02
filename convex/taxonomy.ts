import { v } from 'convex/values';

import { query } from './_generated/server';

export const getHierarchicalData = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('taxonomy'),
      name: v.string(),
      type: v.union(
        v.literal('theme'),
        v.literal('subtheme'),
        v.literal('group'),
      ),
      parentId: v.optional(v.id('taxonomy')),
      children: v.optional(
        v.array(
          v.object({
            _id: v.id('taxonomy'),
            name: v.string(),
            type: v.union(
              v.literal('theme'),
              v.literal('subtheme'),
              v.literal('group'),
            ),
            parentId: v.optional(v.id('taxonomy')),
            children: v.optional(
              v.array(
                v.object({
                  _id: v.id('taxonomy'),
                  name: v.string(),
                  type: v.union(
                    v.literal('theme'),
                    v.literal('subtheme'),
                    v.literal('group'),
                  ),
                  parentId: v.optional(v.id('taxonomy')),
                }),
              ),
            ),
          }),
        ),
      ),
    }),
  ),
  handler: async ctx => {
    // Get all taxonomy items
    const allTaxonomy = await ctx.db.query('taxonomy').collect();

    // Separate by type
    const themes = allTaxonomy.filter(item => item.type === 'theme');
    const subthemes = allTaxonomy.filter(item => item.type === 'subtheme');
    const groups = allTaxonomy.filter(item => item.type === 'group');

    // Build hierarchical structure
    const hierarchical = themes.map(theme => ({
      ...theme,
      children: subthemes
        .filter(subtheme => subtheme.parentId === theme._id)
        .map(subtheme => ({
          ...subtheme,
          children: groups.filter(group => group.parentId === subtheme._id),
        })),
    }));

    return hierarchical;
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
      name: v.string(),
      type: v.union(
        v.literal('theme'),
        v.literal('subtheme'),
        v.literal('group'),
      ),
      parentId: v.optional(v.id('taxonomy')),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('taxonomy')
      .withIndex('by_type', q => q.eq('type', args.type))
      .collect();
  },
});

export const getByParent = query({
  args: { parentId: v.optional(v.id('taxonomy')) },
  returns: v.array(
    v.object({
      _id: v.id('taxonomy'),
      name: v.string(),
      type: v.union(
        v.literal('theme'),
        v.literal('subtheme'),
        v.literal('group'),
      ),
      parentId: v.optional(v.id('taxonomy')),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('taxonomy')
      .withIndex('by_parent', q => q.eq('parentId', args.parentId))
      .collect();
  },
});
