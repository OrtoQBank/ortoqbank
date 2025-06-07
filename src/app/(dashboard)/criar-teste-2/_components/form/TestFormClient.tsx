'use client';

import { useMutation } from 'convex/react';
import { type Preloaded, usePreloadedQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { FormProvider, useForm } from 'react-hook-form';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { api } from '../../../../../../convex/_generated/api';
import { DebugPanel } from './DebugPanel';
import { FilterRadioGroup } from './FilterRadioGroup';
import { FormActions } from './FormActions';
import { FormSubmissionStatus } from './FormSubmissionStatus';
import {
  useQuizPayload,
  useTaxonomyProcessor,
} from './hooks/useTaxonomyProcessor';
import { ModeToggle } from './ModeToggle';
import { QuestionCountInput } from './QuestionCountInput';
import TaxFilter from './TaxFilter';
import type { TaxonomyItem } from './utils/taxonomyProcessor';

type FormData = {
  mode: 'exam' | 'study';
  filter: 'all' | 'unanswered' | 'incorrect' | 'bookmarked';
  taxonomySelection: TaxonomyItem[];
  totalQuestions: number;
};

export function TestFormClient() {
  const router = useRouter();
  const createCustomQuiz = useMutation(api.customQuizzesV2.create);

  const methods = useForm<FormData>({
    defaultValues: {
      mode: 'exam',
      filter: 'all',
      taxonomySelection: [],
      totalQuestions: 20,
    },
  });

  const { handleSubmit, watch } = methods;

  const taxonomySelection = watch('taxonomySelection');

  const {
    processedTaxonomy,
    isValid: isTaxonomyValid,
    summary,
  } = useTaxonomyProcessor(taxonomySelection, {
    mode: 'simple',
    debug: process.env.NODE_ENV === 'development',
  });

  const createPayload = useQuizPayload();

  const onSubmit = async (data: FormData) => {
    try {
      const payload = createPayload(
        {
          name: `Teste ${data.mode === 'exam' ? 'Exame' : 'Estudo'}`,
          description: `Teste criado em ${new Date().toLocaleDateString()}`,
          mode: data.mode,
          filter: data.filter,
          totalQuestions: data.totalQuestions,
        },
        processedTaxonomy,
      );

      console.log('📤 Sending payload:', payload);

      const result = await createCustomQuiz(payload);

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
          {processedTaxonomy.selectedTaxThemes.length > 0 ||
          processedTaxonomy.selectedTaxSubthemes.length > 0 ||
          processedTaxonomy.selectedTaxGroups.length > 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">🎯 {summary}</p>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">
              📚 Todas as questões disponíveis serão incluídas
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <ModeToggle />

            <FilterRadioGroup />

            <div className="space-y-3">
              <TaxFilter />
            </div>

            <QuestionCountInput />

            {process.env.NODE_ENV === 'development' &&
              taxonomySelection.length > 0 && (
                <div className="rounded-lg bg-blue-50 p-4 text-sm">
                  <h4 className="mb-2 font-medium text-blue-900">
                    Taxonomy Processing (Dev Mode)
                  </h4>
                  <div className="space-y-1 text-blue-700">
                    <p>Themes: {processedTaxonomy.selectedTaxThemes.length}</p>
                    <p>
                      Subthemes: {processedTaxonomy.selectedTaxSubthemes.length}
                    </p>
                    <p>Groups: {processedTaxonomy.selectedTaxGroups.length}</p>
                    <p>Valid: {isTaxonomyValid ? '✅' : '❌'}</p>
                  </div>
                </div>
              )}

            <FormSubmissionStatus />

            <FormActions
              submitText="Criar Teste"
              resetText="Limpar Formulário"
              onReset={() => {
                methods.reset();
                console.log('Form reset');
              }}
            />
          </form>
        </CardContent>
      </Card>

      <DebugPanel />
    </FormProvider>
  );
}
