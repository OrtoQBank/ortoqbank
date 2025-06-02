'use client';

import { InfoIcon as InfoCircle } from 'lucide-react';

import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type QuestionModeSelectorProps = {
  value: string;
  onChange: (value: 'all' | 'incorrect' | 'unanswered' | 'bookmarked') => void;
  error?: string;
};

export function QuestionModeSelector({
  value,
  onChange,
  error,
}: QuestionModeSelectorProps) {
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
        {[
          { id: 'all', label: 'Todas', apiKey: 'all' },
          {
            id: 'unanswered',
            label: 'Não respondidas',
            apiKey: 'unanswered',
          },
          { id: 'incorrect', label: 'Incorretas', apiKey: 'incorrect' },
          { id: 'bookmarked', label: 'Marcadas', apiKey: 'bookmarked' },
        ].map(({ id, label, apiKey }) => {
          return (
            <div key={id} className="flex items-center gap-2">
              <RadioGroupItem id={id} value={id} />
              <Label htmlFor={id} className="flex items-center gap-2">
                <span>{label}</span>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
