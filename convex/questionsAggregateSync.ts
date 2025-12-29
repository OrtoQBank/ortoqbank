import { GenericMutationCtx } from 'convex/server';

import { DataModel, Doc, Id } from './_generated/dataModel';
import {
  questionCountByGroup,
  questionCountBySubtheme,
  questionCountByTheme,
  // Add Section 2 aggregates for random question selection
  randomQuestions,
  randomQuestionsByGroup,
  randomQuestionsBySubtheme,
  randomQuestionsByTheme,
  totalQuestionCount,
} from './aggregates';
// Question stats are now handled by aggregates and triggers

// Type for question content that goes into separate table
type QuestionContentData = {
  questionTextString: string;
  explanationTextString: string;
  alternatives: string[];
  // Legacy fields (optional, for migration compatibility)
  questionText?: any;
  explanationText?: any;
};

// ---------- Helper Functions for Question CRUD + Aggregate Sync ----------

// Use GenericMutationCtx with DataModel
export async function _internalInsertQuestion(
  ctx: GenericMutationCtx<DataModel>,
  data: Omit<Doc<'questions'>, '_id' | '_creationTime'>,
  contentData?: QuestionContentData,
) {
  const questionId = await ctx.db.insert('questions', data);
  const questionDoc = (await ctx.db.get(questionId))!;

  // If content data is provided, insert into questionContent table
  if (contentData) {
    await ctx.db.insert('questionContent', {
      questionId,
      questionTextString: contentData.questionTextString,
      explanationTextString: contentData.explanationTextString,
      alternatives: contentData.alternatives,
      questionText: contentData.questionText,
      explanationText: contentData.explanationText,
    });
    console.log(`Created questionContent for question ${questionId}`);
  }

  console.log(`Attempting to insert question ${questionId} into aggregates...`);

  // Try to update aggregates, but don't fail the question creation if there are aggregate issues
  let aggregateErrors: string[] = [];

  // 1. Theme count aggregate
  try {
    await questionCountByTheme.insert(ctx, questionDoc);
    console.log(
      `Successfully inserted question ${questionId} into theme aggregate`,
    );
  } catch (error: any) {
    console.warn(
      `Error inserting question ${questionId} into theme aggregate:`,
      error,
    );
    aggregateErrors.push(`theme aggregate: ${error.message}`);
  }

  // 2. Subtheme count aggregate (only if question has subthemeId)
  if (questionDoc.subthemeId) {
    try {
      await questionCountBySubtheme.insert(ctx, questionDoc);
      console.log(
        `Successfully inserted question ${questionId} into subtheme aggregate`,
      );
    } catch (error: any) {
      console.warn(
        `Error inserting question ${questionId} into subtheme aggregate:`,
        error,
      );
      aggregateErrors.push(`subtheme aggregate: ${error.message}`);
    }
  }

  // 3. Group count aggregate (only if question has groupId)
  if (questionDoc.groupId) {
    try {
      await questionCountByGroup.insert(ctx, questionDoc);
      console.log(
        `Successfully inserted question ${questionId} into group aggregate`,
      );
    } catch (error: any) {
      console.warn(
        `Error inserting question ${questionId} into group aggregate:`,
        error,
      );
      aggregateErrors.push(`group aggregate: ${error.message}`);
    }
  }

  // 4. Total count aggregate
  try {
    await totalQuestionCount.insert(ctx, questionDoc);
    console.log(
      `Successfully inserted question ${questionId} into total count aggregate`,
    );
  } catch (error: any) {
    console.warn(
      `Error inserting question ${questionId} into total count aggregate:`,
      error,
    );
    aggregateErrors.push(`total count aggregate: ${error.message}`);
  }

  // ============================================================================
  // SECTION 2: RANDOM QUESTION SELECTION AGGREGATES
  // ============================================================================

  try {
    console.log(
      `Starting Section 2 aggregate updates for question ${questionId}...`,
    );

    // 5. Global random questions aggregate
    try {
      console.log(`Attempting to insert into global random aggregate...`);
      await randomQuestions.insert(ctx, questionDoc);
      console.log(
        `Successfully inserted question ${questionId} into global random aggregate`,
      );
    } catch (error: any) {
      console.error(
        `Error inserting question ${questionId} into global random aggregate:`,
        error,
      );
      aggregateErrors.push(`global random aggregate: ${error.message}`);
    }

    // 6. Theme random questions aggregate
    try {
      console.log(`Attempting to insert into theme random aggregate...`);
      await randomQuestionsByTheme.insert(ctx, questionDoc);
      console.log(
        `Successfully inserted question ${questionId} into theme random aggregate`,
      );
    } catch (error: any) {
      console.error(
        `Error inserting question ${questionId} into theme random aggregate:`,
        error,
      );
      aggregateErrors.push(`theme random aggregate: ${error.message}`);
    }

    // 7. Subtheme random questions aggregate (only if question has subthemeId)
    if (questionDoc.subthemeId) {
      try {
        console.log(`Attempting to insert into subtheme random aggregate...`);
        await randomQuestionsBySubtheme.insert(ctx, questionDoc);
        console.log(
          `Successfully inserted question ${questionId} into subtheme random aggregate`,
        );
      } catch (error: any) {
        console.error(
          `Error inserting question ${questionId} into subtheme random aggregate:`,
          error,
        );
        aggregateErrors.push(`subtheme random aggregate: ${error.message}`);
      }
    } else {
      console.log(
        `Question ${questionId} has no subthemeId, skipping subtheme random aggregate`,
      );
    }

    // 8. Group random questions aggregate (only if question has groupId)
    if (questionDoc.groupId) {
      try {
        console.log(`Attempting to insert into group random aggregate...`);
        await randomQuestionsByGroup.insert(ctx, questionDoc);
        console.log(
          `Successfully inserted question ${questionId} into group random aggregate`,
        );
      } catch (error: any) {
        console.error(
          `Error inserting question ${questionId} into group random aggregate:`,
          error,
        );
        aggregateErrors.push(`group random aggregate: ${error.message}`);
      }
    } else {
      console.log(
        `Question ${questionId} has no groupId, skipping group random aggregate`,
      );
    }
  } catch (error: any) {
    console.error(
      `FATAL ERROR in Section 2 aggregates for question ${questionId}:`,
      error,
    );
    aggregateErrors.push(`Section 2 FATAL ERROR: ${error.message}`);
  }

  // Question stats are now handled automatically by aggregate triggers

  // Log summary of aggregate operations
  const totalAggregates = 8; // 4 Section 1 + 4 Section 2
  const successfulAggregates = totalAggregates - aggregateErrors.length;

  console.log(`Aggregate update summary for question ${questionId}:`);
  console.log(`- Section 1 (Count aggregates): 4 total`);
  console.log(`- Section 2 (Random selection): 4 total`);
  console.log(
    `- Successfully updated: ${successfulAggregates}/${totalAggregates}`,
  );

  if (aggregateErrors.length > 0) {
    console.warn(
      `Question ${questionId} created successfully but with aggregate issues:`,
      aggregateErrors,
    );
  } else {
    console.log(
      `Question ${questionId} created successfully with all aggregates updated`,
    );
  }

  return questionId;
}

