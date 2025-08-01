import { TableAggregate } from '@convex-dev/aggregate';

import { components } from './_generated/api';
import { DataModel, Id } from './_generated/dataModel';

// Track total questions answered by each user
export const answeredByUser = new TableAggregate<{
  Namespace: Id<'users'>;
  Key: string;
  DataModel: DataModel;
  TableName: 'userQuestionStats';
}>(components.answeredByUser, {
  namespace: (d: unknown) => (d as { userId: Id<'users'> }).userId,
  sortKey: (d: unknown) => 'answered',
  // Filter in the functions that use this aggregate
});

// Track total incorrect answers by each user
export const incorrectByUser = new TableAggregate<{
  Namespace: Id<'users'>;
  Key: string;
  DataModel: DataModel;
  TableName: 'userQuestionStats';
}>(components.incorrectByUser, {
  namespace: (d: unknown) => (d as { userId: Id<'users'> }).userId,
  sortKey: (d: unknown) => 'incorrect',
  // Filter in the functions that use this aggregate
});

// Track total bookmarks by each user
export const bookmarkedByUser = new TableAggregate<{
  Namespace: Id<'users'>;
  Key: string;
  DataModel: DataModel;
  TableName: 'userBookmarks';
}>(components.bookmarkedByUser, {
  namespace: (d: unknown) => (d as { userId: Id<'users'> }).userId,
  sortKey: (d: unknown) => 'bookmarked',
});

// Track total question count globally
export const totalQuestionCount = new TableAggregate<{
  Namespace: string;
  Key: string;
  DataModel: DataModel;
  TableName: 'questions';
}>(components.questionCountTotal, {
  namespace: () => 'global',
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
  Namespace: Id<'subthemes'>;
  Key: string;
  DataModel: DataModel;
  TableName: 'questions';
}>(components.questionCountBySubtheme, {
  namespace: (d: unknown) => {
    const question = d as { subthemeId?: Id<'subthemes'> };
    if (!question.subthemeId) {
      throw new Error('Question has no subthemeId');
    }
    return question.subthemeId;
  },
  sortKey: (d: unknown) => 'question',
});

//track total question count by group (only for questions that have groupId)
export const questionCountByGroup = new TableAggregate<{
  Namespace: Id<'groups'>;
  Key: string;
  DataModel: DataModel;
  TableName: 'questions';
}>(components.questionCountByGroup, {
  namespace: (d: unknown) => {
    const question = d as { groupId?: Id<'groups'> };
    if (!question.groupId) {
      throw new Error('Question has no groupId');
    }
    return question.groupId;
  },
  sortKey: (d: unknown) => 'question',
});

// Random question selection aggregates for efficient randomization
export const randomQuestions = new TableAggregate<{
  Namespace: string;
  Key: null;
  DataModel: DataModel;
  TableName: 'questions';
}>(components.randomQuestions, {
  namespace: () => 'global',
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
  Namespace: Id<'subthemes'>;
  Key: null;
  DataModel: DataModel;
  TableName: 'questions';
}>(components.randomQuestionsBySubtheme, {
  namespace: (d: unknown) => {
    const question = d as { subthemeId?: Id<'subthemes'> };
    if (!question.subthemeId) {
      throw new Error('Question has no subthemeId');
    }
    return question.subthemeId;
  },
  sortKey: () => null, // No sorting = random order by _id
});

export const randomQuestionsByGroup = new TableAggregate<{
  Namespace: Id<'groups'>;
  Key: null;
  DataModel: DataModel;
  TableName: 'questions';
}>(components.randomQuestionsByGroup, {
  namespace: (d: unknown) => {
    const question = d as { groupId?: Id<'groups'> };
    if (!question.groupId) {
      throw new Error('Question has no groupId');
    }
    return question.groupId;
  },
  sortKey: () => null, // No sorting = random order by _id
});
