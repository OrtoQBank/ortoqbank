import { FormContextProvider } from '../criar-teste/_components/context/FormContext';
import TestFormV2 from './_components/TestFormV2';

export default function CriarTesteV2Page() {
  return (
    <FormContextProvider>
      <div className="rounded-lg border bg-white p-6">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Criar Teste
        </h1>

        <TestFormV2 />
      </div>
    </FormContextProvider>
  );
}
