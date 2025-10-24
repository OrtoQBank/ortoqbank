import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface QuizProgressProps {
  currentIndex: number;
  totalQuestions: number;
  mode: 'study' | 'exam';
  onNavigate?: (index: number) => void;
  answerFeedback?: Array<{ isCorrect: boolean } | undefined>;
  visibleCount?: number; // Number of questions to show at once
}

export default function QuizProgress({
  currentIndex,
  totalQuestions,
  mode,
  onNavigate,
  answerFeedback = [],
  visibleCount = 5, // Default to showing 5 questions at a time
}: QuizProgressProps) {
  const isExamMode = mode === 'exam';

  // State to track the first visible question index
  const [startIndex, setStartIndex] = useState(0);

  // Find the furthest answered question index
  const furthestAnsweredIndex = answerFeedback.reduce(
    (maxIndex, feedback, index) =>
      feedback ? Math.max(maxIndex, index) : maxIndex,
    -1,
  );

  // Next allowed question is the one after the furthest answered
  const maxAllowedIndex = Math.min(
    furthestAnsweredIndex + 1,
    totalQuestions - 1,
  );

  // Ensure current question is visible initially, but not after user manually navigates
  useEffect(() => {
    // Only auto-adjust when the current question changes, not when startIndex changes
    if (
      currentIndex < startIndex ||
      currentIndex >= startIndex + visibleCount
    ) {
      setStartIndex(
        Math.max(0, Math.min(currentIndex, totalQuestions - visibleCount)),
      );
    }
  }, [currentIndex, totalQuestions, visibleCount]);

  // Make sure start index is valid
  const validStartIndex = Math.max(
    0,
    Math.min(
      startIndex,
      totalQuestions - Math.min(totalQuestions, visibleCount),
    ),
  );

  // Check if we need navigation arrows
  const showLeftArrow = validStartIndex > 0;
  const showRightArrow = validStartIndex + visibleCount < totalQuestions;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Questão {currentIndex + 1}</h1>
        <p className="text-muted-foreground text-sm">
          {currentIndex + 1} de {totalQuestions}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* Left arrow */}
        {showLeftArrow && (
          <button
            onClick={() =>
              setStartIndex(Math.max(0, validStartIndex - visibleCount))
            }
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
            aria-label="Previous questions"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
        )}

        {/* Visible question buttons */}
        {Array.from(
          { length: Math.min(visibleCount, totalQuestions - validStartIndex) },
          (_, i) => {
            const questionIndex = validStartIndex + i;
            const isNavigable = !isExamMode && questionIndex <= maxAllowedIndex;

            // Determine button color based on answer status
            let buttonColorClass;

            if (isExamMode) {
              // In exam mode, keep all buttons grey but use darker grey for answered questions
              if (answerFeedback[questionIndex]) {
                // Answered question - darker grey
                buttonColorClass =
                  currentIndex === questionIndex
                    ? 'ring-2 ring-offset-1 ring-brand-blue bg-gray-300 text-gray-800'
                    : 'bg-gray-300 text-gray-800';
              } else {
                // Unanswered question - lighter grey
                buttonColorClass =
                  currentIndex === questionIndex
                    ? 'ring-2 ring-offset-1 ring-brand-blue bg-gray-100'
                    : 'bg-gray-100 text-gray-700';
              }
            } else {
              // In study mode, show colors based on answer feedback
              buttonColorClass =
                currentIndex === questionIndex
                  ? 'ring-2 ring-offset-1 ring-brand-blue bg-brand-blue/10'
                  : 'bg-gray-100';

              if (answerFeedback[questionIndex]) {
                buttonColorClass =
                  currentIndex === questionIndex
                    ? 'ring-2 ring-offset-1 ring-brand-blue ' +
                      (answerFeedback[questionIndex]?.isCorrect
                        ? 'bg-green-100'
                        : 'bg-red-100')
                    : answerFeedback[questionIndex]?.isCorrect
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800';
              } else if (currentIndex !== questionIndex) {
                buttonColorClass = isNavigable
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-gray-100 text-gray-400'; // Disabled look
              }
            }

            return (
              <button
                key={questionIndex}
                onClick={() => isNavigable && onNavigate?.(questionIndex)}
                disabled={!isNavigable || isExamMode}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${buttonColorClass} ${
                  isNavigable ? 'cursor-pointer' : 'cursor-default'
                }`}
                aria-label={`Go to question ${questionIndex + 1}`}
              >
                {questionIndex + 1}
              </button>
            );
          },
        )}

        {/* Right arrow */}
        {showRightArrow && (
          <button
            onClick={() =>
              setStartIndex(
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
    </div>
  );
}
