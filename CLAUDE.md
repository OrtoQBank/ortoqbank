# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OrtoQBank is a question bank web application for students and professionals to practice questions, track progress, and receive instant feedback. Built with Next.js, Convex backend, and Clerk authentication.

## Development Commands

### Essential Commands
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production and generate Sentry sourcemaps
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run type-check` - Run TypeScript compiler check

### Testing Commands
- `npm test` - Run Vitest tests with verbose output
- `npm run test:convex` - Run Convex-specific tests
- `npm run test:e2e` - Run Playwright end-to-end tests
- `npm run test:e2e:ui` - Run Playwright tests with UI
- `npm run test:once` - Run tests once without watch mode
- `npm run test:debug` - Run tests with debugger
- `npm run coverage` - Generate test coverage report

### Database Commands
- `npm run seed` - Initialize Convex database with seed data
- `npm run migrate:content` - Migrate TipTap content to string format

### Code Quality
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 with App Router, React 19, TypeScript
- **Backend**: Convex (serverless database and functions)
- **Authentication**: Clerk
- **Payments**: MercadoPago API
- **UI**: Radix UI components, Tailwind CSS
- **Rich Text**: TipTap editor
- **Analytics**: PostHog, Vercel Analytics
- **Monitoring**: Sentry
- **Testing**: Vitest, Playwright, Testing Library

### Key Directories

#### Frontend Structure
- `src/app/` - Next.js App Router pages and layouts
  - `(dashboard)/` - Protected dashboard pages
  - `api/` - API route handlers
  - `components/` - Landing page components
- `src/components/` - Shared React components
  - `ui/` - Reusable UI components (Radix-based)
  - `quiz/` - Quiz-related components
  - `sidebar/` - Navigation components
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utility libraries and configurations

#### Backend Structure
- `convex/` - Convex backend functions and schema
  - `schema.ts` - Database schema definition
  - Individual files for different domains (questions, users, quiz, etc.)

### Data Model

The application uses a hierarchical question organization:
- **Themes** (top level categories)
- **Subthemes** (subcategories within themes)
- **Groups** (granular groupings within subthemes)

Key entities:
- `users` - User accounts with payment status
- `questions` - Question bank with content and taxonomy
- `presetQuizzes` - Admin-created quizzes (trilhas/simulados)
- `customQuizzes` - User-created custom quizzes
- `quizSessions` - Active quiz attempts with progress
- `userQuestionStats` - User performance tracking
- `questionCounts` - Cached question counts for taxonomy levels

### Quiz Types
- **Study Mode**: Immediate feedback after each question
- **Exam Mode**: No feedback until completion
- **Trilhas**: Study-focused preset quizzes
- **Simulados**: Exam-focused preset quizzes

## Development Guidelines

### Convex Functions
- Follow the function guidelines in `.cursor/rules/convex_rules.mdc`
- Always use argument and return validators
- Use `internal` functions for server-side only operations
- Prefer helper functions over `ctx.runQuery`/`ctx.runMutation` chains

### Component Patterns
- Use Radix UI primitives from `src/components/ui/`
- Follow existing component structure and naming conventions
- Implement proper TypeScript types
- Use React hooks from `src/hooks/` for shared logic

### State Management
- Zustand for client-side state (see admin stores)
- Convex queries/mutations for server state
- React Hook Form for form management

### Content Management
- Questions support rich text via TipTap editor
- Content is stored as both structured JSON and plain text
- Use `StructuredContentRenderer` for displaying rich content

### Authentication & Authorization
- Clerk handles authentication
- Role-based access control for admin features
- Payment status checking for premium features

## Testing

- Unit tests: Vitest with Testing Library
- E2E tests: Playwright for critical user journeys
- Coverage reports available via `npm run coverage`
- Convex functions have separate test configuration

## Payment Integration

- MercadoPago for Brazilian payment processing
- Webhook handling for payment status updates
- User payment status tracked in database

## Content Migration

The codebase includes migration utilities for:
- Converting TipTap JSON content to string format
- Updating legacy taxonomy references
- Use migration scripts in `scripts/` directory