'use client';

import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';

import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { FeedbackModal } from './form/modals/FeedbackModal';
import { NameModal } from './form/modals/NameModal';
import { QuestionCountSelector } from './form/QuestionCountSelector';
import { QuestionModeSelector } from './form/QuestionModeSelector';
import { SubthemeSelector } from './form/SubthemeSelector';
import { TestModeSelector } from './form/TestModeSelector';
import { ThemeSelector } from './form/ThemeSelector';
import { useTestFormState } from './hooks/useTestFormState';
import { type TestFormData } from './schema';

export default function TestForm() {
  const router = useRouter();
  const [showNameModal, setShowNameModal] = useState(false);
  const [formData, setFormData] = useState<TestFormData | undefined>();
  const [submissionState, setSubmissionState] = useState<
    | 'idle'
    | 'loading'
    | 'success'
    | 'error'
    | 'no-questions'
    | 'validation-error'
  >('idle');
  const [resultMessage, setResultMessage] = useState<{
    title: string;
    description: string;
  }>({
    title: '',
    description: '',
  });
  const [successData, setSuccessData] = useState<{
    quizId: string;
    questionCount: number;
  } | null>(null);

  // Use the direct mutation instead of the workflow
  const createQuiz = useMutation(api.customQuizCreation.create);

  // Custom hook for form state and logic
  const {
    form,
    handleSubmit,
    control,
    getCurrentQuestionCount,
    tenantId,
    hierarchicalData,
    mapQuestionMode,
    isAuthenticated,
    isLoading,
  } = useTestFormState();

  const onSubmit = async (data: TestFormData) => {
    setFormData(data);
    setShowNameModal(true);
  };

  const submitWithName = useCallback(
    async (testName: string) => {
      if (!formData) return;

      try {
        setSubmissionState('loading');

        // Build pre-computed parent relationships from cached hierarchicalData
        // This eliminates DB reads in the backend for computing effective hierarchy
        const groupParents: Record<
          string,
          { subthemeId: Id<'subthemes'>; themeId: Id<'themes'> }
        > = {};
        const subthemeParents: Record<string, { themeId: Id<'themes'> }> = {};

        if (hierarchicalData) {
          // Build subtheme -> themeId lookup
          const subthemeToTheme = new Map<string, Id<'themes'>>();
          for (const subtheme of hierarchicalData.subthemes || []) {
            subthemeToTheme.set(subtheme._id, subtheme.themeId as Id<'themes'>);
            subthemeParents[subtheme._id] = {
              themeId: subtheme.themeId as Id<'themes'>,
            };
          }

          // Build group -> (subthemeId, themeId) lookup
          for (const group of hierarchicalData.groups || []) {
            const themeId = subthemeToTheme.get(group.subthemeId);
            if (themeId) {
              groupParents[group._id] = {
                subthemeId: group.subthemeId as Id<'subthemes'>,
                themeId,
              };
            }
          }
        }

        // Validate tenantId is available
        if (!tenantId) {
          throw new Error('Tenant not available. Please refresh the page.');
        }

        // Use the direct mutation (no workflow)
        const result = await createQuiz({
          tenantId,
          name: testName,
          description: `Teste criado em ${new Date().toLocaleDateString()}`,
          testMode: formData.testMode,
          questionMode: mapQuestionMode(formData.questionMode),
          numQuestions: formData.numQuestions,
          selectedThemes: formData.selectedThemes as Id<'themes'>[],
          selectedSubthemes: formData.selectedSubthemes as Id<'subthemes'>[],
          selectedGroups: formData.selectedGroups as Id<'groups'>[],
          // Pre-computed parent relationships (optimization)
          groupParents: groupParents as Record<
            Id<'groups'>,
            { subthemeId: Id<'subthemes'>; themeId: Id<'themes'> }
          >,
          subthemeParents: subthemeParents as Record<
            Id<'subthemes'>,
            { themeId: Id<'themes'> }
          >,
        });

        setShowNameModal(false);

        // Handle result based on success flag
        if (result.success) {
          setSuccessData({
            quizId: result.quizId,
            questionCount: result.questionCount,
          });
          setResultMessage({
            title: 'Quiz criado com sucesso!',
            description: `Seu teste foi criado com ${result.questionCount} questões.`,
          });
          setSubmissionState('success');
        } else {
          // No questions found
          setSubmissionState('no-questions');
          setResultMessage({
            title: 'Nenhuma questão encontrada',
            description: result.message,
          });
        }
      } catch (error) {
        console.error('Erro ao criar quiz:', error);
        setSubmissionState('error');

        if (error instanceof Error) {
          setResultMessage({
            title: 'Erro ao criar quiz',
            description: error.message || 'Ocorreu um erro ao criar o quiz.',
          });
        } else {
          setResultMessage({
            title: 'Erro ao criar quiz',
            description: 'Ocorreu um erro ao criar o quiz.',
          });
        }
        setShowNameModal(false);
      }
    },
    [formData, createQuiz, mapQuestionMode, hierarchicalData, tenantId],
  );

  // Memoized form handlers (same as v1)
  const handleTestModeChange = useCallback(
    (value: 'study' | 'exam') => {
      form.setValue('testMode', value, { shouldValidate: true });
    },
    [form],
  );

  const handleQuestionModeChange = useCallback(
    (value: 'all' | 'incorrect' | 'unanswered' | 'bookmarked') => {
      form.setValue('questionMode', value, { shouldValidate: true });
    },
    [form],
  );

  const handleToggleTheme = useCallback(
    (themeId: string) => {
      const current = form.getValues('selectedThemes') || [];
      form.setValue(
        'selectedThemes',
        current.includes(themeId)
          ? current.filter(id => id !== themeId)
          : [...current, themeId],
        { shouldValidate: true },
      );
    },
    [form],
  );

  const handleToggleSubtheme = useCallback(
    (subthemeId: string) => {
      const current = form.getValues('selectedSubthemes') || [];
      form.setValue(
        'selectedSubthemes',
        current.includes(subthemeId)
          ? current.filter(id => id !== subthemeId)
          : [...current, subthemeId],
        { shouldValidate: true },
      );
    },
    [form],
  );

  const handleToggleGroup = useCallback(
    (groupId: string) => {
      const current = form.getValues('selectedGroups') || [];
      form.setValue(
        'selectedGroups',
        current.includes(groupId)
          ? current.filter(id => id !== groupId)
          : [...current, groupId],
        { shouldValidate: true },
      );
    },
    [form],
  );

  const handleToggleMultipleGroups = useCallback(
    (groupIds: string[]) => {
      const current = form.getValues('selectedGroups') || [];
      const updatedGroups = new Set(current);

      groupIds.forEach(groupId => {
        if (updatedGroups.has(groupId)) {
          updatedGroups.delete(groupId);
        } else {
          updatedGroups.add(groupId);
        }
      });

      form.setValue('selectedGroups', [...updatedGroups], {
        shouldValidate: true,
      });
    },
    [form],
  );

  const handleQuestionCountChange = useCallback(
    (value: number) => {
      form.setValue('numQuestions', value, { shouldValidate: true });
    },
    [form],
  );

  // Memoized sorted data
  const sortedThemes = useMemo(
    () =>
      ([...(hierarchicalData?.themes || [])] as any[]).toSorted(
        (a: any, b: any) => (a.name || '').localeCompare(b.name || ''),
      ),
    [hierarchicalData?.themes],
  );

  const sortedSubthemes = useMemo(
    () =>
      ([...(hierarchicalData?.subthemes || [])] as any[]).toSorted(
        (a: any, b: any) => (a.name || '').localeCompare(b.name || ''),
      ),
    [hierarchicalData?.subthemes],
  );

  const sortedGroups = useMemo(
    () =>
      ([...(hierarchicalData?.groups || [])] as any[]).toSorted(
        (a: any, b: any) => (a.name || '').localeCompare(b.name || ''),
      ),
    [hierarchicalData?.groups],
  );

  // Show loading state while authentication is being checked
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <div className="text-center">
          <div className="border-t-brand-blue mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  const isProcessing = submissionState === 'loading';

  return (
    <>
      <form
        onSubmit={e => {
          const currentValues = form.getValues();
          const questionMode = currentValues.questionMode;
          const hasFilters =
            (currentValues.selectedThemes?.length || 0) > 0 ||
            (currentValues.selectedSubthemes?.length || 0) > 0 ||
            (currentValues.selectedGroups?.length || 0) > 0;

          // For "all" and "unanswered" modes, require at least one filter
          if (
            (questionMode === 'all' || questionMode === 'unanswered') &&
            !hasFilters
          ) {
            e.preventDefault();
            setSubmissionState('validation-error');
            setResultMessage({
              title: 'Seleção obrigatória',
              description:
                'Para os modos "Todas" e "Não respondidas", você deve selecionar pelo menos um tema, subtema ou grupo.',
            });
            return;
          }

          const currentQuestionCount = getCurrentQuestionCount();
          if (!isLoading && currentQuestionCount === 0) {
            e.preventDefault();
            setSubmissionState('no-questions');
            setResultMessage({
              title: 'Nenhuma questão encontrada',
              description:
                'Não há questões disponíveis com os filtros selecionados. Tente ajustar os filtros ou selecionar temas diferentes.',
            });
          } else {
            handleSubmit(onSubmit)(e);
          }
        }}
      >
        {/* Modals */}
        <NameModal
          isOpen={showNameModal}
          onClose={() => setShowNameModal(false)}
          onSubmit={submitWithName}
        />

        <FeedbackModal
          isOpen={
            submissionState === 'error' ||
            submissionState === 'no-questions' ||
            submissionState === 'validation-error' ||
            submissionState === 'success'
          }
          onClose={() => {
            if (
              submissionState === 'error' ||
              submissionState === 'no-questions' ||
              submissionState === 'validation-error'
            ) {
              setSubmissionState('idle');
            }
          }}
          state={submissionState}
          message={resultMessage}
          questionCount={successData?.questionCount}
          onStartQuiz={
            successData
              ? () => router.push(`/criar-teste/${successData.quizId}`)
              : undefined
          }
        />

        <div className="space-y-12 sm:space-y-14">
          {/* Test Mode Section */}
          <TestModeSelector control={control} onChange={handleTestModeChange} />

          {/* Question Mode Section */}
          <QuestionModeSelector
            control={control}
            onChange={handleQuestionModeChange}
            error={form.formState.errors.questionMode?.message}
          />

          {/* Themes Section */}
          <ThemeSelector
            control={control}
            themes={sortedThemes}
            onToggleTheme={handleToggleTheme}
            error={form.formState.errors.selectedThemes?.message}
          />

          {/* Subthemes Section */}
          <SubthemeSelector
            control={control}
            themes={sortedThemes}
            subthemes={sortedSubthemes}
            groups={sortedGroups}
            onToggleSubtheme={handleToggleSubtheme}
            onToggleGroup={handleToggleGroup}
            onToggleMultipleGroups={handleToggleMultipleGroups}
          />

          {/* Question Count Section */}
          <QuestionCountSelector
            control={control}
            onChange={handleQuestionCountChange}
            error={form.formState.errors.numQuestions?.message}
          />

          <Button
            type="submit"
            className="bg-brand-blue hover:bg-brand-blue/90 w-full cursor-pointer"
            disabled={isProcessing}
          >
            {isProcessing ? 'Gerando seu teste...' : 'Gerar Teste'}
          </Button>
        </div>
      </form>
    </>
  );
}
