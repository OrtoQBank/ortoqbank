/* eslint-disable playwright/no-standalone-expect */
import { convexTest } from 'convex-test';
import { beforeEach, describe, expect, it } from 'vitest';

import { api } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import schema from './schema';

describe('CustomQuizzes Functions', () => {
  describe('create', () => {
    it('should create a custom quiz with basic parameters', async () => {
      const t = convexTest(schema);

      const asUser = t.withIdentity({
        name: 'Test User',
        subject: 'test-user',
        tokenIdentifier: 'test-user-token',
      });

      // Create a user record first
      await t.run(async ctx => {
        await ctx.db.insert('users', {
          email: 'user@test.com',
          clerkUserId: 'test-user',
        });
      });

      // Create test data (theme and questions)
      const themeId = await asUser.mutation(api.themes.create, {
        name: 'Test Theme',
      });

      const questionIds = await Promise.all([
        asUser.mutation(api.questions.create, {
          title: 'Test Question 1',
          questionTextString: JSON.stringify({
            type: 'doc',
            content: [{ type: 'text', text: 'What is 1+1?' }],
          }),
          explanationTextString: JSON.stringify({
            type: 'doc',
            content: [{ type: 'text', text: 'Basic math' }],
          }),
          alternatives: ['2', '3', '4', '5'],
          correctAlternativeIndex: 0,
          themeId,
        }),
        asUser.mutation(api.questions.create, {
          title: 'Test Question 2',
          questionTextString: JSON.stringify({
            type: 'doc',
            content: [{ type: 'text', text: 'What is 2+2?' }],
          }),
          explanationTextString: JSON.stringify({
            type: 'doc',
            content: [{ type: 'text', text: 'Basic math' }],
          }),
          alternatives: ['2', '3', '4', '5'],
          correctAlternativeIndex: 2,
          themeId,
        }),
      ]);

      // Create a custom quiz
      const result = await asUser.mutation(api.customQuizzes.create, {
        name: 'Test Custom Quiz',
        description: 'A test custom quiz',
        testMode: 'study',
        questionMode: 'all',
        numQuestions: 2,
        selectedThemes: [themeId],
      });

      // Verify the quiz was created successfully
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.quizId).toBeDefined();
        expect(result.questionCount).toBe(2);

        // Verify the quiz exists in the database
        const quiz = await asUser.query(api.customQuizzes.getById, {
          id: result.quizId,
        });

        expect(quiz).toMatchObject({
          name: 'Test Custom Quiz',
          description: 'A test custom quiz',
          testMode: 'study',
          questionMode: 'all',
          questions: expect.arrayContaining([
            expect.objectContaining({
              title: 'Test Question 1',
            }),
            expect.objectContaining({
              title: 'Test Question 2',
            }),
          ]),
        });
      }
    });

    it('should return error when no questions are found', async () => {
      const t = convexTest(schema);

      const asUser = t.withIdentity({
        name: 'Test User',
        subject: 'test-user',
        tokenIdentifier: 'test-user-token',
      });

      // Create a user record first
      await t.run(async ctx => {
        await ctx.db.insert('users', {
          email: 'user@test.com',
          clerkUserId: 'test-user',
        });
      });

      // Create a theme but no questions
      const themeId = await asUser.mutation(api.themes.create, {
        name: 'Empty Theme',
      });

      // Try to create a custom quiz with no available questions
      const result = await asUser.mutation(api.customQuizzes.create, {
        name: 'Empty Quiz',
        description: 'A quiz with no questions',
        testMode: 'study',
        questionMode: 'all',
        numQuestions: 5,
        selectedThemes: [themeId],
      });

      // Verify error response
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('NO_QUESTIONS_FOUND');
        expect(result.message).toContain('Nenhuma questão encontrada');
      }
    });

    it('should create quiz with default parameters when optional fields are not provided', async () => {
      const t = convexTest(schema);

      const asUser = t.withIdentity({
        name: 'Test User',
        subject: 'test-user',
        tokenIdentifier: 'test-user-token',
      });

      // Create a user record first
      await t.run(async ctx => {
        await ctx.db.insert('users', {
          email: 'user@test.com',
          clerkUserId: 'test-user',
        });
      });

      // Create test question with theme
      const themeId = await asUser.mutation(api.themes.create, {
        name: 'Test Theme',
      });

      await asUser.mutation(api.questions.create, {
        title: 'Test Question',
        questionTextString: JSON.stringify({
          type: 'doc',
          content: [{ type: 'text', text: 'What is 1+1?' }],
        }),
        explanationTextString: JSON.stringify({
          type: 'doc',
          content: [{ type: 'text', text: 'Basic math' }],
        }),
        alternatives: ['2', '3', '4', '5'],
        correctAlternativeIndex: 0,
        themeId,
      });

      // Create a custom quiz with minimal parameters
      const result = await asUser.mutation(api.customQuizzes.create, {
        name: 'Minimal Quiz',
        description: 'A minimal quiz',
        testMode: 'exam',
        questionMode: 'all',
      });

      // Verify the quiz was created successfully
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.quizId).toBeDefined();
        expect(result.questionCount).toBeGreaterThan(0);
      }
    });
  });
});
