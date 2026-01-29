import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { verifyTenantAccess } from './auth';

export const create = mutation({
  args: {
    tenantId: v.optional(v.id('apps')),
    name: v.string(),
    description: v.string(),
    category: v.union(v.literal('trilha'), v.literal('simulado')),
    themeId: v.optional(v.id('themes')),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
    questions: v.array(v.id('questions')),
    isPublic: v.boolean(),
    subcategory: v.optional(v.string()),
    displayOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // For trilhas, themeId is required
    if (args.category === 'trilha' && !args.themeId) {
      throw new Error('themeId is required for trilhas');
    }

    // Use provided tenantId or fall back to default tenant
    let tenantId = args.tenantId;
    if (!tenantId) {
      const defaultApp = await ctx.db
        .query('apps')
        .withIndex('by_slug', q => q.eq('slug', 'ortoqbank'))
        .first();
      tenantId = defaultApp?._id;
    }

    return await ctx.db.insert('presetQuizzes', {
      name: args.name,
      description: args.description,
      category: args.category,
      themeId: args.themeId,
      subthemeId: args.subthemeId,
      groupId: args.groupId,
      questions: args.questions,
      isPublic: args.isPublic,
      subcategory: args.subcategory,
      displayOrder: args.displayOrder,
      // Multi-tenancy
      tenantId,
    });
  },
});

export const list = query({
  args: { tenantId: v.optional(v.id('apps')) },
  handler: async (ctx, { tenantId }) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(ctx, tenantId);

    if (tenantId) {
      return await ctx.db
        .query('presetQuizzes')
        .withIndex('by_tenant', q => q.eq('tenantId', tenantId))
        .collect();
    }
    return await ctx.db.query('presetQuizzes').collect();
  },
});

// Returns trilhas filtered and sorted by displayOrder
export const listTrilhasSorted = query({
  args: { tenantId: v.optional(v.id('apps')) },
  returns: v.array(
    v.object({
      _id: v.id('presetQuizzes'),
      _creationTime: v.number(),
      tenantId: v.optional(v.id('apps')),
      name: v.string(),
      description: v.string(),
      category: v.union(v.literal('trilha'), v.literal('simulado')),
      questions: v.array(v.id('questions')),
      subcategory: v.optional(v.string()),
      themeId: v.optional(v.id('themes')),
      subthemeId: v.optional(v.id('subthemes')),
      groupId: v.optional(v.id('groups')),
      isPublic: v.boolean(),
      displayOrder: v.optional(v.number()),
      TaxThemeId: v.optional(v.string()),
      TaxSubthemeId: v.optional(v.string()),
      TaxGroupId: v.optional(v.string()),
      taxonomyPathIds: v.optional(v.array(v.string())),
    }),
  ),
  handler: async (ctx, { tenantId }) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(ctx, tenantId);

    let trilhas;
    if (tenantId) {
      // Use compound index for tenant + category
      trilhas = await ctx.db
        .query('presetQuizzes')
        .withIndex('by_tenant_and_category', q =>
          q.eq('tenantId', tenantId).eq('category', 'trilha'),
        )
        .collect();
    } else {
      // Fall back to category-only index
      trilhas = await ctx.db
        .query('presetQuizzes')
        .withIndex('by_category', q => q.eq('category', 'trilha'))
        .collect();
    }

    // Sort by displayOrder, then name
    return trilhas.toSorted((a, b) => {
      if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
        return a.displayOrder - b.displayOrder;
      }
      if (a.displayOrder === undefined && b.displayOrder === undefined) {
        return a.name.localeCompare(b.name);
      }
      // a.displayOrder is undefined, b.displayOrder is defined -> a goes after b
      if (a.displayOrder === undefined) return 1;
      // a.displayOrder is defined, b.displayOrder is undefined -> a goes before b
      return -1;
    });
  },
});

