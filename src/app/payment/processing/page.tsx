'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from 'convex/react';
import { AlertCircle, Clock, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../convex/_generated/api';

export default function PaymentProcessingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pendingOrderId = searchParams.get('order');
  const [showManualCheck, setShowManualCheck] = useState(false);

  // Real-time payment status - no polling needed!
  const paymentStatus = useQuery(
    api.payments.checkPaymentStatus,
    pendingOrderId ? { pendingOrderId } : 'skip'
  );

  useEffect(() => {
    if (!pendingOrderId) {
      router.push('/?error=payment_required');
      return;
    }
  }, [pendingOrderId, router]);

  useEffect(() => {
    if (paymentStatus) {
      if (paymentStatus.status === 'confirmed' && paymentStatus.claimToken) {
        // Payment confirmed! Redirect to sign-up with claim token
        console.log('Payment confirmed, redirecting to sign-up with claim token');
        router.push(`/sign-up?claim=${paymentStatus.claimToken}`);
        return;
      }

      if (paymentStatus.status === 'failed') {
        // Payment failed - stay on page to show error
        return;
      }
    }

    // Show manual check option after 30 seconds for pending payments
    const timer = setTimeout(() => {
      if (paymentStatus?.status === 'pending') {
        setShowManualCheck(true);
      }
    }, 30000);

    return () => clearTimeout(timer);
  }, [paymentStatus, router]);

  if (!pendingOrderId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Erro</CardTitle>
            <CardDescription>ID do pedido não encontrado</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => router.push('/')}>
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentStatus?.status === 'failed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Pagamento Não Encontrado</CardTitle>
            <CardDescription>
              Não foi possível encontrar informações sobre este pagamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Verifique se o pagamento foi processado corretamente ou tente novamente.
              </AlertDescription>
            </Alert>
            <div className="flex flex-col gap-2">
              <Button onClick={() => router.push('/checkout')}>
                Tentar Novamente
              </Button>
              <Button variant="outline" onClick={() => router.push('/')}>
                Voltar ao Início
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="relative">
            <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
            <Clock className="w-6 h-6 text-blue-300 absolute top-3 left-1/2 transform -translate-x-1/2" />
          </div>
          <CardTitle className="text-blue-600">Processando Pagamento</CardTitle>
          <CardDescription>
            Aguarde enquanto confirmamos seu pagamento...
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Payment Info */}
          {paymentStatus?.orderDetails && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Detalhes do Pedido</h3>
              <div className="space-y-1 text-sm text-blue-800">
                <p><strong>Email:</strong> {paymentStatus.orderDetails.email}</p>
                <p><strong>Produto:</strong> {paymentStatus.orderDetails.productId}</p>
                <p><strong>Valor:</strong> R$ {paymentStatus.orderDetails.finalPrice.toFixed(2)}</p>
                <p><strong>ID do Pedido:</strong> {pendingOrderId}</p>
              </div>
            </div>
          )}

          {/* Status Messages */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Aguardando confirmação do pagamento...</span>
            </div>
            
            <div className="text-xs text-gray-500 space-y-1">
              <p>• Para PIX: A confirmação pode levar alguns minutos</p>
              <p>• Para Cartão: A confirmação é quase imediata</p>
              <p>• Você será redirecionado automaticamente quando confirmado</p>
              <p>• Esta página atualiza em tempo real - sem necessidade de recarregar</p>
            </div>
          </div>

          {/* Manual Check Option */}
          {showManualCheck && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Está demorando mais que o esperado?</strong></p>
                  <p className="text-sm">
                    Se você já confirmou o pagamento PIX, a confirmação pode levar alguns minutos.
                    Esta página detectará automaticamente quando o pagamento for confirmado.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <Button 
              variant="outline" 
              onClick={() => router.push('/')}
              className="w-full"
            >
              Voltar ao Início
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}