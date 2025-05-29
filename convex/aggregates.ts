import { TableAggregate } from '@convex-dev/aggregate';

import { components } from './_generated/api';
import { DataModel, Id } from './_generated/dataModel';

// Track questions answered by each user
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

// Track incorrect answers by each user
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

// Track bookmarks by each user
export const bookmarkedByUser = new TableAggregate<{
  Namespace: Id<'users'>;
  Key: string;
  DataModel: DataModel;
  TableName: 'userBookmarks';
}>(components.bookmarkedByUser, {
  namespace: (d: unknown) => (d as { userId: Id<'users'> }).userId,
  sortKey: (d: unknown) => 'bookmarked',
});

// Track question count by theme
export const questionCountByTheme = new TableAggregate<{
  Namespace: Id<'themes'>;
  Key: string;
  DataModel: DataModel;
  TableName: 'questions';
}>(components.questionCountByTheme, {
  namespace: (d: unknown) => (d as { themeId: Id<'themes'> }).themeId,
  sortKey: (d: unknown) => 'question',
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
