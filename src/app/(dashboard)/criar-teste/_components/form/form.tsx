'use client';

import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';

import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';
import { useTestFormState } from '../hooks/useTestFormState';
import { type TestFormData } from '../schema';
import { FeedbackModal } from './modals/FeedbackModal';
import { NameModal } from './modals/NameModal';
import { QuestionCountSelector } from './QuestionCountSelector';
import { QuestionModeSelector } from './QuestionModeSelector';
import { SubthemeSelector } from './SubthemeSelector';
import { TestModeSelector } from './TestModeSelector';
import { ThemeSelector } from './ThemeSelector';

export default function TestForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const createCustomQuiz = useMutation(api.customQuizzesCreation.create);

  // Custom hook for form state and logic
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

  // Don't watch values here - let individual components watch what they need

  const onSubmit = async (data: TestFormData) => {
    setFormData(data);
    setShowNameModal(true);
  };

  const submitWithName = useCallback(
    async (testName: string) => {
      if (!formData) return;

      try {
        setIsSubmitting(true);
        setSubmissionState('loading');

        // Map string arrays to appropriate ID types
        const formattedData = {
          name: testName,
          description: `Teste criado em ${new Date().toLocaleDateString()}`,
          testMode: formData.testMode,
          questionMode: mapQuestionMode(formData.questionMode),
          numQuestions: formData.numQuestions,
          selectedThemes: formData.selectedThemes as Id<'themes'>[],
          selectedSubthemes: formData.selectedSubthemes as Id<'subthemes'>[],
          selectedGroups: formData.selectedGroups as Id<'groups'>[],
        };

        // Create the custom quiz
        const result = await createCustomQuiz(formattedData);

        // Handle the new response format
        if (result.success) {
          setSubmissionState('success');
          setResultMessage({
            title: 'Quiz criado com sucesso!',
            description: `Seu quiz com ${result.questionCount} questões foi criado. Aguarde, você será redirecionado automaticamente...`,
          });

          // Navigate after a short delay to show success
          setTimeout(() => {
            router.push(`/criar-teste/${result.quizId}`);
            setIsSubmitting(false);
          }, 2000);
        } else {
          // Handle error response from the mutation
          if (result.error === 'NO_QUESTIONS_FOUND') {
            setSubmissionState('no-questions');
            setResultMessage({
              title: 'Nenhuma questão encontrada',
              description: result.message,
            });
          } else {
            setSubmissionState('error');
            setResultMessage({
              title: 'Não foi possível criar o quiz',
              description: result.message,
            });
          }
          setIsSubmitting(false);
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
        setIsSubmitting(false);
      } finally {
        setShowNameModal(false);
      }
    },
    [formData, createCustomQuiz, mapQuestionMode, router],
  );

  // Memoized form handlers to prevent unnecessary re-renders
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
      // Create a new set from the current groups
      const updatedGroups = new Set(current);

      // For each group ID in the array, toggle its presence in the set
      groupIds.forEach(groupId => {
        if (updatedGroups.has(groupId)) {
          updatedGroups.delete(groupId);
        } else {
          updatedGroups.add(groupId);
        }
      });

      // Update the form state with the new array
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

  // Memoized sorted data to prevent re-sorting on every render
  const sortedThemes = useMemo(
    () =>
      ([...(hierarchicalData?.themes || [])] as any[]).sort((a: any, b: any) =>
        (a.name || '').localeCompare(b.name || ''),
      ),
    [hierarchicalData?.themes],
  );

  const sortedSubthemes = useMemo(
    () =>
      ([...(hierarchicalData?.subthemes || [])] as any[]).sort(
        (a: any, b: any) => (a.name || '').localeCompare(b.name || ''),
      ),
    [hierarchicalData?.subthemes],
  );

  const sortedGroups = useMemo(
    () =>
      ([...(hierarchicalData?.groups || [])] as any[]).sort((a: any, b: any) =>
        (a.name || '').localeCompare(b.name || ''),
      ),
    [hierarchicalData?.groups],
  );

  // Show loading state while authentication is being checked
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={e => {
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
          isSubmitting ||
          submissionState === 'error' ||
          submissionState === 'no-questions'
        }
        onClose={() => {
          if (
            submissionState === 'error' ||
            submissionState === 'no-questions'
          ) {
            setSubmissionState('idle');
            setIsSubmitting(false);
          }
        }}
        state={submissionState}
        message={resultMessage}
      />

      {/* Debug Panel - Development Only - Temporarily disabled */}
      {/* {process.env.NODE_ENV === 'development' && (
        <DebugPanel
          control={control}
          mapQuestionMode={mapQuestionMode}
          getCurrentQuestionCount={getCurrentQuestionCount}
          isCountLoading={isLoading}
          hierarchicalData={hierarchicalData}
        />
      )} */}

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

        {/* Subthemes Section - conditionally rendered based on form state */}
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
          className="w-full cursor-pointer bg-blue-500 hover:bg-blue-600"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Gerando seu teste...' : 'Gerar Teste'}
        </Button>
      </div>
    </form>
  );
}
