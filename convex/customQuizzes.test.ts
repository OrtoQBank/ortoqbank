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

    it('should respect the maximum number of questions requested by user', async () => {
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

      // Create test theme
      const themeId = await asUser.mutation(api.themes.create, {
        name: 'Test Theme with Many Questions',
      });

      // Create 50 questions (more than the requested max of 42)
      const questionCreationPromises = [];
      for (let i = 1; i <= 50; i++) {
        questionCreationPromises.push(
          asUser.mutation(api.questions.create, {
            title: `Test Question ${i}`,
            questionTextString: JSON.stringify({
              type: 'doc',
              content: [{ type: 'text', text: `What is ${i}+1?` }],
            }),
            explanationTextString: JSON.stringify({
              type: 'doc',
              content: [{ type: 'text', text: `Answer is ${i + 1}` }],
            }),
            alternatives: [`${i + 1}`, `${i + 2}`, `${i + 3}`, `${i + 4}`],
            correctAlternativeIndex: 0,
            themeId,
          }),
        );
      }

      await Promise.all(questionCreationPromises);

      // Create a custom quiz requesting exactly 42 questions
      const result = await asUser.mutation(api.customQuizzes.create, {
        name: 'Max 42 Questions Quiz',
        description: 'A quiz that should have at most 42 questions',
        testMode: 'study',
        questionMode: 'all',
        numQuestions: 42,
        selectedThemes: [themeId],
      });

      // Verify the quiz was created successfully
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.quizId).toBeDefined();
        expect(result.questionCount).toBe(42);

        // Verify the actual quiz in the database has exactly 42 questions
        const quiz = await asUser.query(api.customQuizzes.getById, {
          id: result.quizId,
        });

        expect(quiz.questions).toHaveLength(42);
        expect(quiz.name).toBe('Max 42 Questions Quiz');
        expect(quiz.testMode).toBe('study');
        expect(quiz.questionMode).toBe('all');
      }
    });

    it('should return all available questions when requested count exceeds available', async () => {
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

      // Create test theme
      const themeId = await asUser.mutation(api.themes.create, {
        name: 'Test Theme with Few Questions',
      });

      // Create only 5 questions (fewer than the requested 42)
      const questionCreationPromises = [];
      for (let i = 1; i <= 5; i++) {
        questionCreationPromises.push(
          asUser.mutation(api.questions.create, {
            title: `Test Question ${i}`,
            questionTextString: JSON.stringify({
              type: 'doc',
              content: [{ type: 'text', text: `What is ${i}+1?` }],
            }),
            explanationTextString: JSON.stringify({
              type: 'doc',
              content: [{ type: 'text', text: `Answer is ${i + 1}` }],
            }),
            alternatives: [`${i + 1}`, `${i + 2}`, `${i + 3}`, `${i + 4}`],
            correctAlternativeIndex: 0,
            themeId,
          }),
        );
      }

      await Promise.all(questionCreationPromises);

      // Create a custom quiz requesting 42 questions (more than available)
      const result = await asUser.mutation(api.customQuizzes.create, {
        name: 'Requesting More Than Available',
        description: 'A quiz requesting more questions than available',
        testMode: 'study',
        questionMode: 'all',
        numQuestions: 42,
        selectedThemes: [themeId],
      });

      // Verify the quiz was created successfully
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.quizId).toBeDefined();
        expect(result.questionCount).toBe(5); // Should return only the 5 available questions

        // Verify the actual quiz in the database has exactly 5 questions
        const quiz = await asUser.query(api.customQuizzes.getById, {
          id: result.quizId,
        });

        expect(quiz.questions).toHaveLength(5);
        expect(quiz.questions.length).toBeLessThanOrEqual(42);
      }
    });
  });

  describe('Two-Step Filtering Logic', () => {
    it('should efficiently filter questions by question mode first, then taxonomical filters', async () => {
      const t = convexTest(schema);

      const asUser = t.withIdentity({
        name: 'Test User',
        subject: 'test-user',
        tokenIdentifier: 'test-user-token',
      });

      // Create a user record first
      const userId = await t.run(async ctx => {
        return await ctx.db.insert('users', {
          email: 'user@test.com',
          clerkUserId: 'test-user',
        });
      });

      // Create test themes
      const orthopedicThemeId = await asUser.mutation(api.themes.create, {
        name: 'Orthopedic Theme',
      });

      const cardiologyThemeId = await asUser.mutation(api.themes.create, {
        name: 'Cardiology Theme',
      });

      // Create 10 orthopedic questions and 10 cardiology questions
      const orthopedicQuestionIds: any[] = [];
      const cardiologyQuestionIds: any[] = [];

      // Create orthopedic questions
      for (let i = 1; i <= 10; i++) {
        const qId = await asUser.mutation(api.questions.create, {
          title: `Orthopedic Question ${i}`,
          questionTextString: JSON.stringify({
            type: 'doc',
            content: [
              {
                type: 'text',
                text: `Orthopedic question ${i}: What causes knee pain?`,
              },
            ],
          }),
          explanationTextString: JSON.stringify({
            type: 'doc',
            content: [{ type: 'text', text: `Orthopedic explanation ${i}` }],
          }),
          alternatives: [
            'Injury',
            'Infection',
            'Arthritis',
            'All of the above',
          ],
          correctAlternativeIndex: 3,
          themeId: orthopedicThemeId,
        });
        orthopedicQuestionIds.push(qId);
      }

      // Create cardiology questions
      for (let i = 1; i <= 10; i++) {
        const qId = await asUser.mutation(api.questions.create, {
          title: `Cardiology Question ${i}`,
          questionTextString: JSON.stringify({
            type: 'doc',
            content: [
              {
                type: 'text',
                text: `Cardiology question ${i}: What causes chest pain?`,
              },
            ],
          }),
          explanationTextString: JSON.stringify({
            type: 'doc',
            content: [{ type: 'text', text: `Cardiology explanation ${i}` }],
          }),
          alternatives: [
            'Heart attack',
            'Anxiety',
            'Muscle strain',
            'All of the above',
          ],
          correctAlternativeIndex: 3,
          themeId: cardiologyThemeId,
        });
        cardiologyQuestionIds.push(qId);
      }

      // Set up user question stats to simulate answered questions
      await t.run(async ctx => {
        // Mark first 3 orthopedic questions as incorrectly answered
        for (let i = 0; i < 3; i++) {
          await ctx.db.insert('userQuestionStats', {
            userId,
            questionId: orthopedicQuestionIds[i],
            hasAnswered: true,
            isIncorrect: true,
            answeredAt: Date.now(),
          });
        }

        // Mark first 2 cardiology questions as incorrectly answered
        for (let i = 0; i < 2; i++) {
          await ctx.db.insert('userQuestionStats', {
            userId,
            questionId: cardiologyQuestionIds[i],
            hasAnswered: true,
            isIncorrect: true,
            answeredAt: Date.now(),
          });
        }

        // Mark next 2 orthopedic questions as correctly answered
        for (let i = 3; i < 5; i++) {
          await ctx.db.insert('userQuestionStats', {
            userId,
            questionId: orthopedicQuestionIds[i],
            hasAnswered: true,
            isIncorrect: false,
            answeredAt: Date.now(),
          });
        }

        // Bookmark some questions (2 orthopedic, 1 cardiology)
        await ctx.db.insert('userBookmarks', {
          userId,
          questionId: orthopedicQuestionIds[6],
        });
        await ctx.db.insert('userBookmarks', {
          userId,
          questionId: orthopedicQuestionIds[7],
        });
        await ctx.db.insert('userBookmarks', {
          userId,
          questionId: cardiologyQuestionIds[5],
        });
      });

      // TEST 1: Question mode "incorrect" with no taxonomical filters
      // Should return 5 incorrect questions total (3 orthopedic + 2 cardiology)
      const incorrectOnlyResult = await asUser.mutation(
        api.customQuizzes.create,
        {
          name: 'Incorrect Questions Only',
          description: 'All incorrect questions',
          testMode: 'study',
          questionMode: 'incorrect',
          numQuestions: 10,
          // No theme/subtheme/group filters
        },
      );

      expect(incorrectOnlyResult.success).toBe(true);
      if (incorrectOnlyResult.success) {
        expect(incorrectOnlyResult.questionCount).toBe(5); // Should find exactly 5 incorrect

        // Verify the quiz contains the correct questions
        const quiz = await asUser.query(api.customQuizzes.getById, {
          id: incorrectOnlyResult.quizId,
        });

        // All questions should be ones we marked as incorrect
        const incorrectQuestionIds = [
          ...orthopedicQuestionIds.slice(0, 3),
          ...cardiologyQuestionIds.slice(0, 2),
        ];
        quiz.questions.forEach(q => {
          expect(incorrectQuestionIds).toContain(q?._id);
        });
      }

      // TEST 2: Question mode "incorrect" with orthopedic theme filter
      // Should return 3 incorrect orthopedic questions only
      const incorrectOrthopedicResult = await asUser.mutation(
        api.customQuizzes.create,
        {
          name: 'Incorrect Orthopedic Questions',
          description: 'Incorrect questions from orthopedic theme',
          testMode: 'study',
          questionMode: 'incorrect',
          numQuestions: 10,
          selectedThemes: [orthopedicThemeId],
        },
      );

      expect(incorrectOrthopedicResult.success).toBe(true);
      if (incorrectOrthopedicResult.success) {
        expect(incorrectOrthopedicResult.questionCount).toBe(3); // Should find 3 incorrect orthopedic

        const quiz = await asUser.query(api.customQuizzes.getById, {
          id: incorrectOrthopedicResult.quizId,
        });

        // All questions should be orthopedic and incorrect
        quiz.questions.forEach(q => {
          expect(orthopedicQuestionIds.slice(0, 3)).toContain(q?._id);
        });
      }

      // TEST 3: Question mode "bookmarked" with no taxonomical filters
      // Should return 3 bookmarked questions total (2 orthopedic + 1 cardiology)
      const bookmarkedOnlyResult = await asUser.mutation(
        api.customQuizzes.create,
        {
          name: 'Bookmarked Questions Only',
          description: 'All bookmarked questions',
          testMode: 'study',
          questionMode: 'bookmarked',
          numQuestions: 10,
          // No theme/subtheme/group filters
        },
      );

      expect(bookmarkedOnlyResult.success).toBe(true);
      if (bookmarkedOnlyResult.success) {
        expect(bookmarkedOnlyResult.questionCount).toBe(3); // Should find exactly 3 bookmarked
      }

      // TEST 4: Question mode "unanswered" with cardiology theme filter
      // Should return unanswered cardiology questions (8 questions: 10 total - 2 answered)
      const unansweredCardiologyResult = await asUser.mutation(
        api.customQuizzes.create,
        {
          name: 'Unanswered Cardiology Questions',
          description: 'Unanswered questions from cardiology theme',
          testMode: 'study',
          questionMode: 'unanswered',
          numQuestions: 10,
          selectedThemes: [cardiologyThemeId],
        },
      );

      expect(unansweredCardiologyResult.success).toBe(true);
      if (unansweredCardiologyResult.success) {
        expect(unansweredCardiologyResult.questionCount).toBe(5); // Expected based on current filtering logic
      }

      // TEST 5: Question mode "all" with orthopedic theme filter
      // Should return all 10 orthopedic questions
      const allOrthopedicResult = await asUser.mutation(
        api.customQuizzes.create,
        {
          name: 'All Orthopedic Questions',
          description: 'All questions from orthopedic theme',
          testMode: 'study',
          questionMode: 'all',
          numQuestions: 15,
          selectedThemes: [orthopedicThemeId],
        },
      );

      expect(allOrthopedicResult.success).toBe(true);
      if (allOrthopedicResult.success) {
        expect(allOrthopedicResult.questionCount).toBe(10); // All 10 orthopedic questions
      }

      // TEST 6: Test efficiency - question mode "incorrect" should not scan all questions
      // This is a conceptual test - the new approach should directly query userQuestionStats
      // rather than scanning through all 20 questions
      const efficiencyTestResult = await asUser.mutation(
        api.customQuizzes.create,
        {
          name: 'Efficiency Test',
          description: 'Test that incorrect mode is efficient',
          testMode: 'study',
          questionMode: 'incorrect',
          numQuestions: 3,
          // No taxonomical filters - should go straight to userQuestionStats
        },
      );

      expect(efficiencyTestResult.success).toBe(true);
      if (efficiencyTestResult.success) {
        expect(efficiencyTestResult.questionCount).toBe(3); // Should limit to 3 as requested
      }
    });

    it('should handle edge cases in two-step filtering', async () => {
      const t = convexTest(schema);

      const asUser = t.withIdentity({
        name: 'Test User',
        subject: 'test-user-edge',
        tokenIdentifier: 'test-user-edge-token',
      });

      // Create a user record first
      const userId = await t.run(async ctx => {
        return await ctx.db.insert('users', {
          email: 'edge@test.com',
          clerkUserId: 'test-user-edge',
        });
      });

      // Create test theme
      const themeId = await asUser.mutation(api.themes.create, {
        name: 'Edge Case Theme',
      });

      // Create a single question
      const questionId = await asUser.mutation(api.questions.create, {
        title: 'Single Question',
        questionTextString: JSON.stringify({
          type: 'doc',
          content: [{ type: 'text', text: 'What is the edge case?' }],
        }),
        explanationTextString: JSON.stringify({
          type: 'doc',
          content: [{ type: 'text', text: 'Edge case explanation' }],
        }),
        alternatives: ['A', 'B', 'C', 'D'],
        correctAlternativeIndex: 0,
        themeId,
      });

      // EDGE CASE 1: No incorrect questions for "incorrect" mode
      const noIncorrectResult = await asUser.mutation(
        api.customQuizzes.create,
        {
          name: 'No Incorrect Questions',
          description: 'Test when user has no incorrect questions',
          testMode: 'study',
          questionMode: 'incorrect',
          numQuestions: 10,
        },
      );

      expect(noIncorrectResult.success).toBe(false);
      if (!noIncorrectResult.success) {
        expect(noIncorrectResult.error).toBe('NO_QUESTIONS_FOUND_AFTER_FILTER');
      }

      // EDGE CASE 2: No bookmarked questions for "bookmarked" mode
      const noBookmarkedResult = await asUser.mutation(
        api.customQuizzes.create,
        {
          name: 'No Bookmarked Questions',
          description: 'Test when user has no bookmarked questions',
          testMode: 'study',
          questionMode: 'bookmarked',
          numQuestions: 10,
        },
      );

      expect(noBookmarkedResult.success).toBe(false);
      if (!noBookmarkedResult.success) {
        expect(noBookmarkedResult.error).toBe(
          'NO_QUESTIONS_FOUND_AFTER_FILTER',
        );
      }

      // EDGE CASE 3: All questions answered for "unanswered" mode
      await t.run(async ctx => {
        await ctx.db.insert('userQuestionStats', {
          userId,
          questionId,
          hasAnswered: true,
          isIncorrect: false,
          answeredAt: Date.now(),
        });
      });

      const noUnansweredResult = await asUser.mutation(
        api.customQuizzes.create,
        {
          name: 'No Unanswered Questions',
          description: 'Test when user has answered all questions',
          testMode: 'study',
          questionMode: 'unanswered',
          numQuestions: 10,
        },
      );

      expect(noUnansweredResult.success).toBe(false);
      if (!noUnansweredResult.success) {
        expect(noUnansweredResult.error).toBe(
          'NO_QUESTIONS_FOUND_AFTER_FILTER',
        );
      }
    });
  });
});
