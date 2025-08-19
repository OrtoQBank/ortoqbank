import { CheckCircle2Icon, XCircleIcon } from 'lucide-react';
import { useEffect } from 'react';

import { AlternativeIndex } from './types';

interface QuizAlternativesProps {
  alternatives: string[];
  selectedAlternative: AlternativeIndex | undefined;
  onSelect: (index: AlternativeIndex) => void;
  onSubmit?: () => void;
  onNext?: () => void;
  hasAnswered?: boolean;
  disabled: boolean;
  showFeedback?: boolean;
  correctAlternative?: AlternativeIndex;
}

export default function QuizAlternatives({
  alternatives,
  selectedAlternative,
  onSelect,
  onSubmit,
  onNext,
  hasAnswered = false,
  disabled,
  showFeedback = false,
  correctAlternative,
}: QuizAlternativesProps) {
  // Remove complex focus state management to avoid conflicts

  // Add keyboard navigation for selecting alternatives
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard input if the component is not disabled
      if (disabled) return;

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          const newIndex =
            selectedAlternative === undefined
              ? 0
              : Math.min(selectedAlternative + 1, alternatives.length - 1);
          onSelect(newIndex as AlternativeIndex);
          break;
        }

        case 'ArrowUp': {
          event.preventDefault();
          const newIndex =
            selectedAlternative === undefined
              ? alternatives.length - 1
              : Math.max(selectedAlternative - 1, 0);
          onSelect(newIndex as AlternativeIndex);
          break;
        }

        case ' ':
        case 'Enter': {
          event.preventDefault();
          if (hasAnswered && onNext) {
            // If already answered, space/enter goes to next question
            onNext();
          } else if (onSubmit && selectedAlternative !== undefined) {
            // If not answered yet and has selection, space/enter submits the answer
            onSubmit();
          }
          break;
        }

        case '1':
        case '2':
        case '3':
        case '4': {
          // Number key shortcuts (1-4)
          const keyNumber = Number.parseInt(event.key);
          if (keyNumber <= alternatives.length) {
            event.preventDefault();
            const alternativeIndex = (keyNumber - 1) as AlternativeIndex;
            onSelect(alternativeIndex);
          }
          break;
        }
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    alternatives.length,
    disabled,
    onSelect,
    onSubmit,
    onNext,
    hasAnswered,
    selectedAlternative,
  ]);

  return (
    <div>
      <h2 className="my-2 border-t pt-4 font-semibold">Alternativas:</h2>
      <div className="mt-4 space-y-2">
        {alternatives.map((alternative, i) => {
          // Determine the appropriate styling for each alternative
          let borderClass = '';
          let showCorrectIcon = false;
          let showIncorrectIcon = false;

          if (showFeedback && selectedAlternative !== undefined) {
            if (i === correctAlternative) {
              // Correct answer gets green
              borderClass = 'border-green-500 bg-green-50';
              showCorrectIcon = true;
            } else if (i === selectedAlternative && i !== correctAlternative) {
              // Selected incorrect answer gets red
              borderClass = 'border-red-500 bg-red-50';
              showIncorrectIcon = true;
            }
          } else if (selectedAlternative === i) {
            // Default selected style when not showing feedback
            borderClass = 'border-blue-500 bg-blue-50';
          }

          return (
            <button
              key={i}
              onClick={e => {
                e.preventDefault();
                e.currentTarget.blur(); // Remove DOM focus immediately
                onSelect(i as AlternativeIndex);
              }}
              onMouseDown={e => e.preventDefault()} // Prevent focus on mouse down
              disabled={disabled}
              className={`w-full rounded-lg border p-4 text-left hover:bg-gray-50 ${borderClass} relative transition-all duration-150 focus:ring-0 focus:outline-none`}
            >
              <div className="flex items-center">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-700">
                    {String.fromCodePoint(65 + i)}
                  </span>
                  <div>{alternative}</div>
                </div>
                <div className="ml-auto flex items-center">
                  {showCorrectIcon && (
                    <CheckCircle2Icon className="h-5 w-5 flex-shrink-0 text-green-600" />
                  )}
                  {showIncorrectIcon && (
                    <XCircleIcon className="h-5 w-5 flex-shrink-0 text-red-600" />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
