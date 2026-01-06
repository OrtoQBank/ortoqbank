'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

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

  // Extract form methods - DO NOT watch values here to prevent re-renders
  const { handleSubmit, control } = form;

  // Function to get current question count based on form values
  const getCurrentQuestionCount = useCallback(() => {
    if (!isAuthenticated || isLoading) return 0;

    const currentValues = form.getValues();
    const mappedMode = mapQuestionMode(currentValues.questionMode || 'all');
    const hasFilters =
      (currentValues.selectedThemes?.length || 0) > 0 ||
      (currentValues.selectedSubthemes?.length || 0) > 0 ||
      (currentValues.selectedGroups?.length || 0) > 0;

    // For filtered queries, we'd need to call the API, but for now return a reasonable estimate
    if (hasFilters && (mappedMode === 'all' || mappedMode === 'unanswered')) {
      // Return total questions as estimate - this could be improved with API calls if needed
      return totalQuestions || 0;
    }

    const count = calculateQuestionCounts(
      currentValues.selectedThemes as Id<'themes'>[],
      currentValues.selectedSubthemes as Id<'subthemes'>[],
      currentValues.selectedGroups as Id<'groups'>[],
      mappedMode,
    );

    return typeof count === 'number' ? count : count.all;
  }, [
    form,
    isAuthenticated,
    isLoading,
    totalQuestions,
    calculateQuestionCounts,
  ]);

  // Note: API fallback removed - we now rely entirely on local calculations
  // For 'all' and 'unanswered' modes with hierarchical selections,
  // we use the global total as a reasonable approximation

  return {
    form,
    handleSubmit,
    control,
    getCurrentQuestionCount,
    hierarchicalData,
    userCountsForQuizCreation,
    totalQuestions,
    calculateQuestionCounts,
    mapQuestionMode,
    isAuthenticated,
    isLoading,
  };
}