export async function _internalUpdateQuestion(
  ctx: GenericMutationCtx<DataModel>,
  id: Id<'questions'>,
  updates: Partial<Doc<'questions'>>,
) {
  const oldQuestionDoc = await ctx.db.get(id);
  if (!oldQuestionDoc) {
    throw new Error(`Question not found for update: ${id}`);
  }
  await ctx.db.patch(id, updates);
  const newQuestionDoc = (await ctx.db.get(id))!;

  // Check if any taxonomy fields changed
  const taxonomyChanged =
    (updates.themeId && updates.themeId !== oldQuestionDoc.themeId) ||
    (updates.subthemeId !== undefined &&
      updates.subthemeId !== oldQuestionDoc.subthemeId) ||
    (updates.groupId !== undefined &&
      updates.groupId !== oldQuestionDoc.groupId);

  if (taxonomyChanged) {
    console.log(`Question ${id} taxonomy changed, updating aggregates...`);

    // Update theme aggregate if themeId changed
    if (updates.themeId && updates.themeId !== oldQuestionDoc.themeId) {
      try {
        await questionCountByTheme.replace(ctx, oldQuestionDoc, newQuestionDoc);
      } catch (error: any) {
        if (error.code === 'DELETE_MISSING_KEY') {
          console.warn(
            `Question ${id} not found in theme aggregate, inserting instead`,
          );
          await questionCountByTheme.insert(ctx, newQuestionDoc);
        } else {
          throw error;
        }
      }
    }

    // Update subtheme aggregate if subthemeId changed
    if (
      updates.subthemeId !== undefined &&
      updates.subthemeId !== oldQuestionDoc.subthemeId
    ) {
      // Remove from old subtheme aggregate if it had one
      if (oldQuestionDoc.subthemeId) {
        try {
          await questionCountBySubtheme.delete(ctx, oldQuestionDoc);
        } catch (error: any) {
          console.warn(
            `Error removing question ${id} from old subtheme aggregate:`,
            error,
          );
        }
      }

      // Add to new subtheme aggregate if it has one
      if (newQuestionDoc.subthemeId) {
        try {
          await questionCountBySubtheme.insert(ctx, newQuestionDoc);
        } catch (error: any) {
          console.warn(
            `Error inserting question ${id} into new subtheme aggregate:`,
            error,
          );
        }
      }
    }

    // Update group aggregate if groupId changed
    if (
      updates.groupId !== undefined &&
      updates.groupId !== oldQuestionDoc.groupId
    ) {
      // Remove from old group aggregate if it had one
      if (oldQuestionDoc.groupId) {
        try {
          await questionCountByGroup.delete(ctx, oldQuestionDoc);
        } catch (error: any) {
          console.warn(
            `Error removing question ${id} from old group aggregate:`,
            error,
          );
        }
      }

      // Add to new group aggregate if it has one
      if (newQuestionDoc.groupId) {
        try {
          await questionCountByGroup.insert(ctx, newQuestionDoc);
        } catch (error: any) {
          console.warn(
            `Error inserting question ${id} into new group aggregate:`,
            error,
          );
        }
      }
    }

    // totalQuestionCount doesn't change when moving between themes, so no update needed
  }

  // ============================================================================
  // SECTION 2: RANDOM QUESTION SELECTION AGGREGATES UPDATE
  // ============================================================================

  // Update Section 2 aggregates if taxonomy changed
  if (taxonomyChanged) {
    console.log(
      `Question ${id} taxonomy changed, updating Section 2 aggregates...`,
    );

    // Update theme random aggregate if themeId changed
    if (updates.themeId && updates.themeId !== oldQuestionDoc.themeId) {
      try {
        await randomQuestionsByTheme.replace(
          ctx,
          oldQuestionDoc,
          newQuestionDoc,
        );
      } catch (error: any) {
        if (error.code === 'DELETE_MISSING_KEY') {
          console.warn(
            `Question ${id} not found in theme random aggregate, inserting instead`,
          );
          await randomQuestionsByTheme.insert(ctx, newQuestionDoc);
        } else {
          throw error;
        }
      }
    }

    // Update subtheme random aggregate if subthemeId changed
    if (
      updates.subthemeId !== undefined &&
      updates.subthemeId !== oldQuestionDoc.subthemeId
    ) {
      // Remove from old subtheme random aggregate if it had one
      if (oldQuestionDoc.subthemeId) {
        try {
          await randomQuestionsBySubtheme.delete(ctx, oldQuestionDoc);
        } catch (error: any) {
          console.warn(
            `Error removing question ${id} from old subtheme random aggregate:`,
            error,
          );
        }
      }

      // Add to new subtheme random aggregate if it has one
      if (newQuestionDoc.subthemeId) {
        try {
          await randomQuestionsBySubtheme.insert(ctx, newQuestionDoc);
        } catch (error: any) {
          console.warn(
            `Error inserting question ${id} into new subtheme random aggregate:`,
            error,
          );
        }
      }
    }

    // Update group random aggregate if groupId changed
    if (
      updates.groupId !== undefined &&
      updates.groupId !== oldQuestionDoc.groupId
    ) {
      // Remove from old group random aggregate if it had one
      if (oldQuestionDoc.groupId) {
        try {
          await randomQuestionsByGroup.delete(ctx, oldQuestionDoc);
        } catch (error: any) {
          console.warn(
            `Error removing question ${id} from old group random aggregate:`,
            error,
          );
        }
      }

      // Add to new group random aggregate if it has one
      if (newQuestionDoc.groupId) {
        try {
          await randomQuestionsByGroup.insert(ctx, newQuestionDoc);
        } catch (error: any) {
          console.warn(
            `Error inserting question ${id} into new group random aggregate:`,
            error,
          );
        }
      }
    }

    // Global random aggregate doesn't change when moving between themes, so no update needed
  }

  // Note: Add update logic for _updateQuestionStats if needed here as well
}

