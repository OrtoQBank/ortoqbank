'use client';

import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { FormProvider, useForm } from 'react-hook-form';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { api } from '../../../../../../convex/_generated/api';
import { DebugPanel } from './DebugPanel';
import { FilterRadioGroup } from './FilterRadioGroup';
import { FormActions } from './FormActions';
import { FormSubmissionStatus } from './FormSubmissionStatus';
import { ModeToggle } from './ModeToggle';
import { QuestionCountInput } from './QuestionCountInput';
import TaxFilter from './TaxFilter';

type FormData = {
  mode: 'exam' | 'study';
  filter: 'all' | 'unanswered' | 'incorrect' | 'bookmarked';
  taxonomySelection: string[];
  totalQuestions: number;
};

export function TestFormClient() {
  const router = useRouter();
  const createCustomQuiz = useMutation(api.customQuizzes.create);

  const methods = useForm<FormData>({
    defaultValues: {
      mode: 'exam',
      filter: 'all',
      taxonomySelection: [],
      totalQuestions: 20,
    },
  });

  const { handleSubmit } = methods;

  const onSubmit = async (data: FormData) => {
    try {
      const result = await createCustomQuiz({
        name: `Teste ${data.mode === 'exam' ? 'Exame' : 'Estudo'}`,
        description: `Teste criado em`,
        testMode: data.mode,
        questionMode: data.filter,
        numQuestions: data.totalQuestions,
        selectedThemes: [],
        selectedSubthemes: [],
        selectedGroups: [],
      });

      if (result.quizId) {
        router.push(`/criar-teste-2/${result.quizId}`);
      }
    } catch (error) {
      console.error('Erro ao criar teste:', error);
    }
  };

  return (
    <FormProvider {...methods}>
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Criar Novo Teste</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <ModeToggle />

            <FilterRadioGroup />

            <div className="space-y-3">
              <TaxFilter />
            </div>

            <QuestionCountInput />

            <FormSubmissionStatus />

            <FormActions
              submitText="Criar Teste"
              resetText="Limpar Formulário"
              onReset={() => console.log('Form reset')}
            />
          </form>
        </CardContent>
      </Card>

      <DebugPanel />
    </FormProvider>
  );
}
