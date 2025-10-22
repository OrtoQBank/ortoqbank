/* eslint-disable playwright/no-standalone-expect */
import { convexTest } from 'convex-test';
import { beforeEach, describe, expect, it } from 'vitest';

import { Id } from '../_generated/dataModel';
import schema from '../schema';

/**
 * Load Testing: Query Performance Under Load
 *
 * Tests system behavior under various load conditions.
 * Validates response times and throughput with realistic data volumes.
 */
describe('Load Testing: Query Performance', () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema);
  });

  describe('Read Load Tests', () => {
    it('handles high-frequency question queries', async () => {
      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Load Test Theme' });
      });

      // Populate with questions
      const questionIds = await t.run(async ctx => {
        const ids = [];
        for (let i = 0; i < 100; i++) {
          const id = await ctx.db.insert('questions', {
            title: `Load Q${i}`,
            normalizedTitle: `load q${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: i % 4,
            themeId,
          });
          ids.push(id);
        }
        return ids;
      });

      // Simulate high-frequency reads
      const iterations = 50;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const randomId = questionIds[Math.floor(Math.random() * questionIds.length)];
        await t.run(async ctx => {
          return ctx.db.get(randomId);
        });
      }

      const totalTime = performance.now() - startTime;
      const avgTime = totalTime / iterations;

      expect(avgTime).toBeLessThan(50); // Average query under 50ms
      expect(totalTime).toBeLessThan(5000); // Total under 5s
    });

    it('handles concurrent user quiz sessions', async () => {
      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Concurrent Sessions Theme' });
      });

      // Create quiz
      const questionIds = await t.run(async ctx => {
        const ids = [];
        for (let i = 0; i < 10; i++) {
          const id = await ctx.db.insert('questions', {
            title: `Session Q${i}`,
            normalizedTitle: `session q${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: 0,
            themeId,
          });
          ids.push(id);
        }
        return ids;
      });

      const quizId = await t.run(async ctx => {
        return ctx.db.insert('presetQuizzes', {
          name: 'Session Quiz',
          description: 'Test quiz',
          category: 'trilha',
          questions: questionIds,
          isPublic: true,
        });
      });

      // Create multiple users with concurrent sessions
      const userCount = 20;
      const startTime = performance.now();

      const sessionPromises = Array.from({ length: userCount }, async (_, i) => {
        const userId = await t.run(async ctx => {
          return ctx.db.insert('users', {
            email: `concurrent${i}@test.com`,
            clerkUserId: `concurrent-${i}`,
          });
        });

        return t.run(async ctx => {
          return ctx.db.insert('quizSessions', {
            userId,
            quizId,
            mode: 'study',
            currentQuestionIndex: 0,
            answers: [],
            answerFeedback: [],
            isComplete: false,
          });
        });
      });

      const sessions = await Promise.all(sessionPromises);
      const totalTime = performance.now() - startTime;

      expect(sessions).toHaveLength(userCount);
      expect(totalTime).toBeLessThan(3000); // All sessions created in < 3s
    });

    it('handles bulk bookmark operations', async () => {
      const userId = await t.run(async ctx => {
        return ctx.db.insert('users', {
          email: 'bulk@test.com',
          clerkUserId: 'bulk-clerk',
        });
      });

      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Bulk Theme' });
      });

      const questionIds = await t.run(async ctx => {
        const ids = [];
        for (let i = 0; i < 50; i++) {
          const id = await ctx.db.insert('questions', {
            title: `Bulk Q${i}`,
            normalizedTitle: `bulk q${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: 0,
            themeId,
          });
          ids.push(id);
        }
        return ids;
      });

      // Bulk bookmark creation
      const startTime = performance.now();
      await t.run(async ctx => {
        for (const questionId of questionIds) {
          await ctx.db.insert('userBookmarks', {
            userId,
            questionId,
            themeId,
          });
        }
      });
      const createTime = performance.now() - startTime;

      // Query all bookmarks
      const queryStart = performance.now();
      const bookmarks = await t.run(async ctx => {
        return ctx.db
          .query('userBookmarks')
          .filter(q => q.eq(q.field('userId'), userId))
          .collect();
      });
      const queryTime = performance.now() - queryStart;

      expect(bookmarks).toHaveLength(50);
      expect(createTime).toBeLessThan(2000);
      expect(queryTime).toBeLessThan(100);
    });
  });

  describe('Write Load Tests', () => {
    it('handles rapid question creation', async () => {
      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Rapid Create Theme' });
      });

      const batchSize = 50;
      const startTime = performance.now();

      const questionIds = await t.run(async ctx => {
        const ids = [];
        for (let i = 0; i < batchSize; i++) {
          const id = await ctx.db.insert('questions', {
            title: `Rapid Q${i}`,
            normalizedTitle: `rapid q${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: 0,
            themeId,
          });
          ids.push(id);
        }
        return ids;
      });

      const totalTime = performance.now() - startTime;
      const avgTime = totalTime / batchSize;

      expect(questionIds).toHaveLength(batchSize);
      expect(avgTime).toBeLessThan(100); // Average insert under 100ms
    });

    it('handles rapid user stats updates', async () => {
      const userId = await t.run(async ctx => {
        return ctx.db.insert('users', {
          email: 'rapid@test.com',
          clerkUserId: 'rapid-clerk',
        });
      });

      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Stats Theme' });
      });

      const questionIds = await t.run(async ctx => {
        const ids = [];
        for (let i = 0; i < 30; i++) {
          const id = await ctx.db.insert('questions', {
            title: `Stats Q${i}`,
            normalizedTitle: `stats q${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: 0,
            themeId,
          });
          ids.push(id);
        }
        return ids;
      });

      // Simulate answering questions rapidly
      const startTime = performance.now();
      await t.run(async ctx => {
        for (const questionId of questionIds) {
          await ctx.db.insert('userQuestionStats', {
            userId,
            questionId,
            hasAnswered: true,
            isIncorrect: Math.random() > 0.7,
            answeredAt: Date.now(),
            themeId,
          });
        }
      });
      const totalTime = performance.now() - startTime;

      expect(totalTime).toBeLessThan(2000); // All updates in < 2s
    });
  });

  describe('Mixed Load Tests', () => {
    it('handles mixed read/write operations', async () => {
      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Mixed Load Theme' });
      });

      const userId = await t.run(async ctx => {
        return ctx.db.insert('users', {
          email: 'mixed@test.com',
          clerkUserId: 'mixed-clerk',
        });
      });

      // Create initial questions
      const questionIds = await t.run(async ctx => {
        const ids = [];
        for (let i = 0; i < 20; i++) {
          const id = await ctx.db.insert('questions', {
            title: `Mixed Q${i}`,
            normalizedTitle: `mixed q${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: 0,
            themeId,
          });
          ids.push(id);
        }
        return ids;
      });

      // Mixed operations
      const startTime = performance.now();

      for (let i = 0; i < 30; i++) {
        if (i % 3 === 0) {
          // Read operation
          await t.run(async ctx => {
            return ctx.db
              .query('questions')
              .filter(q => q.eq(q.field('themeId'), themeId))
              .first();
          });
        } else if (i % 3 === 1) {
          // Write operation (bookmark)
          const randomId = questionIds[Math.floor(Math.random() * questionIds.length)];
          await t.run(async ctx => {
            const existing = await ctx.db
              .query('userBookmarks')
              .filter(q => q.and(
                q.eq(q.field('userId'), userId),
                q.eq(q.field('questionId'), randomId)
              ))
              .first();

            if (!existing) {
              await ctx.db.insert('userBookmarks', {
                userId,
                questionId: randomId,
                themeId,
              });
            }
          });
        } else {
          // Update operation (stats)
          const randomId = questionIds[Math.floor(Math.random() * questionIds.length)];
          await t.run(async ctx => {
            const existing = await ctx.db
              .query('userQuestionStats')
              .filter(q => q.and(
                q.eq(q.field('userId'), userId),
                q.eq(q.field('questionId'), randomId)
              ))
              .first();

            if (!existing) {
              await ctx.db.insert('userQuestionStats', {
                userId,
                questionId: randomId,
                hasAnswered: true,
                isIncorrect: false,
                answeredAt: Date.now(),
                themeId,
              });
            }
          });
        }
      }

      const totalTime = performance.now() - startTime;

      expect(totalTime).toBeLessThan(3000); // Mixed operations complete reasonably
    });
  });

  describe('Stress Tests', () => {
    it('maintains performance with large user base', async () => {
      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Large User Base Theme' });
      });

      // Create many users
      const userCount = 100;
      const startTime = performance.now();

      const userIds = await t.run(async ctx => {
        const ids = [];
        for (let i = 0; i < userCount; i++) {
          const id = await ctx.db.insert('users', {
            email: `stress${i}@test.com`,
            clerkUserId: `stress-${i}`,
          });
          ids.push(id);
        }
        return ids;
      });

      const createTime = performance.now() - startTime;

      // Query users
      const queryStart = performance.now();
      const users = await t.run(async ctx => {
        return ctx.db.query('users').take(50);
      });
      const queryTime = performance.now() - queryStart;

      expect(userIds).toHaveLength(userCount);
      expect(users.length).toBeLessThanOrEqual(50);
      expect(createTime).toBeLessThan(1000);
      expect(queryTime).toBeLessThan(100);
    });

    it('handles large theme with many questions efficiently', async () => {
      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Large Theme' });
      });

      const questionCount = 200;
      const batchSize = 50;
      let totalInsertTime = 0;

      // Insert in batches
      for (let batch = 0; batch < questionCount / batchSize; batch++) {
        const batchStart = performance.now();

        await t.run(async ctx => {
          for (let i = 0; i < batchSize; i++) {
            const index = batch * batchSize + i;
            await ctx.db.insert('questions', {
              title: `Large Q${index}`,
              normalizedTitle: `large q${index}`,
              questionTextString: JSON.stringify({ type: 'doc' }),
              explanationTextString: JSON.stringify({ type: 'doc' }),
              alternatives: ['A', 'B', 'C', 'D'],
              correctAlternativeIndex: index % 4,
              themeId,
            });
          }
        });

        totalInsertTime += performance.now() - batchStart;
      }

      // Query performance with large dataset
      const queryStart = performance.now();
      const questions = await t.run(async ctx => {
        return ctx.db
          .query('questions')
          .filter(q => q.eq(q.field('themeId'), themeId))
          .take(50);
      });
      const queryTime = performance.now() - queryStart;

      expect(questions.length).toBeLessThanOrEqual(50);
      expect(queryTime).toBeLessThan(200); // Should stay fast even with 200 questions
    });
  });

  describe('Throughput Metrics', () => {
    it('measures queries per second capacity', async () => {
      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Throughput Theme' });
      });

      await t.run(async ctx => {
        for (let i = 0; i < 50; i++) {
          await ctx.db.insert('questions', {
            title: `Throughput Q${i}`,
            normalizedTitle: `throughput q${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: 0,
            themeId,
          });
        }
      });

      const duration = 1000; // 1 second
      const startTime = performance.now();
      let queryCount = 0;

      while (performance.now() - startTime < duration) {
        await t.run(async ctx => {
          return ctx.db
            .query('questions')
            .filter(q => q.eq(q.field('themeId'), themeId))
            .first();
        });
        queryCount++;
      }

      const qps = queryCount / (duration / 1000);

      expect(qps).toBeGreaterThan(10); // At least 10 queries per second
    });
  });
});
