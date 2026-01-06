import { FormContextProvider } from './_components/context/FormContext';
import TestForm from './_components/TestForm';

export default function CriarTestePage() {
  return (
    <FormContextProvider>
      <div className="rounded-lg border bg-white p-6">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Criar Teste
        </h1>

        <TestForm />
      </div>
    </FormContextProvider>
  );
}
