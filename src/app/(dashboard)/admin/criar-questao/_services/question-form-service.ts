import { IMAGE_OPTIMIZATION } from '@/components/rich-text-editor/constants';
import {
  hasBlobUrls,
  InvalidImageInfo,
  processEditorContent,
  TiptapNode,
  validateImageSourcesWithDetails,
} from '@/components/rich-text-editor/content-processor';
import { toast } from '@/hooks/use-toast';

import { Id } from '../../../../../../convex/_generated/dataModel';
import { normalizeText } from '../../../../../../convex/utils';
import { QuestionFormData } from '../_components/schema';

/**
 * Question Form Service
 *
 * CONTENT MIGRATION STATUS: UPDATED
 *
 * This service has been updated to only save TipTap content in string format:
 * - We process editor content into TipTap JSON objects for validation
 * - We convert these objects to strings using JSON.stringify()
 * - We only send the string fields (questionTextString and explanationTextString) to the API
 * - The legacy object fields (questionText and explanationText) are no longer sent
 */

interface SubmissionOptions {
  mode: 'create' | 'edit';
  defaultValues?: any;
  imageKitEndpoint: string;
  selectedTheme: Id<'themes'> | undefined;
  selectedSubtheme: Id<'subthemes'> | undefined;
  generatedId: string;
  onSuccess?: () => void;
}

export async function processAndSubmitQuestion(
  data: QuestionFormData,
  {
    mode,
    defaultValues,
    imageKitEndpoint,
    selectedTheme,
    selectedSubtheme,
    generatedId,
    onSuccess,
  }: SubmissionOptions,
  createQuestion: any,
  updateQuestion: any,
  clearEditors: () => void,
) {
  try {
    // Ensure ImageKit URL endpoint is available
    if (!imageKitEndpoint) {
      console.error('IMAGEKIT_URL_ENDPOINT is not defined.');
      toast({
        title: 'Erro de Configuração',
        description: 'O endpoint do ImageKit não está configurado.',
        variant: 'destructive',
      });
      return false;
    }

    // Process both questionTextString and explanationTextString
    // Parse the strings back to TipTap objects for processing
    const questionTextObject = JSON.parse(data.questionTextString);
    const explanationTextObject = JSON.parse(data.explanationTextString);

    const processedQuestionContent = await processEditorContent(
      (questionTextObject.content as TiptapNode[]) || [],
    );
    const processedExplanationContent = await processEditorContent(
      (explanationTextObject.content as TiptapNode[]) || [],
    );

    const processedQuestionText = {
      type: 'doc',
      content: processedQuestionContent,
    };

    const processedExplanationText = {
      type: 'doc',
      content: processedExplanationContent,
    };

    // --- VALIDATION STEP ---
    const questionValidation = validateImageSourcesWithDetails(
      processedQuestionText.content,
      imageKitEndpoint,
    );
    const explanationValidation = validateImageSourcesWithDetails(
      processedExplanationText.content,
      imageKitEndpoint,
    );

    const allInvalidImages = [
      ...questionValidation.invalidImages.map(img => ({
        ...img,
        location: 'Enunciado' as const,
      })),
      ...explanationValidation.invalidImages.map(img => ({
        ...img,
        location: 'Explicação' as const,
      })),
    ];

    if (allInvalidImages.length > 0) {
      // Log detailed info for debugging (internal only)
      console.error('[QuestionForm] Image validation failed:', {
        totalInvalidImages: allInvalidImages.length,
        invalidImages: allInvalidImages,
        imageKitEndpoint,
      });

      // Build user-friendly error message
      const errorDetails = allInvalidImages
        .map(img => {
          const fileName = img.alt || 'imagem sem nome';
          const location = img.location;
          switch (img.reason) {
            case 'blob_url':
              return `• ${location}: "${fileName}" - Falha no upload. Tente uma imagem menor (máx ${IMAGE_OPTIMIZATION.MAX_FILE_SIZE_MB}MB)`;
            case 'external_url':
              return `• ${location}: "${fileName}" - URL externa não permitida. Use o botão de upload`;
            case 'missing_src':
              return `• ${location}: "${fileName}" - Imagem corrompida`;
            default:
              return `• ${location}: "${fileName}" - Erro desconhecido`;
          }
        })
        .join('\n');

      toast({
        title: 'Erro nas Imagens',
        description: `${errorDetails}\n\nRemova e adicione novamente.`,
        variant: 'destructive',
        duration: 10000,
      });
      return false;
    }
    // --- END VALIDATION STEP ---

    // Create string versions of the processed content
    const questionTextString = JSON.stringify(processedQuestionText);
    const explanationTextString = JSON.stringify(processedExplanationText);

    // Include generated question code in submission
    const submissionData = {
      ...data,
      // Make one final pass with normalizeText to guarantee no special characters
      questionCode: normalizeText(generatedId).toUpperCase(),
      // Store processed content to use in validation, but don't send to API
      _questionText: processedQuestionText,
      _explanationText: processedExplanationText,
    };

    // This check might be redundant now with the stricter validation above,
    // but keeping it doesn't hurt.
    if (
      hasBlobUrls(submissionData._questionText.content) ||
      hasBlobUrls(submissionData._explanationText.content)
    ) {
      toast({
        title: 'Erro ao salvar questão',
        description: 'Algumas imagens ainda são locais (blob).', // More specific message
        variant: 'destructive',
      });
      return false;
    }

    // --- Final Type Check ---
    if (!selectedTheme) {
      toast({
        title: 'Erro Interno',
        description:
          'O tema selecionado é inválido. Por favor, selecione um tema.',
        variant: 'destructive',
      });
      return false; // Prevent submission if themeId is somehow undefined
    }
    // --- End Final Type Check ---

    // Final data structure for DB operations
    const processedData = {
      // Explicitly list fields needed by mutations, using correct types
      title: submissionData.title,
      questionCode: submissionData.questionCode,
      // Only include the string fields, not the legacy object fields
      questionTextString,
      explanationTextString,
      alternatives: submissionData.alternatives,
      correctAlternativeIndex: submissionData.correctAlternativeIndex,
      themeId: submissionData.themeId as Id<'themes'>, // Still need assertion here
      subthemeId: submissionData.subthemeId
        ? (submissionData.subthemeId as Id<'subthemes'>)
        : undefined,
      groupId: submissionData.groupId
        ? (submissionData.groupId as Id<'groups'>)
        : undefined,
    };

    if (mode === 'edit' && defaultValues) {
      // Spread the ID for update separately
      await updateQuestion({
        id: defaultValues._id,
        ...processedData,
      });
      toast({ title: 'Questão atualizada com sucesso!' });

      // Call the success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } else {
      await createQuestion(processedData);
      toast({ title: 'Questão criada com sucesso!' });

      // Only clear the form if we're in create mode
      if (mode === 'create') {
        clearEditors();
        return true; // Signal successful creation for form reset
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to submit:', error);
    toast({
      title: 'Erro ao salvar questão',
      description: 'Tente novamente mais tarde',
      variant: 'destructive',
    });
    return false;
  }
}
