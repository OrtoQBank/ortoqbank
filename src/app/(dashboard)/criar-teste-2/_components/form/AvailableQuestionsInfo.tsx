'use client';

import { InfoIcon as InfoCircle, Loader2 } from 'lucide-react';

type AvailableQuestionsInfoProps = {
  isLoading: boolean;
  count?: number;
  requestedCount: number;
};

export function AvailableQuestionsInfo({
  isLoading,
  count,
  requestedCount,
}: AvailableQuestionsInfoProps) {
  return (
    <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
      <div className="flex items-center">
        <InfoCircle className="h-5 w-5 text-blue-400 dark:text-blue-300" />
        <div className="ml-3">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Questões Disponíveis
          </h3>
          <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
            {isLoading ? (
              <div className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Calculando...
              </div>
            ) : count === undefined ? (
              <p>
                Selecione pelo menos um tema para ver quantas questões estão
                disponíveis.
              </p>
            ) : (
              <p>
                Há <span className="font-bold">{count}</span>{' '}
                {count === 1 ? 'questão disponível' : 'questões disponíveis'}{' '}
                com os critérios selecionados.
                {requestedCount > (count || 0) && (
                  <span className="mt-1 block text-amber-600 dark:text-amber-400">
                    Nota: Você solicitou {requestedCount} questões, mas apenas{' '}
                    {count}{' '}
                    {count === 1 ? 'está disponível' : 'estão disponíveis'}.
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
