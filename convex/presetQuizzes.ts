import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    category: v.union(v.literal('trilha'), v.literal('simulado')),
    themeId: v.optional(v.id('themes')),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
    questions: v.array(v.id('questions')),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    // For trilhas, themeId is required
    if (args.category === 'trilha' && !args.themeId) {
      throw new Error('themeId is required for trilhas');
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
    });
  },
});

export const list = query({
  handler: async ctx => {
    return await ctx.db.query('presetQuizzes').collect();
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
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quizId, {
      name: args.name,
      description: args.description,
      category: args.category,
      questions: args.questions,
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
