# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

OrtoQBank is a question bank web application for orthopedic students and
professionals. It's built with Next.js 15, Convex backend, Clerk authentication,
and supports custom and preset quizzes with study/exam modes.

## Key Technologies

- **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS
- **Backend**: Convex (real-time database and functions)
- **Authentication**: Clerk
- **Payments**: MercadoPago
- **Analytics**: PostHog
- **Error Tracking**: Sentry
- **UI Components**: Radix UI with shadcn/ui
- **Rich Text**: TipTap editor
- **Testing**: Vitest (unit), Playwright (e2e)

## Development Commands

```bash
# Development
npm run dev                    # Start dev server with turbopack
npm run seed                   # Initialize Convex database

# Building & Deployment
npm run build                  # Build for production
npm run start                  # Start production server

# Code Quality
npm run lint                   # Run ESLint
npm run lint:fix              # Fix ESLint issues
npm run type-check             # Run TypeScript compiler check
npm run format                 # Format with Prettier
npm run format:check           # Check Prettier formatting

# Testing
npm run test                   # Run unit tests (Vitest)
npm run test:convex           # Run Convex-specific tests
npm run test:e2e              # Run Playwright e2e tests
npm run test:e2e:ui           # Run Playwright with UI
npm run test:once             # Run tests once (no watch)
npm run test:debug            # Debug tests
npm run coverage              # Run tests with coverage
```

## Project Architecture

### Database Schema (Convex)

- **users**: User profiles with Clerk integration and payment status
- **themes/subthemes/groups**: Hierarchical taxonomy for question organization
- **questions**: Question bank with TipTap rich content and taxonomy
  classification
- **presetQuizzes**: Admin-created quizzes (trilha/simulado categories)
- **customQuizzes**: User-created personalized quizzes
- **quizSessions**: Active quiz sessions with progress tracking
- **userBookmarks**: User bookmarked questions
- **userQuestionStats**: User performance tracking per question

### Key Directories

- `src/app/`: Next.js app router pages and layouts
- `src/components/`: Reusable React components
- `convex/`: Backend functions and database schema
- `src/lib/`: Utility functions and configurations
- `src/hooks/`: Custom React hooks

### Authentication & Authorization

- Uses Clerk for authentication with email/password
- User session management with single active session restriction
- Payment status tracked in users table (MercadoPago integration)

### Quiz System Architecture

- **Study Mode**: Immediate feedback after each question
- **Exam Mode**: Feedback only after quiz completion
- **Question Modes**: All, unanswered, incorrect, bookmarked questions
- Hierarchical filtering by themes → subthemes → groups

## Convex Guidelines

Follow the established Convex patterns in this codebase:

- Always use new function syntax with validators
- Use `query`, `mutation`, `action` for public functions
- Use `internalQuery`, `internalMutation`, `internalAction` for private
  functions
- Include both `args` and `returns` validators for all functions
- Prefer `withIndex` over `.filter()` for database queries
- Use helper functions in `/model` directories for shared logic
- **Workflows**: Use for long-running, multi-step processes that survive server
  restarts and can run for extended periods. Steps must be deterministic, with
  max 1 MiB data per execution. Implement logic by calling other Convex
  functions with custom retry behaviors as needed.
- **Aggregates**: Use for efficient O(log(n)) calculations of counts, sums, and
  aggregations across data instead of scanning entire datasets. Keep aggregates
  in sync with source data and use namespaces for partitioned data performance.

## Testing Strategy

- **Unit Tests**: Focus on utility functions and components
- **Convex Tests**: Test database functions with convex-test
- **E2E Tests**: Critical user flows with Playwright
- Test files use `.test.ts/.test.tsx` extension

## Content Management

- Questions support rich text with TipTap editor
- Content migrated from legacy object format to string format
- Image uploads handled via ImageKit CDN
- Questions organized by hierarchical taxonomy (themes/subthemes/groups)

## Payment Integration

- MercadoPago for payment processing
- Payment webhooks handled in API routes
- User access controlled by `paid` status in database

## Aggregate System Architecture

The application uses a comprehensive aggregate system for O(log n) performance
across all counting operations:

### File Organization

- `aggregateRepairs.ts` - Repair functions for inconsistent aggregates
  (production-safe with pagination)
- `aggregateWorkflows.ts` - Workflow orchestration for large-scale aggregate
  repairs
- `aggregateMonitoring.ts` - Debug queries and health checks for aggregate
  validation
- `aggregateQueries.ts` - CRUD operations and aggregate-based counting queries

### Aggregate Types

