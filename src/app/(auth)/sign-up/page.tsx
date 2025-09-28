'use client';

import { SignUp } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../convex/_generated/api';

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const claimToken = searchParams.get('claim');
  const token = searchParams.get('token'); // Legacy support
  const payment = searchParams.get('payment'); // Legacy support
  const orderId = searchParams.get('order'); // Legacy support
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  // Validate claim token (new robust flow)
  const claimValidation = useQuery(
    api.payments.validateClaimToken,
    claimToken ? { claimToken } : 'skip'
  );

  // Legacy signup token validation
  const tokenValidation = useQuery(
    api.payments.validateSignupToken,
    !claimToken && token ? { token } : 'skip'
  );

  // Legacy validation for old URLs
  const orderValidation = useQuery(
    api.payments.validateOrderAccess,
    !token && orderId ? { orderId } : 'skip'
  );

  useEffect(() => {
    if (payment === 'success') {
      // Old URL format - redirect to processing
      window.location.href = `/payment/processing?order=${orderId}`;
      return;
    }

    // New claim token flow (robust pattern)
    if (claimToken) {
      if (claimValidation !== undefined) {
        setIsValidating(false);
        
        if (!claimValidation.isValid) {
          console.log('Invalid or expired claim token, redirecting to pricing');
          router.push('/?error=payment_required');
          return;
        }

        // Valid claim token - show success banner
        setShowPaymentSuccess(true);
      }
      return;
    }

    // Legacy token-based flow
    if (token) {
      if (tokenValidation !== undefined) {
        setIsValidating(false);
        
        if (!tokenValidation.isValid) {
          console.log('Invalid or expired token, redirecting to pricing');
          router.push('/?error=payment_required');
          return;
        }

        // Valid token - show success banner
        setShowPaymentSuccess(true);
      }
      return;
    }

    // Legacy order ID flow
    if (orderId) {
      if (orderValidation !== undefined) {
        setIsValidating(false);
        
        if (!orderValidation.isValid) {
          console.log('Invalid or unpaid order, redirecting to pricing');
          router.push('/?error=payment_required');
          return;
        }

        // Valid payment - show success banner
        if (payment === 'confirmed') {
          setShowPaymentSuccess(true);
        }
      }
      return;
    }

    // No token or order ID provided, redirect to pricing
    console.log('No token or order ID provided, redirecting to pricing');
    router.push('/?error=payment_required');
  }, [payment, orderId, claimToken, token, orderValidation, tokenValidation, claimValidation, router]);

  // Show loading while validating
  if (isValidating || (claimToken && claimValidation === undefined) || (token && tokenValidation === undefined) || (!claimToken && !token && orderId && orderValidation === undefined)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            Validando pagamento...
          </h2>
          <p className="text-gray-600">
            Aguarde enquanto verificamos seu acesso
          </p>
        </div>
      </div>
    );
  }

  // Show error if validation failed (shouldn't reach here due to redirect, but just in case)
  const currentValidation = claimToken ? claimValidation : (token ? tokenValidation : orderValidation);
  if (currentValidation && !currentValidation.isValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">
            Acesso Negado
          </h2>
          <p className="text-gray-600">
            Você precisa completar o pagamento para acessar esta página.
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ver Planos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        
        {/* Payment Success Banner */}
        {showPaymentSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <h3 className="text-sm font-medium text-green-800">
                  🎉 Pagamento Confirmado!
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  Crie sua conta para acessar o conteúdo imediatamente
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Welcome Message */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bem-vindo ao OrtoQBank!
          </h1>
          <p className="text-gray-600">
            {showPaymentSuccess 
              ? 'Finalize criando sua conta para acessar o conteúdo'
              : 'Crie sua conta e comece sua preparação'
            }
          </p>
        </div>

        {/* Clerk SignUp Component */}
        <div className="flex justify-center">
          <SignUp 
            routing="hash"
            appearance={{
              elements: {
                formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
                card: 'shadow-xl',
              }
            }}
            redirectUrl="/dashboard"
            afterSignUpUrl="/dashboard"
          />
        </div>
        
      </div>
    </div>
  );
}
