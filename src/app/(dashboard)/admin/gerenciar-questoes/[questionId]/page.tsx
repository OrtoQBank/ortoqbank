'use client';

import { useParams } from 'next/navigation';

import { Button } from '@/components/ui/button';

import { Id } from '../../../../../../convex/_generated/dataModel';
import { QuestionForm } from '../../criar-questao/_components/question-form';
import { QuestionDisplay } from './_components/question-display';
import { useQuestionDetail } from './_hooks/use-question-detail';

export default function QuestionDetailPage() {
  const params = useParams();
  const questionId = params.questionId as Id<'questions'>;

  // Use the custom hook to manage question data and editing state
  const {
    question,
    isLoading,
    isEditing,
    startEditing,
    cancelEditing,
    handleEditSuccess,
  } = useQuestionDetail(questionId);

  // Show loading state
  if (isLoading) {
    return <div className="p-0 md:p-6">Carregando...</div>;
  }

  // Show edit form when in edit mode
  if (isEditing) {
    return (
      <div className="p-0 md:p-6">
        <div className="mb-6 flex justify-between">
          <h1 className="text-2xl font-bold">Editar Questão</h1>
          <Button variant="outline" onClick={cancelEditing}>
            Cancelar
          </Button>
        </div>
        <QuestionForm
          defaultValues={question}
          mode="edit"
          onSuccess={handleEditSuccess}
        />
      </div>
    );
  }

  // Show question details when in view mode
  return (
    <div className="p-0 md:p-6">
      <QuestionDisplay
        question={question}
        onEdit={startEditing}
        onBack={() => globalThis.history.back()}
      />
    </div>
  );
}