1. **Global Question Counts**: `totalQuestionCount`, question counts by
   theme/subtheme/group
2. **Random Question Selection**: Efficient random sampling using aggregates
3. **User-Specific Stats**: Per-user answered/incorrect/bookmarked counts with
   hierarchical breakdowns

### Production Features

- **15-second safe operations** with proper pagination (100-item batches)
- **Memory-efficient processing** using cursor-based pagination
- **Comprehensive workflow system** for multi-step repairs surviving server
  restarts
- **Health monitoring** with aggregate vs database validation queries

### Repair System

- Individual repairs: `repairUserAllAggregates(userId)`
- Section-based repairs: `startSection1Repair()`, `startSection2Repair()`,
  `startSection3Repair()`
- Comprehensive repair: `startComprehensiveRepair()` - full system repair with
  progress tracking

### Question Selection Use Case

The application presents users with 4 question selection modes:

1. **All Mode** (Global):
   - Displays total question count across entire database
   - Shows individual theme, subtheme, and group question counts
   - Uses hierarchical taxonomy filtering: selecting theme1 + subtheme from
     theme2 counts all theme1 questions plus all theme2/subtheme questions

2. **User-Specific Modes** (Unanswered, Incorrect, Bookmarked):
   - Displays user-specific total counts for each category
   - Shows user-specific theme, subtheme, and group counts for that category
   - Uses hierarchical user aggregates (`incorrectByThemeByUser`,
     `bookmarkedByGroupByUser`, etc.)
   - Maintains smart hierarchical filtering with user-specific data

**Performance Benefits:**

- All modes use O(log n) aggregate lookups instead of O(n) table scans
- Hierarchical selections are optimized with dedicated user-specific aggregates
- Smart caching prevents double-counting in overlapping taxonomy selections

## Key Development Notes

- Use TypeScript strictly throughout the codebase
- Follow established naming conventions for database indexes
- Maintain consistent error handling patterns
- Implement proper access control for all public functions
- Use aggregate functions for performance-sensitive operations
- Always validate user permissions before data operations

## Convex Limitations and Restrictions

### Runtime Limitations

- **15-second timeout**: All Convex mutations and actions have a strict
  15-second execution limit. Functions that exceed this limit will throw
  `worker:runMutationWrapper: Your request timed out (15 seconds)` errors.
- **Memory constraints**: Functions are limited to 1 MiB of data per execution,
  including all variables, function calls, and return values.

### Query and Pagination Restrictions

- **Single paginated query per function**: Convex only supports one paginated
  query (`.paginate()`) per function. Attempting to run multiple paginated
  queries within the same function will throw
  `This query or mutation function ran multiple paginated queries. Convex only supports a single paginated query in each function.`
- **No `.collect()` on large datasets**: Using `.collect()` on large datasets
  can cause memory overruns and timeouts. Always use `.paginate()` for
  processing large datasets.
- **Cursor-based pagination**: When using `.paginate()`, always handle the
  `continueCursor` and `isDone` properties properly to implement proper
  pagination loops.

### Workflow and Batch Processing Patterns

- **Workflow orchestration**: For long-running operations that exceed 15
  seconds, use Convex workflows (`workflow.define`) to orchestrate multi-step
  processes that can survive server restarts.
- **Batch processing**: Break large operations into smaller batches using
  pagination. Each batch should process a manageable amount of data (typically
  50-100 items) to stay within the 15-second limit.
- **State management**: Use cursors and batch counters to track progress across
  multiple function calls.

### Performance Optimization Strategies

- **Batch fetching**: Instead of individual `ctx.db.get()` calls in loops,
  collect all IDs first and perform batch fetches to reduce database round trips
  from O(N) to O(1).
- **Aggregate usage**: Use pre-calculated aggregates for O(log n) performance
  instead of scanning entire datasets.
- **Index utilization**: Always use `.withIndex()` instead of `.filter()` for
  efficient database queries.

### Error Handling Patterns

- **Timeout prevention**: Implement safety checks to prevent infinite loops and
  ensure functions complete within the 15-second limit.
- **Graceful degradation**: When processing large datasets, implement partial
  completion with resume capabilities using cursors.
- **Progress tracking**: Log progress information to help debug and monitor
  long-running operations.

### Common Anti-Patterns to Avoid

- **Multiple paginated queries**: Never attempt to run more than one
  `.paginate()` call within a single function.
- **Large `.collect()` calls**: Avoid collecting large datasets that could cause
  memory issues.
- **Nested loops with database calls**: Minimize database calls within loops by
  batching operations.
- **Unbounded operations**: Always implement limits and safety checks to prevent
  timeouts.
