import { Wrench } from 'lucide-react';

export const metadata = {
  title: 'Manutenção em Andamento | OrtoQBank',
  description: 'Estamos realizando manutenção para melhorar sua experiência.',
};

export default function MaintenancePage() {
  return (
    <div className="via-brand-blue/10 flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-indigo-100 p-6">
      {/* Animated background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-brand-blue/5 absolute -top-40 -right-40 h-80 w-80 animate-pulse rounded-full blur-3xl" />
        <div className="bg-brand-blue/5 absolute -bottom-40 -left-40 h-80 w-80 animate-pulse rounded-full blur-3xl [animation-delay:1s]" />
      </div>

      {/* Main card */}
      <div className="animate-in fade-in slide-in-from-bottom-4 relative z-10 w-full max-w-lg rounded-xl border border-gray-100 bg-white p-8 text-center shadow-lg duration-500 md:p-12">
        {/* Pulsing icon */}
        <div className="bg-brand-blue/10 text-brand-blue relative mx-auto mb-6 flex h-20 w-20 animate-pulse items-center justify-center rounded-full">
          <Wrench className="h-10 w-10" />
          {/* Pulse ring */}
          <div className="border-brand-blue/30 absolute inset-0 animate-ping rounded-full border-2 [animation-duration:2s]" />
        </div>

        {/* Blue divider */}
        <div className="bg-brand-blue mx-auto mb-6 h-1 w-16 rounded-full" />

        {/* Heading */}
        <h1 className="text-brand-blue animate-in fade-in mb-4 text-2xl font-bold duration-500 [animation-delay:200ms] md:text-3xl">
          Manutenção em Andamento
        </h1>

        {/* Subheading */}
        <p className="animate-in fade-in mb-4 text-lg font-medium text-gray-700 duration-500 [animation-delay:300ms]">
          Estamos trabalhando para melhorar sua experiência
        </p>

        {/* Body text */}
        <p className="animate-in fade-in mb-6 text-gray-600 duration-500 [animation-delay:400ms]">
          Nossa equipe está realizando uma manutenção programada para garantir a
          melhor qualidade do serviço. Por favor, tente novamente em alguns
          instantes.
        </p>

        {/* Status indicator */}
        <div className="animate-in fade-in flex items-center justify-center gap-2 text-sm text-gray-500 duration-500 [animation-delay:500ms]">
          <span className="bg-brand-blue inline-block h-2 w-2 animate-pulse rounded-full" />
          <span>Sistema em manutenção</span>
        </div>
      </div>

      {/* Footer */}
      <p className="animate-in fade-in relative z-10 mt-8 text-sm text-gray-500 duration-500 [animation-delay:600ms]">
        Obrigado pela compreensão.
      </p>
    </div>
  );
}
