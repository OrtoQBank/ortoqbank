import { useState } from 'react';

import { useTenantQuery } from '@/hooks/useTenantQuery';

import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';

export function useQuestionDetail(questionId: Id<'questions'>) {
  const [isEditing, setIsEditing] = useState(false);

  // Fetch question data - tenant-aware
  const question = useTenantQuery(api.questions.getById, { id: questionId });

  // Toggle edit mode
  const startEditing = () => setIsEditing(true);
  const cancelEditing = () => setIsEditing(false);

  // Handle successful edit
  const handleEditSuccess = () => {
    setIsEditing(false);
  };

  return {
    question,
    isLoading: question === undefined,
    isEditing,
    startEditing,
    cancelEditing,
    handleEditSuccess,
  };
}
