import { TableAggregate } from '@convex-dev/aggregate';
import {
  customCtx,
  customMutation,
} from 'convex-helpers/server/customFunctions';
import { Triggers } from 'convex-helpers/server/triggers';

import { DataModel, Doc } from './_generated/dataModel';
import {
  internalMutation as rawInternalMutation,
  mutation as rawMutation,
  MutationCtx,
} from './_generated/server';
import * as aggregates from './aggregates';

export const triggers = new Triggers<DataModel>();

type QuestionDoc = Doc<'questions'>;

/**
 * Fields that affect aggregate namespaces.
 * If these don't change on an update, we skip the aggregate operation entirely.
 */
type NamespaceFields = 'tenantId' | 'themeId' | 'subthemeId' | 'groupId';

/**
 * Check if any namespace-affecting fields changed between old and new document.
 */
function namespaceFieldsChanged(
  oldDoc: QuestionDoc,
  newDoc: QuestionDoc,
  fields: NamespaceFields[],
): boolean {
  return fields.some(field => oldDoc[field] !== newDoc[field]);
}

/**
 * Creates a defensive trigger wrapper for TableAggregate that:
 * 1. Skips updates entirely if no namespace-affecting fields changed
 * 2. Handles missing entries gracefully (DELETE_MISSING_KEY errors)
 *
 * @param aggregate - The TableAggregate instance
 * @param relevantFields - Fields that affect this aggregate's namespace
 */
function createSmartTrigger<T extends TableAggregate<any>>(
  aggregate: T,
  relevantFields: NamespaceFields[],
) {
  return async (
    ctx: MutationCtx,
    change: { oldDoc: QuestionDoc | null; newDoc: QuestionDoc | null },
  ) => {
    const { oldDoc, newDoc } = change;

    try {
      if (oldDoc === null && newDoc !== null) {
        // INSERT: new document created - always add to aggregate
        await aggregate.insert(ctx, newDoc);
      } else if (oldDoc !== null && newDoc === null) {
        // DELETE: document removed - always try to remove from aggregate
        try {
          await aggregate.delete(ctx, oldDoc);
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            error.message.includes('DELETE_MISSING_KEY')
          ) {
            // Entry didn't exist, that's fine for delete
            console.warn(
              `[Aggregate] Ignoring DELETE_MISSING_KEY for deleted document ${oldDoc._id}`,
            );
          } else {
            throw error;
          }
        }
      } else if (oldDoc !== null && newDoc !== null) {
        // UPDATE: document modified
        // Only touch aggregate if namespace-affecting fields changed
        if (!namespaceFieldsChanged(oldDoc, newDoc, relevantFields)) {
          // No relevant fields changed - skip aggregate update entirely
          return;
        }

        // Namespace changed - need to move document between aggregates
        // Delete from old namespace, insert into new namespace
        try {
          await aggregate.delete(ctx, oldDoc);
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            error.message.includes('DELETE_MISSING_KEY')
          ) {
            // Old entry didn't exist, that's fine - continue to insert
            console.warn(
              `[Aggregate] DELETE_MISSING_KEY on update for ${newDoc._id}, proceeding with insert`,
            );
          } else {
            throw error;
          }
        }
        // Insert into new namespace
        await aggregate.insert(ctx, newDoc);
      }
    } catch (error: unknown) {
      // Log but don't throw for aggregate errors - we don't want to break the mutation
      if (error instanceof Error && error.message.includes('DELETE_MISSING_KEY')) {
        console.warn(`[Aggregate] Unhandled DELETE_MISSING_KEY error:`, error.message);
      } else {
        throw error;
      }
    }
  };
}

// Question count aggregates with smart triggers
// totalQuestionCount: namespace is tenantId only
triggers.register(
  'questions',
  createSmartTrigger(aggregates.totalQuestionCount, ['tenantId']),
);

// questionCountByTheme: namespace is tenantId:themeId
triggers.register(
  'questions',
  createSmartTrigger(aggregates.questionCountByTheme, ['tenantId', 'themeId']),
);

// questionCountBySubtheme: namespace is tenantId:subthemeId
triggers.register(
  'questions',
  createSmartTrigger(aggregates.questionCountBySubtheme, ['tenantId', 'subthemeId']),
);

// questionCountByGroup: namespace is tenantId:groupId
triggers.register(
  'questions',
  createSmartTrigger(aggregates.questionCountByGroup, ['tenantId', 'groupId']),
);

// Random selection aggregates with smart triggers
triggers.register(
  'questions',
  createSmartTrigger(aggregates.randomQuestions, ['tenantId']),
);

triggers.register(
  'questions',
  createSmartTrigger(aggregates.randomQuestionsByTheme, ['tenantId', 'themeId']),
);

triggers.register(
  'questions',
  createSmartTrigger(aggregates.randomQuestionsBySubtheme, ['tenantId', 'subthemeId']),
);

triggers.register(
  'questions',
  createSmartTrigger(aggregates.randomQuestionsByGroup, ['tenantId', 'groupId']),
);

// Export custom mutation and query that wrap the triggers
export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(
  rawInternalMutation,
  customCtx(triggers.wrapDB),
);
export { query } from './_generated/server';
