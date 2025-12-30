'use client';

import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';

import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { useTestFormState } from '../../criar-teste/_components/hooks/useTestFormState';
import { type TestFormData } from '../../criar-teste/_components/schema';
import { FeedbackModal } from '../../criar-teste/_components/form/modals/FeedbackModal';
import { NameModal } from '../../criar-teste/_components/form/modals/NameModal';
import { QuestionCountSelector } from '../../criar-teste/_components/form/QuestionCountSelector';
import { QuestionModeSelector } from '../../criar-teste/_components/form/QuestionModeSelector';
import { SubthemeSelector } from '../../criar-teste/_components/form/SubthemeSelector';
import { TestModeSelector } from '../../criar-teste/_components/form/TestModeSelector';
import { ThemeSelector } from '../../criar-teste/_components/form/ThemeSelector';
import { useQuizCreationJob } from './hooks/useQuizCreationJob';
import { ProgressOverlay } from './ProgressOverlay';

export default function TestFormV2() {
  const router = useRouter();
  const [showNameModal, setShowNameModal] = useState(false);
  const [formData, setFormData] = useState<TestFormData | undefined>();
  const [submissionState, setSubmissionState] = useState<
    'idle' | 'loading' | 'success' | 'error' | 'no-questions'
  >('idle');
  const [resultMessage, setResultMessage] = useState<{
    title: string;
    description: string;
  }>({
    title: '',
    description: '',
  });

  // V2: Use the workflow mutation instead of the synchronous one
  const createWithWorkflow = useMutation(api.customQuizWorkflow.createWithWorkflow);

  // Job progress tracking
  const {
    jobStatus,
    isActive: isJobActive,
    isCompleted,
    isFailed,
    startWatching,
    reset: resetJob,
  } = useQuizCreationJob();

  // Custom hook for form state and logic (reused from v1)
  const {
    form,
    handleSubmit,
    control,
    getCurrentQuestionCount,
    hierarchicalData,
    mapQuestionMode,
    isAuthenticated,
    isLoading,
  } = useTestFormState();

  // Build hierarchy maps from hierarchicalData
  const buildHierarchyMaps = useCallback(() => {
    if (!hierarchicalData) {
      return {
        groupToSubtheme: {} as Record<Id<'groups'>, Id<'subthemes'>>,
        subthemeToTheme: {} as Record<Id<'subthemes'>, Id<'themes'>>,
      };
    }

    const groupToSubtheme: Record<Id<'groups'>, Id<'subthemes'>> = {};
    const subthemeToTheme: Record<Id<'subthemes'>, Id<'themes'>> = {};

    // Build group -> subtheme mapping
    for (const group of hierarchicalData.groups || []) {
      if (group.subthemeId) {
        groupToSubtheme[group._id as Id<'groups'>] = group.subthemeId as Id<'subthemes'>;
      }
    }

    // Build subtheme -> theme mapping
    for (const subtheme of hierarchicalData.subthemes || []) {
      if (subtheme.themeId) {
        subthemeToTheme[subtheme._id as Id<'subthemes'>] = subtheme.themeId as Id<'themes'>;
      }
    }

    return { groupToSubtheme, subthemeToTheme };
  }, [hierarchicalData]);

  const onSubmit = async (data: TestFormData) => {
    setFormData(data);
    setShowNameModal(true);
  };

  const submitWithName = useCallback(
    async (testName: string) => {
      if (!formData) return;

      try {
        setSubmissionState('loading');

        // Build hierarchy maps from the already-loaded hierarchicalData
        const { groupToSubtheme, subthemeToTheme } = buildHierarchyMaps();

        // V2: Use the workflow mutation with pre-computed hierarchy maps
        const result = await createWithWorkflow({
          name: testName,
          description: `Teste criado em ${new Date().toLocaleDateString()}`,
          testMode: formData.testMode,
          questionMode: mapQuestionMode(formData.questionMode),
          numQuestions: formData.numQuestions,
          selectedThemes: formData.selectedThemes as Id<'themes'>[],
          selectedSubthemes: formData.selectedSubthemes as Id<'subthemes'>[],
          selectedGroups: formData.selectedGroups as Id<'groups'>[],
          // OPTIMIZED: Pass pre-computed hierarchy relationships
          groupToSubtheme,
          subthemeToTheme,
        });

        // Start watching the job for progress updates
        startWatching(result.jobId);
        setShowNameModal(false);
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
    [formData, createWithWorkflow, mapQuestionMode, buildHierarchyMaps, startWatching]
  );

  // Memoized form handlers (same as v1)
  const handleTestModeChange = useCallback(
    (value: 'study' | 'exam') => {
      form.setValue('testMode', value, { shouldValidate: true });
    },
    [form]
  );

  const handleQuestionModeChange = useCallback(
    (value: 'all' | 'incorrect' | 'unanswered' | 'bookmarked') => {
      form.setValue('questionMode', value, { shouldValidate: true });
    },
    [form]
  );

  const handleToggleTheme = useCallback(
    (themeId: string) => {
      const current = form.getValues('selectedThemes') || [];
      form.setValue(
        'selectedThemes',
        current.includes(themeId)
          ? current.filter((id) => id !== themeId)
          : [...current, themeId],
        { shouldValidate: true }
      );
    },
    [form]
  );

  const handleToggleSubtheme = useCallback(
    (subthemeId: string) => {
      const current = form.getValues('selectedSubthemes') || [];
      form.setValue(
        'selectedSubthemes',
        current.includes(subthemeId)
          ? current.filter((id) => id !== subthemeId)
          : [...current, subthemeId],
        { shouldValidate: true }
      );
    },
    [form]
  );

  const handleToggleGroup = useCallback(
    (groupId: string) => {
      const current = form.getValues('selectedGroups') || [];
      form.setValue(
        'selectedGroups',
        current.includes(groupId)
          ? current.filter((id) => id !== groupId)
          : [...current, groupId],
        { shouldValidate: true }
      );
    },
    [form]
  );

  const handleToggleMultipleGroups = useCallback(
    (groupIds: string[]) => {
      const current = form.getValues('selectedGroups') || [];
      const updatedGroups = new Set(current);

      groupIds.forEach((groupId) => {
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
    [form]
  );

  const handleQuestionCountChange = useCallback(
    (value: number) => {
      form.setValue('numQuestions', value, { shouldValidate: true });
    },
    [form]
  );

  // Memoized sorted data
  const sortedThemes = useMemo(
    () =>
      ([...(hierarchicalData?.themes || [])] as any[]).sort((a: any, b: any) =>
        (a.name || '').localeCompare(b.name || '')
      ),
    [hierarchicalData?.themes]
  );

  const sortedSubthemes = useMemo(
    () =>
      ([...(hierarchicalData?.subthemes || [])] as any[]).sort(
        (a: any, b: any) => (a.name || '').localeCompare(b.name || '')
      ),
    [hierarchicalData?.subthemes]
  );

  const sortedGroups = useMemo(
    () =>
      ([...(hierarchicalData?.groups || [])] as any[]).sort((a: any, b: any) =>
        (a.name || '').localeCompare(b.name || '')
      ),
    [hierarchicalData?.groups]
  );

  // Handle progress overlay close on error
  const handleProgressClose = useCallback(() => {
    resetJob();
    setSubmissionState('idle');
  }, [resetJob]);

  // Show loading state while authentication is being checked
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-brand-blue"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  const isProcessing = isJobActive || submissionState === 'loading';

  return (
    <>
      {/* Progress Overlay for workflow tracking */}
      <ProgressOverlay
        isVisible={isJobActive || isCompleted || isFailed}
        status={jobStatus?.status || 'pending'}
        progress={jobStatus?.progress || 0}
        progressMessage={jobStatus?.progressMessage}
        quizId={jobStatus?.quizId}
        questionCount={jobStatus?.questionCount}
        error={jobStatus?.error}
        errorMessage={jobStatus?.errorMessage}
        onClose={handleProgressClose}
      />

      <form
        onSubmit={(e) => {
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
            submissionState === 'no-questions'
          }
          onClose={() => {
            if (
              submissionState === 'error' ||
              submissionState === 'no-questions'
            ) {
              setSubmissionState('idle');
            }
          }}
          state={submissionState}
          message={resultMessage}
        />

        {/* V2 Badge */}
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
            V2 - Workflow com Progresso
          </span>
          <span className="text-sm text-gray-500">
            Esta versão usa workflow assíncrono com acompanhamento em tempo real
          </span>
        </div>

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
            className="w-full cursor-pointer bg-brand-blue hover:bg-brand-blue/90"
            disabled={isProcessing}
          >
            {isProcessing ? 'Gerando seu teste...' : 'Gerar Teste'}
          </Button>
        </div>
      </form>
    </>
  );
}

