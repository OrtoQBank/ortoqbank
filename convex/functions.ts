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
import {
  questionCountByGroup,
  questionCountBySubtheme,
  questionCountByTheme,
  randomQuestions,
  randomQuestionsByGroup,
  randomQuestionsBySubtheme,
  randomQuestionsByTheme,
  totalQuestionCount,
} from './aggregates';

// =============================================================================
// TRIGGERS CONFIGURATION
// =============================================================================
// Triggers automatically keep aggregates in sync when data changes via
// ctx.db.insert, ctx.db.patch, ctx.db.replace, or ctx.db.delete.
//
// IMPORTANT: Triggers only run through mutations wrapped with customMutation.
// Direct database edits (dashboard, npx convex import) bypass triggers.
// Use aggregateRepairs.ts to fix inconsistencies if needed.
// =============================================================================

const triggers = new Triggers<DataModel>();

// Register all 8 question aggregates for automatic sync
// Section 1: Question Count Aggregates
triggers.register('questions', totalQuestionCount.trigger());
triggers.register('questions', questionCountByTheme.trigger());
triggers.register('questions', questionCountBySubtheme.trigger());
triggers.register('questions', questionCountByGroup.trigger());

// Section 2: Random Question Selection Aggregates
triggers.register('questions', randomQuestions.trigger());
triggers.register('questions', randomQuestionsByTheme.trigger());
triggers.register('questions', randomQuestionsBySubtheme.trigger());
triggers.register('questions', randomQuestionsByGroup.trigger());

// =============================================================================
// WRAPPED MUTATIONS WITH TRIGGERS
// =============================================================================
// Use these instead of raw mutation/internalMutation when modifying the
// 'questions' table to ensure aggregates stay in sync automatically.
// =============================================================================

export const mutationWithTriggers = customMutation(
  rawMutation,
  customCtx(triggers.wrapDB),
);

export const internalMutationWithTriggers = customMutation(
  rawInternalMutation,
  customCtx(triggers.wrapDB),
);
