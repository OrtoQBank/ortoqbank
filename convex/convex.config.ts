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

export default app;
