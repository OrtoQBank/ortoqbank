'use client';

import { useQuery } from 'convex/react';
import { CheckCircle, Home,Loader2, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { api } from '../../../../convex/_generated/api';

declare global {
  interface Window {
    dataLayer?: Object[];
  }
}

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');
  
  const gtmEventSentRef = useRef(false);

  // Get order details
  const orderDetails = useQuery(
    api.payments.getPendingOrderById,
    orderId ? { orderId } : 'skip'
  );

  // Send GTM purchase event
  useEffect(() => {
    if (orderDetails && !gtmEventSentRef.current && typeof globalThis !== 'undefined') {
      const dataLayer = (globalThis as typeof globalThis & { dataLayer?: Object[] }).dataLayer;
      if (dataLayer) {
        dataLayer.push({
          event: 'purchase',
          transaction_id: orderId,
          value: orderDetails.finalPrice,
          currency: 'BRL',
          items: [{
            item_id: orderDetails.productId,
            item_name: orderDetails.productId,
            price: orderDetails.finalPrice,
            quantity: 1,
          }],
        });
        console.log('GTM purchase event sent:', {
          transaction_id: orderId,
          value: orderDetails.finalPrice,
        });
        gtmEventSentRef.current = true;
      }
    }
  }, [orderDetails, orderId]);

  if (!orderId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertDescription className="text-red-600 font-medium">
                  ID do pedido não encontrado
                </AlertDescription>
                <Button onClick={() => router.push('/')} className="mt-4">
                  Voltar ao Início
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!orderDetails) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-blue mx-auto mb-4" />
                <p className="text-lg">Carregando detalhes do pedido...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
            </div>
            <CardTitle className="text-3xl text-green-600">
              Pagamento Confirmado!
            </CardTitle>
            <CardDescription className="text-lg">
              Seu pagamento foi processado com sucesso
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Success Message */}
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Parabéns!</strong> Seu pagamento foi confirmado. Você receberá um email com instruções para criar sua conta e acessar a plataforma.
              </AlertDescription>
            </Alert>

            {/* Email Instructions */}
            <div className="bg-brand-blue/10 p-6 rounded-lg border border-brand-blue/20">
              <h3 className="font-semibold text-brand-blue mb-4 flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                Próximos Passos
              </h3>
              <div className="space-y-3 text-brand-blue/90">
                <div className="flex items-start">
                  <div className="bg-brand-blue/20 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                    1
                  </div>
                  <p>Verifique seu email <strong>({orderDetails.email})</strong> nos próximos minutos</p>
                </div>
                <div className="flex items-start">
                  <div className="bg-brand-blue/20 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                    2
                  </div>
                  <p>O email conterá um link para criar sua conta na plataforma OrtoQBank</p>
                </div>
                <div className="flex items-start">
                  <div className="bg-brand-blue/20 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                    3
                  </div>
                  <p>Após criar sua conta, você terá acesso completo ao conteúdo</p>
                </div>
              </div>
            </div>

            {/* Quick Email Access Buttons */}
            <div className="space-y-3">
              <p className="text-center text-sm font-medium text-gray-700">
                Acesse seu email rapidamente:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open('https://mail.google.com', '_blank')}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Abrir Gmail
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open('https://outlook.live.com', '_blank')}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Abrir Outlook
                </Button>
              </div>
            </div>

            {/* Order Details */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold mb-3 text-gray-900">Detalhes da Compra</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span className="font-medium">ID do Pedido:</span>
                  <span className="font-mono text-xs">{orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Email:</span>
                  <span>{orderDetails.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Produto:</span>
                  <span>{orderDetails.productId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Valor:</span>
                  <span className="text-green-600 font-semibold">R$ {orderDetails.finalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Data:</span>
                  <span>{new Date().toLocaleString('pt-BR')}</span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex flex-col gap-3 pt-4">
              <Button 
                onClick={() => router.push('/')}
                className="w-full flex items-center justify-center"
                size="lg"
              >
                <Home className="w-4 h-4 mr-2" />
                Voltar ao Início
              </Button>
            </div>

            {/* Support Note */}
            <div className="text-center text-sm text-gray-600 pt-4 border-t">
              <p>
                Não recebeu o email? Verifique sua caixa de spam ou{' '}
                <button 
                  onClick={() => router.push('/suporte')}
                  className="text-brand-blue hover:underline font-medium"
                >
                  entre em contato conosco
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
