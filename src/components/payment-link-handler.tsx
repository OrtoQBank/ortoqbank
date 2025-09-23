'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

export function PaymentLinkHandler() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const linkUserToPayment = useMutation(api.asaas.linkUserToPayment);
  
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderId = searchParams.get('order');
  const payment = searchParams.get('payment');

  useEffect(() => {
    // Only link if:
    // 1. User is loaded and authenticated
    // 2. We have a payment success flag
    // 3. We have an order ID  
    // 4. Haven't already linked
    // 5. Not currently linking
    if (
      isLoaded && 
      user && 
      payment === 'success' && 
      orderId && 
      !linked && 
      !linking
    ) {
      handleLinking();
    }
  }, [isLoaded, user, payment, orderId, linked, linking]);

  const handleLinking = async () => {
    if (!user || !orderId) return;

    setLinking(true);
    setError(null);

    try {
      const result = await linkUserToPayment({
        orderId: orderId as Id<"pendingOrders">,
        clerkUserId: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
      });

      if (result.success) {
        setLinked(true);
        console.log('✅ Pagamento vinculado:', result.message);
      } else {
        setError(result.message);
        console.error('❌ Erro ao vincular:', result.message);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMsg);
      console.error('❌ Erro ao vincular pagamento:', err);
    } finally {
      setLinking(false);
    }
  };

  // Don't render anything if no payment to process
  if (payment !== 'success' || !orderId) {
    return null;
  }

  return (
    <div className="mt-4">
      {linking && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700">
            🔗 Vinculando sua compra à conta...
          </p>
        </div>
      )}
      
      {linked && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-700">
            ✅ Compra vinculada! Acesso será liberado após confirmação do pagamento.
          </p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">
            ❌ {error}
          </p>
          <button 
            onClick={handleLinking}
            className="text-sm text-red-600 underline mt-1"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
