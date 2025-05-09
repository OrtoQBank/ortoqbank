import aggregate from '@convex-dev/aggregate/convex.config';
import rateLimiter from '@convex-dev/rate-limiter/convex.config';
import { defineApp } from 'convex/server';

const app = defineApp();

app.use(aggregate, { name: 'questionStats' });
app.use(rateLimiter);

// New aggregate for counting questions by theme
app.use(aggregate, { name: 'questionCountByThemeAggregate' });

export default app;
