import { TableAggregate } from '@convex-dev/aggregate';

import { components } from './_generated/api';
import { DataModel, Id } from './_generated/dataModel';

// =============================================================================
// SECTION 1: QUESTION COUNT AGGREGATES (NAMESPACED BY TENANT)
// Used for question mode 'all' (non-user-specific)
// These count total available questions by category, scoped per tenant
// =============================================================================

// Track total question count per tenant
export const totalQuestionCount = new TableAggregate<{
  Namespace: Id<'apps'>;
  Key: string;
  DataModel: DataModel;
  TableName: 'questions';
}>(components.questionCountTotal, {
  namespace: (d: unknown) => (d as { tenantId: Id<'apps'> }).tenantId,
  sortKey: () => 'question',
});

// Track total question count by theme
export const questionCountByTheme = new TableAggregate<{
  Namespace: Id<'themes'>;
  Key: string;
  DataModel: DataModel;
  TableName: 'questions';
}>(components.questionCountByTheme, {
  namespace: (d: unknown) => (d as { themeId: Id<'themes'> }).themeId,
  sortKey: (d: unknown) => 'question',
});

//track total question count by subtheme (only for questions that have subthemeId)
export const questionCountBySubtheme = new TableAggregate<{
  Namespace: string;
  Key: string;
  DataModel: DataModel;
  TableName: 'questions';
}>(components.questionCountBySubtheme, {
  namespace: (d: unknown) => {
    const question = d as { subthemeId?: Id<'subthemes'> };
    // Use "no-subtheme" for questions without subthemeId
    const subthemeId = question.subthemeId || 'no-subtheme';
    return subthemeId;
  },
  sortKey: (d: unknown) => 'question',
});

//track total question count by group (only for questions that have groupId)
export const questionCountByGroup = new TableAggregate<{
  Namespace: string;
  Key: string;
  DataModel: DataModel;
  TableName: 'questions';
}>(components.questionCountByGroup, {
  namespace: (d: unknown) => {
    const question = d as { groupId?: Id<'groups'> };
    // Use "no-group" for questions without groupId
    const groupId = question.groupId || 'no-group';
    return groupId;
  },
  sortKey: (d: unknown) => 'question',
});

// =============================================================================
// SECTION 2: RANDOM QUESTION SELECTION AGGREGATES (NAMESPACED BY TENANT)
// Used for question mode 'all' (non-user-specific)
// These return actual question documents for quiz generation, scoped per tenant
// =============================================================================

// Random question selection aggregates for efficient randomization
export const randomQuestions = new TableAggregate<{
  Namespace: Id<'apps'>;
  Key: null;
  DataModel: DataModel;
  TableName: 'questions';
}>(components.randomQuestions, {
  namespace: (d: unknown) => (d as { tenantId: Id<'apps'> }).tenantId,
  sortKey: () => null, // No sorting = random order by _id
});

export const randomQuestionsByTheme = new TableAggregate<{
  Namespace: Id<'themes'>;
  Key: null;
  DataModel: DataModel;
  TableName: 'questions';
}>(components.randomQuestionsByTheme, {
  namespace: (d: unknown) => (d as { themeId: Id<'themes'> }).themeId,
  sortKey: () => null, // No sorting = random order by _id
});

export const randomQuestionsBySubtheme = new TableAggregate<{
  Namespace: string;
  Key: null;
  DataModel: DataModel;
  TableName: 'questions';
}>(components.randomQuestionsBySubtheme, {
  namespace: (d: unknown) => {
    const question = d as { subthemeId?: Id<'subthemes'> };
    // Use "no-subtheme" for questions without subthemeId
    const subthemeId = question.subthemeId || 'no-subtheme';
    return subthemeId;
  },
  sortKey: () => null, // No sorting = random order by _id
});

export const randomQuestionsByGroup = new TableAggregate<{
  Namespace: string;
  Key: null;
  DataModel: DataModel;
  TableName: 'questions';
}>(components.randomQuestionsByGroup, {
  namespace: (d: unknown) => {
    const question = d as { groupId?: Id<'groups'> };
    // Use "no-group" for questions without groupId
    const groupId = question.groupId || 'no-group';
    return groupId;
  },
  sortKey: () => null, // No sorting = random order by _id
});

// =============================================================================
// SECTION 3: USER-SPECIFIC COUNT AGGREGATES - REMOVED
// Replaced by userStatsCounts table for better performance
// =============================================================================

// All user-specific aggregates have been removed and replaced by the userStatsCounts table
// This eliminates 12 complex aggregate components and provides much better performance:
// - answeredByUser, incorrectByUser, bookmarkedByUser
// - answeredByThemeByUser, incorrectByThemeByUser, bookmarkedByThemeByUser
// - answeredBySubthemeByUser, incorrectBySubthemeByUser, bookmarkedBySubthemeByUser
// - answeredByGroupByUser, incorrectByGroupByUser, bookmarkedByGroupByUser
//
// Benefits:
// - 1-2 database calls instead of 1000+ aggregate calls
// - Simpler codebase with no complex namespace/sortKey logic
// - Easier to maintain and debug
// - Better scalability for large user bases
