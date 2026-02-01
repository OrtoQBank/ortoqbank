import {
  customCtx,
  customMutation,
} from 'convex-helpers/server/customFunctions';
import { Triggers } from 'convex-helpers/server/triggers';

import { DataModel } from './_generated/dataModel';
import {
  internalMutation as rawInternalMutation,
  mutation as rawMutation,
} from './_generated/server';
import * as aggregates from './aggregates';

// Create a triggers instance to handle updates to aggregates
export const triggers = new Triggers<DataModel>();

// Register only the global aggregates (user-specific aggregates removed)
// User-specific counts are now handled by the userStatsCounts table for better performance

// Questions aggregates
triggers.register('questions', aggregates.totalQuestionCount.trigger());
triggers.register('questions', aggregates.questionCountByTheme.trigger());
triggers.register('questions', aggregates.questionCountBySubtheme.trigger());
triggers.register('questions', aggregates.questionCountByGroup.trigger());

// Register random selection aggregates
triggers.register('questions', aggregates.randomQuestions.trigger());
triggers.register('questions', aggregates.randomQuestionsByTheme.trigger());
triggers.register('questions', aggregates.randomQuestionsBySubtheme.trigger());
triggers.register('questions', aggregates.randomQuestionsByGroup.trigger());

// Export custom mutation and query that wrap the triggers
export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(
  rawInternalMutation,
  customCtx(triggers.wrapDB),
);
// queries don't need trigger wrapping

// Only global question aggregates remain - user-specific aggregates replaced by userStatsCounts table
// For aggregate repair/backfill, use the paginated functions in aggregateRepairs.ts

export { query } from './_generated/server';
