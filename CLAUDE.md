# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OrtoQBank is a question bank web application for orthopedic students and professionals. It's built with Next.js 15, Convex backend, Clerk authentication, and supports custom and preset quizzes with study/exam modes.

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
- **questions**: Question bank with TipTap rich content and taxonomy classification
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
- Use `internalQuery`, `internalMutation`, `internalAction` for private functions
- Include both `args` and `returns` validators for all functions
- Prefer `withIndex` over `.filter()` for database queries
- Use helper functions in `/model` directories for shared logic
- **Workflows**: Use for long-running, multi-step processes that survive server restarts and can run for extended periods. Steps must be deterministic, with max 1 MiB data per execution. Implement logic by calling other Convex functions with custom retry behaviors as needed.
- **Aggregates**: Use for efficient O(log(n)) calculations of counts, sums, and aggregations across data instead of scanning entire datasets. Keep aggregates in sync with source data and use namespaces for partitioned data performance.

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

## Key Development Notes

- Use TypeScript strictly throughout the codebase
- Follow established naming conventions for database indexes
- Maintain consistent error handling patterns
- Implement proper access control for all public functions
- Use aggregate functions for performance-sensitive operations
- Always validate user permissions before data operations