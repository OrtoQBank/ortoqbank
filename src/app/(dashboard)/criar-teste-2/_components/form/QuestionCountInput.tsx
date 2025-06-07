import { useFormContext } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function QuestionCountInput() {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <div className="space-y-3">
      <Label htmlFor="totalQuestions" className="text-base font-medium">
        Total de Questões
      </Label>
      <Input
        id="totalQuestions"
        type="number"
        min={1}
        max={200}
        {...register('totalQuestions')}
        className="w-full"
      />
      {errors.totalQuestions && (
        <p className="text-sm text-red-600">
          {errors.totalQuestions.message as string}
        </p>
      )}
    </div>
  );
}
