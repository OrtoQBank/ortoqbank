'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock, RefreshCw, XCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'expired';

export default function CheckoutStatusPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('payment');
  
  const [status, setStatus] = useState<PaymentStatus>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkPaymentStatus = async () => {
    if (!paymentId) return;
    
    setIsLoading(true);
    try {
      // TODO: Implement actual payment status check with AsaaS API
      // For now, simulate different statuses
      const response = await fetch(`/api/asaas/payments/status?id=${paymentId}`);
      
      if (response.ok) {
        const data = await response.json();
        setStatus(data.status);
      } else {
        // Simulate random status for demo
        const statuses: PaymentStatus[] = ['pending', 'confirmed', 'failed'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        setStatus(randomStatus);
      }
      
      setLastChecked(new Date());
    } catch (error) {
      console.error('Error checking payment status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkPaymentStatus();
    
    // Auto-refresh every 10 seconds if payment is pending
    const interval = setInterval(() => {
      if (status === 'pending') {
        checkPaymentStatus();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [paymentId, status]);

  const getStatusIcon = () => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-12 h-12 text-green-600" />;
      case 'pending':
        return <Clock className="w-12 h-12 text-yellow-600" />;
      case 'failed':
        return <XCircle className="w-12 h-12 text-red-600" />;
      case 'expired':
        return <XCircle className="w-12 h-12 text-gray-600" />;
      default:
        return <Clock className="w-12 h-12 text-gray-600" />;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'confirmed':
        return 'Pagamento Confirmado!';
      case 'pending':
        return 'Aguardando Pagamento';
      case 'failed':
        return 'Pagamento Falhou';
      case 'expired':
        return 'Pagamento Expirado';
      default:
        return 'Verificando Status...';
    }
  };

  const getStatusDescription = () => {
    switch (status) {
      case 'confirmed':
        return 'Seu pagamento foi processado com sucesso!';
      case 'pending':
        return 'Ainda estamos aguardando a confirmação do seu pagamento PIX';
      case 'failed':
        return 'Houve um problema com seu pagamento';
      case 'expired':
        return 'O prazo para pagamento expirou';
      default:
        return 'Verificando o status do seu pagamento...';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'confirmed':
        return 'text-green-600';
      case 'pending':
        return 'text-yellow-600';
      case 'failed':
        return 'text-red-600';
      case 'expired':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  if (!paymentId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">ID de Pagamento Não Encontrado</h2>
                <p className="text-gray-600 mb-4">
                  Não foi possível encontrar o ID do pagamento na URL.
                </p>
                <Button onClick={() => router.push('/')}>
                  Voltar ao Início
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
            <div className="mx-auto mb-4">
              {getStatusIcon()}
            </div>
            <CardTitle className={`text-2xl ${getStatusColor()}`}>
              {getStatusTitle()}
            </CardTitle>
            <CardDescription>
              {getStatusDescription()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status-specific content */}
            {status === 'confirmed' && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Sucesso!</strong> Você receberá um email com instruções para criar sua conta.
                </AlertDescription>
              </Alert>
            )}

            {status === 'pending' && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <Clock className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <strong>Aguardando...</strong> Seu pagamento PIX ainda está sendo processado. 
                  Isso pode levar alguns minutos.
                </AlertDescription>
              </Alert>
            )}

            {status === 'failed' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Erro:</strong> Houve um problema com seu pagamento. 
                  Verifique se o pagamento foi realizado ou tente novamente.
                </AlertDescription>
              </Alert>
            )}

            {status === 'expired' && (
              <Alert className="border-gray-200 bg-gray-50">
                <XCircle className="h-4 w-4 text-gray-600" />
                <AlertDescription className="text-gray-800">
                  <strong>Expirado:</strong> O prazo para pagamento expirou. 
                  Você precisará gerar um novo PIX.
                </AlertDescription>
              </Alert>
            )}

            {/* Payment Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Informações do Pagamento</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p><strong>ID do Pagamento:</strong> {paymentId}</p>
                {lastChecked && (
                  <p><strong>Última Verificação:</strong> {lastChecked.toLocaleTimeString('pt-BR')}</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {status === 'pending' && (
                <Button 
                  onClick={checkPaymentStatus}
                  disabled={isLoading}
                  variant="outline"
                  className="flex items-center"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Verificar Novamente
                </Button>
              )}

              {status === 'confirmed' && (
                <Button 
                  onClick={() => router.push('/checkout/success?paymentId=' + paymentId)}
                  className="flex items-center"
                >
                  Continuar
                </Button>
              )}

              {(status === 'failed' || status === 'expired') && (
                <Button 
                  onClick={() => router.push('/checkout')}
                  className="flex items-center"
                >
                  Tentar Novamente
                </Button>
              )}

              <Button 
                variant="outline" 
                onClick={() => router.push('/')}
              >
                Voltar ao Início
              </Button>
            </div>

            {/* Auto-refresh indicator */}
            {status === 'pending' && (
              <div className="text-center text-sm text-gray-500">
                <p>Esta página será atualizada automaticamente a cada 10 segundos</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