// Returns simulados filtered and sorted by displayOrder
export const listSimuladosSorted = query({
  args: { tenantId: v.optional(v.id('apps')) },
  returns: v.array(
    v.object({
      _id: v.id('presetQuizzes'),
      _creationTime: v.number(),
      tenantId: v.optional(v.id('apps')),
      name: v.string(),
      description: v.string(),
      category: v.union(v.literal('trilha'), v.literal('simulado')),
      questions: v.array(v.id('questions')),
      subcategory: v.optional(v.string()),
      themeId: v.optional(v.id('themes')),
      subthemeId: v.optional(v.id('subthemes')),
      groupId: v.optional(v.id('groups')),
      isPublic: v.boolean(),
      displayOrder: v.optional(v.number()),
      TaxThemeId: v.optional(v.string()),
      TaxSubthemeId: v.optional(v.string()),
      TaxGroupId: v.optional(v.string()),
      taxonomyPathIds: v.optional(v.array(v.string())),
    }),
  ),
  handler: async (ctx, { tenantId }) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(ctx, tenantId);

    let simulados;
    if (tenantId) {
      // Use compound index for tenant + category
      simulados = await ctx.db
        .query('presetQuizzes')
        .withIndex('by_tenant_and_category', q =>
          q.eq('tenantId', tenantId).eq('category', 'simulado'),
        )
        .collect();
    } else {
      // Fall back to category-only index
      simulados = await ctx.db
        .query('presetQuizzes')
        .withIndex('by_category', q => q.eq('category', 'simulado'))
        .collect();
    }

    // Sort by displayOrder, then name
    return simulados.toSorted((a, b) => {
      if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
        return a.displayOrder - b.displayOrder;
      }
      if (a.displayOrder === undefined && b.displayOrder === undefined) {
        return a.name.localeCompare(b.name);
      }
      // a.displayOrder is undefined, b.displayOrder is defined -> a goes after b
      if (a.displayOrder === undefined) return 1;
      // a.displayOrder is defined, b.displayOrder is undefined -> a goes before b
      return -1;
    });
  },
});

export const addQuestion = mutation({
  args: {
    quizId: v.id('presetQuizzes'),
    questionId: v.id('questions'),
  },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new Error('Quiz not found');

    const updatedQuestions = [...quiz.questions, args.questionId];
    await ctx.db.patch(args.quizId, { questions: updatedQuestions });
  },
});

export const removeQuestion = mutation({
  args: {
    quizId: v.id('presetQuizzes'),
    questionId: v.id('questions'),
  },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new Error('Quiz not found');

    const updatedQuestions = quiz.questions.filter(
      id => id !== args.questionId,
    );
    await ctx.db.patch(args.quizId, { questions: updatedQuestions });
  },
});

export const updateQuestions = mutation({
  args: {
    quizId: v.id('presetQuizzes'),
    questions: v.array(v.id('questions')),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quizId, {
      questions: args.questions,
    });
  },
});

export const updateQuiz = mutation({
  args: {
    quizId: v.id('presetQuizzes'),
    name: v.string(),
    description: v.string(),
    category: v.union(v.literal('trilha'), v.literal('simulado')),
    questions: v.array(v.id('questions')),
    subcategory: v.optional(v.string()),
    displayOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quizId, {
      name: args.name,
      description: args.description,
      category: args.category,
      questions: args.questions,
      subcategory: args.subcategory,
      displayOrder: args.displayOrder,
    });
  },
});

export const deleteQuiz = mutation({
  args: {
    quizId: v.id('presetQuizzes'),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.quizId);
  },
});

export const get = query({
  args: { id: v.id('presetQuizzes') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getWithQuestions = query({
  args: { id: v.id('presetQuizzes') },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.id);
    if (!quiz) return;

    const questions = await Promise.all(
      quiz.questions.map(async id => await ctx.db.get(id)),
    );
    return { ...quiz, questions };
  },
});

export const searchByName = query({
  args: {
    tenantId: v.optional(v.id('apps')),
    name: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(ctx, args.tenantId);

    if (!args.name || args.name.trim() === '') {
      return [];
    }

    // Normalize the search term
    const searchTerm = args.name.trim();

    // Use provided limit or default to 50
    const limit = args.limit || 50;

    // Use the search index for efficient text search
    let matchingQuizzes = await ctx.db
      .query('presetQuizzes')
      .withSearchIndex('search_by_name', q => q.search('name', searchTerm))
      .take(limit);

    // Filter by tenant if provided
    if (args.tenantId) {
      matchingQuizzes = matchingQuizzes.filter(
        q => q.tenantId === args.tenantId,
      );
    }

    return matchingQuizzes;
  },
});
