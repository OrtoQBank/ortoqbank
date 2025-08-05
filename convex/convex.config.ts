import aggregate from '@convex-dev/aggregate/convex.config';
import migrations from '@convex-dev/migrations/convex.config';
import rateLimiter from '@convex-dev/rate-limiter/convex.config';
import workflow from '@convex-dev/workflow/convex.config';
import { defineApp } from 'convex/server';

const app = defineApp();

app.use(rateLimiter);
app.use(migrations);
app.use(workflow);

// =============================================================================
// SECTION 1: GLOBAL QUESTION COUNT AGGREGATES
// Used for question mode 'all' (non-user-specific)
// These count total available questions by category
// =============================================================================
app.use(aggregate, { name: 'questionCountTotal' });
app.use(aggregate, { name: 'questionCountByTheme' });
app.use(aggregate, { name: 'questionCountBySubtheme' });
app.use(aggregate, { name: 'questionCountByGroup' });

// =============================================================================
// SECTION 2: RANDOM QUESTION SELECTION AGGREGATES
// Used for question mode 'all' (non-user-specific)
// These return actual question documents for quiz generation
// =============================================================================
app.use(aggregate, { name: 'randomQuestions' });
app.use(aggregate, { name: 'randomQuestionsByTheme' });
app.use(aggregate, { name: 'randomQuestionsBySubtheme' });
app.use(aggregate, { name: 'randomQuestionsByGroup' });

// =============================================================================
// SECTION 3: USER-SPECIFIC COUNT AGGREGATES
// Used for question modes: unanswered, incorrect, bookmarked
// =============================================================================

// Basic user-specific counts (across all categories)
app.use(aggregate, { name: 'answeredByUser' });
app.use(aggregate, { name: 'incorrectByUser' });
app.use(aggregate, { name: 'bookmarkedByUser' });

// Hierarchical user-specific counts (user + category breakdown)
app.use(aggregate, { name: 'answeredByThemeByUser' });
app.use(aggregate, { name: 'answeredBySubthemeByUser' });
app.use(aggregate, { name: 'answeredByGroupByUser' });

app.use(aggregate, { name: 'incorrectByThemeByUser' });
app.use(aggregate, { name: 'incorrectBySubthemeByUser' });
app.use(aggregate, { name: 'incorrectByGroupByUser' });

app.use(aggregate, { name: 'bookmarkedByThemeByUser' });
app.use(aggregate, { name: 'bookmarkedBySubthemeByUser' });
app.use(aggregate, { name: 'bookmarkedByGroupByUser' });

export default app;
