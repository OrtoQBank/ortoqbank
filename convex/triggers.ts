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

export const triggers = new Triggers<DataModel>();

// Question count aggregates (using idempotentTrigger for self-healing behavior)
triggers.register(
  'questions',
  aggregates.totalQuestionCount.idempotentTrigger(),
);
triggers.register(
  'questions',
  aggregates.questionCountByTheme.idempotentTrigger(),
);
triggers.register(
  'questions',
  aggregates.questionCountBySubtheme.idempotentTrigger(),
);
triggers.register(
  'questions',
  aggregates.questionCountByGroup.idempotentTrigger(),
);

// Register random selection aggregates (using idempotentTrigger for self-healing behavior)
triggers.register('questions', aggregates.randomQuestions.idempotentTrigger());
triggers.register(
  'questions',
  aggregates.randomQuestionsByTheme.idempotentTrigger(),
);
triggers.register(
  'questions',
  aggregates.randomQuestionsBySubtheme.idempotentTrigger(),
);
triggers.register(
  'questions',
  aggregates.randomQuestionsByGroup.idempotentTrigger(),
);

// Export custom mutation and query that wrap the triggers
export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(
  rawInternalMutation,
  customCtx(triggers.wrapDB),
);
export { query } from './_generated/server';
