'use client';

import { InfoIcon as InfoCircle } from 'lucide-react';
import { memo } from 'react';
import { type Control, useWatch } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { TestFormData } from '../schema';

type QuestionCountSelectorProps = {
  control: Control<TestFormData>;
  onChange: (value: number) => void;
  error?: string;
};

export const QuestionCountSelector = memo(function QuestionCountSelector({
  control,
  onChange,
  error,
}: QuestionCountSelectorProps) {
  const value = useWatch({ control, name: 'numQuestions' });
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium">Quantidade Máxima de Questões</h3>
          <Popover>
            <PopoverTrigger asChild>
              <InfoCircle className="text-muted-foreground h-4 w-4 cursor-pointer" />
            </PopoverTrigger>
            <PopoverContent className="max-w-xs border border-black">
              <p>
                Defina o número máximo de questões para o seu teste (entre 1 e
                120). O teste terá no máximo este número de questões, ou o total
                de questões disponíveis se for menor.
              </p>
            </PopoverContent>
          </Popover>
        </div>
        <div className="w-24">
          <Input
            type="number"
            min={1}
            max={120}
            value={value || ''}
            onChange={e => {
              const inputValue = e.target.value;

              // Allow empty value (user cleared the field)
              if (inputValue === '') {
                onChange(0); // or use null/undefined based on your type system
                return;
              }

              const newValue = Number.parseInt(inputValue);
              if (!Number.isNaN(newValue)) {
                // Clamp the value between 1 and 120 for valid numbers
                onChange(Math.min(Math.max(newValue, 1), 120));
              }
            }}
          />
        </div>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
});
