'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, CheckCircle, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const orderId = searchParams.get('orderId');
  
  const [isLoading, setIsLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'confirmed' | 'pending' | 'failed'>('pending');

  useEffect(() => {
    // Simulate checking payment status
    // In a real implementation, you would call an API to check the payment status
    const checkPaymentStatus = async () => {
      try {
        // TODO: Implement actual payment status check
        // const response = await fetch(`/api/payments/status?id=${paymentId}`);
        // const data = await response.json();
        
        // For now, simulate a successful payment
        setTimeout(() => {
          setPaymentStatus('confirmed');
          setIsLoading(false);
        }, 2000);
      } catch (error) {
        console.error('Error checking payment status:', error);
        setPaymentStatus('failed');
        setIsLoading(false);
      }
    };

    if (paymentId) {
      checkPaymentStatus();
    } else {
      setIsLoading(false);
    }
  }, [paymentId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-lg">Verificando status do pagamento...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'failed') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-red-600">
                Pagamento Não Confirmado
              </CardTitle>
              <CardDescription>
                Não foi possível confirmar seu pagamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert variant="destructive">
                <AlertDescription>
                  Houve um problema ao processar seu pagamento. Por favor, verifique se o pagamento foi realizado
                  ou entre em contato com nosso suporte.
                </AlertDescription>
              </Alert>

              <div className="flex gap-4 justify-center">
                <Button variant="outline" onClick={() => router.push('/')}>
                  Voltar ao Início
                </Button>
                <Button onClick={() => router.push('/suporte')}>
                  Falar com Suporte
                </Button>
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
            <CardTitle className="text-2xl text-green-600">
              <CheckCircle className="w-12 h-12 mx-auto mb-4" />
              Pagamento Confirmado!
            </CardTitle>
            <CardDescription>
              Seu pagamento foi processado com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Success Message */}
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Parabéns!</strong> Seu pagamento foi confirmado e seu acesso está sendo preparado.
              </AlertDescription>
            </Alert>

            {/* Next Steps */}
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-4 flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                Próximos Passos
              </h3>
              <div className="space-y-3 text-blue-800">
                <div className="flex items-start">
                  <div className="bg-blue-200 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">
                    1
                  </div>
                  <p>Você receberá um email de confirmação nos próximos minutos</p>
                </div>
                <div className="flex items-start">
                  <div className="bg-blue-200 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">
                    2
                  </div>
                  <p>O email conterá um link para criar sua conta na plataforma</p>
                </div>
                <div className="flex items-start">
                  <div className="bg-blue-200 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">
                    3
                  </div>
                  <p>Após criar sua conta, você terá acesso completo ao OrtoQBank</p>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            {(paymentId || orderId) && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Detalhes da Compra</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  {paymentId && (
                    <p><strong>ID do Pagamento:</strong> {paymentId}</p>
                  )}
                  {orderId && (
                    <p><strong>ID do Pedido:</strong> {orderId}</p>
                  )}
                  <p><strong>Data:</strong> {new Date().toLocaleString('pt-BR')}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="outline" 
                onClick={() => router.push('/')}
                className="flex items-center"
              >
                Voltar ao Início
              </Button>
              <Button 
                onClick={() => router.push('/sign-up')}
                className="flex items-center"
              >
                Criar Minha Conta
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Support */}
            <div className="text-center text-sm text-gray-600">
              <p>
                Não recebeu o email? Verifique sua caixa de spam ou{' '}
                <button 
                  onClick={() => router.push('/suporte')}
                  className="text-blue-600 hover:underline"
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
