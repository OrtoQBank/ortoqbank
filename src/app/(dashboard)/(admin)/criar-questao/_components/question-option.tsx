import { type Control } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { QuestionFormData } from './schema';

const ASCII_UPPERCASE_A = 65;

export function QuestionOption({
  control,
  index,
  isSelected,
  onSelect,
}: {
  control: Control<QuestionFormData>;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={isSelected ? 'default' : 'outline'}
        size="sm"
        onClick={onSelect}
      >
        {String.fromCodePoint(ASCII_UPPERCASE_A + index)}
      </Button>
      <FormField
        control={control}
        name={`alternatives.${index}`}
        render={({ field }) => (
          <FormItem className="flex-1">
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
