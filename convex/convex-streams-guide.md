# Convex Streams - Advanced Query Patterns Guide

> **Sources:**
>
> - [Merging Streams of Convex Data](https://stack.convex.dev/merging-streams-of-convex-data)
> - [Translate SQL into Convex Queries](https://stack.convex.dev/translate-sql-into-convex-queries)

This guide covers advanced query patterns using `convex-helpers` streams to
replicate SQL-like operations in Convex.

## What Are Streams?

Streams are async iterables of documents, ordered by indexed fields. Think of
them as **documents flowing out of a stream** that you can read one at a time,
allowing for advanced query patterns like:

- **UNION ALL** - Combining multiple query results
- **JOIN** - Relating data across tables
- **DISTINCT** - Removing duplicates
- **WHERE clauses** - Even when skipping index fields
- **Pagination** - Efficient pagination across merged data

## Installation

```bash
npm install convex-helpers
```

## Basic Stream Syntax

Streams use similar syntax to regular Convex queries:

```typescript
import { stream } from 'convex-helpers/server/stream';
import schema from './schema';

// Regular query
const messages = await ctx.db
  .query('messages')
  .withIndex('from_to', q => q.eq('from', u1).eq('to', u2))
  .collect();

// Stream query - same interface!
const messageStream = stream(ctx.db, schema)
  .query('messages')
  .withIndex('from_to', q => q.eq('from', u1).eq('to', u2))
  .order('desc');

// Get results from stream
const messages = await messageStream.collect();
const firstMessage = await messageStream.first();
const tenMessages = await messageStream.take(10);
```

## Core Stream Operations

### 1. UNION ALL - Merging Streams

Combine multiple streams into one, maintaining order:

```typescript
import { stream, mergedStream } from 'convex-helpers/server/stream';

export const conversation = query({
  args: {
    u1: v.id('users'),
    u2: v.id('users'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { u1, u2, paginationOpts }) => {
    // Stream of messages from u1 → u2
    const messages1 = stream(ctx.db, schema)
      .query('messages')
      .withIndex('from_to', q => q.eq('from', u1).eq('to', u2));

    // Stream of messages from u2 → u1
    const messages2 = stream(ctx.db, schema)
      .query('messages')
      .withIndex('from_to', q => q.eq('from', u2).eq('to', u1));

    // Merged stream of all conversation messages, ordered by creation time
    const conversation = mergedStream(
      [messages1, messages2],
      ['_creationTime'],
    );

    // Paginate the combined result
    return conversation.paginate(paginationOpts);
  },
});
```

**Key Points:**

- Each input stream must already be ordered by the merge fields
- Merge order can be any prefix of the index fields
- Results are interleaved in the specified order

### 2. JOIN - FlatMap Pattern

Use `flatMap` to expand each document into related documents:

```typescript
// Get users and their recent messages
const users = stream(ctx.db, schema)
  .query('users')
  .withIndex('by_creation_time');

const usersWithMessages = users.flatMap(
  async user =>
    stream(ctx.db, schema)
      .query('messages')
      .withIndex('from_to', q => q.eq('from', user._id))
      .take(5), // Last 5 messages per user
  ['_creationTime'], // Order for flattened results
);

const results = await usersWithMessages.collect();
```

### 3. DISTINCT - Remove Duplicates

Get unique values based on specific fields:

```typescript
// Get unique message priorities
const uniquePriorities = await stream(ctx.db, schema)
  .query('messages')
  .withIndex('priority', q => q.gt('priority', 5))
  .distinct(['priority'])
  .map(async message => message.priority)
  .collect();
```

### 4. WHERE with Index Skip Scans

Handle complex WHERE clauses that skip index fields:

```typescript
// Find messages WHERE priority > 5 AND _creationTime > recent
const priorities = stream(ctx.db, schema)
  .query('messages')
  .withIndex('priority', q => q.gt('priority', 5))
  .order('desc')
  .distinct(['priority'])
  .map(async message => message.priority);

const recentHighPriorityMessages = priorities.flatMap(
  async priority =>
    stream(ctx.db, schema)
      .query('messages')
      .withIndex('priority', q =>
        q
          .eq('priority', priority)
          .gt('_creationTime', Date.now() - 24 * 60 * 60 * 1000),
      )
      .order('desc'),
  ['priority', '_creationTime'],
);

const results = await recentHighPriorityMessages.paginate(paginationOpts);
```

### 5. Filtering with TypeScript Predicates

Use `filterWith` for arbitrary filtering logic:

```typescript
const activeMessages = stream(ctx.db, schema)
  .query('messages')
  .withIndex('from_to')
  .filterWith(async message => {
    // Any TypeScript logic
    return !message.archived && message.body.length > 10;
  });
```

### 6. Transforming Data

Use `map` to transform or join with other data:

```typescript
const messagesWithUserInfo = stream(ctx.db, schema)
  .query('messages')
  .withIndex('from_to')
  .map(async message => {
    const user = await ctx.db.get(message.from);
    return {
      ...message,
      fromUser: user?.name || 'Unknown',
    };
  });
```

## SQL to Convex Streams Translation

### SQL UNION

```sql
SELECT * FROM messages WHERE from = 'u1' AND to = 'u2'
UNION ALL
SELECT * FROM messages WHERE from = 'u2' AND to = 'u1'
ORDER BY _creationTime DESC;
```

```typescript
const messages1 = stream(ctx.db, schema)
  .query('messages')
  .withIndex('from_to', q => q.eq('from', 'u1').eq('to', 'u2'));

const messages2 = stream(ctx.db, schema)
  .query('messages')
  .withIndex('from_to', q => q.eq('from', 'u2').eq('to', 'u1'));

const result = mergedStream([messages1, messages2], ['_creationTime']);
```

### SQL JOIN

```sql
SELECT u.name, m.body FROM users u
JOIN messages m ON u._id = m.from
WHERE u.status = 'active';
```

```typescript
const activeUsers = stream(ctx.db, schema)
  .query('users')
  .withIndex('by_status', q => q.eq('status', 'active'));

const result = activeUsers.flatMap(
  async user =>
    stream(ctx.db, schema)
      .query('messages')
      .withIndex('from_to', q => q.eq('from', user._id))
      .map(async message => ({
        userName: user.name,
        messageBody: message.body,
      })),
  ['_creationTime'],
);
```

### SQL DISTINCT with WHERE

```sql
SELECT DISTINCT priority FROM messages
WHERE priority > 5 AND created_at > '2024-01-01';
```

```typescript
const distinctPriorities = await stream(ctx.db, schema)
  .query('messages')
  .withIndex('priority', q => q.gt('priority', 5))
  .filterWith(async message => message._creationTime > Date.parse('2024-01-01'))
  .distinct(['priority'])
  .map(async message => message.priority)
  .collect();
```

## Advanced Patterns

### Composing Multiple Operations

```typescript
export const complexQuery = query({
  args: { userId: v.id('users'), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { userId, paginationOpts }) => {
    // Get user's high-priority messages
    const highPriorityMessages = stream(ctx.db, schema)
      .query('messages')
      .withIndex('from_priority', q => q.eq('from', userId).gt('priority', 7));

    // Get user's recent messages
    const recentMessages = stream(ctx.db, schema)
      .query('messages')
      .withIndex('from_time', q =>
        q
          .eq('from', userId)
          .gt('_creationTime', Date.now() - 7 * 24 * 60 * 60 * 1000),
      );

    // Merge both streams
    const combinedMessages = mergedStream(
      [highPriorityMessages, recentMessages],
      ['_creationTime'],
    );

    // Filter out archived messages
    const activeMessages = combinedMessages.filterWith(
      async message => !message.archived,
    );

    // Add user context
    const enrichedMessages = activeMessages.map(async message => {
      const recipient = await ctx.db.get(message.to);
      return {
        ...message,
        recipientName: recipient?.name || 'Unknown',
      };
    });

    // Paginate results
    return enrichedMessages.paginate(paginationOpts);
  },
});
```

### Dynamic Query Building

```typescript
import {
  StreamQueryInitializer,
  StreamQuery,
  OrderedStreamQuery,
} from 'convex-helpers/server/stream';

function buildMessageQuery(
  ctx: QueryCtx,
  filters: {
    userId?: Id<'users'>;
    priority?: number;
    recent?: boolean;
  },
): OrderedStreamQuery<'messages'> {
  let query: StreamQuery<'messages'>;

  if (filters.userId && filters.priority) {
    query = stream(ctx.db, schema)
      .query('messages')
      .withIndex('from_priority', q =>
        q.eq('from', filters.userId).gte('priority', filters.priority),
      );
  } else if (filters.userId) {
    query = stream(ctx.db, schema)
      .query('messages')
      .withIndex('from_time', q => q.eq('from', filters.userId));
  } else {
    query = stream(ctx.db, schema)
      .query('messages')
      .withIndex('by_creation_time');
  }

  const orderedQuery = query.order('desc');

  if (filters.recent) {
    return orderedQuery.filterWith(
      async message => message._creationTime > Date.now() - 24 * 60 * 60 * 1000,
    );
  }

  return orderedQuery;
}
```

## Pagination Considerations

### ⚠️ Important Warnings

1. **Security Concern - Index Leakage:**

```typescript
// ❌ DON'T use filterWith for access control
// Index keys may leak in pagination cursors
const messages = await stream(ctx.db, schema)
  .query('messages')
  .withIndex('from_to')
  .filterWith(async message => haveAccess(ctx, message)) // 🚨 Leaks index data
  .paginate(paginationOpts);
```

2. **Stability Requirement:**

```typescript
// ❌ DON'T make queries data-dependent
const newestUser = await ctx.db.query('users').order('desc').first();
return await stream(ctx.db, schema)
  .query('messages')
  .withIndex('from_to', q => q.eq('from', newestUser._id)) // 🚨 Unstable query
  .paginate(paginationOpts);
```

3. **Reactive Pagination:**

```typescript
// ✅ Use endCursor for contiguous pages in reactive contexts
const result = await messageStream.paginate({
  ...paginationOpts,
  endCursor: previousResult.continueCursor, // Ensures contiguous pages
});
```

### Best Practices for Pagination

```typescript
export const paginatedMessages = query({
  args: {
    userId: v.id('users'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { userId, paginationOpts }) => {
    // ✅ Stable query definition
    const messages = stream(ctx.db, schema)
      .query('messages')
      .withIndex('from_time', q => q.eq('from', userId))
      .order('desc');

    // ✅ No filterWith for access control - handle in index design instead
    return messages.paginate(paginationOpts);
  },
});
```

## Performance Tips

### 1. Index Design Matters

- Design indexes to support your stream patterns
- Consider the merge order when creating indexes
- Use the indexing mental model (see `indexing-mental-model.md`)

### 2. Minimize Stream Operations

```typescript
// ✅ Better: Use appropriate index
const messages = stream(ctx.db, schema)
  .query('messages')
  .withIndex('user_priority', q => q.eq('userId', userId).gt('priority', 5));

// ❌ Worse: Filter after querying
const messages = stream(ctx.db, schema)
  .query('messages')
  .withIndex('by_user', q => q.eq('userId', userId))
  .filterWith(async m => m.priority > 5); // Linear scan!
```

### 3. Batch Operations

```typescript
// ✅ Collect related data efficiently
const userIds = await messageStream
  .map(async message => message.from)
  .distinct(['from'])
  .collect();

const users = await Promise.all(userIds.map(id => ctx.db.get(id)));
```

## Summary

Convex streams enable powerful SQL-like patterns:

- **Streams** - Ordered, lazy sequences of documents
- **mergedStream** - UNION operations with custom merge order
- **flatMap** - JOIN operations and one-to-many expansions
- **distinct** - Remove duplicates based on fields
- **filterWith** - Arbitrary TypeScript predicates
- **map** - Transform and enrich data
- **Composable** - Chain operations together
- **Paginated** - Efficient pagination across complex queries

Use streams when you need to:

- Combine data from multiple index ranges
- Implement complex WHERE clauses
- Join data across tables
- Paginate merged or filtered results
- Replicate SQL patterns in Convex

Remember the pagination warnings and design your indexes to support your
streaming patterns for optimal performance.
