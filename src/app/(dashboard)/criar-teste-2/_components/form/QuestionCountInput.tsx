import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface QuestionCountInputProps {
  register: any; // Simplified to avoid complex typing
  error?: string;
}

export function QuestionCountInput({
  register,
  error,
}: QuestionCountInputProps) {
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
        {...register}
        className="w-full"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
