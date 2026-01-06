'use client';

import QuestionContent from '@/components/quiz/QuestionContent';
import { Button } from '@/components/ui/button';

interface QuestionDisplayProps {
  question: any; // Replace with proper type when available
  onEdit: () => void;
  onBack: () => void;
}

export function QuestionDisplay({
  question,
  onEdit,
  onBack,
}: QuestionDisplayProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{question.title}</h1>
        <div className="space-x-2">
          <Button onClick={onEdit}>Editar</Button>
          <Button variant="outline" onClick={onBack}>
            Voltar
          </Button>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl rounded-3xl border bg-white p-6">
        <div className="space-y-6">
          <div>
            <h2 className="mb-4 font-semibold">Pergunta:</h2>
            <QuestionContent stringContent={question.questionTextString} />
          </div>

          <div>
            <div className="mt-4 space-y-2">
              {question.alternatives?.map(
                (alternative: string, index: number) => (
                  <div
                    key={index}
                    className={`w-full rounded-lg border p-4 text-left ${
                      index === question.correctAlternativeIndex
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <div
                        className={
                          index === question.correctAlternativeIndex
                            ? 'font-medium text-green-600'
                            : ''
                        }
                      >
                        {index + 1}. {alternative}
                        {index === question.correctAlternativeIndex && ' ✓'}
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-4 font-semibold">Explicação:</h2>
            <div className="border-brand-blue/20 bg-brand-blue/10 mt-6 rounded-lg border p-4">
              <div className="prose mt-2 max-w-none">
                <QuestionContent
                  stringContent={question.explanationTextString}
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-4 font-semibold">Informações Adicionais:</h2>
            <p>Tema: {question.theme?.name}</p>
            {question.subtheme && <p>Subtema: {question.subtheme.name}</p>}
            <p>Status: {question.isPublic ? 'Publicada' : 'Rascunho'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
