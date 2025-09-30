'use client';

import { MessageCircle, RefreshCw, XCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';

const handleRetryPayment = () => {
  // Redirect back to pricing plans to retry
  globalThis.location.href = '/';
};

function PaymentFailedContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');

  const handleContactSupport = () => {
    // Redirect to support with context
    globalThis.location.href = `/suporte?issue=payment-failed&order=${orderId}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        
        {/* Error Icon */}
        <XCircle className="h-20 w-20 text-red-600 mx-auto" />

        {/* Main Message */}
        <div>
          <h1 className="text-3xl font-bold text-red-900 mb-4">
            ❌ Pagamento Não Aprovado
          </h1>
          <p className="text-lg text-red-700 mb-6">
            Não foi possível processar seu pagamento
          </p>
        </div>

        {/* Reasons */}
        <div className="bg-white rounded-lg p-6 shadow-sm text-left">
          <h3 className="font-semibold text-gray-900 mb-3">
            Possíveis motivos:
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="text-red-500 mr-2">•</span>
              <span>Cartão sem limite ou dados incorretos</span>
            </li>
            <li className="flex items-start">
              <span className="text-red-500 mr-2">•</span>
              <span>PIX não foi realizado no prazo</span>
            </li>
            <li className="flex items-start">
              <span className="text-red-500 mr-2">•</span>
              <span>Problema técnico temporário</span>
            </li>
            <li className="flex items-start">
              <span className="text-red-500 mr-2">•</span>
              <span>Boleto vencido ou não pago</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            onClick={handleRetryPayment}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            <RefreshCw className="mr-2 h-5 w-5" />
            Tentar Novamente
          </Button>

          <Button 
            onClick={handleContactSupport}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            Falar com Suporte
          </Button>
        </div>

        {/* Security Message */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm">
            <p className="font-medium text-blue-800 mb-1">
              🔒 Dados Protegidos
            </p>
            <p className="text-blue-700">
              Nenhuma conta foi criada. Seus dados estão seguros.
              Tente novamente quando resolver o problema do pagamento.
            </p>
          </div>
        </div>

        {/* Order Reference */}
        {orderId && (
          <p className="text-xs text-gray-500">
            Referência: {orderId}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <PaymentFailedContent />
    </Suspense>
  );
}
