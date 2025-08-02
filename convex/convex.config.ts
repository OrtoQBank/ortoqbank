import aggregate from '@convex-dev/aggregate/convex.config';
import migrations from '@convex-dev/migrations/convex.config';
import rateLimiter from '@convex-dev/rate-limiter/convex.config';
import workflow from '@convex-dev/workflow/convex.config';
import { defineApp } from 'convex/server';

const app = defineApp();

app.use(rateLimiter);
app.use(migrations);
app.use(workflow);

//aggregates
app.use(aggregate, { name: 'questionCountTotal' });
app.use(aggregate, { name: 'questionCountByTheme' });
app.use(aggregate, { name: 'questionCountBySubtheme' });
app.use(aggregate, { name: 'questionCountByGroup' });
app.use(aggregate, { name: 'answeredByUser' });
app.use(aggregate, { name: 'incorrectByUser' });
app.use(aggregate, { name: 'bookmarkedByUser' });

// Random selection aggregates
app.use(aggregate, { name: 'randomQuestions' });
app.use(aggregate, { name: 'randomQuestionsByTheme' });
app.use(aggregate, { name: 'randomQuestionsBySubtheme' });
app.use(aggregate, { name: 'randomQuestionsByGroup' });

// Hierarchical user-specific aggregates for count
app.use(aggregate, { name: 'incorrectByThemeByUser' });
app.use(aggregate, { name: 'incorrectBySubthemeByUser' });
app.use(aggregate, { name: 'incorrectByGroupByUser' });
app.use(aggregate, { name: 'bookmarkedByThemeByUser' });
app.use(aggregate, { name: 'bookmarkedBySubthemeByUser' });
app.use(aggregate, { name: 'bookmarkedByGroupByUser' });
app.use(aggregate, { name: 'answeredByThemeByUser' });
app.use(aggregate, { name: 'answeredBySubthemeByUser' });
app.use(aggregate, { name: 'answeredByGroupByUser' });

export default app;
