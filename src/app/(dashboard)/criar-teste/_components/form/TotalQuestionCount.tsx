'use client';

import { useQuery } from 'convex/react';
import { Calculator, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
  const [showDetails, setShowDetails] = useState(false);

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

  // Prepare selections for batch query
  const selections = [
    ...selectedThemes.map(id => ({ type: 'theme' as const, id })),
    ...selectedSubthemes.map(id => ({ type: 'subtheme' as const, id })),
    ...selectedGroups.map(id => ({ type: 'group' as const, id })),
  ];

  const hasMultipleSelections = selections.length > 1;
  const isUserSpecificMode = filter === 'incorrect' || filter === 'bookmarked';
  const shouldShowDetailsOption = hasMultipleSelections && isUserSpecificMode;

  // Use the optimized batch query for detailed breakdowns when beneficial
  const batchData = useQuery(
    api.aggregateQueries.getBatchQuestionCountsBySelection,
    shouldShowDetailsOption && showDetails
      ? {
          filter,
          selections,
        }
      : 'skip',
  );

  // Use the standard query for simple total count
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

  const isLoading = totalCount === undefined && batchData === undefined;
  const displayCount = batchData?.totalCount ?? totalCount;

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

          <div className="flex items-center gap-3">
            {shouldShowDetailsOption && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-800/30 dark:hover:text-blue-300"
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="mr-1 h-4 w-4" />
                    Ocultar detalhes
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-4 w-4" />
                    Ver detalhes
                  </>
                )}
              </Button>
            )}

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
                  {(displayCount || 0).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {!isLoading && displayCount !== undefined && (
          <div className="mt-3 text-xs text-blue-700 dark:text-blue-300">
            <p>
              🧠 <strong>Total inteligente:</strong>{' '}
              {displayCount === 0
                ? 'Nenhuma questão disponível'
                : displayCount === 1
                  ? '1 questão única disponível'
                  : `${displayCount} questões únicas disponíveis`}{' '}
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
              {isUserSpecificMode && (
                <span className="mt-1 block text-green-600 dark:text-green-400">
                  ⚡ Usando agregados otimizados para máxima performance
                </span>
              )}
            </p>
          </div>
        )}

        {/* Detailed breakdown for user-specific modes */}
        {shouldShowDetailsOption && showDetails && batchData && (
          <div className="mt-4 border-t border-blue-200 pt-3 dark:border-blue-700">
            <h4 className="mb-2 text-sm font-medium text-blue-800 dark:text-blue-200">
              Detalhamento por seleção:
            </h4>
            <div className="space-y-1">
              {batchData.individualCounts.map((item: any, index: number) => (
                <div
                  key={`${item.type}-${item.id}-${index}`}
                  className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-300"
                >
                  <span className="capitalize">
                    {item.type === 'theme' && '📚 Tema'}
                    {item.type === 'subtheme' && '📖 Subtema'}
                    {item.type === 'group' && '📄 Grupo'} (ID:{' '}
                    {item.id.slice(-8)})
                  </span>
                  <span className="font-medium">
                    {item.count.toLocaleString()} questões
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t border-blue-100 pt-2 dark:border-blue-800">
              <div className="flex items-center justify-between text-xs font-medium text-blue-700 dark:text-blue-200">
                <span>Total (sem duplicação):</span>
                <span>
                  {(batchData.totalCount || 0).toLocaleString()} questões
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
