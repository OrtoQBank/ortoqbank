/* eslint-disable playwright/no-standalone-expect */
import { convexTest } from 'convex-test';
import { beforeEach, describe, expect, it } from 'vitest';

import { api, internal } from '../_generated/api';
import { Id } from '../_generated/dataModel';
import schema from '../schema';

describe('Integration: Clerk + Convex Sync', () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema);
  });

  describe('User Creation from Clerk', () => {
    it('creates new user with complete Clerk data', async () => {
      const clerkData = {
        id: 'clerk_user123',
        first_name: 'John',
        last_name: 'Doe',
        email_addresses: [{ email_address: 'john@example.com' }],
        image_url: 'https://example.com/avatar.jpg',
        public_metadata: {},
      };

      const userId = await t.run(async ctx => {
        return ctx.runMutation(internal.users.upsertFromClerk, { data: clerkData });
      });

      expect(userId).toBeDefined();

      // Verify user was created correctly
      const user = await t.run(ctx => ctx.db.get(userId!));
      expect(user).toBeDefined();
      expect(user?.email).toBe('john@example.com');
      expect(user?.firstName).toBe('John');
      expect(user?.lastName).toBe('Doe');
      expect(user?.clerkUserId).toBe('clerk_user123');
      expect(user?.imageUrl).toBe('https://example.com/avatar.jpg');
    });

    it('creates user with minimal Clerk data', async () => {
      const clerkData = {
        id: 'clerk_user456',
        email_addresses: [{ email_address: 'minimal@example.com' }],
      };

      const userId = await t.run(async ctx => {
        return ctx.runMutation(internal.users.upsertFromClerk, { data: clerkData });
      });

      const user = await t.run(ctx => ctx.db.get(userId!));
      expect(user?.email).toBe('minimal@example.com');
      expect(user?.clerkUserId).toBe('clerk_user456');
      expect(user?.firstName).toBeUndefined();
      expect(user?.lastName).toBeUndefined();
    });

    it('creates user with payment metadata from Clerk', async () => {
      const clerkData = {
        id: 'clerk_paid_user',
        email_addresses: [{ email_address: 'paid@example.com' }],
        public_metadata: {
          paid: true,
          paymentId: 'pay_123456',
          paymentDate: '2025-01-15',
          paymentStatus: 'approved',
        },
      };

      const userId = await t.run(async ctx => {
        return ctx.runMutation(internal.users.upsertFromClerk, { data: clerkData });
      });

      const user = await t.run(ctx => ctx.db.get(userId!));
      expect(user?.paid).toBe(true);
      expect(user?.paymentId).toBe('pay_123456');
      expect(user?.paymentDate).toBe('2025-01-15');
      expect(user?.paymentStatus).toBe('approved');
    });
  });

  describe('User Update from Clerk', () => {
    it('updates existing user data', async () => {
      // Create initial user
      const clerkData1 = {
        id: 'clerk_update_user',
        first_name: 'Jane',
        email_addresses: [{ email_address: 'jane@example.com' }],
      };

      await t.run(async ctx => {
        return ctx.runMutation(internal.users.upsertFromClerk, { data: clerkData1 });
      });

      // Update user
      const clerkData2 = {
        id: 'clerk_update_user',
        first_name: 'Jane',
        last_name: 'Smith',
        email_addresses: [{ email_address: 'jane.smith@example.com' }],
        image_url: 'https://example.com/new-avatar.jpg',
      };

      await t.run(async ctx => {
        return ctx.runMutation(internal.users.upsertFromClerk, { data: clerkData2 });
      });

      // Verify update
      const user = await t.run(async ctx => {
        return ctx.runQuery(internal.users.getUserByClerkId, {
          clerkUserId: 'clerk_update_user',
        });
      });

      expect(user?.lastName).toBe('Smith');
      expect(user?.email).toBe('jane.smith@example.com');
      expect(user?.imageUrl).toBe('https://example.com/new-avatar.jpg');
    });

    it('preserves existing payment data when updating user', async () => {
      // Create user with payment data
      const userId = await t.run(async ctx => {
        return ctx.db.insert('users', {
          email: 'preserve@example.com',
          clerkUserId: 'clerk_preserve_user',
          paid: true,
          paymentId: 'original_payment_123',
          paymentDate: '2025-01-01',
          paymentStatus: 'confirmed',
        });
      });

      // Update user from Clerk without payment metadata
      const clerkData = {
        id: 'clerk_preserve_user',
        first_name: 'Updated',
        email_addresses: [{ email_address: 'preserve@example.com' }],
        public_metadata: {}, // No payment data
      };

      await t.run(async ctx => {
        return ctx.runMutation(internal.users.upsertFromClerk, { data: clerkData });
      });

      // Verify payment data was preserved
      const user = await t.run(ctx => ctx.db.get(userId));
      expect(user?.firstName).toBe('Updated');
      expect(user?.paid).toBe(true);
      expect(user?.paymentId).toBe('original_payment_123');
      expect(user?.paymentDate).toBe('2025-01-01');
      expect(user?.paymentStatus).toBe('confirmed');
    });

    it('updates payment data when new payment metadata in Clerk', async () => {
      // Create user without payment
      await t.run(async ctx => {
        return ctx.db.insert('users', {
          email: 'upgrade@example.com',
          clerkUserId: 'clerk_upgrade_user',
        });
      });

      // Update with payment metadata
      const clerkData = {
        id: 'clerk_upgrade_user',
        email_addresses: [{ email_address: 'upgrade@example.com' }],
        public_metadata: {
          paid: true,
          paymentId: 'new_payment_456',
          paymentDate: '2025-01-20',
          paymentStatus: 'approved',
        },
      };

      await t.run(async ctx => {
        return ctx.runMutation(internal.users.upsertFromClerk, { data: clerkData });
      });

      // Verify payment was added
      const user = await t.run(async ctx => {
        return ctx.runQuery(internal.users.getUserByClerkId, {
          clerkUserId: 'clerk_upgrade_user',
        });
      });

      expect(user?.paid).toBe(true);
      expect(user?.paymentId).toBe('new_payment_456');
    });
  });

  describe('User Deletion from Clerk', () => {
    it('deletes user when Clerk user is deleted', async () => {
      // Create user
      const userId = await t.run(async ctx => {
        return ctx.db.insert('users', {
          email: 'delete@example.com',
          clerkUserId: 'clerk_delete_user',
        });
      });

      // Delete user
      await t.run(async ctx => {
        return ctx.runMutation(internal.users.deleteFromClerk, {
          clerkUserId: 'clerk_delete_user',
        });
      });

      // Verify user was deleted
      const user = await t.run(ctx => ctx.db.get(userId));
      expect(user).toBeNull();
    });

    it('handles deletion of non-existent user gracefully', async () => {
      // Should not throw error
      await expect(
        t.run(async ctx => {
          return ctx.runMutation(internal.users.deleteFromClerk, {
            clerkUserId: 'non_existent_clerk_user',
          });
        })
      ).resolves.toBeNull();
    });
  });

  describe('User Query by Clerk ID', () => {
    it('retrieves user by Clerk ID', async () => {
      await t.run(async ctx => {
        return ctx.db.insert('users', {
          email: 'query@example.com',
          clerkUserId: 'clerk_query_user',
          firstName: 'Query',
          lastName: 'User',
        });
      });

      const user = await t.run(async ctx => {
        return ctx.runQuery(internal.users.getUserByClerkId, {
          clerkUserId: 'clerk_query_user',
        });
      });

      expect(user).toBeDefined();
      expect(user?.email).toBe('query@example.com');
      expect(user?.firstName).toBe('Query');
    });

    it('returns null for non-existent Clerk ID', async () => {
      const user = await t.run(async ctx => {
        return ctx.runQuery(internal.users.getUserByClerkId, {
          clerkUserId: 'non_existent_id',
        });
      });

      expect(user).toBeNull();
    });
  });

  describe('Sync Consistency', () => {
    it('handles rapid successive updates', async () => {
      const clerkId = 'clerk_rapid_updates';

      // Initial creation
      await t.run(async ctx => {
        return ctx.runMutation(internal.users.upsertFromClerk, {
          data: {
            id: clerkId,
            first_name: 'First',
            email_addresses: [{ email_address: 'rapid@example.com' }],
          },
        });
      });

      // Multiple rapid updates
      await t.run(async ctx => {
        return ctx.runMutation(internal.users.upsertFromClerk, {
          data: {
            id: clerkId,
            first_name: 'Second',
            email_addresses: [{ email_address: 'rapid@example.com' }],
          },
        });
      });

      await t.run(async ctx => {
        return ctx.runMutation(internal.users.upsertFromClerk, {
          data: {
            id: clerkId,
            first_name: 'Third',
            last_name: 'Final',
            email_addresses: [{ email_address: 'rapid@example.com' }],
          },
        });
      });

      // Verify final state
      const user = await t.run(async ctx => {
        return ctx.runQuery(internal.users.getUserByClerkId, { clerkUserId: clerkId });
      });

      expect(user?.firstName).toBe('Third');
      expect(user?.lastName).toBe('Final');
    });

    it('ensures single user per Clerk ID', async () => {
      const clerkId = 'clerk_unique_user';

      // Create user twice
      await t.run(async ctx => {
        return ctx.runMutation(internal.users.upsertFromClerk, {
          data: {
            id: clerkId,
            email_addresses: [{ email_address: 'unique@example.com' }],
          },
        });
      });

      await t.run(async ctx => {
        return ctx.runMutation(internal.users.upsertFromClerk, {
          data: {
            id: clerkId,
            first_name: 'Updated',
            email_addresses: [{ email_address: 'unique@example.com' }],
          },
        });
      });

      // Count users with this Clerk ID
      const users = await t.run(async ctx => {
        return ctx.db
          .query('users')
          .filter(q => q.eq(q.field('clerkUserId'), clerkId))
          .collect();
      });

      expect(users).toHaveLength(1);
      expect(users[0].firstName).toBe('Updated');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty email addresses array', async () => {
      const clerkData = {
        id: 'clerk_no_email',
        email_addresses: [],
      };

      const userId = await t.run(async ctx => {
        return ctx.runMutation(internal.users.upsertFromClerk, { data: clerkData });
      });

      const user = await t.run(ctx => ctx.db.get(userId!));
      expect(user?.email).toBeUndefined();
    });

    it('handles missing email_addresses field', async () => {
      const clerkData = {
        id: 'clerk_missing_email',
      };

      const userId = await t.run(async ctx => {
        return ctx.runMutation(internal.users.upsertFromClerk, { data: clerkData });
      });

      const user = await t.run(ctx => ctx.db.get(userId!));
      expect(user?.email).toBeUndefined();
    });

    it('handles special characters in names', async () => {
      const clerkData = {
        id: 'clerk_special_chars',
        first_name: "O'Brien",
        last_name: 'São Paulo-Silva',
        email_addresses: [{ email_address: 'special@example.com' }],
      };

      const userId = await t.run(async ctx => {
        return ctx.runMutation(internal.users.upsertFromClerk, { data: clerkData });
      });

      const user = await t.run(ctx => ctx.db.get(userId!));
      expect(user?.firstName).toBe("O'Brien");
      expect(user?.lastName).toBe('São Paulo-Silva');
    });
  });
});
