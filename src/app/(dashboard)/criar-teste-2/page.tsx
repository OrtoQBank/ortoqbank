import TestForm from './_components/form/form';

export default function CriarTeste2Page() {
  return (
    <div className="container mx-auto max-w-4xl md:p-6">
      <h1 className="py-6 text-2xl font-semibold tracking-tight text-gray-900 md:py-0 dark:text-gray-100">
        Criar Teste
      </h1>
      <TestForm />
    </div>
  );
}
