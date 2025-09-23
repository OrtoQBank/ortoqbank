'use client';

import { useQuery } from 'convex/react';
import { CheckCircle, Clock, RefreshCw, XCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';

export default function PaymentProcessingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');
  const [manualRefresh, setManualRefresh] = useState(0);

  // Check payment status with reduced polling frequency
  const orderStatus = useQuery(
    api.asaas.getCheckoutStatus,
    orderId ? { checkoutRequestId: orderId as Id<"pendingOrders"> } : "skip"
  );

  // Manual refresh function
  const handleManualRefresh = () => {
    setManualRefresh(prev => prev + 1);
  };

  useEffect(() => {
    if (orderStatus?.status === 'paid') {
      // Payment confirmed! Redirect to sign-up
      router.push(`/sign-up?payment=confirmed&order=${orderId}`);
    } else if (orderStatus?.status === 'failed') {
      // Payment failed, redirect to retry
      router.push(`/payment/failed?order=${orderId}`);
    }
  }, [orderStatus, router, orderId]);

  if (!orderId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-900 mb-2">
            Erro na Transação
          </h1>
          <p className="text-red-700">ID da ordem não encontrado</p>
        </div>
      </div>
    );
  }

  // Show loading while waiting for payment confirmation
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        
        {/* Loading Animation */}
        <div className="relative">
          <Clock className="h-20 w-20 text-blue-600 mx-auto animate-pulse" />
          <div className="absolute inset-0 h-20 w-20 mx-auto">
            <div className="h-20 w-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        </div>

        {/* Main Message */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🔐 Processando Pagamento...
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Aguarde enquanto confirmamos seu pagamento de forma segura
          </p>
        </div>

        {/* Status Info */}
        <div className="bg-white rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Status:</span>
            <span className="font-medium text-blue-600">
              {orderStatus?.status === 'ready' ? 'Aguardando confirmação' : 
               orderStatus?.status === 'pending' ? 'Processando...' :
               'Verificando...'}
            </span>
          </div>
          
          <div className="border-t pt-4">
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                <span>Pagamento enviado</span>
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-blue-500 mr-2 animate-pulse" />
                <span>Confirmação em andamento</span>
              </div>
              <div className="flex items-center opacity-50">
                <div className="h-4 w-4 rounded-full border-2 border-gray-300 mr-2"></div>
                <span>Criação da conta</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Message */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-green-800 mb-1">
                🛡️ Segurança Máxima
              </p>
              <p className="text-green-700">
                Sua conta só será criada após confirmação do pagamento. 
                Dados protegidos com criptografia de ponta.
              </p>
            </div>
          </div>
        </div>

        {/* Manual refresh button */}
        <div className="text-center">
          <button
            onClick={handleManualRefresh}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Verificar Status
          </button>
        </div>

        {/* Time estimate */}
        <p className="text-sm text-gray-500 text-center">
          ⏱️ Este processo geralmente leva de 30 segundos a 2 minutos
        </p>
      </div>
    </div>
  );
}
