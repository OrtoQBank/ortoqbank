import { Loader2 } from 'lucide-react';
import { useFormContext } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * This component demonstrates how deeply nested components can access
 * form state using useFormContext without prop drilling.
 * It shows the submission status and form validation state.
 */
export function FormSubmissionStatus() {
  const {
    formState: { isSubmitting, isValid, isDirty, errors },
  } = useFormContext();

  if (isSubmitting) {
    return (
      <Alert className="border-blue-200 bg-blue-50">
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription className="ml-2">
          Criando seu teste personalizado...
        </AlertDescription>
      </Alert>
    );
  }

  if (isDirty && !isValid) {
    return (
      <Alert className="border-amber-200 bg-amber-50">
        <AlertDescription>
          Por favor, corrija os erros no formulário antes de continuar.
          {Object.keys(errors).length > 0 && (
            <span className="ml-1">
              ({Object.keys(errors).length} erro
              {Object.keys(errors).length === 1 ? '' : 's'})
            </span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (isDirty && isValid) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <AlertDescription>
          Formulário válido e pronto para criação do teste!
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
