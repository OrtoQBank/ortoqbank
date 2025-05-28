import { Metadata } from 'next';

import TaxonomyForm from './_components/form/TaxonomyForm';

export const metadata: Metadata = {
  title: 'Criar Teste | OrtoQBank',
  description: 'Crie um teste personalizado',
};

export default function CriarTeste2Page() {
  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Criar Teste</h1>
      </div>
      <TaxonomyForm />
    </div>
  );
}
