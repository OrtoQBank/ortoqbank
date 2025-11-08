import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';
import { QuestionFormData, questionSchema } from '../_components/schema';
import { processAndSubmitQuestion } from '../_services/question-form-service';
import { useTaxonomyData } from './use-taxonomy-data';

const NUMBER_OF_ALTERNATIVES = 4;

interface UseQuestionFormProps {
  mode?: 'create' | 'edit';
  defaultValues?: any;
  onSuccess?: () => void;
}

export function useQuestionForm({
  mode = 'create',
  defaultValues,
  onSuccess,
}: UseQuestionFormProps = {}) {
  // Convex mutations
  const createQuestion = useMutation(api.questions.create);
  const updateQuestion = useMutation(api.questions.update);

  // Editor references
  const [questionEditor, setQuestionEditor] = useState<any>();
  const [explanationEditor, setExplanationEditor] = useState<any>();

  // Initialize form with default values or empty state
  const form = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    mode: 'onSubmit',
    defaultValues: {
      title: '',
      questionTextString: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
      }),
      alternatives: ['', '', '', ''],
      correctAlternativeIndex: undefined,
      explanationTextString: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
      }),
      themeId: '',
      subthemeId: undefined,
      groupId: undefined,
      ...defaultValues,
    },
  });

  // Initialize taxonomy data with default values if in edit mode
  const taxonomy = useTaxonomyData(
    defaultValues?.themeId as Id<'themes'>,
    defaultValues?.subthemeId as Id<'subthemes'>,
    defaultValues?.groupId as Id<'groups'>,
  );

  // Form submission handler
  const onSubmit = async (data: QuestionFormData) => {
    // Clear editors if form resets
    const clearEditors = () => {
      if (mode === 'create') {
        form.reset({
          title: '',
          questionTextString: JSON.stringify({
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          }),
          alternatives: ['', '', '', ''],
          correctAlternativeIndex: undefined,
          explanationTextString: JSON.stringify({
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          }),
          themeId: '',
          subthemeId: undefined,
          groupId: undefined,
        });
        questionEditor?.commands.setContent('');
        explanationEditor?.commands.setContent('');
      }
    };

    // Get ImageKit endpoint from environment
    const imageKitEndpoint =
      process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || '';

    // Process and submit the question
    await processAndSubmitQuestion(
      data,
      {
        mode,
        defaultValues,
        imageKitEndpoint,
        selectedTheme: taxonomy.selectedTheme,
        selectedSubtheme: taxonomy.selectedSubtheme,
        generatedId: taxonomy.generatedId,
        onSuccess,
      },
      createQuestion,
      updateQuestion,
      clearEditors,
    );
  };

  // Return values and methods needed by the form component
  return {
    form,
    taxonomy,
    onSubmit: form.handleSubmit(onSubmit),
    isSubmitting: form.formState.isSubmitting,
    setQuestionEditor,
    setExplanationEditor,
    getButtonText: () => {
      if (form.formState.isSubmitting) {
        return mode === 'edit' ? 'Salvando...' : 'Criando...';
      }
      return mode === 'edit' ? 'Salvar Alterações' : 'Criar Questão';
    },
  };
}
