import { Loader2 } from 'lucide-react';
import { useFormContext } from 'react-hook-form';

import { Button } from '@/components/ui/button';

interface FormActionsProps {
  onReset?: () => void;
  submitText?: string;
  resetText?: string;
  showReset?: boolean;
}

/**
 * This component demonstrates how to create reusable form action components
 * that access form state via useFormContext without prop drilling.
 * It can be placed anywhere within the FormProvider context.
 */
export function FormActions({
  onReset,
  submitText = 'Submit',
  resetText = 'Reset',
  showReset = true,
}: FormActionsProps) {
  const {
    reset,
    formState: { isSubmitting, isDirty, isValid },
  } = useFormContext();

  const handleReset = () => {
    reset();
    onReset?.();
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
      <div className="flex gap-2">
        {showReset && (
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isSubmitting || !isDirty}
            className="flex-1 sm:flex-none"
          >
            {resetText}
          </Button>
        )}
      </div>

      <Button
        type="submit"
        className="flex-1 bg-blue-500 hover:bg-blue-600 sm:flex-none"
        disabled={isSubmitting || !isValid}
      >
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSubmitting ? 'Processing...' : submitText}
      </Button>
    </div>
  );
}
