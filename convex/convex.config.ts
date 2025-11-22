import actionRetrier from '@convex-dev/action-retrier/convex.config';
import aggregate from '@convex-dev/aggregate/convex.config';
import migrations from '@convex-dev/migrations/convex.config';
import rateLimiter from '@convex-dev/rate-limiter/convex.config';
import workflow from '@convex-dev/workflow/convex.config';
import { defineApp } from 'convex/server';

const app = defineApp();

app.use(rateLimiter);
app.use(migrations);
app.use(workflow);
app.use(actionRetrier);

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
// SECTION 3: USER-SPECIFIC COUNT AGGREGATES - REMOVED
// Replaced by userStatsCounts table for better performance
// =============================================================================

// All user-specific aggregates have been replaced by the userStatsCounts table
// This provides much better performance (1-2 DB calls vs 1000+ aggregate calls)

export default app;
