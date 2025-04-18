import TestForm from './_components/form/form';

export default function CriarTestePage() {
  return (
    <div className="container mx-auto max-w-4xl p-6">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
        Criar Teste
      </h1>

      <TestForm />
    </div>
  );
}
