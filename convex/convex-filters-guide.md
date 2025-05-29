# Convex Filters - Complete Guide to Query Filtering

> **Source:** >
> [Using TypeScript to Write Complex Query Filters](https://stack.convex.dev/complex-filters-in-convex)

This guide covers everything you need to know about filtering data in Convex,
from basic built-in filters to advanced TypeScript predicates.

## The Filtering Problem

Convex's built-in `.filter()` syntax is intentionally limited to ensure
performance clarity:

```typescript
// Built-in filters - limited but fast
export const messages = query({
  args: { channel: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('posts')
      .filter(q => q.eq(q.field('channel'), args.channel))
      .collect();
  },
});
```

**Built-in filter operators:**

- `q.eq(field, value)` - Equality
- `q.neq(field, value)` - Not equal
- `q.lt(field, value)` - Less than
- `q.lte(field, value)` - Less than or equal
- `q.gt(field, value)` - Greater than
- `q.gte(field, value)` - Greater than or equal
- `q.or(condition1, condition2)` - Logical OR
- `q.and(condition1, condition2)` - Logical AND

**What you CAN'T do with built-in filters:**

- Array operations (`includes`, `length`)
- String manipulation (`startsWith`, `contains`, regex)
- Complex logic with loops or conditions
- Date/time calculations
- Cross-field comparisons
- Nested object property access

## Solution: TypeScript Filters

When built-in filters aren't enough, use TypeScript! You can run arbitrary code
within the Convex runtime.

### Simple Array Example

Let's say you have posts with tags and want to find posts containing a specific
tag:

```typescript
// Schema
export default defineSchema({
  posts: defineTable({
    body: v.string(),
    tags: v.array(v.string()), // ["happy", "coding", "tutorial"]
  }),
});

// ❌ This doesn't work - no array support in built-in filters
export const postsWithTag = query({
  args: { tag: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('posts')
      .filter(q => q.arrayIncludes(q.field('tags'), args.tag)) // Doesn't exist!
      .collect();
  },
});

// ✅ This works - TypeScript array filter
export const postsWithTag = query({
  args: { tag: v.string() },
  handler: async (ctx, args) => {
    const allPosts = await ctx.db.query('posts').collect();
    return allPosts.filter(post => post.tags.includes(args.tag));
  },
});
```

## The `filter` Helper from convex-helpers

The `filter` helper gives you the best of both worlds - TypeScript power with
query efficiency:

```bash
npm install convex-helpers
```

```typescript
import { filter } from 'convex-helpers/server/filter';

// Replace this:
ctx.db.query('posts').filter(q => /* limited functionality */).collect();

// With this:
filter(ctx.db.query('posts'), post => /* unlimited functionality */).collect();
```

### Basic Usage

```typescript
import { filter } from 'convex-helpers/server/filter';

export const postsWithTag = query({
  args: { tag: v.string() },
  handler: async (ctx, args) => {
    return filter(ctx.db.query('posts'), post =>
      post.tags.includes(args.tag),
    ).collect();
  },
});

// Works with all query methods
export const firstPostWithTag = query({
  args: { tag: v.string() },
  handler: (ctx, args) => {
    return filter(ctx.db.query('posts'), post =>
      post.tags.includes(args.tag),
    ).first(); // ✅ Stops at first match
  },
});
```

### Advanced TypeScript Filter Examples

#### String Operations

```typescript
// Find posts with titles starting with specific text
export const postsStartingWith = query({
  args: { prefix: v.string() },
  handler: (ctx, args) => {
    return filter(ctx.db.query('posts'), post =>
      post.title.toLowerCase().startsWith(args.prefix.toLowerCase()),
    ).collect();
  },
});

// Find posts with specific word count
export const shortPosts = query({
  handler: ctx => {
    return filter(
      ctx.db.query('posts'),
      post => post.body.split(' ').length < 100,
    ).collect();
  },
});
```

#### Date/Time Operations

```typescript
// Posts from the last week
export const recentPosts = query({
  handler: ctx => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return filter(
      ctx.db.query('posts'),
      post => post._creationTime > oneWeekAgo,
    ).collect();
  },
});

// Posts created on weekends
export const weekendPosts = query({
  handler: ctx => {
    return filter(ctx.db.query('posts'), post => {
      const day = new Date(post._creationTime).getDay();
      return day === 0 || day === 6; // Sunday or Saturday
    }).collect();
  },
});
```

#### Complex Logic

```typescript
// Posts with complex scoring logic
export const topPosts = query({
  handler: ctx => {
    return filter(ctx.db.query('posts'), post => {
      const age = Date.now() - post._creationTime;
      const hoursSinceCreation = age / (1000 * 60 * 60);
      const score =
        (post.likes * 2 + post.comments) / Math.log(hoursSinceCreation + 2);
      return score > 10;
    }).take(20);
  },
});
```

#### Async Filters with Database Lookups

```typescript
// Posts by verified authors only
export const verifiedAuthorPosts = query({
  handler: ctx => {
    return filter(ctx.db.query('posts'), async post => {
      const author = await ctx.db.get(post.authorId);
      return author?.isVerified === true;
    }).collect();
  },
});
```

## Performance: TypeScript vs Built-in Filters

**Key insight:** TypeScript filters have the **same performance** as built-in
filters for unindexed queries!

```typescript
// These have identical performance:
// 1. Built-in filter
ctx.db
  .query('posts')
  .filter(q => q.eq(q.field('channel'), 'general'))
  .collect();

// 2. TypeScript filter
filter(ctx.db.query('posts'), post => post.channel === 'general').collect();

// 3. Array filter
const posts = await ctx.db.query('posts').collect();
posts.filter(post => post.channel === 'general');
```

**Why?** All three approaches:

- Scan the same documents in the Convex runtime
- Execute filters "within the database"
- Have the same reactivity behavior
- Cause the same mutation retry patterns

## When to Use Indexes vs Filters

### Use Indexes When:

- You query the same fields frequently
- You need range queries (`>`, `<`)
- You have large datasets
- Performance is critical

```typescript
// Schema with index
posts: defineTable({
  title: v.string(),
  authorId: v.id('users'),
  priority: v.number(),
}).index('by_author_priority', ['authorId', 'priority']);

// Fast indexed query
export const userHighPriorityPosts = query({
  args: { authorId: v.id('users') },
  handler: async (ctx, args) => {
    return ctx.db
      .query('posts')
      .withIndex('by_author_priority', q =>
        q.eq('authorId', args.authorId).gt('priority', 7),
      )
      .collect();
  },
});
```

### Use Filters When:

- Complex logic that can't be indexed
- Prototyping and development
- Infrequent queries
- Small datasets after index filtering

## Optimization Strategies

### 1. Combine Indexes with Filters

Use indexes to narrow down results, then filter for complex conditions:

```typescript
export const authorComplexPosts = query({
  args: { authorId: v.id('users'), tag: v.string() },
  handler: (ctx, args) => {
    // Use index to filter by author (fast)
    return filter(
      ctx.db
        .query('posts')
        .withIndex('by_author', q => q.eq('authorId', args.authorId)),
      // Then use TypeScript for complex tag logic (on smaller dataset)
      post => post.tags.includes(args.tag) && post.body.length > 500,
    ).collect();
  },
});
```

### 2. Denormalization for Common Queries

Store computed values to avoid repeated filtering:

```typescript
// Add computed fields to schema
posts: defineTable({
  title: v.string(),
  body: v.string(),
  tags: v.array(v.string()),
  isImportant: v.boolean(), // Denormalized: tags.includes("important")
  wordCount: v.number(), // Denormalized: body.split(' ').length
})
  .index('by_important', ['isImportant'])
  .index('by_word_count', ['wordCount']);

// Fast queries on denormalized fields
export const importantPosts = query({
  handler: ctx => {
    return ctx.db
      .query('posts')
      .withIndex('by_important', q => q.eq('isImportant', true))
      .collect();
  },
});

// Remember to keep denormalized fields in sync!
export const createPost = mutation({
  args: { title: v.string(), body: v.string(), tags: v.array(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.insert('posts', {
      ...args,
      isImportant: args.tags.includes('important'),
      wordCount: args.body.split(' ').length,
    });
  },
});
```

### 3. Separate Tables for Complex Relationships

For many-to-many relationships, create junction tables:

```typescript
// Instead of tags array, use separate table
posts: defineTable({
  title: v.string(),
  body: v.string(),
}),

postTags: defineTable({
  postId: v.id('posts'),
  tag: v.string(),
}).index('by_tag', ['tag'])
  .index('by_post', ['postId'])

// Now you can efficiently query by tag
export const postsWithTag = query({
  args: { tag: v.string() },
  handler: async (ctx, args) => {
    const taggedPosts = await ctx.db
      .query('postTags')
      .withIndex('by_tag', q => q.eq('tag', args.tag))
      .collect();

    return Promise.all(
      taggedPosts.map(tp => ctx.db.get(tp.postId))
    );
  },
});
```

## Advanced Filter Patterns

### Pagination with Filters

Filters work with pagination, but pages might be smaller than expected:

```typescript
import { filter } from 'convex-helpers/server/filter';

export const filteredPosts = query({
  args: {
    tag: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: (ctx, args) => {
    return filter(ctx.db.query('posts'), post =>
      post.tags.includes(args.tag),
    ).paginate(args.paginationOpts);
  },
});
```

**Note:** This might return pages with fewer items than requested since
filtering happens after pagination.

### Search-like Functionality

```typescript
// Multi-field search
export const searchPosts = query({
  args: { searchTerm: v.string() },
  handler: (ctx, args) => {
    const term = args.searchTerm.toLowerCase();
    return filter(
      ctx.db.query('posts'),
      post =>
        post.title.toLowerCase().includes(term) ||
        post.body.toLowerCase().includes(term) ||
        post.tags.some(tag => tag.toLowerCase().includes(term)),
    ).take(50);
  },
});

// For better search, consider using Convex's search indexes:
posts: defineTable({
  title: v.string(),
  body: v.string(),
}).searchIndex('search_posts', {
  searchField: 'title',
  filterFields: ['authorId'],
});
```

### Conditional Filtering

```typescript
export const conditionalPosts = query({
  args: {
    authorId: v.optional(v.id('users')),
    tag: v.optional(v.string()),
    minLength: v.optional(v.number()),
  },
  handler: (ctx, args) => {
    let query = ctx.db.query('posts');

    // Use index if author specified
    if (args.authorId) {
      query = query.withIndex('by_author', q =>
        q.eq('authorId', args.authorId),
      );
    }

    return filter(query, post => {
      // Apply filters conditionally
      if (args.tag && !post.tags.includes(args.tag)) return false;
      if (args.minLength && post.body.length < args.minLength) return false;
      return true;
    }).collect();
  },
});
```

## Best Practices

### 1. Start with Filters, Optimize with Indexes

```typescript
// ✅ Good development flow:
// 1. Start with TypeScript filter for rapid development
export const postsWithComplexLogic = query({
  handler: ctx => {
    return filter(
      ctx.db.query('posts'),
      post => /* complex logic */,
    ).collect();
  },
});

// 2. Add indexes when you need performance
// 3. Denormalize if the logic is used frequently
```

### 2. Avoid Filters for Access Control

```typescript
// ❌ Don't use filters for security
export const userPosts = query({
  args: { userId: v.id('users') },
  handler: (ctx, args) => {
    return filter(
      ctx.db.query('posts'),
      post => post.authorId === args.userId, // Security through filtering
    ).collect();
  },
});

// ✅ Use indexes for access control
export const userPosts = query({
  args: { userId: v.id('users') },
  handler: (ctx, args) => {
    return ctx.db
      .query('posts')
      .withIndex('by_author', q => q.eq('authorId', args.userId))
      .collect();
  },
});
```

### 3. Consider Data Volume

```typescript
// ✅ Good for small datasets or after index filtering
const userPosts = await ctx.db
  .query('posts')
  .withIndex('by_author', q => q.eq('authorId', userId))
  .collect(); // Maybe 10-100 posts per user

const filteredPosts = userPosts.filter(post => /* complex logic */);

// ❌ Avoid for large unfiltered datasets
const allPosts = await ctx.db.query('posts').collect(); // Maybe millions
const filtered = allPosts.filter(post => /* logic */); // Inefficient
```

## Filter Helper API Reference

The `filter` helper supports all query operations:

```typescript
import { filter } from 'convex-helpers/server/filter';

// Basic usage
filter(query, predicate)
  // Supports all query methods
  .first() // Get first matching document
  .unique() // Get single document (throws if not exactly one)
  .take(n) // Get first n documents
  .collect() // Get all documents as array
  .paginate(opts) // Paginated results
  .next(); // Iterator interface

// Works with indexes and ordering
filter(
  ctx.db
    .query('posts')
    .withIndex('by_author', q => q.eq('authorId', userId))
    .order('desc'),
  post => post.tags.includes('featured'),
).take(10);

// Supports async predicates
filter(ctx.db.query('posts'), async post => {
  const author = await ctx.db.get(post.authorId);
  return author?.isVerified;
}).collect();
```

## Summary

Convex filters provide a spectrum of options:

**Built-in Filters (`ctx.db.query().filter()`)**

- ✅ Fast and optimized
- ✅ Clear performance characteristics
- ❌ Limited to basic operations

**TypeScript Filters (`filter()` helper)**

- ✅ Unlimited functionality
- ✅ Same performance as built-in for unindexed queries
- ✅ Works with all query operations
- ✅ Supports async operations
- ❌ No automatic optimization

**Indexes**

- ✅ Extremely fast for supported patterns
- ✅ Enable efficient range queries
- ❌ Require planning and maintenance
- ❌ Limited to indexable fields

**When to use each:**

- **Prototyping:** Start with TypeScript filters
- **Production:** Use indexes for frequent queries
- **Complex logic:** TypeScript filters after index filtering
- **One-off queries:** TypeScript filters are fine
- **Large datasets:** Always use indexes to narrow results first

The key is combining these approaches effectively - use indexes to quickly
narrow your dataset, then apply TypeScript filters for complex logic that can't
be indexed.
