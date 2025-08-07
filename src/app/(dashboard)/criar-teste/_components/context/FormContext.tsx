'use client';

import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex-helpers/react/cache/hooks';
import React, { createContext, useContext, useMemo } from 'react';

import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';

// Types
export type QuestionMode = 'all' | 'unanswered' | 'incorrect' | 'bookmarked';

export interface QuestionCounts {
  all: number;
  unanswered: number;
  incorrect: number;
  bookmarked: number;
}

export interface FormContextValue {
  // Core data (fetched once, cached)
  userCountsForQuizCreation: any;
  totalQuestions: number | undefined;
  hierarchicalData: any;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Memoized calculation function
  calculateQuestionCounts: (
    selectedThemes: Id<'themes'>[],
    selectedSubthemes: Id<'subthemes'>[],
    selectedGroups: Id<'groups'>[],
    questionMode?: QuestionMode,
  ) => QuestionCounts | number;
}

const FormContext = createContext<FormContextValue | undefined>(undefined);

// Calculate question counts locally from userCountsForQuizCreation data
const calculateLocalQuestionCounts = (
  userCounts: {
    global: {
      totalAnswered: number;
      totalIncorrect: number;
      totalBookmarked: number;
    };
    byTheme: Record<
      string,
      { answered: number; incorrect: number; bookmarked: number }
    >;
    bySubtheme: Record<
      string,
      { answered: number; incorrect: number; bookmarked: number }
    >;
    byGroup: Record<
      string,
      { answered: number; incorrect: number; bookmarked: number }
    >;
  },
  totalQuestions: number,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  questionMode: QuestionMode,
): number => {
  // If no hierarchical selections, use global counts
  if (
    selectedThemes.length === 0 &&
    selectedSubthemes.length === 0 &&
    selectedGroups.length === 0
  ) {
    switch (questionMode) {
      case 'all':
        return totalQuestions;
      case 'unanswered':
        return Math.max(0, totalQuestions - userCounts.global.totalAnswered);
      case 'incorrect':
        return userCounts.global.totalIncorrect;
      case 'bookmarked':
        return userCounts.global.totalBookmarked;
    }
  }

  // Calculate counts for selected hierarchies
  let totalCount = 0;

  // Process groups first (most specific)
  for (const groupId of selectedGroups) {
    const groupData = userCounts.byGroup[groupId];
    if (groupData) {
      switch (questionMode) {
        case 'incorrect':
          totalCount += groupData.incorrect;
          break;
        case 'bookmarked':
          totalCount += groupData.bookmarked;
          break;
      }
    }
  }

  // Process subthemes (exclude those that have groups already selected)
  for (const subthemeId of selectedSubthemes) {
    const subthemeData = userCounts.bySubtheme[subthemeId];
    if (subthemeData) {
      switch (questionMode) {
        case 'incorrect':
          totalCount += subthemeData.incorrect;
          break;
        case 'bookmarked':
          totalCount += subthemeData.bookmarked;
          break;
      }
    }
  }

  // Process themes (exclude those that have subthemes or groups already selected)
  for (const themeId of selectedThemes) {
    const themeData = userCounts.byTheme[themeId];
    if (themeData) {
      switch (questionMode) {
        case 'incorrect':
          totalCount += themeData.incorrect;
          break;
        case 'bookmarked':
          totalCount += themeData.bookmarked;
          break;
      }
    }
  }

  // For 'all' and 'unanswered' modes with hierarchical selections,
  // we need to use API calls since we don't have total question counts per hierarchy
  if (questionMode === 'all' || questionMode === 'unanswered') {
    // TODO: Implement API call for filtered total counts
    // For now, return 0 to indicate this needs API resolution
    return 0;
  }

  return totalCount;
};

export function FormContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn } = useUser();
  const isAuthenticated = isLoaded && isSignedIn;

  // Fetch data once and cache it
  const totalQuestions = useQuery(
    api.aggregateQueries.getTotalQuestionCountQuery,
    isAuthenticated ? {} : 'skip',
  );

  const hierarchicalData = useQuery(
    api.themes.getHierarchicalData,
    isAuthenticated ? {} : 'skip',
  );

  const userCountsForQuizCreation = useQuery(
    api.userStats.getUserCountsForQuizCreation,
    isAuthenticated ? {} : 'skip',
  );

  const isLoading =
    (userCountsForQuizCreation === undefined || totalQuestions === undefined) &&
    isAuthenticated;

  // Memoized calculation function that returns all counts at once
  const calculateQuestionCounts = useMemo(() => {
    return (
      selectedThemes: Id<'themes'>[],
      selectedSubthemes: Id<'subthemes'>[],
      selectedGroups: Id<'groups'>[],
      questionMode?: QuestionMode,
    ): QuestionCounts | number => {
      if (!userCountsForQuizCreation || totalQuestions === undefined) {
        return questionMode
          ? 0
          : { all: 0, unanswered: 0, incorrect: 0, bookmarked: 0 };
      }

      // If specific mode requested, return just that count
      if (questionMode) {
        return calculateLocalQuestionCounts(
          userCountsForQuizCreation,
          totalQuestions,
          selectedThemes,
          selectedSubthemes,
          selectedGroups,
          questionMode,
        );
      }

      // Return all counts at once (more efficient)
      // These are GLOBAL counts for the question mode selector - they don't change with filters
      const allCounts: QuestionCounts = {
        all: totalQuestions, // Always use total question count from aggregate
        unanswered: Math.max(
          0,
          totalQuestions - userCountsForQuizCreation.global.totalAnswered,
        ), // Total unanswered globally
        incorrect: userCountsForQuizCreation.global.totalIncorrect, // Total incorrect globally
        bookmarked: userCountsForQuizCreation.global.totalBookmarked, // Total bookmarked globally
      };

      return allCounts;
    };
  }, [userCountsForQuizCreation, totalQuestions]); // Only depends on data, not selections

  const contextValue: FormContextValue = useMemo(
    () => ({
      userCountsForQuizCreation,
      totalQuestions,
      hierarchicalData,
      isAuthenticated,
      isLoading,
      calculateQuestionCounts,
    }),
    [
      userCountsForQuizCreation,
      totalQuestions,
      hierarchicalData,
      isAuthenticated,
      isLoading,
      calculateQuestionCounts,
    ],
  );

  return (
    <FormContext.Provider value={contextValue}>{children}</FormContext.Provider>
  );
}

export function useFormContext() {
  const context = useContext(FormContext);
  if (context === undefined) {
    throw new Error('useFormContext must be used within a FormContextProvider');
  }
  return context;
}
