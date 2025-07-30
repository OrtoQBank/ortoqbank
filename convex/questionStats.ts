import { mutation, query } from './_generated/server';

/**
 * This function can be called when a question is inserted to update statistics.
 * Currently a no-op as we're using the triggers system instead.
 */
export async function _updateQuestionStatsOnInsert(ctx: any, questionDoc: any) {
  // Not needed - using triggers
  return;
}

/**
 * This function can be called when a question is deleted to update statistics.
 * Currently a no-op as we're using the triggers system instead.
 */
export async function _updateQuestionStatsOnDelete(ctx: any, questionDoc: any) {
  // Not needed - using triggers
  return;
}

/**
 * Utility function to recalculate question statistics.
 */
export const recalculateQuestionStats = mutation({
  args: {},
  handler: async ctx => {
    // Not needed to implement here - using triggers.initializeAggregates instead
    return { success: true };
  },
});
