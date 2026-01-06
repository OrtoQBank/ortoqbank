import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-t from-indigo-50 to-white p-6 text-center">
      <h1 className="text-brand-blue mb-4 text-6xl font-bold">404</h1>
      <h2 className="mb-6 text-2xl font-semibold">Página não encontrada</h2>
      <p className="mb-8 max-w-md text-gray-600">
        A página que você está procurando não existe ou foi movida.
      </p>
      <Link
        href="/"
        className="bg-brand-blue hover:bg-brand-blue/90 rounded-md px-6 py-3 text-white transition-colors"
      >
        Voltar para a página inicial
      </Link>
    </div>
  );
}
