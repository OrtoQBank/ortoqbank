import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Users table
  users: defineTable({
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    clerkUserId: v.string(),
  }).index('by_clerkUserId', ['clerkUserId']),

  themes: defineTable({
    name: v.string(),
  }).index('by_name', ['name']),

  subthemes: defineTable({
    name: v.string(),
    themeId: v.id('themes'),
  }).index('by_theme', ['themeId']),

  groups: defineTable({
    name: v.string(),
    subthemeId: v.id('subthemes'),
  }).index('by_subtheme', ['subthemeId']),

  // Tags table
  tags: defineTable({
    name: v.string(),
  }),

  questions: defineTable({
    title: v.string(),
    normalizedTitle: v.string(),
    text: v.string(),
    questionImageUrl: v.optional(v.string()),
    explanation: v.string(),
    explanationImageUrl: v.optional(v.string()),
    options: v.array(
      v.object({
        text: v.string(),
      }),
    ),
    correctOptionIndex: v.number(),
    themeId: v.id('themes'),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
    authorId: v.id('users'),
    isPublic: v.boolean(),
  })
    .index('by_title', ['normalizedTitle'])
    .searchIndex('search_by_title', {
      searchField: 'title',
    }),
});
