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

// Hierarchical user-specific question mode aggregates - COUNT ONLY

// Track incorrect questions by user within each theme
export const incorrectByThemeByUser = new TableAggregate<{
  Namespace: string; // Composite: `${userId}_${themeId}`
  Key: string;
  DataModel: DataModel;
  TableName: 'userQuestionStats';
}>(components.incorrectByThemeByUser, {
  namespace: (d: unknown) => {
    const stat = d as { userId: Id<'users'>; themeId: Id<'themes'> };
    return `${stat.userId}_${stat.themeId}`;
  },
  sortKey: (d: unknown) => 'incorrect',
  // Filter for isIncorrect=true in the functions that use this aggregate
});

// Track incorrect questions by user within each subtheme
export const incorrectBySubthemeByUser = new TableAggregate<{
  Namespace: string; // Composite: `${userId}_${subthemeId}`
  Key: string;
  DataModel: DataModel;
  TableName: 'userQuestionStats';
}>(components.incorrectBySubthemeByUser, {
  namespace: (d: unknown) => {
    const stat = d as { userId: Id<'users'>; subthemeId?: Id<'subthemes'> };
    if (!stat.subthemeId) {
      throw new Error('UserQuestionStat has no subthemeId');
    }
    return `${stat.userId}_${stat.subthemeId}`;
  },
  sortKey: (d: unknown) => 'incorrect',
  // Filter for isIncorrect=true in the functions that use this aggregate
});

// Track incorrect questions by user within each group
export const incorrectByGroupByUser = new TableAggregate<{
  Namespace: string; // Composite: `${userId}_${groupId}`
  Key: string;
  DataModel: DataModel;
  TableName: 'userQuestionStats';
}>(components.incorrectByGroupByUser, {
  namespace: (d: unknown) => {
    const stat = d as { userId: Id<'users'>; groupId?: Id<'groups'> };
    if (!stat.groupId) {
      throw new Error('UserQuestionStat has no groupId');
    }
    return `${stat.userId}_${stat.groupId}`;
  },
  sortKey: (d: unknown) => 'incorrect',
  // Filter for isIncorrect=true in the functions that use this aggregate
});

// Track bookmarked questions by user within each theme
export const bookmarkedByThemeByUser = new TableAggregate<{
  Namespace: string; // Composite: `${userId}_${themeId}`
  Key: string;
  DataModel: DataModel;
  TableName: 'userBookmarks';
}>(components.bookmarkedByThemeByUser, {
  namespace: (d: unknown) => {
    const bookmark = d as { userId: Id<'users'>; themeId: Id<'themes'> };
    return `${bookmark.userId}_${bookmark.themeId}`;
  },
  sortKey: (d: unknown) => 'bookmarked',
});

// Track bookmarked questions by user within each subtheme
export const bookmarkedBySubthemeByUser = new TableAggregate<{
  Namespace: string; // Composite: `${userId}_${subthemeId}`
  Key: string;
  DataModel: DataModel;
  TableName: 'userBookmarks';
}>(components.bookmarkedBySubthemeByUser, {
  namespace: (d: unknown) => {
    const bookmark = d as { userId: Id<'users'>; subthemeId?: Id<'subthemes'> };
    if (!bookmark.subthemeId) {
      throw new Error('UserBookmark has no subthemeId');
    }
    return `${bookmark.userId}_${bookmark.subthemeId}`;
  },
  sortKey: (d: unknown) => 'bookmarked',
});

// Track bookmarked questions by user within each group
export const bookmarkedByGroupByUser = new TableAggregate<{
  Namespace: string; // Composite: `${userId}_${groupId}`
  Key: string;
  DataModel: DataModel;
  TableName: 'userBookmarks';
}>(components.bookmarkedByGroupByUser, {
  namespace: (d: unknown) => {
    const bookmark = d as { userId: Id<'users'>; groupId?: Id<'groups'> };
    if (!bookmark.groupId) {
      throw new Error('UserBookmark has no groupId');
    }
    return `${bookmark.userId}_${bookmark.groupId}`;
  },
  sortKey: (d: unknown) => 'bookmarked',
});

// Track answered questions by user within each theme
export const answeredByThemeByUser = new TableAggregate<{
  Namespace: string; // Composite: `${userId}_${themeId}`
  Key: string;
  DataModel: DataModel;
  TableName: 'userQuestionStats';
}>(components.answeredByThemeByUser, {
  namespace: (d: unknown) => {
    const stat = d as { userId: Id<'users'>; themeId: Id<'themes'> };
    return `${stat.userId}_${stat.themeId}`;
  },
  sortKey: (d: unknown) => 'answered',
});

// Track answered questions by user within each subtheme
export const answeredBySubthemeByUser = new TableAggregate<{
  Namespace: string; // Composite: `${userId}_${subthemeId}`
  Key: string;
  DataModel: DataModel;
  TableName: 'userQuestionStats';
}>(components.answeredBySubthemeByUser, {
  namespace: (d: unknown) => {
    const stat = d as { userId: Id<'users'>; subthemeId?: Id<'subthemes'> };
    if (!stat.subthemeId) {
      throw new Error('UserQuestionStat has no subthemeId');
    }
    return `${stat.userId}_${stat.subthemeId}`;
  },
  sortKey: (d: unknown) => 'answered',
});

// Track answered questions by user within each group
export const answeredByGroupByUser = new TableAggregate<{
  Namespace: string; // Composite: `${userId}_${groupId}`
  Key: string;
  DataModel: DataModel;
  TableName: 'userQuestionStats';
}>(components.answeredByGroupByUser, {
  namespace: (d: unknown) => {
    const stat = d as { userId: Id<'users'>; groupId?: Id<'groups'> };
    if (!stat.groupId) {
      throw new Error('UserQuestionStat has no groupId');
    }
    return `${stat.userId}_${stat.groupId}`;
  },
  sortKey: (d: unknown) => 'answered',
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
