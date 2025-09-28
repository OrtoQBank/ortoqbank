'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PaymentErrorAlert() {
  const searchParams = useSearchParams();
  const [showPaymentError, setShowPaymentError] = useState(false);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'payment_required') {
      setShowPaymentError(true);
      // Auto-hide after 10 seconds
      const timer = setTimeout(() => setShowPaymentError(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  if (!showPaymentError) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-4">
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Pagamento necessário:</strong> Você precisa completar o pagamento antes de criar sua conta. 
          Escolha um plano abaixo para continuar.
        </AlertDescription>
      </Alert>
    </div>
  );
}