export async function _internalDeleteQuestion(
  ctx: GenericMutationCtx<DataModel>,
  id: Id<'questions'>,
) {
  const questionDoc = await ctx.db.get(id);
  if (!questionDoc) {
    console.warn(`Question not found for deletion: ${id}`);
    return false; // Indicate deletion didn't happen
  }
  await ctx.db.delete(id);

  // Handle ALL aggregate operations with comprehensive error recovery
  // If any operation fails with DELETE_MISSING_KEY, just skip it and continue

  console.log(`Attempting to delete question ${id} from aggregates...`);

  // 1. Theme count aggregate
  try {
    await questionCountByTheme.delete(ctx, questionDoc);
    console.log(`Successfully deleted question ${id} from theme aggregate`);
  } catch (error: any) {
    console.warn(`Error deleting question ${id} from theme aggregate:`, error);
    if (error.code !== 'DELETE_MISSING_KEY') {
      console.error(`Unexpected error type:`, error);
    }
    // Continue regardless of error type for now
  }

  // 2. Subtheme count aggregate (only if question had subthemeId)
  if (questionDoc.subthemeId) {
    try {
      await questionCountBySubtheme.delete(ctx, questionDoc);
      console.log(
        `Successfully deleted question ${id} from subtheme aggregate`,
      );
    } catch (error: any) {
      console.warn(
        `Error deleting question ${id} from subtheme aggregate:`,
        error,
      );
      if (error.code !== 'DELETE_MISSING_KEY') {
        console.error(`Unexpected error type:`, error);
      }
      // Continue regardless of error type for now
    }
  }

  // 3. Group count aggregate (only if question had groupId)
  if (questionDoc.groupId) {
    try {
      await questionCountByGroup.delete(ctx, questionDoc);
      console.log(`Successfully deleted question ${id} from group aggregate`);
    } catch (error: any) {
      console.warn(
        `Error deleting question ${id} from group aggregate:`,
        error,
      );
      if (error.code !== 'DELETE_MISSING_KEY') {
        console.error(`Unexpected error type:`, error);
      }
      // Continue regardless of error type for now
    }
  }

  // 4. Total count aggregate
  try {
    await totalQuestionCount.delete(ctx, questionDoc);
    console.log(
      `Successfully deleted question ${id} from total count aggregate`,
    );
  } catch (error: any) {
    console.warn(
      `Error deleting question ${id} from total count aggregate:`,
      error,
    );
    if (error.code !== 'DELETE_MISSING_KEY') {
      console.error(`Unexpected error type:`, error);
    }
    // Continue regardless of error type for now
  }

  // ============================================================================
  // SECTION 2: RANDOM QUESTION SELECTION AGGREGATES DELETE
  // ============================================================================

  // 5. Global random questions aggregate
  try {
    await randomQuestions.delete(ctx, questionDoc);
    console.log(
      `Successfully deleted question ${id} from global random aggregate`,
    );
  } catch (error: any) {
    console.warn(
      `Error deleting question ${id} from global random aggregate:`,
      error,
    );
    if (error.code !== 'DELETE_MISSING_KEY') {
      console.error(`Unexpected error type:`, error);
    }
    // Continue regardless of error type for now
  }

  // 6. Theme random questions aggregate
  try {
    await randomQuestionsByTheme.delete(ctx, questionDoc);
    console.log(
      `Successfully deleted question ${id} from theme random aggregate`,
    );
  } catch (error: any) {
    console.warn(
      `Error deleting question ${id} from theme random aggregate:`,
      error,
    );
    if (error.code !== 'DELETE_MISSING_KEY') {
      console.error(`Unexpected error type:`, error);
    }
    // Continue regardless of error type for now
  }

  // 7. Subtheme random questions aggregate (only if question had subthemeId)
  if (questionDoc.subthemeId) {
    try {
      await randomQuestionsBySubtheme.delete(ctx, questionDoc);
      console.log(
        `Successfully deleted question ${id} from subtheme random aggregate`,
      );
    } catch (error: any) {
      console.warn(
        `Error deleting question ${id} from subtheme random aggregate:`,
        error,
      );
      if (error.code !== 'DELETE_MISSING_KEY') {
        console.error(`Unexpected error type:`, error);
      }
      // Continue regardless of error type for now
    }
  }

  // 8. Group random questions aggregate (only if question had groupId)
  if (questionDoc.groupId) {
    try {
      await randomQuestionsByGroup.delete(ctx, questionDoc);
      console.log(
        `Successfully deleted question ${id} from group random aggregate`,
      );
    } catch (error: any) {
      console.warn(
        `Error deleting question ${id} from group random aggregate:`,
        error,
      );
      if (error.code !== 'DELETE_MISSING_KEY') {
        console.error(`Unexpected error type:`, error);
      }
      // Continue regardless of error type for now
    }
  }

  // Question stats are now handled automatically by aggregate triggers

  console.log(`Completed deletion process for question ${id}`);
  return true; // Indicate successful deletion
}

// -----------------------------------------------------------------------
