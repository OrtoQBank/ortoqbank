import { ActionRetrier } from '@convex-dev/action-retrier';

import { components } from './_generated/api';

export const retrier = new ActionRetrier(components.actionRetrier, {
  initialBackoffMs: 1000, // Wait 1 second before first retry
  base: 2, // Exponential backoff multiplier
  maxFailures: 3, // Try up to 3 times (initial + 2 retries)
});
