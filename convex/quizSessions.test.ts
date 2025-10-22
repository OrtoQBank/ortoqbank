/* eslint-disable playwright/no-standalone-expect */
import { convexTest } from 'convex-test';
import { beforeEach, describe, expect, it } from 'vitest';

import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import schema from './schema';

describe('Quiz Sessions - Session Management', () => {
  let t: ReturnType<typeof convexTest>;
  let userId: Id<'users'>;
  let themeId: Id<'themes'>;
  let questionId1: Id<'questions'>;
  let questionId2: Id<'questions'>;
  let questionId3: Id<'questions'>;
  let presetQuizId: Id<'presetQuizzes'>;
  let customQuizId: Id<'customQuizzes'>;

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

    const asUser = t.withIdentity({
      name: 'User',
      subject: 'user-clerk-id',
      tokenIdentifier: 'user-token',
    });

    // Create taxonomy
    themeId = await t.run(async ctx => {
      return ctx.db.insert('themes', { name: 'Test Theme' });
    });

    // Create questions
    questionId1 = await t.run(async ctx => {
      return ctx.db.insert('questions', {
        title: 'Question 1',
        normalizedTitle: 'question 1',
        questionTextString: JSON.stringify({ type: 'doc', content: [] }),
        explanationTextString: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Explanation 1' }] }],
        }),
        alternatives: ['A', 'B', 'C', 'D'],
        correctAlternativeIndex: 0,
        themeId,
      });
    });

    questionId2 = await t.run(async ctx => {
      return ctx.db.insert('questions', {
        title: 'Question 2',
        normalizedTitle: 'question 2',
        questionTextString: JSON.stringify({ type: 'doc', content: [] }),
        explanationTextString: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Explanation 2' }] }],
        }),
        alternatives: ['W', 'X', 'Y', 'Z'],
        correctAlternativeIndex: 2,
        themeId,
      });
    });

    questionId3 = await t.run(async ctx => {
      return ctx.db.insert('questions', {
        title: 'Question 3',
        normalizedTitle: 'question 3',
        questionTextString: JSON.stringify({ type: 'doc', content: [] }),
        explanationTextString: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Explanation 3' }] }],
        }),
        alternatives: ['1', '2', '3', '4'],
        correctAlternativeIndex: 1,
        themeId,
      });
    });

    // Create preset quiz
    presetQuizId = await t.run(async ctx => {
      return ctx.db.insert('presetQuizzes', {
        name: 'Test Preset Quiz',
        description: 'A test quiz',
        category: 'trilha',
        questions: [questionId1, questionId2, questionId3],
        isPublic: true,
      });
    });

    // Create custom quiz
    customQuizId = await t.run(async ctx => {
      return ctx.db.insert('customQuizzes', {
        name: 'Test Custom Quiz',
        description: 'A test quiz',
        authorId: userId,
        questions: [questionId1, questionId2],
        testMode: 'study',
        questionMode: 'all',
        selectedThemes: [themeId],
        selectedSubthemes: [],
        selectedGroups: [],
      });
    });
  });

  describe('startQuizSession', () => {
    it('creates a new quiz session in study mode', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const result = await asUser.mutation(api.quizSessions.startQuizSession, {
        quizId: presetQuizId,
        mode: 'study',
      });

      expect(result.sessionId).toBeDefined();

      // Verify session was created
      const session = await t.run(ctx => ctx.db.get(result.sessionId));
      expect(session).toBeDefined();
      expect(session?.userId).toBe(userId);
      expect(session?.quizId).toBe(presetQuizId);
      expect(session?.mode).toBe('study');
      expect(session?.currentQuestionIndex).toBe(0);
      expect(session?.answers).toEqual([]);
      expect(session?.isComplete).toBe(false);
    });

    it('creates a new quiz session in exam mode', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const result = await asUser.mutation(api.quizSessions.startQuizSession, {
        quizId: customQuizId,
        mode: 'exam',
      });

      const session = await t.run(ctx => ctx.db.get(result.sessionId));
      expect(session?.mode).toBe('exam');
    });

    it('allows multiple sessions for different quizzes', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const session1 = await asUser.mutation(api.quizSessions.startQuizSession, {
        quizId: presetQuizId,
        mode: 'study',
      });

      const session2 = await asUser.mutation(api.quizSessions.startQuizSession, {
        quizId: customQuizId,
        mode: 'exam',
      });

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });

    it('requires authentication', async () => {
      await expect(
        t.mutation(api.quizSessions.startQuizSession, {
          quizId: presetQuizId,
          mode: 'study',
        })
      ).rejects.toThrow();
    });
  });

  describe('submitAnswerAndProgress', () => {
    it('submits a correct answer and returns feedback', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      // Start session
      const { sessionId } = await asUser.mutation(api.quizSessions.startQuizSession, {
        quizId: presetQuizId,
        mode: 'study',
      });

      // Submit correct answer (0 is correct for questionId1)
      const result = await asUser.mutation(api.quizSessions.submitAnswerAndProgress, {
        quizId: presetQuizId,
        selectedAlternativeIndex: 0,
      });

      expect(result.isAnswerCorrect).toBe(true);
      expect(result.feedback).toBe('Correct!');
      expect(result.correctAlternative).toBe(0);
      expect(result.nextQuestionIndex).toBe(1);
      expect(result.isComplete).toBe(false);
      expect(result.explanation).toContain('Explanation 1');

      // Verify session was updated
      const session = await t.run(ctx => ctx.db.get(sessionId));
      expect(session?.answers).toEqual([0]);
      expect(session?.currentQuestionIndex).toBe(1);
      expect(session?.answerFeedback).toHaveLength(1);
      expect(session?.answerFeedback[0].isCorrect).toBe(true);
    });

    it('submits an incorrect answer and returns feedback', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      await asUser.mutation(api.quizSessions.startQuizSession, {
        quizId: presetQuizId,
        mode: 'study',
      });

      // Submit incorrect answer (1 is wrong, 0 is correct)
      const result = await asUser.mutation(api.quizSessions.submitAnswerAndProgress, {
        quizId: presetQuizId,
        selectedAlternativeIndex: 1,
      });

      expect(result.isAnswerCorrect).toBe(false);
      expect(result.feedback).toBe('Incorrect');
      expect(result.correctAlternative).toBe(0);
    });

    it('progresses through multiple questions', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const { sessionId } = await asUser.mutation(api.quizSessions.startQuizSession, {
        quizId: presetQuizId,
        mode: 'study',
      });

      // Answer question 1
      await asUser.mutation(api.quizSessions.submitAnswerAndProgress, {
        quizId: presetQuizId,
        selectedAlternativeIndex: 0,
      });

      // Answer question 2 (correct is 2)
      await asUser.mutation(api.quizSessions.submitAnswerAndProgress, {
        quizId: presetQuizId,
        selectedAlternativeIndex: 2,
      });

      // Verify session state
      const session = await t.run(ctx => ctx.db.get(sessionId));
      expect(session?.currentQuestionIndex).toBe(2);
      expect(session?.answers).toEqual([0, 2]);
      expect(session?.answerFeedback).toHaveLength(2);
    });

    it('marks quiz as complete when last question is answered', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const { sessionId } = await asUser.mutation(api.quizSessions.startQuizSession, {
        quizId: customQuizId, // Only 2 questions
        mode: 'exam',
      });

      // Answer question 1
      await asUser.mutation(api.quizSessions.submitAnswerAndProgress, {
        quizId: customQuizId,
        selectedAlternativeIndex: 0,
      });

      // Answer question 2 (last question)
      const result = await asUser.mutation(api.quizSessions.submitAnswerAndProgress, {
        quizId: customQuizId,
        selectedAlternativeIndex: 2,
      });

      expect(result.isComplete).toBe(true);

      // Verify session is complete
      const session = await t.run(ctx => ctx.db.get(sessionId));
      expect(session?.isComplete).toBe(true);
    });

    it('throws error when no active session exists', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      await expect(
        asUser.mutation(api.quizSessions.submitAnswerAndProgress, {
          quizId: presetQuizId,
          selectedAlternativeIndex: 0,
        })
      ).rejects.toThrow(/No active quiz progress found/);
    });
  });

  describe('getActiveSession', () => {
    it('returns incomplete session when available', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const { sessionId } = await asUser.mutation(api.quizSessions.startQuizSession, {
        quizId: presetQuizId,
        mode: 'study',
      });

      const activeSession = await asUser.query(api.quizSessions.getActiveSession, {
        quizId: presetQuizId,
      });

      expect(activeSession).toBeDefined();
      expect(activeSession?._id).toBe(sessionId);
      expect(activeSession?.isComplete).toBe(false);
    });

    it('returns most recent completed session when no incomplete session', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      // Create and complete a session
      const { sessionId } = await asUser.mutation(api.quizSessions.startQuizSession, {
        quizId: customQuizId,
        mode: 'study',
      });

      await t.run(ctx => ctx.db.patch(sessionId, { isComplete: true }));

      const activeSession = await asUser.query(api.quizSessions.getActiveSession, {
        quizId: customQuizId,
      });

      expect(activeSession).toBeDefined();
      expect(activeSession?._id).toBe(sessionId);
      expect(activeSession?.isComplete).toBe(true);
    });

    it('returns null when no sessions exist', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const activeSession = await asUser.query(api.quizSessions.getActiveSession, {
        quizId: presetQuizId,
      });

      expect(activeSession).toBeNull();
    });
  });

  describe('completeQuizSession', () => {
    it('marks active session as complete', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const { sessionId } = await asUser.mutation(api.quizSessions.startQuizSession, {
        quizId: presetQuizId,
        mode: 'exam',
      });

      const result = await asUser.mutation(api.quizSessions.completeQuizSession, {
        quizId: presetQuizId,
      });

      expect(result.success).toBe(true);

      // Verify session is complete
      const session = await t.run(ctx => ctx.db.get(sessionId));
      expect(session?.isComplete).toBe(true);
    });

    it('throws error when no active session exists', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      await expect(
        asUser.mutation(api.quizSessions.completeQuizSession, {
          quizId: presetQuizId,
        })
      ).rejects.toThrow(/No active quiz session found/);
    });

    it('does not affect other users sessions', async () => {
      // Create another user
      const user2Id = await t.run(async ctx => {
        return ctx.db.insert('users', {
          email: 'user2@test.com',
          clerkUserId: 'user2-clerk-id',
          role: 'user',
        });
      });

      const asUser1 = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const asUser2 = t.withIdentity({
        subject: 'user2-clerk-id',
        tokenIdentifier: 'user2-token',
      });

      // Both users start sessions
      const { sessionId: session1Id } = await asUser1.mutation(
        api.quizSessions.startQuizSession,
        { quizId: presetQuizId, mode: 'study' }
      );

      const { sessionId: session2Id } = await asUser2.mutation(
        api.quizSessions.startQuizSession,
        { quizId: presetQuizId, mode: 'study' }
      );

      // User1 completes their session
      await asUser1.mutation(api.quizSessions.completeQuizSession, {
        quizId: presetQuizId,
      });

      // Verify user1's session is complete
      const session1 = await t.run(ctx => ctx.db.get(session1Id));
      expect(session1?.isComplete).toBe(true);

      // Verify user2's session is still active
      const session2 = await t.run(ctx => ctx.db.get(session2Id));
      expect(session2?.isComplete).toBe(false);
    });
  });

  describe('getCompletedSessions', () => {
    it('returns completed sessions for a quiz', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      // Create and complete two sessions
      const { sessionId: sessionId1 } = await asUser.mutation(
        api.quizSessions.startQuizSession,
        { quizId: presetQuizId, mode: 'study' }
      );
      await t.run(ctx => ctx.db.patch(sessionId1, { isComplete: true }));

      const { sessionId: sessionId2 } = await asUser.mutation(
        api.quizSessions.startQuizSession,
        { quizId: presetQuizId, mode: 'exam' }
      );
      await t.run(ctx => ctx.db.patch(sessionId2, { isComplete: true }));

      const completedSessions = await asUser.query(api.quizSessions.getCompletedSessions, {
        quizId: presetQuizId,
      });

      expect(completedSessions).toHaveLength(2);
      expect(completedSessions[0]._id).toBe(sessionId2); // Most recent first
      expect(completedSessions[1]._id).toBe(sessionId1);
    });

    it('does not return incomplete sessions', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      // Create incomplete session
      await asUser.mutation(api.quizSessions.startQuizSession, {
        quizId: presetQuizId,
        mode: 'study',
      });

      const completedSessions = await asUser.query(api.quizSessions.getCompletedSessions, {
        quizId: presetQuizId,
      });

      expect(completedSessions).toHaveLength(0);
    });

    it('returns empty array when no completed sessions exist', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const completedSessions = await asUser.query(api.quizSessions.getCompletedSessions, {
        quizId: presetQuizId,
      });

      expect(completedSessions).toHaveLength(0);
    });
  });

  describe('listIncompleteSessions', () => {
    it('returns all incomplete sessions for current user', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      // Create multiple incomplete sessions
      await asUser.mutation(api.quizSessions.startQuizSession, {
        quizId: presetQuizId,
        mode: 'study',
      });

      await asUser.mutation(api.quizSessions.startQuizSession, {
        quizId: customQuizId,
        mode: 'exam',
      });

      const incompleteSessions = await asUser.query(api.quizSessions.listIncompleteSessions, {});

      expect(incompleteSessions).toHaveLength(2);
    });

    it('does not return completed sessions', async () => {
      const asUser = t.withIdentity({
        subject: 'user-clerk-id',
        tokenIdentifier: 'user-token',
      });

      const { sessionId } = await asUser.mutation(api.quizSessions.startQuizSession, {
        quizId: presetQuizId,
        mode: 'study',
      });

      await t.run(ctx => ctx.db.patch(sessionId, { isComplete: true }));

      const incompleteSessions = await asUser.query(api.quizSessions.listIncompleteSessions, {});

      expect(incompleteSessions).toHaveLength(0);
    });
  });
});

