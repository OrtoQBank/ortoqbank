import {
  customCtx,
  customMutation,
} from 'convex-helpers/server/customFunctions';
import { Triggers } from 'convex-helpers/server/triggers';

import { DataModel } from './_generated/dataModel';
import {
  mutation as rawMutation,
  query as rawQuery,
} from './_generated/server';
import * as aggregates from './aggregates';

// Create a triggers instance to handle updates to aggregates
export const triggers = new Triggers<DataModel>();

// Register all our aggregates with the triggers
// User question stats aggregates
triggers.register('userQuestionStats', aggregates.answeredByUser.trigger());
triggers.register('userQuestionStats', aggregates.incorrectByUser.trigger());
triggers.register(
  'userQuestionStats',
  aggregates.answeredByThemeByUser.trigger(),
);
triggers.register(
  'userQuestionStats',
  aggregates.answeredBySubthemeByUser.trigger(),
);
triggers.register(
  'userQuestionStats',
  aggregates.answeredByGroupByUser.trigger(),
);
triggers.register(
  'userQuestionStats',
  aggregates.incorrectByThemeByUser.trigger(),
);
triggers.register(
  'userQuestionStats',
  aggregates.incorrectBySubthemeByUser.trigger(),
);
triggers.register(
  'userQuestionStats',
  aggregates.incorrectByGroupByUser.trigger(),
);

// User bookmarks aggregates
triggers.register('userBookmarks', aggregates.bookmarkedByUser.trigger());
triggers.register(
  'userBookmarks',
  aggregates.bookmarkedByThemeByUser.trigger(),
);
triggers.register(
  'userBookmarks',
  aggregates.bookmarkedBySubthemeByUser.trigger(),
);
triggers.register(
  'userBookmarks',
  aggregates.bookmarkedByGroupByUser.trigger(),
);

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
export const query = rawQuery; // queries don't need trigger wrapping

// For comprehensive aggregate repair and testing, use aggregateWorkflows.ts functions
