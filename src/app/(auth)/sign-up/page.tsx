'use client';

import { SignUp } from '@clerk/nextjs';
import { CheckCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const payment = searchParams.get('payment');
  const orderId = searchParams.get('order');
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);

  useEffect(() => {
    if (payment === 'confirmed' && orderId) {
      setShowPaymentSuccess(true);
    } else if (payment === 'success') {
      // Old URL format - redirect to processing
      window.location.href = `/payment/processing?order=${orderId}`;
    }
  }, [payment, orderId]);

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
            Bem-vindo ao OrtoQBank! 🎓
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

        {/* Payment linking happens automatically via Clerk webhook */}
        {showPaymentSuccess && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              🔐 Pagamento confirmado! Sua conta terá acesso imediato após criação
            </p>
          </div>
        )}

        {/* Benefits List */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">
            ✨ O que você terá acesso:
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Simulados exclusivos para TEOT
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Trilhas de estudo organizadas
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Questões comentadas
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Suporte especializado
            </li>
          </ul>
        </div>

        {/* Hidden order data for post-signup processing */}
        {orderId && (
          <input 
            type="hidden" 
            id="payment-order-id" 
            value={orderId}
          />
        )}
      </div>
    </div>
  );
}
