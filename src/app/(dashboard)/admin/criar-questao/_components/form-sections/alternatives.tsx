'use client';

import { useEffect } from 'react';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormLabel } from '@/components/ui/form';
import { toast } from '@/hooks/use-toast';

import { QuestionOption } from '../question-option';
import { QuestionFormData } from '../schema';

interface AlternativesProps {
  form: UseFormReturn<QuestionFormData>;
}

export function Alternatives({ form }: AlternativesProps) {
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'alternatives',
  } as any);

  // Ensure field array is initialized with default values
  useEffect(() => {
    if (fields.length < 2) {
      replace(['', '', '', '']);
    }
  }, [fields.length, replace]);

  const handleAddAlternative = () => {
    // Check if the last alternative is empty
    const alternatives = form.getValues('alternatives');
    const lastAlternative = alternatives.at(-1);

    if (lastAlternative !== undefined && lastAlternative.trim() === '') {
      toast({
        title: 'Preencha a última alternativa',
        description: 'A última alternativa não pode estar vazia',
        variant: 'destructive',
      });
      return;
    }

    if (fields.length < 6) {
      append('');
    } else {
      toast({
        title: 'Máximo de 6 alternativas atingido',
        description: 'Você pode adicionar até 6 alternativas',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveAlternative = () => {
    if (fields.length > 2) {
      remove(fields.length - 1);
    } else {
      toast({
        title: 'Mínimo de 2 alternativas atingido',
        description: 'Você deve adicionar pelo menos 2 alternativas',
        variant: 'destructive',
      });
    }
  };

  const correctAlternativeError = form.formState.errors.correctAlternativeIndex;

  return (
    <div className="space-y-2">
      <FormLabel>Alternativas</FormLabel>
      <Card>
        <CardContent className="space-y-2 p-2">
          {fields.map((field, index) => (
            <QuestionOption
              key={field.id}
              control={form.control}
              index={index}
              isSelected={form.watch('correctAlternativeIndex') === index}
              onSelect={() =>
                form.setValue('correctAlternativeIndex', index, {
                  shouldValidate: true,
                })
              }
            />
          ))}
        </CardContent>
      </Card>
      {correctAlternativeError && (
        <p className="text-destructive text-sm font-medium">
          {correctAlternativeError.message}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          type="button"
          size="sm"
          onClick={handleAddAlternative}
        >
          Adicionar Alternativa
        </Button>
        <Button
          variant="outline"
          type="button"
          size="sm"
          onClick={handleRemoveAlternative}
        >
          Remover Alternativa
        </Button>
      </div>
    </div>
  );
}
