'use client';

interface QuestionIdDisplayProps {
  generatedId: string;
}

export function QuestionIdDisplay({ generatedId }: QuestionIdDisplayProps) {
  return (
    <div className="flex flex-row items-center gap-4 py-2">
      <div className="flex-1">
        <div className="mb-1 text-sm font-medium">Código da Questão</div>
        <div className="flex items-center gap-2">
          <div
            className={`rounded-md border px-3 py-1 ${
              generatedId
                ? 'border-brand-blue/20 bg-brand-blue/10 dark:border-brand-blue/80 dark:bg-brand-blue/20'
                : 'bg-muted'
            }`}
          >
            {generatedId || 'Selecione um tema para gerar o código'}
          </div>
          {generatedId && (
            <div className="text-muted-foreground text-xs">
              Este código será salvo com a questão e ajudará na identificação
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
