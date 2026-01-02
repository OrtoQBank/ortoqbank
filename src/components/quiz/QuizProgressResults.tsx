import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface QuizProgressResultsProps {
  currentIndex: number;
  totalQuestions: number;
  onNavigate: (index: number) => void;
  answerFeedback: Array<{ isCorrect: boolean }>;
  visibleCount?: number; // Number of questions to show at once
}

export default function QuizProgressResults({
  currentIndex,
  totalQuestions,
  onNavigate,
  answerFeedback,
  visibleCount = 10, // Default to showing 10 questions at a time for results
}: QuizProgressResultsProps) {
  // State to track user's manual navigation offset
  const [manualOffset, setManualOffset] = useState(0);

  // Sync manualOffset when currentIndex changes to keep it visible
  // This only runs when currentIndex changes (e.g., via Anterior/Próxima or clicking a question)
  // It does NOT run when manualOffset changes (e.g., via left/right arrows)
  useEffect(() => {
    if (currentIndex < manualOffset) {
      setManualOffset(Math.max(0, currentIndex));
    } else if (currentIndex >= manualOffset + visibleCount) {
      setManualOffset(
        Math.max(
          0,
          Math.min(currentIndex - visibleCount + 1, totalQuestions - visibleCount),
        ),
      );
    }
  }, [currentIndex, visibleCount, totalQuestions]);

  // Use manualOffset directly as the source of truth for the view position
  const validStartIndex = Math.max(
    0,
    Math.min(manualOffset, totalQuestions - Math.min(totalQuestions, visibleCount)),
  );

  // Check if we need navigation arrows
  const showLeftArrow = validStartIndex > 0;
  const showRightArrow = validStartIndex + visibleCount < totalQuestions;

  // Calculate which questions to display when there are many
  const isCompact = totalQuestions > 20;

  // Determine how many to show per page in compact mode (either visibleCount or all if fewer)
  const visibleQuestions = Math.min(
    visibleCount,
    totalQuestions - validStartIndex,
  );

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Revisão de Questões</h2>
        <div className="text-sm">
          Questão {currentIndex + 1} de {totalQuestions}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Left arrow */}
        {showLeftArrow && (
          <button
            onClick={() =>
              setManualOffset(Math.max(0, validStartIndex - visibleCount))
            }
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
            aria-label="Previous questions"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
        )}

        {/* Question buttons */}
        <div className={`flex flex-wrap ${isCompact ? 'gap-1' : 'gap-2'}`}>
          {Array.from({ length: visibleQuestions }, (_, i) => {
            const questionIndex = validStartIndex + i;
            const feedback = answerFeedback[questionIndex];

            // Determine button appearance
            let bgColor =
              currentIndex === questionIndex
                ? 'ring-2 ring-offset-1 ring-brand-blue bg-brand-blue/10'
                : 'bg-gray-100';

            if (feedback) {
              bgColor =
                currentIndex === questionIndex
                  ? 'ring-2 ring-offset-1 ring-brand-blue ' +
                    (feedback.isCorrect ? 'bg-green-100' : 'bg-red-100')
                  : feedback.isCorrect
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800';
            }

            return (
              <button
                key={questionIndex}
                onClick={() => onNavigate(questionIndex)}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${bgColor} hover:opacity-90`}
                aria-label={`Go to question ${questionIndex + 1}`}
                title={
                  feedback?.isCorrect
                    ? 'Resposta Correta'
                    : feedback
                      ? 'Resposta Incorreta'
                      : 'Ir para Questão'
                }
              >
                {questionIndex + 1}
              </button>
            );
          })}
        </div>

        {/* Right arrow */}
        {showRightArrow && (
          <button
            onClick={() =>
              setManualOffset(
                Math.min(
                  totalQuestions - visibleCount,
                  validStartIndex + visibleCount,
                ),
              )
            }
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
            aria-label="Next questions"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {isCompact && (
        <div className="text-muted-foreground mt-1 text-center text-xs">
          Mostrando {validStartIndex + 1}-{validStartIndex + visibleQuestions}{' '}
          de {totalQuestions} questões
        </div>
      )}
    </div>
  );
}
