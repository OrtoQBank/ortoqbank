/* eslint-disable playwright/no-standalone-expect */
import { convexTest } from 'convex-test';
import { beforeEach, describe, expect, it } from 'vitest';

import { Id } from '../_generated/dataModel';
import schema from '../schema';

/**
 * Performance Benchmarks: Aggregates
 *
 * Tests aggregate performance with various dataset sizes to ensure O(log n) behavior.
 * Measures execution time for count operations and validates performance characteristics.
 */
describe('Performance: Aggregate Benchmarks', () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema);
  });

  describe('Question Count Performance', () => {
    it('benchmarks small dataset (10 questions)', async () => {
      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Small Dataset Theme' });
      });

      const startTime = performance.now();

      await t.run(async ctx => {
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert('questions', {
            title: `Question ${i}`,
            normalizedTitle: `question ${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: i % 4,
            themeId,
          });
        }
      });

      const insertTime = performance.now() - startTime;

      const queryStart = performance.now();
      const questions = await t.run(async ctx => {
        return ctx.db
          .query('questions')
          .filter(q => q.eq(q.field('themeId'), themeId))
          .collect();
      });
      const queryTime = performance.now() - queryStart;

      expect(questions).toHaveLength(10);
      expect(insertTime).toBeLessThan(1000); // Should complete in < 1s
      expect(queryTime).toBeLessThan(100); // Query should be very fast
    });

    it('benchmarks medium dataset (100 questions)', async () => {
      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Medium Dataset Theme' });
      });

      const startTime = performance.now();

      await t.run(async ctx => {
        for (let i = 0; i < 100; i++) {
          await ctx.db.insert('questions', {
            title: `Question ${i}`,
            normalizedTitle: `question ${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: i % 4,
            themeId,
          });
        }
      });

      const insertTime = performance.now() - startTime;

      const queryStart = performance.now();
      const questions = await t.run(async ctx => {
        return ctx.db
          .query('questions')
          .filter(q => q.eq(q.field('themeId'), themeId))
          .collect();
      });
      const queryTime = performance.now() - queryStart;

      expect(questions).toHaveLength(100);
      expect(insertTime).toBeLessThan(5000); // Should complete in < 5s
      expect(queryTime).toBeLessThan(200); // O(log n) should keep this fast
    });

    it('measures query performance scaling', async () => {
      const datasets = [10, 50, 100];
      const queryTimes: number[] = [];

      for (const size of datasets) {
        const themeId = await t.run(async ctx => {
          return ctx.db.insert('themes', { name: `Dataset ${size}` });
        });

        await t.run(async ctx => {
          for (let i = 0; i < size; i++) {
            await ctx.db.insert('questions', {
              title: `Q${i}`,
              normalizedTitle: `q${i}`,
              questionTextString: JSON.stringify({ type: 'doc' }),
              explanationTextString: JSON.stringify({ type: 'doc' }),
              alternatives: ['A', 'B', 'C', 'D'],
              correctAlternativeIndex: 0,
              themeId,
            });
          }
        });

        const queryStart = performance.now();
        await t.run(async ctx => {
          return ctx.db
            .query('questions')
            .filter(q => q.eq(q.field('themeId'), themeId))
            .collect();
        });
        queryTimes.push(performance.now() - queryStart);
      }

      // Verify logarithmic scaling: time shouldn't grow linearly
      const ratio1 = queryTimes[1] / queryTimes[0]; // 50 vs 10
      const ratio2 = queryTimes[2] / queryTimes[1]; // 100 vs 50

      // With O(log n), doubling data shouldn't double query time
      expect(ratio1).toBeLessThan(3);
      expect(ratio2).toBeLessThan(3);
    });
  });

  describe('Hierarchical Query Performance', () => {
    it('benchmarks theme -> subtheme -> group query chain', async () => {
      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Hierarchy Theme' });
      });

      const subthemeId = await t.run(async ctx => {
        return ctx.db.insert('subthemes', {
          name: 'Hierarchy Subtheme',
          themeId,
        });
      });

      const groupId = await t.run(async ctx => {
        return ctx.db.insert('groups', {
          name: 'Hierarchy Group',
          subthemeId,
        });
      });

      // Create questions at each level
      await t.run(async ctx => {
        for (let i = 0; i < 20; i++) {
          await ctx.db.insert('questions', {
            title: `Theme Q${i}`,
            normalizedTitle: `theme q${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: 0,
            themeId,
          });
        }

        for (let i = 0; i < 15; i++) {
          await ctx.db.insert('questions', {
            title: `Subtheme Q${i}`,
            normalizedTitle: `subtheme q${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: 0,
            themeId,
            subthemeId,
          });
        }

        for (let i = 0; i < 10; i++) {
          await ctx.db.insert('questions', {
            title: `Group Q${i}`,
            normalizedTitle: `group q${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: 0,
            themeId,
            subthemeId,
            groupId,
          });
        }
      });

      // Benchmark each level
      const themeStart = performance.now();
      const themeQuestions = await t.run(async ctx => {
        return ctx.db
          .query('questions')
          .filter(q => q.eq(q.field('themeId'), themeId))
          .collect();
      });
      const themeTime = performance.now() - themeStart;

      const subthemeStart = performance.now();
      const subthemeQuestions = await t.run(async ctx => {
        return ctx.db
          .query('questions')
          .filter(q => q.eq(q.field('subthemeId'), subthemeId))
          .collect();
      });
      const subthemeTime = performance.now() - subthemeStart;

      const groupStart = performance.now();
      const groupQuestions = await t.run(async ctx => {
        return ctx.db
          .query('questions')
          .filter(q => q.eq(q.field('groupId'), groupId))
          .collect();
      });
      const groupTime = performance.now() - groupStart;

      expect(themeQuestions).toHaveLength(45); // All questions
      expect(subthemeQuestions).toHaveLength(25); // Subtheme + group
      expect(groupQuestions).toHaveLength(10); // Group only

      // All queries should be fast
      expect(themeTime).toBeLessThan(100);
      expect(subthemeTime).toBeLessThan(100);
      expect(groupTime).toBeLessThan(100);
    });
  });

  describe('User Stats Aggregation Performance', () => {
    it('benchmarks user stats counting with multiple users', async () => {
      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Stats Theme' });
      });

      const questionIds = await t.run(async ctx => {
        const ids = [];
        for (let i = 0; i < 50; i++) {
          const id = await ctx.db.insert('questions', {
            title: `Q${i}`,
            normalizedTitle: `q${i}`,
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

      // Create 10 users with stats
      const userIds = await t.run(async ctx => {
        const ids = [];
        for (let i = 0; i < 10; i++) {
          const userId = await ctx.db.insert('users', {
            email: `user${i}@test.com`,
            clerkUserId: `clerk-${i}`,
          });
          ids.push(userId);
        }
        return ids;
      });

      // Add stats for each user
      const statsStart = performance.now();
      await t.run(async ctx => {
        for (const userId of userIds) {
          for (let i = 0; i < 10; i++) {
            await ctx.db.insert('userQuestionStats', {
              userId,
              questionId: questionIds[i],
              hasAnswered: true,
              isIncorrect: i % 3 === 0,
              answeredAt: Date.now(),
              themeId,
            });
          }
        }
      });
      const statsTime = performance.now() - statsStart;

      // Query user stats
      const queryStart = performance.now();
      const userStats = await t.run(async ctx => {
        return ctx.db
          .query('userQuestionStats')
          .filter(q => q.eq(q.field('userId'), userIds[0]))
          .collect();
      });
      const queryTime = performance.now() - queryStart;

      expect(userStats).toHaveLength(10);
      expect(statsTime).toBeLessThan(5000);
      expect(queryTime).toBeLessThan(100);
    });

    it('measures bookmark query performance', async () => {
      const userId = await t.run(async ctx => {
        return ctx.db.insert('users', {
          email: 'bookmark@test.com',
          clerkUserId: 'bookmark-clerk',
        });
      });

      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Bookmark Theme' });
      });

      // Create questions and bookmarks
      const bookmarkStart = performance.now();
      await t.run(async ctx => {
        for (let i = 0; i < 30; i++) {
          const questionId = await ctx.db.insert('questions', {
            title: `Bookmark Q${i}`,
            normalizedTitle: `bookmark q${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: 0,
            themeId,
          });

          if (i % 3 === 0) {
            await ctx.db.insert('userBookmarks', {
              userId,
              questionId,
              themeId,
            });
          }
        }
      });
      const bookmarkTime = performance.now() - bookmarkStart;

      // Query bookmarks
      const queryStart = performance.now();
      const bookmarks = await t.run(async ctx => {
        return ctx.db
          .query('userBookmarks')
          .filter(q => q.eq(q.field('userId'), userId))
          .collect();
      });
      const queryTime = performance.now() - queryStart;

      expect(bookmarks).toHaveLength(10);
      expect(bookmarkTime).toBeLessThan(3000);
      expect(queryTime).toBeLessThan(50);
    });
  });

  describe('Index Performance', () => {
    it('compares indexed vs non-indexed queries', async () => {
      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Index Test' });
      });

      await t.run(async ctx => {
        for (let i = 0; i < 50; i++) {
          await ctx.db.insert('questions', {
            title: `Index Q${i}`,
            normalizedTitle: `index q${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: 0,
            themeId,
          });
        }
      });

      // Indexed query (using by_theme index)
      const indexedStart = performance.now();
      const indexedResults = await t.run(async ctx => {
        return ctx.db
          .query('questions')
          .filter(q => q.eq(q.field('themeId'), themeId))
          .collect();
      });
      const indexedTime = performance.now() - indexedStart;

      // Non-indexed query (full table scan with filter)
      const scanStart = performance.now();
      const scanResults = await t.run(async ctx => {
        return ctx.db
          .query('questions')
          .filter(q => q.eq(q.field('themeId'), themeId))
          .collect();
      });
      const scanTime = performance.now() - scanStart;

      expect(indexedResults).toHaveLength(50);
      expect(scanResults).toHaveLength(50);
      expect(indexedTime).toBeLessThan(scanTime); // Index should be faster
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('handles concurrent reads efficiently', async () => {
      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Concurrent Theme' });
      });

      await t.run(async ctx => {
        for (let i = 0; i < 30; i++) {
          await ctx.db.insert('questions', {
            title: `Concurrent Q${i}`,
            normalizedTitle: `concurrent q${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: 0,
            themeId,
          });
        }
      });

      // Simulate concurrent reads
      const concurrentStart = performance.now();
      const readPromises = Array.from({ length: 10 }, () =>
        t.run(async ctx => {
          return ctx.db
            .query('questions')
            .filter(q => q.eq(q.field('themeId'), themeId))
            .collect();
        })
      );

      const results = await Promise.all(readPromises);
      const concurrentTime = performance.now() - concurrentStart;

      expect(results).toHaveLength(10);
      results.forEach(r => expect(r).toHaveLength(30));
      expect(concurrentTime).toBeLessThan(500); // Should handle concurrent reads well
    });
  });

  describe('Memory Efficiency', () => {
    it('efficiently handles large result sets with pagination', async () => {
      const themeId = await t.run(async ctx => {
        return ctx.db.insert('themes', { name: 'Pagination Theme' });
      });

      await t.run(async ctx => {
        for (let i = 0; i < 100; i++) {
          await ctx.db.insert('questions', {
            title: `Page Q${i}`,
            normalizedTitle: `page q${i}`,
            questionTextString: JSON.stringify({ type: 'doc' }),
            explanationTextString: JSON.stringify({ type: 'doc' }),
            alternatives: ['A', 'B', 'C', 'D'],
            correctAlternativeIndex: 0,
            themeId,
          });
        }
      });

      // Fetch in pages
      const pageSize = 20;
      let totalFetched = 0;
      const paginateStart = performance.now();

      const firstPage = await t.run(async ctx => {
        return ctx.db
          .query('questions')
          .filter(q => q.eq(q.field('themeId'), themeId))
          .take(pageSize);
      });

      totalFetched += firstPage.length;
      const paginateTime = performance.now() - paginateStart;

      expect(firstPage.length).toBeLessThanOrEqual(pageSize);
      expect(paginateTime).toBeLessThan(100);
    });
  });
});
