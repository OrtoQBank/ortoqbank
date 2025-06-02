'use client';

import { useMutation, usePreloadedQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

import { api } from '../../../../../../convex/_generated/api';
import { DebugPanel } from './DebugPanel';
import { FilterRadioGroup } from './FilterRadioGroup';
import { ModeToggle } from './ModeToggle';
import { QuestionCountInput } from './QuestionCountInput';
import { TaxonomyFilter } from './TaxonomyFilter';

type FormData = {
  mode: 'exam' | 'study';
  filter: 'all' | 'unanswered' | 'incorrect' | 'bookmarked';
  taxonomySelection: string[];
  totalQuestions: number;
};

interface TestFormClientProps {
  preloadedTaxonomy: any; // Simplified for now
}

export function TestFormClient({ preloadedTaxonomy }: TestFormClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taxonomySelection, setTaxonomySelection] = useState<string[]>([]);

  const taxonomyData = usePreloadedQuery(preloadedTaxonomy);
  const createCustomQuiz = useMutation(api.customQuizzes.create);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      mode: 'exam',
      filter: 'all',
      totalQuestions: 20,
    },
  });

  const mode = watch('mode');
  const filter = watch('filter');
  const totalQuestions = watch('totalQuestions');

  // Watch all form data for debug panel
  const formData = {
    mode,
    filter,
    taxonomySelection,
    totalQuestions,
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      const result = await createCustomQuiz({
        name: `Teste ${mode === 'exam' ? 'Exame' : 'Estudo'} - ${new Date().toLocaleDateString()}`,
        description: `Teste criado em ${new Date().toLocaleDateString()}`,
        testMode: data.mode,
        questionMode: data.filter,
        numQuestions: data.totalQuestions,
        selectedThemes: [],
        selectedSubthemes: [],
        selectedGroups: [],
      });

      if (result.quizId) {
        router.push(`/criar-teste/${result.quizId}`);
      }
    } catch (error) {
      console.error('Erro ao criar teste:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Criar Novo Teste</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <ModeToggle
              value={mode}
              onChange={value => setValue('mode', value)}
            />

            <FilterRadioGroup
              value={filter}
              onChange={value => setValue('filter', value)}
            />

            <div className="space-y-3">
              <Label className="text-base font-medium">
                Filtros de Taxonomia
              </Label>
              <TaxonomyFilter
                selectedItems={taxonomySelection}
                onSelectionChange={setTaxonomySelection}
              />
            </div>

            <QuestionCountInput
              register={register('totalQuestions', {
                required: 'Este campo é obrigatório',
                min: { value: 1, message: 'Mínimo 1 questão' },
                max: { value: 120, message: 'Máximo 120 questões' },
              })}
              error={errors.totalQuestions?.message}
            />

            <Button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Criando teste...' : 'Criar Teste'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <DebugPanel
        formData={formData}
        taxonomySelection={taxonomySelection}
        errors={errors}
      />
    </>
  );
}
