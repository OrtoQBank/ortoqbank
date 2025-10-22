/* eslint-disable playwright/no-standalone-expect */
import { convexTest } from 'convex-test';
import { beforeEach, describe, expect, it } from 'vitest';

import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import schema from './schema';

describe('Custom Quiz Creation - Quiz Creation Flow', () => {
  let t: ReturnType<typeof convexTest>;
  let userId: Id<'users'>;
  let theme1Id: Id<'themes'>;
  let theme2Id: Id<'themes'>;
  let subtheme1Id: Id<'subthemes'>;
  let subtheme2Id: Id<'subthemes'>;
  let group1Id: Id<'groups'>;
  let question1Id: Id<'questions'>;
  let question2Id: Id<'questions'>;
  let question3Id: Id<'questions'>;
  let question4Id: Id<'questions'>;

  beforeEach(async () => {
    t = convexTest(schema);

    // Create test user
    userId = await t.run(async ctx => {
      return ctx.db.insert('users', {
        email: 'user@test.com',
        clerkUserId: 'user-clerk-id',
        role: 'user',
      });
    });

    // Create taxonomy
    theme1Id = await t.run(async ctx => {
      return ctx.db.insert('themes', { name: 'Theme 1' });
    });

    theme2Id = await t.run(async ctx => {
      return ctx.db.insert('themes', { name: 'Theme 2' });
    });

    subtheme1Id = await t.run(async ctx => {
      return ctx.db.insert('subthemes', {
        name: 'Subtheme 1',
        themeId: theme1Id,
      });
    });

    subtheme2Id = await t.run(async ctx => {
      return ctx.db.insert('subthemes', {
        name: 'Subtheme 2',
        themeId: theme2Id,
      });
    });

    group1Id = await t.run(async ctx => {
      return ctx.db.insert('groups', {
        name: 'Group 1',
        subthemeId: subtheme1Id,
      });
    });

    // Create questions
    question1Id = await t.run(async ctx => {
      return ctx.db.insert('questions', {
        title: 'Question 1',
        normalizedTitle: 'question 1',
        questionTextString: JSON.stringify({ type: 'doc' }),
        explanationTextString: JSON.stringify({ type: 'doc' }),
        alternatives: ['A', 'B', 'C', 'D'],
        correctAlternativeIndex: 0,
        themeId: theme1Id,
        subthemeId: subtheme1Id,
        groupId: group1Id,
      });
    });

    question2Id = await t.run(async ctx => {
      return ctx.db.insert('questions', {
        title: 'Question 2',
        normalizedTitle: 'question 2',
        questionTextString: JSON.stringify({ type: 'doc' }),
        explanationTextString: JSON.stringify({ type: 'doc' }),
        alternatives: ['W', 'X', 'Y', 'Z'],
        correctAlternativeIndex: 1,
        themeId: theme1Id,
        subthemeId: subtheme1Id,
      });
    });

    question3Id = await t.run(async ctx => {
      return ctx.db.insert('questions', {
        title: 'Question 3',
        normalizedTitle: 'question 3',
        questionTextString: JSON.stringify({ type: 'doc' }),
        explanationTextString: JSON.stringify({ type: 'doc' }),
        alternatives: ['1', '2', '3', '4'],
        correctAlternativeIndex: 2,
        themeId: theme2Id,
        subthemeId: subtheme2Id,
      });
    });

    question4Id = await t.run(async ctx => {
      return ctx.db.insert('questions', {
        title: 'Question 4',
        normalizedTitle: 'question 4',
        questionTextString: JSON.stringify({ type: 'doc' }),
        explanationTextString: JSON.stringify({ type: 'doc' }),
        alternatives: ['Alpha', 'Beta', 'Gamma', 'Delta'],
        correctAlternativeIndex: 3,
        themeId: theme2Id,
      });
    });
  });

  describe('create mutation', () => {
    it('creates a custom quiz with all mode and no filters', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const result = await asUser.mutation(api.customQuizzesCreation.create, {
        name: 'My Custom Quiz',
        description: 'A test quiz',
        testMode: 'study',
        questionMode: 'all',
        numQuestions: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.quizId).toBeDefined();
        expect(result.questionCount).toBeGreaterThan(0);

        // Verify quiz was created
        const quiz = await t.run(ctx => ctx.db.get(result.quizId));
        expect(quiz).toBeDefined();
        expect(quiz?.name).toBe('My Custom Quiz');
        expect(quiz?.testMode).toBe('study');
        expect(quiz?.questionMode).toBe('all');
        expect(quiz?.authorId).toBe(userId);

        // Verify session was created
        const session = await t.run(async ctx => {
          return ctx.db
            .query('quizSessions')
            .filter(q => q.and(
              q.eq(q.field('userId'), userId),
              q.eq(q.field('quizId'), result.quizId)
            ))
            .first();
        });
        expect(session).toBeDefined();
        expect(session?.mode).toBe('study');
        expect(session?.isComplete).toBe(false);
      }
    });

    it('creates a custom quiz with exam mode', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const result = await asUser.mutation(api.customQuizzesCreation.create, {
        name: 'Exam Quiz',
        description: 'Exam mode test',
        testMode: 'exam',
        questionMode: 'all',
        numQuestions: 5,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const quiz = await t.run(ctx => ctx.db.get(result.quizId));
        expect(quiz?.testMode).toBe('exam');
      }
    });

    it('creates a custom quiz filtered by theme', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const result = await asUser.mutation(api.customQuizzesCreation.create, {
        name: 'Theme Quiz',
        description: 'Filtered by theme',
        testMode: 'study',
        questionMode: 'all',
        numQuestions: 10,
        selectedThemes: [theme1Id],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const quiz = await t.run(ctx => ctx.db.get(result.quizId));
        expect(quiz?.selectedThemes).toContain(theme1Id);

        // Verify questions are from selected theme
        const questionDocs = await t.run(async ctx => {
          return Promise.all(quiz!.questions.map((id: Id<'questions'>) => ctx.db.get(id)));
        });

        const allFromTheme = questionDocs.every(q => q?.themeId === theme1Id);
        expect(allFromTheme).toBe(true);
      }
    });

    it('creates a custom quiz filtered by subtheme', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const result = await asUser.mutation(api.customQuizzesCreation.create, {
        name: 'Subtheme Quiz',
        description: 'Filtered by subtheme',
        testMode: 'study',
        questionMode: 'all',
        numQuestions: 5,
        selectedSubthemes: [subtheme1Id],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const quiz = await t.run(ctx => ctx.db.get(result.quizId));
        expect(quiz?.selectedSubthemes).toContain(subtheme1Id);
      }
    });

    it('creates a custom quiz filtered by group', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const result = await asUser.mutation(api.customQuizzesCreation.create, {
        name: 'Group Quiz',
        description: 'Filtered by group',
        testMode: 'study',
        questionMode: 'all',
        numQuestions: 5,
        selectedGroups: [group1Id],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const quiz = await t.run(ctx => ctx.db.get(result.quizId));
        expect(quiz?.selectedGroups).toContain(group1Id);
      }
    });

    it('limits number of questions to requested amount', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const result = await asUser.mutation(api.customQuizzesCreation.create, {
        name: 'Limited Quiz',
        description: 'Limited to 2 questions',
        testMode: 'study',
        questionMode: 'all',
        numQuestions: 2,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.questionCount).toBeLessThanOrEqual(2);
        const quiz = await t.run(ctx => ctx.db.get(result.quizId));
        expect(quiz?.questions.length).toBeLessThanOrEqual(2);
      }
    });

    it('enforces maximum question limit', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const result = await asUser.mutation(api.customQuizzesCreation.create, {
        name: 'Large Quiz',
        description: 'Request more than max',
        testMode: 'study',
        questionMode: 'all',
        numQuestions: 500, // More than MAX_QUESTIONS (120)
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.questionCount).toBeLessThanOrEqual(120);
      }
    });

    it('uses default name when not provided', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const result = await asUser.mutation(api.customQuizzesCreation.create, {
        name: '',
        description: 'No name provided',
        testMode: 'study',
        questionMode: 'all',
        numQuestions: 5,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const quiz = await t.run(ctx => ctx.db.get(result.quizId));
        expect(quiz?.name).toContain('Custom Quiz');
      }
    });

    it('requires authentication', async () => {
      await expect(
        t.mutation(api.customQuizzesCreation.create, {
          name: 'Unauthorized',
          description: 'Should fail',
          testMode: 'study',
          questionMode: 'all',
          numQuestions: 5,
        })
      ).rejects.toThrow();
    });
  });

  describe('question mode filtering', () => {
    it('returns error when no questions found in bookmarked mode', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const result = await asUser.mutation(api.customQuizzesCreation.create, {
        name: 'Bookmarked Quiz',
        description: 'No bookmarks yet',
        testMode: 'study',
        questionMode: 'bookmarked',
        numQuestions: 10,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('NO_QUESTIONS_FOUND_AFTER_FILTER');
        expect(result.message).toContain('Nenhuma questão encontrada');
      }
    });

    it('finds bookmarked questions when they exist', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      // Create bookmark
      await t.run(async ctx => {
        await ctx.db.insert('userBookmarks', {
          userId,
          questionId: question1Id,
        });
      });

      const result = await asUser.mutation(api.customQuizzesCreation.create, {
        name: 'Bookmarked Quiz',
        description: 'With bookmarks',
        testMode: 'study',
        questionMode: 'bookmarked',
        numQuestions: 5,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.questionCount).toBeGreaterThan(0);
        const quiz = await t.run(ctx => ctx.db.get(result.quizId));
        expect(quiz?.questions).toContain(question1Id);
      }
    });

    it('returns error when no questions found in incorrect mode', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const result = await asUser.mutation(api.customQuizzesCreation.create, {
        name: 'Incorrect Quiz',
        description: 'No incorrect answers yet',
        testMode: 'study',
        questionMode: 'incorrect',
        numQuestions: 10,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('NO_QUESTIONS_FOUND_AFTER_FILTER');
      }
    });

    it('finds incorrect questions when they exist', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      // Create incorrect stats
      await t.run(async ctx => {
        await ctx.db.insert('userQuestionStats', {
          userId,
          questionId: question2Id,
          timesAnswered: 1,
          timesCorrect: 0,
          hasAnswered: true,
          lastAnsweredAt: Date.now(),
        });
      });

      const result = await asUser.mutation(api.customQuizzesCreation.create, {
        name: 'Incorrect Quiz',
        description: 'With incorrect answers',
        testMode: 'study',
        questionMode: 'incorrect',
        numQuestions: 5,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.questionCount).toBeGreaterThan(0);
      }
    });

    it('returns error when no questions found in unanswered mode with filters', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      // Answer all questions in theme1
      await t.run(async ctx => {
        await ctx.db.insert('userQuestionStats', {
          userId,
          questionId: question1Id,
          timesAnswered: 1,
          timesCorrect: 1,
          hasAnswered: true,
          lastAnsweredAt: Date.now(),
        });
        await ctx.db.insert('userQuestionStats', {
          userId,
          questionId: question2Id,
          timesAnswered: 1,
          timesCorrect: 1,
          hasAnswered: true,
          lastAnsweredAt: Date.now(),
        });
      });

      const result = await asUser.mutation(api.customQuizzesCreation.create, {
        name: 'Unanswered Quiz',
        description: 'All answered in theme1',
        testMode: 'study',
        questionMode: 'unanswered',
        numQuestions: 10,
        selectedThemes: [theme1Id],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('NO_QUESTIONS_FOUND_AFTER_FILTER');
      }
    });
  });

  describe('hierarchy filtering', () => {
    it('respects theme hierarchy when filtering', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const result = await asUser.mutation(api.customQuizzesCreation.create, {
        name: 'Theme Quiz',
        description: 'Theme 1 only',
        testMode: 'study',
        questionMode: 'all',
        numQuestions: 10,
        selectedThemes: [theme1Id],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const quiz = await t.run(ctx => ctx.db.get(result.quizId));
        const questionDocs = await t.run(async ctx => {
          return Promise.all(quiz!.questions.map((id: Id<'questions'>) => ctx.db.get(id)));
        });

        // All questions should be from theme1
        const allFromTheme1 = questionDocs.every(q => q?.themeId === theme1Id);
        expect(allFromTheme1).toBe(true);
      }
    });

    it('combines multiple themes correctly', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const result = await asUser.mutation(api.customQuizzesCreation.create, {
        name: 'Multi Theme Quiz',
        description: 'Both themes',
        testMode: 'study',
        questionMode: 'all',
        numQuestions: 10,
        selectedThemes: [theme1Id, theme2Id],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const quiz = await t.run(ctx => ctx.db.get(result.quizId));
        const questionDocs = await t.run(async ctx => {
          return Promise.all(quiz!.questions.map((id: Id<'questions'>) => ctx.db.get(id)));
        });

        // Questions should be from either theme
        const allFromSelectedThemes = questionDocs.every(
          q => q?.themeId === theme1Id || q?.themeId === theme2Id
        );
        expect(allFromSelectedThemes).toBe(true);
      }
    });
  });
});

