# 📊 Migration Plan: From User-Specific Aggregates to Table-Based Stats

This document outlines the **new design** for question statistics in your quiz
app, migrating from **Convex Aggregate components** to a more optimized and
scalable **table-based tracking system**.

---

## 🎯 Goal

Replace user-specific aggregates with table-backed stats for:

- Better performance at scale
- Reduced aggregate complexity
- More flexible querying with filters (themes, subthemes, groups)
- Support for both total counts and quiz generation

## 📝 Implementation Strategy (Updated)

**Current State Analysis:**

- `userQuestionStats` table already exists and works perfectly for individual
  question tracking
- Performance bottleneck is in count aggregations, not individual stats
- Current `getUserStatsFromTable` loads ALL user stats just to count them
  (expensive!)

**Refined Approach:** Instead of replacing `userQuestionStats`, add a **separate
counts table** for pre-computed aggregates.

---

## 📁 Before: User-Specific Aggregates (❌ Replace)

You previously had 9 user-specific aggregates:

### Basic Counts:

- `answeredByUser`
- `incorrectByUser`
- `bookmarkedByUser`

### Hierarchical Counts (by taxonomy):

- `answeredByThemeByUser`
- `answeredBySubthemeByUser`
- `answeredByGroupByUser`
- `incorrectByThemeByUser`
- `incorrectBySubthemeByUser`
- `incorrectByGroupByUser`

These should now be replaced by a **user stats table**.

---

## ✅ After: Two-Table Approach

### 1. Keep Existing `userQuestionStats` (✅ Already Perfect)

The current `userQuestionStats` table works perfectly for individual question
tracking:

```ts
userQuestionStats: defineTable({
  userId: v.id('users'),
  questionId: v.id('questions'),
  hasAnswered: v.boolean(),
  isIncorrect: v.boolean(),
  answeredAt: v.number(),
  themeId: v.optional(v.id('themes')),
  subthemeId: v.optional(v.id('subthemes')),
  groupId: v.optional(v.id('groups')),
});
```

### 2. Add New `userStatsCounts` Table (🚀 New)

Pre-computed counts for ultra-fast statistics:

```ts
userStatsCounts: defineTable({
  userId: v.id('users'),

  // Global counts
  totalAnswered: v.number(),
  totalIncorrect: v.number(),
  totalBookmarked: v.number(),

  // By theme counts (using Records for flexibility)
  answeredByTheme: v.record(v.id('themes'), v.number()),
  incorrectByTheme: v.record(v.id('themes'), v.number()),
  bookmarkedByTheme: v.record(v.id('themes'), v.number()),

  // By subtheme counts
  answeredBySubtheme: v.record(v.id('subthemes'), v.number()),
  incorrectBySubtheme: v.record(v.id('subthemes'), v.number()),
  bookmarkedBySubtheme: v.record(v.id('subthemes'), v.number()),

  // By group counts
  answeredByGroup: v.record(v.id('groups'), v.number()),
  incorrectByGroup: v.record(v.id('groups'), v.number()),
  bookmarkedByGroup: v.record(v.id('groups'), v.number()),

  lastUpdated: v.number(),
}).index('by_user', ['userId']);
```

### Benefits:

- **Keep detailed tracking**: `userQuestionStats` for individual questions
- **Ultra-fast counts**: Single lookup instead of loading thousands of records
- **Incremental updates**: Update counts when stats change
- **Backwards compatible**: Existing code keeps working

---

## 📊 Performance Comparison

**Before (Current - Expensive):**

```ts
// getUserStatsFromTable - loads ALL user stats
const userStatsSummary = await ctx.db
  .query('userQuestionStats')
  .withIndex('by_user', q => q.eq('userId', userId._id))
  .collect(); // 😬 For user with 1000 answered questions: 1000+ records

// Then N+1 queries to get question details
for (const stat of userStatsSummary) {
  const question = await ctx.db.get(stat.questionId); // 😬 1000+ more queries
  // ... counting logic
}
```

**After (New - Ultra Fast):**

```ts
// Single lookup for all counts
const counts = await ctx.db
  .query('userStatsCounts')
  .withIndex('by_user', q => q.eq('userId', userId._id))
  .first(); // ✅ Just 1-2 database calls for any user

return {
  totalAnswered: counts.totalAnswered,
  totalIncorrect: counts.totalIncorrect,
  byTheme: counts.answeredByTheme, // Already computed!
  // ... instant results
};
```

**Performance Gain**: From 1000+ database calls → 1-2 database calls 🚀

---

## 🔄 Incremental Count Updates

When a user answers a question, update both tables:

```ts
// 1. Update individual tracking (existing)
await ctx.db.insert('userQuestionStats', { ... });

// 2. Increment counts (new)
const counts = await ctx.db
  .query('userStatsCounts')
  .withIndex('by_user', q => q.eq('userId', userId))
  .first();

if (counts) {
  await ctx.db.patch(counts._id, {
    totalAnswered: counts.totalAnswered + 1,
    totalIncorrect: isIncorrect ? counts.totalIncorrect + 1 : counts.totalIncorrect,
    answeredByTheme: {
      ...counts.answeredByTheme,
      [themeId]: (counts.answeredByTheme[themeId] || 0) + 1
    },
    lastUpdated: Date.now()
  });
}
```

## ❓ What About Unanswered Questions?

- **For counts**: Total questions - `totalAnswered` from counts table
- **For quiz generation**: Still use existing efficient approach in
  `customQuizzesCreation.ts`

---

## 🔁 Quiz Generation (Random 120 Questions)

### Requirement:

Get 120 random unanswered questions (filtered by theme, subtheme, or group).

### Efficient Strategy:

1. Filter questions via `.withIndex('by_theme', [themeId])`, etc.
2. Page results (e.g., 100 at a time)
3. For each question:
   - Check if user has answered (`userQuestionStats` lookup)
   - If not answered, add to pool

4. Stop when you reach 120 questions
5. Shuffle the results if needed

This ensures performance whether the user has answered 1% or 99% of the
questions.

---

## ✅ Aggregates You Should Keep

Keep only these non-user-specific aggregates:

```ts
// Global (non-user) counts
questionCountTotal;
questionCountByTheme;
questionCountBySubtheme;
questionCountByGroup;

// Random question pools
randomQuestions;
randomQuestionsByTheme;
randomQuestionsBySubtheme;
randomQuestionsByGroup;
```

These help avoid paginating the whole `questions` table and support UI display
or random selection logic efficiently.

---

## 🗺️ Migration Plan

### Phase 1: Add Counts Table

1. Add `userStatsCounts` to schema
2. Create initialization function to populate existing users
3. Update `_updateQuestionStats` to maintain both tables

### Phase 2: Switch Stats Queries

1. Create new ultra-fast `getUserStatsFast` function
2. Test performance comparison
3. Switch frontend to use new function

### Phase 3: Remove Aggregates

1. Remove 9 user-specific aggregates from `convex.config.ts`
2. Clean up aggregate-related code
3. Keep only global aggregates for quiz generation

## 📦 Result

- ✅ **Keep detailed tracking**: Individual question stats preserved
- ✅ **Ultra-fast counts**: 1000x faster statistics queries
- ✅ **Backwards compatible**: Existing functionality unchanged
- ✅ **Simpler maintenance**: No complex aggregate logic
- ✅ **Scalable**: Works efficiently at any scale

---

**Next Steps**: Implement the `userStatsCounts` table and update functions!
