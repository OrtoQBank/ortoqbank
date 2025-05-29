import { CheckCircle2Icon, XCircleIcon } from 'lucide-react';

import { AlternativeIndex } from './types';

interface QuizAlternativesProps {
  alternatives: string[];
  selectedAlternative: AlternativeIndex | undefined;
  onSelect: (index: AlternativeIndex) => void;
  disabled: boolean;
  showFeedback?: boolean;
  correctAlternative?: AlternativeIndex;
}

export default function QuizAlternatives({
  alternatives,
  selectedAlternative,
  onSelect,
  disabled,
  showFeedback = false,
  correctAlternative,
}: QuizAlternativesProps) {
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
              onClick={() => onSelect(i as AlternativeIndex)}
              disabled={disabled}
              className={`w-full rounded-lg border p-4 text-left hover:bg-gray-50 ${borderClass} relative`}
            >
              <div className="flex items-center">
                <div>{alternative}</div>
                {showCorrectIcon && (
                  <CheckCircle2Icon className="ml-2 h-5 w-5 flex-shrink-0 text-green-600" />
                )}
                {showIncorrectIcon && (
                  <XCircleIcon className="ml-2 h-5 w-5 flex-shrink-0 text-red-600" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