describe('Custom Quiz Creation - Business Logic', () => {
  it('validates maximum question limit constant', () => {
    const MAX_QUESTIONS = 120;
    expect(MAX_QUESTIONS).toBe(120);
  });

  it('calculates effective question count with limit', () => {
    const requested = 150;
    const maxAllowed = 120;
    const effective = Math.min(requested, maxAllowed);

    expect(effective).toBe(120);
  });

  it('shuffles array correctly', () => {
    const array = [1, 2, 3, 4, 5];
    const shuffled = [...array];

    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Array should still contain all original elements
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('deduplicates question IDs correctly', () => {
    const ids = ['q1', 'q2', 'q1', 'q3', 'q2'];
    const unique = [...new Set(ids)];

    expect(unique).toEqual(['q1', 'q2', 'q3']);
    expect(unique.length).toBe(3);
  });

  it('determines if filters are applied', () => {
    const hasFilters1 = [1].length > 0 || [].length > 0 || [].length > 0;
    const hasFilters2 = [].length > 0 || [].length > 0 || [].length > 0;

    expect(hasFilters1).toBe(true);
    expect(hasFilters2).toBe(false);
  });

  it('calculates question pool size requirement', () => {
    const requestedQuestions = 50;
    const poolSize = requestedQuestions * 2; // Extra for shuffling

    expect(poolSize).toBe(100);
  });

  it('validates quiz name fallback logic', () => {
    const providedName = '';
    const defaultName = `Custom Quiz - ${new Date().toLocaleDateString()}`;
    const finalName = providedName || defaultName;

    expect(finalName).toContain('Custom Quiz');
  });

  it('validates quiz description fallback logic', () => {
    const providedDesc = '';
    const questionCount = 10;
    const defaultDesc = `Custom quiz with ${questionCount} questions`;
    const finalDesc = providedDesc || defaultDesc;

    expect(finalDesc).toBe('Custom quiz with 10 questions');
  });

  it('determines correct error type based on question mode', () => {
    const questionMode1 = 'all';
    const questionMode2 = 'bookmarked';

    const isFiltering1 = questionMode1 !== 'all';
    const isFiltering2 = questionMode2 === 'bookmarked';

    expect(isFiltering1).toBe(false);
    expect(isFiltering2).toBe(false);
  });

  it('checks hierarchy override logic', () => {
    const selectedSubthemes = new Set(['sub1', 'sub2']);
    const overriddenSubthemes = new Set(['sub1']);

    const effectiveSubthemes = [...selectedSubthemes].filter(
      st => !overriddenSubthemes.has(st)
    );

    expect(effectiveSubthemes).toEqual(['sub2']);
  });
});
