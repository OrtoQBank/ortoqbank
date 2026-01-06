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
    <div className="bg-brand-blue/10 dark:bg-brand-blue/20 rounded-md p-4">
      <div className="flex items-center">
        <InfoCircle className="text-brand-blue/40 dark:text-brand-blue/30 h-5 w-5" />
        <div className="ml-3">
          <h3 className="text-brand-blue/90 dark:text-brand-blue/20 text-sm font-medium">
            Questões Disponíveis
          </h3>
          <div className="text-brand-blue/80 dark:text-brand-blue/30 mt-2 text-sm">
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