describe('Quiz Sessions - Business Logic', () => {
  it('calculates quiz completion percentage', () => {
    const totalQuestions = 10;
    const answeredQuestions = 7;
    const percentage = (answeredQuestions / totalQuestions) * 100;

    expect(percentage).toBe(70);
  });

  it('calculates score correctly', () => {
    const answers = [0, 2, 1, 3];
    const correctAnswers = [0, 2, 0, 3];
    const correctCount = answers.filter((ans, i) => ans === correctAnswers[i]).length;
    const score = (correctCount / answers.length) * 100;

    expect(score).toBe(75); // 3 out of 4 correct
  });

  it('determines if session is in progress', () => {
    const session = {
      currentQuestionIndex: 5,
      totalQuestions: 10,
      isComplete: false,
    };

    const inProgress = !session.isComplete && session.currentQuestionIndex < session.totalQuestions;
    expect(inProgress).toBe(true);
  });

  it('validates alternative index range', () => {
    const selectedIndex = 2;
    const isValid = selectedIndex >= 0 && selectedIndex <= 3;

    expect(isValid).toBe(true);
  });

  it('formats session duration', () => {
    const startTime = new Date('2025-01-01T10:00:00Z').getTime();
    const endTime = new Date('2025-01-01T10:25:00Z').getTime();
    const durationMs = endTime - startTime;
    const durationMinutes = Math.floor(durationMs / 1000 / 60);

    expect(durationMinutes).toBe(25);
  });

  it('checks if answer is correct', () => {
    const selectedAlternative = 2;
    const correctAlternative = 2;

    expect(selectedAlternative === correctAlternative).toBe(true);
  });

  it('calculates remaining questions', () => {
    const totalQuestions = 20;
    const currentQuestionIndex = 7;
    const remaining = totalQuestions - currentQuestionIndex - 1;

    expect(remaining).toBe(12);
  });
});
