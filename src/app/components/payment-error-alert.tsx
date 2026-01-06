'use client';

import { AlertCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';

function PaymentErrorAlertContent() {
  const searchParams = useSearchParams();
  const [isHidden, setIsHidden] = useState(false);

  // Derive whether to show error from searchParams
  const hasPaymentError = useMemo(() => {
    return searchParams.get('error') === 'payment_required';
  }, [searchParams]);

  // Auto-hide after 10 seconds
  useEffect(() => {
    if (hasPaymentError && !isHidden) {
      const timer = setTimeout(() => setIsHidden(true), 10_000);
      return () => clearTimeout(timer);
    }
  }, [hasPaymentError, isHidden]);

  if (!hasPaymentError || isHidden) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-4">
      <Alert variant="destructive" className="mx-auto max-w-2xl">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Pagamento necessário:</strong> Você precisa completar o
          pagamento antes de criar sua conta. Escolha um plano abaixo para
          continuar.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default function PaymentErrorAlert() {
  return (
    <Suspense fallback={null}>
      <PaymentErrorAlertContent />
    </Suspense>
  );
}
