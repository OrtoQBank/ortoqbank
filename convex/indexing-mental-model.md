# Databases are Spreadsheets - Mental Model for Convex Indexing

> **Source:**
> [Stack Convex - Databases are Spreadsheets](https://stack.convex.dev/databases-are-spreadsheets)

This is a mental model for understanding databases and indexing, which is
particularly useful when working with Convex.

## Core Mental Model

- **Databases are just big spreadsheets**
- **An index is just a view of the spreadsheet sorted by one or more columns**
- **Binary search over a sorted list is faster than a linear scan (for large
  lists)**

## How Indexes Work

Imagine storing movies in a spreadsheet. It might look like this:

```
| _id | title         | director | year | genre  |
|-----|---------------|----------|------|--------|
| 1   | Inception     | Nolan    | 2010 | Sci-Fi |
| 2   | Interstellar  | Nolan    | 2014 | Sci-Fi |
| 3   | Barbie        | Gerwig   | 2023 | Comedy |
```

The main table is sorted by `_id` for efficient lookups by ID.

### Creating an Index

If we want to query by director, we create an index like a new spreadsheet tab:

```typescript
Movies: defineTable(...).index("ByDirectorAndYear", ["director", "year"])
```

This creates a new "tab" sorted by director, then year:

```
ByDirectorAndYear tab:
| director | year | _id | (reference to main table)
|----------|------|-----|---------------------------|
| Gerwig   | 2023 | 3   | → Barbie                  |
| Nolan    | 2010 | 1   | → Inception               |
| Nolan    | 2014 | 2   | → Interstellar            |
```

## Query Patterns

### ✅ Efficient Queries

**Get all movies by Nolan:**

```typescript
db.query('Movies').withIndex('ByDirectorAndYear', q =>
  q.eq('director', 'Nolan'),
);
```

This selects a contiguous block from the sorted index.

**Get movies from 2018 or later (with proper index):**

```typescript
db.query('Movies').withIndex('ByYearAndDirector', q => q.gte('year', 2018));
```

### ❌ Inefficient Queries

**Skipping index fields:**

```typescript
// ❌ Can't skip "director" and query only "year" efficiently
db.query('Movies').withIndex('ByDirectorAndYear', q => q.eq('year', 2023));
```

**Inequality followed by equality:**

```typescript
// ❌ Can't use inequality then equality efficiently
db.query('Movies').withIndex('ByYearAndDirector', q =>
  q.gte('year', 2000).eq('director', 'Nolan'),
);
```

**"Not equals" queries:**

```typescript
// ❌ No efficient "not equals"
db.query('Movies').withIndex('ByYearAndDirector', q => q.neq('year', 2018));

// ✅ Instead, use two separate queries:
db.query('Movies').withIndex('ByYearAndDirector', q => q.gt('year', 2018));
db.query('Movies').withIndex('ByYearAndDirector', q => q.lt('year', 2018));
```

**"In" / "Or" queries:**

```typescript
// ❌ No efficient "in" operator
db.query('Movies').withIndex('ByDirectorAndYear', q =>
  q.in('director', ['Nolan', 'Gerwig']),
);

// ✅ Instead, use separate queries:
db.query('Movies').withIndex('ByDirectorAndYear', q =>
  q.eq('director', 'Nolan'),
);
db.query('Movies').withIndex('ByDirectorAndYear', q =>
  q.eq('director', 'Gerwig'),
);
```

## Key Rules for Index Design

### 1. Index Field Order Matters

- Fields must be queried in the same order they appear in the index
- You can query a prefix of the index fields, but can't skip fields

### 2. Inequalities Must Be Last

- Only the last field in your query can use inequality operators (`>`, `<`,
  `>=`, `<=`)
- All previous fields must use equality (`eq`)

### 3. Consider Your Product's Query Patterns

- Design indexes based on how your application actually queries data
- Sometimes it's better to fetch a broader result set and filter in JavaScript

## Example: When to Use JavaScript vs. Index

If directors typically have few movies (<20), you might prefer:

```typescript
// Get all Nolan movies and sort/filter in JavaScript
const nolanMovies = await db
  .query('Movies')
  .withIndex('ByDirector', q => q.eq('director', 'Nolan'))
  .collect();

// Sort by release date in JavaScript
nolanMovies.sort((a, b) => a.year - b.year);
```

Rather than creating a complex index like `ByDirectorAndYearAndRating`.

## Convex's Query Syntax Philosophy

Convex makes performance explicit:

- Operations in `withIndex()` are efficient (binary search)
- Operations in `filter()` or JavaScript are linear scans
- The syntax prevents you from writing inefficient index queries that look fast
  but aren't

## Index Trade-offs

**Benefits:**

- Fast queries for the specific access patterns they support
- Enable efficient range queries and sorting

**Costs:**

- Additional storage space (each index is like a new spreadsheet tab)
- Write overhead (every insert/update must update all relevant indexes)
- Maintenance complexity

## Summary

Think of indexes as sorted spreadsheet tabs that enable binary search instead of
linear scans. Design them based on your application's actual query patterns, and
use Convex's explicit syntax to ensure your queries are performing as expected.

The mental model helps you understand:

- Why certain query patterns are fast or slow
- How to design effective indexes
- When to use indexes vs. JavaScript for filtering and sorting
