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
        max={120}
        {...register('totalQuestions', {
          required: 'Este campo é obrigatório',
          min: { value: 1, message: 'Mínimo 1 questão' },
          max: { value: 120, message: 'Máximo 120 questões' },
        })}
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
