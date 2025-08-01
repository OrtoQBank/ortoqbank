'use client';

import { useQuery } from 'convex/react';
import { Calculator, Loader2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';

type TotalQuestionCountProps = {
  selectedThemes: string[];
  selectedSubthemes: string[];
  selectedGroups: string[];
  questionMode: string;
};

export function TotalQuestionCount({
  selectedThemes,
  selectedSubthemes,
  selectedGroups,
  questionMode,
}: TotalQuestionCountProps) {
  // Map question mode to filter type
  const filter = ((): 'all' | 'unanswered' | 'incorrect' | 'bookmarked' => {
    switch (questionMode) {
      case 'bookmarked':
        return 'bookmarked';
      case 'unanswered':
        return 'unanswered';
      case 'incorrect':
        return 'incorrect';
      default:
        return 'all';
    }
  })();

  // Use the new smart selection query that handles hierarchical selections and deduplication
  const totalCount = useQuery(
    api.aggregateQueries.getQuestionCountBySelection,
    selectedThemes.length > 0 ||
      selectedSubthemes.length > 0 ||
      selectedGroups.length > 0
      ? {
          filter,
          selectedThemes: selectedThemes as Id<'themes'>[],
          selectedSubthemes: selectedSubthemes as Id<'subthemes'>[],
          selectedGroups: selectedGroups as Id<'groups'>[],
        }
      : 'skip',
  );

  const isLoading = totalCount === undefined;

  // Don't show if nothing is selected
  if (
    selectedThemes.length === 0 &&
    selectedSubthemes.length === 0 &&
    selectedGroups.length === 0
  ) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-medium text-blue-800 dark:text-blue-200">
              Total Único de Questões
            </h3>
          </div>

          <div className="flex-1" />

          <div className="text-right">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  Calculando...
                </span>
              </div>
            ) : (
              <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                {(totalCount || 0).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {!isLoading && totalCount !== undefined && (
          <div className="mt-3 text-xs text-blue-700 dark:text-blue-300">
            <p>
              🧠 <strong>Total inteligente:</strong>{' '}
              {totalCount === 0
                ? 'Nenhuma questão disponível'
                : totalCount === 1
                  ? '1 questão única disponível'
                  : `${totalCount} questões únicas disponíveis`}{' '}
              para{' '}
              <strong>
                {questionMode === 'all'
                  ? 'todas as questões'
                  : questionMode === 'unanswered'
                    ? 'questões não respondidas'
                    : questionMode === 'incorrect'
                      ? 'questões incorretas'
                      : questionMode === 'bookmarked'
                        ? 'questões marcadas'
                        : questionMode}
              </strong>
              .{' '}
              <span className="opacity-80">
                Este cálculo evita questões duplicadas quando há sobreposição de
                hierarquias.
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
