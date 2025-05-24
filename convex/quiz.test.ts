/* eslint-disable playwright/no-standalone-expect */
import { convexTest } from 'convex-test';
import { beforeEach, describe, expect, it } from 'vitest';

import { api } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import schema from './schema';

describe('Quiz Functions', () => {
  describe('create', () => {
    it('should create a preset quiz', async () => {
      const t = convexTest(schema);

      const asTeacher = t.withIdentity({
        name: 'Teacher',
        subject: 'test-teacher',
        tokenIdentifier: 'test-teacher-token',
      });

      // Create a user record first
      await t.run(async ctx => {
        await ctx.db.insert('users', {
          email: 'teacher@test.com',
          clerkUserId: 'test-teacher',
        });
      });

      // Create test data
      const themeId = await asTeacher.mutation(api.themes.create, {
        name: 'Test Theme',
      });

      const questionIds = await Promise.all([
        asTeacher.mutation(api.questions.create, {
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
        asTeacher.mutation(api.questions.create, {
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

      // Create a quiz
      const quizId = await asTeacher.mutation(api.quiz.create, {
        name: 'Test Quiz',
        description: 'A test quiz',
        category: 'trilha',
        questions: questionIds,
        themeId,
      });

      // Verify the quiz was created
      const quiz = await asTeacher.query(api.quiz.getById, { id: quizId });

      await expect(quiz).toMatchObject({
        name: 'Test Quiz',
        description: 'A test quiz',
        category: 'trilha',
        questions: expect.arrayContaining([
          expect.objectContaining({
            title: 'Test Question 1',
          }),
          expect.objectContaining({
            title: 'Test Question 2',
          }),
        ]),
        themeId,
        isPublic: false,
      });
    });
  });

  describe('getById', () => {
    it('should get a quiz with its questions', async () => {
      const t = convexTest(schema);

      // Create a user record first
      await t.run(async ctx => {
        await ctx.db.insert('users', {
          email: 'teacher@test.com',
          clerkUserId: 'test-teacher',
        });
      });

      const asTeacher = t.withIdentity({
        name: 'Teacher',
        subject: 'test-teacher',
        tokenIdentifier: 'test-teacher-token',
      });

      // Create test data
      const themeId = await asTeacher.mutation(api.themes.create, {
        name: 'Test Theme',
      });

      const questionId = await asTeacher.mutation(api.questions.create, {
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

      // Create a quiz
      const quizId = await asTeacher.mutation(api.quiz.create, {
        name: 'Test Quiz',
        description: 'A test quiz',
        category: 'trilha',
        questions: [questionId],
        themeId,
      });

      // Get the quiz
      const quiz = await asTeacher.query(api.quiz.getById, { id: quizId });

      await expect(quiz).toMatchObject({
        name: 'Test Quiz',
        description: 'A test quiz',
        category: 'trilha',
        questions: [
          expect.objectContaining({
            title: 'Test Question',
          }),
        ],
        themeId,
        isPublic: false,
      });
    });

    it('should throw error if quiz not found', async () => {
      const t = convexTest(schema);
      const asTeacher = t.withIdentity({
        name: 'Teacher',
        subject: 'test-teacher',
        tokenIdentifier: 'test-teacher-token',
      });
      const nonexistentId = '123' as Id<'presetQuizzes'>;

      await expect(
        asTeacher.query(api.quiz.getById, { id: nonexistentId }),
      ).rejects.toThrow('Quiz not found');
    });
  });

  describe('getQuizData', () => {
    it('should get sanitized quiz data', async () => {
      const t = convexTest(schema);

      const asTeacher = t.withIdentity({
        name: 'Teacher',
        subject: 'test-teacher',
        tokenIdentifier: 'test-teacher-token',
      });

      // Create a user record first
      await t.run(async ctx => {
        await ctx.db.insert('users', {
          email: 'teacher@test.com',
          clerkUserId: 'test-teacher',
        });
      });

      // Create test data
      const themeId = await asTeacher.mutation(api.themes.create, {
        name: 'Test Theme',
      });

      const questionId = await asTeacher.mutation(api.questions.create, {
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

      // Create a quiz
      const quizId = await asTeacher.mutation(api.quiz.create, {
        name: 'Test Quiz',
        description: 'A test quiz',
        category: 'trilha',
        questions: [questionId],
        themeId,
      });

      // Get the quiz data
      const quizData = await asTeacher.query(api.quiz.getQuizData, { quizId });

      await expect(quizData).toMatchObject({
        name: 'Test Quiz',
        description: 'A test quiz',
        category: 'trilha',
        questions: [
          {
            title: 'Test Question',
            questionTextString: `{"type":"doc","content":[{"type":"text","text":"What is 1+1?"}]}`,
          },
        ],
        themeId,
        isPublic: false,
      });
    });

    it('should throw error if quiz not found', async () => {
      const t = convexTest(schema);
      const asTeacher = t.withIdentity({
        name: 'Teacher',
        subject: 'test-teacher',
        tokenIdentifier: 'test-teacher-token',
      });
      const nonexistentId = '123' as Id<'presetQuizzes'>;

      await expect(
        asTeacher.query(api.quiz.getQuizData, { quizId: nonexistentId }),
      ).rejects.toThrow('Quiz not found');
    });
  });
});
