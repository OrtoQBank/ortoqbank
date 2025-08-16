'use client';

import { InfoIcon as InfoCircle } from 'lucide-react';
import { memo, useMemo } from 'react';
import { type Control, useWatch } from 'react-hook-form';

import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import { useFormContext } from '../context/FormContext';
import { TestFormData } from '../schema';

type QuestionModeSelectorProps = {
  control: Control<TestFormData>;
  onChange: (value: 'all' | 'incorrect' | 'unanswered' | 'bookmarked') => void;
  error?: string;
};

type ModeKey = 'all' | 'unanswered' | 'incorrect' | 'bookmarked';

export const QuestionModeSelector = memo(function QuestionModeSelector({
  control,
  onChange,
  error,
}: QuestionModeSelectorProps) {
  const value = useWatch({ control, name: 'questionMode' });
  const { isLoading, calculateQuestionCounts } = useFormContext();

  // Memoized counts calculation (global counts - don't change with selections)
  const counts = useMemo(() => {
    if (isLoading) return null;

    // Call with empty arrays to get global counts only
    const result = calculateQuestionCounts([], [], []);

    return typeof result === 'object' ? result : null;
  }, [calculateQuestionCounts, isLoading]);

  const options: { id: string; label: string; apiKey: ModeKey }[] = [
    { id: 'all', label: 'Todas', apiKey: 'all' },
    { id: 'unanswered', label: 'Não respondidas', apiKey: 'unanswered' },
    { id: 'incorrect', label: 'Incorretas', apiKey: 'incorrect' },
    { id: 'bookmarked', label: 'Marcadas', apiKey: 'bookmarked' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">Questões</h3>
        <Popover>
          <PopoverTrigger asChild>
            <InfoCircle className="text-muted-foreground h-4 w-4 cursor-pointer" />
          </PopoverTrigger>
          <PopoverContent className="max-w-xs border border-black">
            <p>
              Filtre as questões por status: Todas, Não respondidas, Incorretas
              ou Marcadas.
            </p>
          </PopoverContent>
        </Popover>
      </div>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="flex flex-wrap gap-4"
      >
        {options.map(({ id, label, apiKey }) => (
          <div key={id} className="flex items-center gap-2">
            <RadioGroupItem id={id} value={id} />
            <Label htmlFor={id} className="flex items-center gap-2">
              <span>{label}</span>
              <span className="text-muted-foreground text-xs">
                {isLoading ? '...' : (counts?.[apiKey] ?? 0)}
              </span>
            </Label>
          </div>
        ))}
      </RadioGroup>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
});
