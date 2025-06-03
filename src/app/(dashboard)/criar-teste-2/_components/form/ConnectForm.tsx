import { ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';

interface ConnectFormProps {
  children: (methods: ReturnType<typeof useFormContext>) => ReactNode;
}

/**
 * ConnectForm component from React Hook Form documentation.
 * This is a render prop component that provides access to all form methods
 * within deeply nested components using useFormContext.
 *
 * Usage:
 * <ConnectForm>
 *   {({ register, formState }) => (
 *     <input {...register('fieldName')} />
 *   )}
 * </ConnectForm>
 */
export function ConnectForm({ children }: ConnectFormProps) {
  const methods = useFormContext();
  return <>{children(methods)}</>;
}
