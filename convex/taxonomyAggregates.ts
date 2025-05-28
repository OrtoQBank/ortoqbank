import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { query } from './_generated/server';
import { totalQuestionCount } from './aggregates';

// Generic taxonomy question count query
export const getTaxonomyQuestionCount = query({
  args: {
    taxonomyId: v.id('taxonomy'),
    level: v.union(
      v.literal('theme'),
      v.literal('subtheme'),
      v.literal('group'),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    // Direct query approach (aggregates can be added later)
    let questions;
    switch (args.level) {
      case 'theme': {
        questions = await ctx.db
          .query('questions')
          .withIndex('by_taxonomy_theme', q =>
            q.eq('TaxThemeId', args.taxonomyId),
          )
          .collect();
        break;
      }
      case 'subtheme': {
        questions = await ctx.db
          .query('questions')
          .withIndex('by_taxonomy_subtheme', q =>
            q.eq('TaxSubthemeId', args.taxonomyId),
          )
          .collect();
        break;
      }
      case 'group': {
        questions = await ctx.db
          .query('questions')
          .withIndex('by_taxonomy_group', q =>
            q.eq('TaxGroupId', args.taxonomyId),
          )
          .collect();
        break;
      }
      default: {
        questions = [];
      }
    }

    return questions.length;
  },
});

// Get all taxonomy items of a specific type
export const getTaxonomyByType = query({
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
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('taxonomy')
      .withIndex('by_type', q => q.eq('type', args.type))
      .collect();
  },
});

// Get taxonomy items by parent
export const getTaxonomyByParent = query({
  args: {
    parentId: v.optional(v.id('taxonomy')),
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
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('taxonomy')
      .withIndex('by_parent', q => q.eq('parentId', args.parentId))
      .collect();
  },
});

// PERFORMANCE WARNING: NEVER EVER USE `await ctx.db.query('questions').collect()`
// This will download the entire database and cause serious performance issues!
// Always use indexes and filters instead.
export const getLiveQuestionCountByTaxonomy = query({
  args: {
    taxonomyIds: v.optional(v.array(v.id('taxonomy'))),
    userId: v.optional(v.id('users')),
    questionMode: v.optional(
      v.union(
        v.literal('all'),
        v.literal('unanswered'),
        v.literal('incorrect'),
        v.literal('bookmarked'),
      ),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const questionIds = new Set<Id<'questions'>>();

    if (args.taxonomyIds && args.taxonomyIds.length > 0) {
      for (const taxonomyId of args.taxonomyIds) {
        // Use specific indexes for each taxonomy level to avoid downloading entire DB

        // Check theme level
        const themeQuestions = await ctx.db
          .query('questions')
          .withIndex('by_taxonomy_theme', q => q.eq('TaxThemeId', taxonomyId))
          .collect();
        themeQuestions.forEach(q => questionIds.add(q._id));

        // Check subtheme level
        const subthemeQuestions = await ctx.db
          .query('questions')
          .withIndex('by_taxonomy_subtheme', q =>
            q.eq('TaxSubthemeId', taxonomyId),
          )
          .collect();
        subthemeQuestions.forEach(q => questionIds.add(q._id));

        // Check group level
        const groupQuestions = await ctx.db
          .query('questions')
          .withIndex('by_taxonomy_group', q => q.eq('TaxGroupId', taxonomyId))
          .collect();
        groupQuestions.forEach(q => questionIds.add(q._id));
      }
    } else {
      // No taxonomy filter provided - if no user filtering needed, use efficient aggregate
      if (!args.userId || !args.questionMode || args.questionMode === 'all') {
        // Use O(log n) aggregate lookup instead of downloading entire database
        return await totalQuestionCount.count(ctx, {
          namespace: 'global',
          bounds: {},
        });
      } else {
        // User filtering needed but no taxonomy filter - we need all question IDs for filtering
        // This is a rare case that still requires getting question IDs, but we optimize by only getting IDs
        throw new Error(
          'Cannot apply user filters without taxonomy filters. This would require downloading entire database.',
        );
      }
    }

    return questionIds.size;
  },
});

// Get taxonomy hierarchy for a specific item
export const getTaxonomyHierarchy = query({
  args: {
    taxonomyId: v.id('taxonomy'),
  },
  returns: v.object({
    theme: v.optional(
      v.object({
        _id: v.id('taxonomy'),
        name: v.string(),
      }),
    ),
    subtheme: v.optional(
      v.object({
        _id: v.id('taxonomy'),
        name: v.string(),
      }),
    ),
    group: v.optional(
      v.object({
        _id: v.id('taxonomy'),
        name: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const taxonomy = await ctx.db.get(args.taxonomyId);
    if (!taxonomy) {
      throw new Error('Taxonomy not found');
    }

    let theme, subtheme, group;

    switch (taxonomy.type) {
      case 'theme': {
        theme = { _id: taxonomy._id, name: taxonomy.name };

        break;
      }
      case 'subtheme': {
        subtheme = { _id: taxonomy._id, name: taxonomy.name };
        if (taxonomy.pathIds && taxonomy.pathIds.length > 0) {
          const themeId = taxonomy.pathIds[0];
          const themeDoc = await ctx.db.get(themeId);
          if (themeDoc) {
            theme = { _id: themeDoc._id, name: themeDoc.name };
          }
        }

        break;
      }
      case 'group': {
        group = { _id: taxonomy._id, name: taxonomy.name };
        if (taxonomy.pathIds && taxonomy.pathIds.length >= 2) {
          const themeId = taxonomy.pathIds[0];
          const subthemeId = taxonomy.pathIds[1];

          const themeDoc = await ctx.db.get(themeId);
          const subthemeDoc = await ctx.db.get(subthemeId);

          if (themeDoc) {
            theme = { _id: themeDoc._id, name: themeDoc.name };
          }
          if (subthemeDoc) {
            subtheme = { _id: subthemeDoc._id, name: subthemeDoc.name };
          }
        }

        break;
      }
      // No default
    }

    return { theme, subtheme, group };
  },
});

// Helper function to get all descendant taxonomy IDs
export const getTaxonomyDescendants = query({
  args: {
    taxonomyId: v.id('taxonomy'),
  },
  returns: v.array(v.id('taxonomy')),
  handler: async (ctx, args) => {
    const descendants: Id<'taxonomy'>[] = [];

    // Get all taxonomy items that have this ID in their pathIds
    const allTaxonomies = await ctx.db.query('taxonomy').collect();

    for (const taxonomy of allTaxonomies) {
      if (taxonomy.pathIds && taxonomy.pathIds.includes(args.taxonomyId)) {
        descendants.push(taxonomy._id);
      }
    }

    return descendants;
  },
});
