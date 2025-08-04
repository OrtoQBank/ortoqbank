'use client';

import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';
import { useTestFormState } from '../hooks/useTestFormState';
import { type TestFormData } from '../schema';
import { DebugPanel } from './DebugPanel';
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
    testMode,
    questionMode,
    numQuestions,
    selectedThemes,
    selectedSubthemes,
    selectedGroups,
    availableQuestionCount,
    isCountLoading,
    hierarchicalData,
    mapQuestionMode,
    isAuthenticated,
  } = useTestFormState();

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

  const onSubmit = async (data: TestFormData) => {
    setFormData(data);
    setShowNameModal(true);
  };

  const submitWithName = async (testName: string) => {
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
  };

  return (
    <form
      onSubmit={e => {
        if (!isCountLoading && availableQuestionCount === 0) {
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

      {/* Debug Panel - Development Only */}
      {process.env.NODE_ENV === 'development' && (
        <DebugPanel
          formData={{
            testMode: testMode,
            questionMode: questionMode,
            numQuestions: numQuestions,
            selectedThemes: selectedThemes,
            selectedSubthemes: selectedSubthemes,
            selectedGroups: selectedGroups,
          }}
          mappedQuestionMode={mapQuestionMode(questionMode)}
          availableQuestionCount={availableQuestionCount}
          isCountLoading={isCountLoading}
          hierarchicalData={hierarchicalData}
        />
      )}

      <div className="space-y-12 sm:space-y-14">
        {/* Test Mode Section */}
        <TestModeSelector
          value={testMode}
          onChange={value =>
            form.setValue('testMode', value, { shouldValidate: true })
          }
        />

        {/* Question Mode Section */}
        <QuestionModeSelector
          value={questionMode}
          onChange={value =>
            form.setValue('questionMode', value, { shouldValidate: true })
          }
          error={form.formState.errors.questionMode?.message}
        />

        {/* Themes Section */}
        <ThemeSelector
          themes={(hierarchicalData?.themes || []).sort((a, b) =>
            (a.name || '').localeCompare(b.name || ''),
          )}
          selectedThemes={selectedThemes}
          onToggleTheme={themeId => {
            const current = selectedThemes || [];
            form.setValue(
              'selectedThemes',
              current.includes(themeId)
                ? current.filter(id => id !== themeId)
                : [...current, themeId],
              { shouldValidate: true },
            );
          }}
          questionMode={questionMode}
          error={form.formState.errors.selectedThemes?.message}
        />

        {/* Subthemes Section - only if themes are selected */}
        {selectedThemes.length > 0 && (
          <SubthemeSelector
            themes={(hierarchicalData?.themes || []).sort((a, b) =>
              (a.name || '').localeCompare(b.name || ''),
            )}
            subthemes={(hierarchicalData?.subthemes || []).sort((a, b) =>
              (a.name || '').localeCompare(b.name || ''),
            )}
            groups={(hierarchicalData?.groups || []).sort((a, b) =>
              (a.name || '').localeCompare(b.name || ''),
            )}
            selectedThemes={selectedThemes}
            selectedSubthemes={selectedSubthemes}
            selectedGroups={selectedGroups}
            questionMode={questionMode}
            onToggleSubtheme={subthemeId => {
              const current = selectedSubthemes || [];
              form.setValue(
                'selectedSubthemes',
                current.includes(subthemeId)
                  ? current.filter(id => id !== subthemeId)
                  : [...current, subthemeId],
                { shouldValidate: true },
              );
            }}
            onToggleGroup={groupId => {
              const current = selectedGroups || [];
              form.setValue(
                'selectedGroups',
                current.includes(groupId)
                  ? current.filter(id => id !== groupId)
                  : [...current, groupId],
                { shouldValidate: true },
              );
            }}
            onToggleMultipleGroups={groupIds => {
              const current = selectedGroups || [];
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
            }}
          />
        )}

        {/* Question Count Section */}
        <QuestionCountSelector
          value={numQuestions}
          onChange={value =>
            form.setValue('numQuestions', value, { shouldValidate: true })
          }
          error={form.formState.errors.numQuestions?.message}
        />

        <Button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Gerando seu teste...' : 'Gerar Teste'}
        </Button>
      </div>
    </form>
  );
}
