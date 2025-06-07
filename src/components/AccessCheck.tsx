'use client';

import { Check, GraduationCap, Loader2, Target } from 'lucide-react';

import { useSession } from './providers/SessionProvider';

export default function AccessCheck({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin } = useSession();

  /*  const accessResult = useQuery(api.users.hasCurrentYearAccess); */
  const accessResult = { hasAccess: true };

  // While loading, show a loading indicator
  if (accessResult === undefined) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-[#2196F3]" />
        <p className="text-lg font-medium">Verificando seu acesso...</p>
      </div>
    );
  }

  // If user has active access, show the children
  if (
    accessResult &&
    typeof accessResult === 'object' &&
    accessResult.hasAccess
  ) {
    return <>{children}</>;
  }

  // Enhanced promotional component when user doesn't have access
  return (
    <div className="mx-auto my-8 max-w-5xl">
      <div className="mb-10 text-center">
        <h2 className="mb-3 text-2xl font-bold text-[#2196F3] md:text-3xl">
          Acesso OrtoQBank
        </h2>
        <p className="text-lg text-gray-600">
          Para acessar este conteúdo, você precisa adquirir um dos passes anuais
          disponíveis.
        </p>
      </div>

      {/* Dynamic Pricing Cards - Fetched from Stripe */}

      {/* Benefits section */}
      <div className="mb-8 grid gap-6 md:grid-cols-3">
        <BenefitCard
          icon={GraduationCap}
          title="Trilhas de Estudo"
          description="Acesso a trilhas de estudo com questões inéditas organizadas por temas"
        />
        <BenefitCard
          icon={Target}
          title="Simulados Completos"
          description="Simulados que reproduzem o formato do TEOT, com questões exclusivas"
        />
        <BenefitCard
          icon={Check}
          title="Testes Personalizados"
          description="Crie testes personalizados focando nas suas áreas de melhoria"
        />
      </div>

      {/* Testimonial */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="mb-4 text-gray-700">
          &ldquo;O OrtoQBank foi essencial para a minha aprovação no TEOT.
          Material organizado e questões de alta qualidade.&rdquo;
        </p>
        <p className="font-medium text-gray-900">
          Dr. João Silva, aprovado no TEOT 2023
        </p>
      </div>
    </div>
  );
}

// Reusable component for benefits
function BenefitCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <Icon className="mb-3 h-8 w-8 text-[#2196F3]" />
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}
