'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from 'convex-helpers/react/cache/hooks';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';

import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';
import { useFormContext } from '../context/FormContext';
import { type TestFormData, testFormSchema } from '../schema';

// Map UI question modes to API question modes
export const mapQuestionMode = (
  mode: string,
): 'all' | 'unanswered' | 'incorrect' | 'bookmarked' => {
  switch (mode) {
    case 'bookmarked': {
      return 'bookmarked';
    }
    case 'unanswered': {
      return 'unanswered';
    }
    case 'incorrect': {
      return 'incorrect';
    }
    default: {
      return 'all';
    }
  }
};

// This function has been moved to FormContext.tsx for better organization and memoization

export function useTestFormState() {
  // Get cached data and memoized calculations from context
  const {
    userCountsForQuizCreation,
    totalQuestions,
    hierarchicalData,
    isAuthenticated,
    isLoading,
    calculateQuestionCounts,
  } = useFormContext();

  const form = useForm<TestFormData>({
    resolver: zodResolver(testFormSchema),
    defaultValues: {
      name: 'Personalizado',
      testMode: 'study',
      questionMode: 'all',
      numQuestions: 30,
      selectedThemes: [],
      selectedSubthemes: [],
      selectedGroups: [],
    },
  });

  // Extract values from form
  const { watch, handleSubmit } = form;
  const testMode = watch('testMode');
  const selectedThemes = watch('selectedThemes');
  const selectedSubthemes = watch('selectedSubthemes');
  const selectedGroups = watch('selectedGroups');
  const questionMode = watch('questionMode');
  const numQuestions = watch('numQuestions');

  // Determine when we should fetch filtered counts from the server for 'all'/'unanswered'
  const mappedMode = mapQuestionMode(questionMode || 'all');
  const hasFilters =
    (selectedThemes?.length || 0) > 0 ||
    (selectedSubthemes?.length || 0) > 0 ||
    (selectedGroups?.length || 0) > 0;
  const shouldFetchFilteredCount =
    isAuthenticated &&
    hasFilters &&
    (mappedMode === 'all' || mappedMode === 'unanswered');

  // Server-side filtered count using aggregates for 'all' and table logic for 'unanswered'
  const filteredCount = useQuery(
    api.aggregateQueries.getQuestionCountBySelection,
    shouldFetchFilteredCount
      ? {
          filter: mappedMode,
          selectedThemes: selectedThemes as Id<'themes'>[],
          selectedSubthemes: selectedSubthemes as Id<'subthemes'>[],
          selectedGroups: selectedGroups as Id<'groups'>[],
        }
      : 'skip',
  );

  // Memoized question count calculation (only recalculates when selections actually change)
  const availableQuestionCount = useMemo(() => {
    if (!isAuthenticated || isLoading) return 0;

    // Prefer server-filtered count when applicable and loaded
    if (shouldFetchFilteredCount && filteredCount !== undefined) {
      return filteredCount;
    }

    const count = calculateQuestionCounts(
      selectedThemes as Id<'themes'>[],
      selectedSubthemes as Id<'subthemes'>[],
      selectedGroups as Id<'groups'>[],
      mapQuestionMode(questionMode || 'all'),
    );

    return typeof count === 'number' ? count : count.all;
  }, [
    selectedThemes,
    selectedSubthemes,
    selectedGroups,
    questionMode,
    calculateQuestionCounts,
    isAuthenticated,
    isLoading,
    shouldFetchFilteredCount,
    filteredCount,
  ]);

  // Note: API fallback removed - we now rely entirely on local calculations
  // For 'all' and 'unanswered' modes with hierarchical selections,
  // we use the global total as a reasonable approximation

  return {
    form,
    handleSubmit,
    testMode,
    questionMode,
    numQuestions,
    selectedThemes,
    selectedSubthemes,
    selectedGroups,
    availableQuestionCount,
    isCountLoading:
      isLoading || (shouldFetchFilteredCount && filteredCount === undefined),
    hierarchicalData,
    userCountsForQuizCreation,
    totalQuestions,
    calculateQuestionCounts,
    mapQuestionMode,
    isAuthenticated,
  };
}
