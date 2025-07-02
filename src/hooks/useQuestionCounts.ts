import { useUser } from '@clerk/nextjs';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useMotherDuckClientState } from '@/lib/motherduck/context/motherduckClientContext';
import {
  type QuestionCounts,
  QuestionCountService,
} from '@/lib/motherduck/functions/questionCountService';

interface UseQuestionCountsParams {
  questionMode: 'all' | 'unanswered' | 'incorrect' | 'bookmarked';
  selectedThemes: string[];
  selectedSubthemes: string[];
  selectedGroups: string[];
}

interface TaxonomyCounts {
  themesCounts: Record<string, number>;
  subthemesCounts: Record<string, number>;
  groupsCounts: Record<string, number>;
  totalFilteredCount: number;
}

export function useQuestionCounts(params: UseQuestionCountsParams) {
  const { user } = useUser();
  const { evaluateQuery } = useMotherDuckClientState();

  const [baseCounts, setBaseCounts] = useState<QuestionCounts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize the count service
  const countService = useMemo(
    () => new QuestionCountService(evaluateQuery),
    [evaluateQuery],
  );

  // Fetch base counts from MotherDuck once per session
  useEffect(() => {
    if (!user?.id) return;

    const fetchBaseCounts = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const counts = await countService.fetchAllBaseCounts(user.id);
        setBaseCounts(counts);
      } catch (error_) {
        console.error('Failed to fetch question counts:', error_);
        setError(
          error_ instanceof Error ? error_.message : 'Failed to fetch counts',
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchBaseCounts();
  }, [user?.id, countService]);

  // Calculate filtered counts client-side based on current selections
  const calculatedCounts = useMemo((): TaxonomyCounts => {
    if (!baseCounts) {
      return {
        themesCounts: {},
        subthemesCounts: {},
        groupsCounts: {},
        totalFilteredCount: 0,
      };
    }

    const { questionMode, selectedThemes, selectedSubthemes, selectedGroups } =
      params;

    // If no selections made, return all counts for the question mode
    if (
      selectedThemes.length === 0 &&
      selectedSubthemes.length === 0 &&
      selectedGroups.length === 0
    ) {
      return {
        themesCounts: Object.fromEntries(
          Object.entries(baseCounts.themesCounts).map(([id, counts]) => [
            id,
            counts[questionMode],
          ]),
        ),
        subthemesCounts: Object.fromEntries(
          Object.entries(baseCounts.subthemesCounts).map(([id, counts]) => [
            id,
            counts[questionMode],
          ]),
        ),
        groupsCounts: Object.fromEntries(
          Object.entries(baseCounts.groupsCounts).map(([id, counts]) => [
            id,
            counts[questionMode],
          ]),
        ),
        totalFilteredCount: baseCounts.totalQuestions,
      };
    }

    // Client-side filtering logic
    const result: TaxonomyCounts = {
      themesCounts: {},
      subthemesCounts: {},
      groupsCounts: {},
      totalFilteredCount: 0,
    };

    // Calculate theme counts
    Object.entries(baseCounts.themesCounts).forEach(([themeId, counts]) => {
      // Theme is available if: no themes selected OR this theme is selected
      const isThemeSelected =
        selectedThemes.length === 0 || selectedThemes.includes(themeId);

      if (isThemeSelected) {
        result.themesCounts[themeId] = counts[questionMode];
      }
    });

    // Calculate subtheme counts
    Object.entries(baseCounts.subthemesCounts).forEach(
      ([subthemeId, counts]) => {
        // Subtheme is available if: no subthemes selected OR this subtheme is selected
        const isSubthemeSelected =
          selectedSubthemes.length === 0 ||
          selectedSubthemes.includes(subthemeId);

        if (isSubthemeSelected) {
          result.subthemesCounts[subthemeId] = counts[questionMode];
        }
      },
    );

    // Calculate group counts
    Object.entries(baseCounts.groupsCounts).forEach(([groupId, counts]) => {
      // Group is available if: no groups selected OR this group is selected
      const isGroupSelected =
        selectedGroups.length === 0 || selectedGroups.includes(groupId);

      if (isGroupSelected) {
        result.groupsCounts[groupId] = counts[questionMode];
      }
    });

    // For now, return estimated total - in production you might want to call the precise MotherDuck query
    // This is a simplified estimation - you can enhance this logic based on your taxonomy hierarchy
    const hasSelections =
      selectedThemes.length > 0 ||
      selectedSubthemes.length > 0 ||
      selectedGroups.length > 0;

    // Sum up counts from selected items (simplified approach) or use total
    result.totalFilteredCount = hasSelections
      ? [
          ...Object.values(result.themesCounts),
          ...Object.values(result.subthemesCounts),
          ...Object.values(result.groupsCounts),
        ].reduce((sum, count) => sum + count, 0)
      : baseCounts.totalQuestions;

    return result;
  }, [baseCounts, params]);

  // Get precise filtered count for final validation (optional, for accuracy)
  const getPreciseFilteredCount = useCallback(async (): Promise<number> => {
    if (!user?.id) return 0;

    try {
      return await countService.getFilteredQuestionCount({
        userId: user.id,
        questionMode: params.questionMode,
        selectedThemes: params.selectedThemes,
        selectedSubthemes: params.selectedSubthemes,
        selectedGroups: params.selectedGroups,
      });
    } catch (error_) {
      console.error('Failed to get precise count:', error_);
      return calculatedCounts.totalFilteredCount; // Fallback to calculated count
    }
  }, [user?.id, params, countService, calculatedCounts.totalFilteredCount]);

  return {
    // Base data
    baseCounts,
    isLoading,
    error,

    // Calculated counts for UI display
    themesCounts: calculatedCounts.themesCounts,
    subthemesCounts: calculatedCounts.subthemesCounts,
    groupsCounts: calculatedCounts.groupsCounts,
    totalFilteredCount: calculatedCounts.totalFilteredCount,

    // Utility functions
    getPreciseFilteredCount,

    // Helper functions for UI
    getThemeCount: (themeId: string) =>
      calculatedCounts.themesCounts[themeId] || 0,
    getSubthemeCount: (subthemeId: string) =>
      calculatedCounts.subthemesCounts[subthemeId] || 0,
    getGroupCount: (groupId: string) =>
      calculatedCounts.groupsCounts[groupId] || 0,
  };
}
