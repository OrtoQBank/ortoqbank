import { useQuery } from 'convex-helpers/react/cache/hooks';
import { useMemo } from 'react';

import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import {
  debugTaxonomyProcessing,
  ProcessedTaxonomy,
  processHierarchicalTaxonomy,
  processSimpleTaxonomy,
  TaxonomyItem,
} from '../utils/taxonomyProcessor';

export interface UseTaxonomyProcessorOptions {
  mode: 'simple' | 'hierarchical';
  debug?: boolean;
}

export interface UseTaxonomyProcessorReturn {
  processedTaxonomy: ProcessedTaxonomy;
  isValid: boolean;
  summary: string;
}

/**
 * Custom hook for processing taxonomy selections in forms
 * Converts user selections into backend-compatible format
 */
export function useTaxonomyProcessor(
  taxonomySelection: TaxonomyItem[],
  options?: UseTaxonomyProcessorOptions,
): UseTaxonomyProcessorReturn {
  const processingOptions = options || { mode: 'simple', debug: false };

  // Fetch taxonomy data to perform hierarchical filtering
  const taxonomyData = useQuery(api.taxonomy.getHierarchicalData);

  const processedTaxonomy = useMemo(() => {
    if (taxonomySelection.length === 0) {
      return {
        selectedTaxThemes: [],
        selectedTaxSubthemes: [],
        selectedTaxGroups: [],
        taxonomyPathIds: [],
      };
    }

    const result =
      processingOptions.mode === 'hierarchical'
        ? processHierarchicalTaxonomy(taxonomySelection)
        : processSimpleTaxonomy(taxonomySelection, taxonomyData);

    if (processingOptions.debug) {
      debugTaxonomyProcessing(taxonomySelection, result);
    }

    return result;
  }, [
    taxonomySelection,
    taxonomyData,
    processingOptions.mode,
    processingOptions.debug,
  ]);

  const isValid = useMemo(() => {
    const hasSelections = taxonomySelection.length > 0;
    const hasProcessedResults =
      processedTaxonomy.selectedTaxThemes.length > 0 ||
      processedTaxonomy.selectedTaxSubthemes.length > 0 ||
      processedTaxonomy.selectedTaxGroups.length > 0;

    return hasSelections && hasProcessedResults;
  }, [taxonomySelection, processedTaxonomy]);

  const summary = useMemo(() => {
    if (taxonomySelection.length === 0) {
      return 'Nenhuma seleção de taxonomia';
    }

    const parts: string[] = [];

    if (processedTaxonomy.selectedTaxThemes.length > 0) {
      parts.push(`${processedTaxonomy.selectedTaxThemes.length} tema(s)`);
    }

    if (processedTaxonomy.selectedTaxSubthemes.length > 0) {
      parts.push(`${processedTaxonomy.selectedTaxSubthemes.length} subtema(s)`);
    }

    if (processedTaxonomy.selectedTaxGroups.length > 0) {
      parts.push(`${processedTaxonomy.selectedTaxGroups.length} grupo(s)`);
    }

    return parts.length > 0
      ? `Questões filtradas por: ${parts.join(', ')}`
      : 'Todas as questões disponíveis';
  }, [processedTaxonomy]);

  return {
    processedTaxonomy,
    isValid,
    summary,
  };
}

/**
 * Helper hook for form submission payload
 */
export function useQuizPayload() {
  return function createPayload(
    formData: {
      name: string;
      description: string;
      mode: 'exam' | 'study';
      filter: 'all' | 'unanswered' | 'incorrect' | 'bookmarked';
      totalQuestions: number;
    },
    processedTaxonomy: ProcessedTaxonomy,
  ) {
    return {
      name: formData.name,
      description: formData.description,
      testMode: formData.mode,
      questionMode: formData.filter,
      numQuestions: formData.totalQuestions,
      // New taxonomy fields only
      ...processedTaxonomy,
    };
  };
}
