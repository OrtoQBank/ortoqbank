'use client';

import { useQuery } from 'convex/react';
import { AlertCircle, CheckCircle, Clock, Copy, Loader2, QrCode } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { api } from '../../../../convex/_generated/api';

function PixPaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pendingOrderId = searchParams.get('order');
  const [copied, setCopied] = useState(false);
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
      if (paymentStatus.status === 'confirmed') {
        // Payment confirmed! Redirect to success page
        console.log('Payment confirmed, redirecting to success page');
        router.push(`/checkout/success?order=${pendingOrderId}`);
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
    }, 30_000);

    return () => clearTimeout(timer);
  }, [paymentStatus, router, pendingOrderId]);

  const handleCopyPixCode = () => {
    if (paymentStatus?.pixData?.qrPayload) {
      navigator.clipboard.writeText(paymentStatus.pixData.qrPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

  // Check if PIX data is available
  const hasPixData = paymentStatus?.pixData?.qrCodeBase64 || paymentStatus?.pixData?.qrPayload;

  if (!paymentStatus || !hasPixData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Loader2 className="w-12 h-12 text-brand-blue mx-auto mb-4 animate-spin" />
            <CardTitle className="text-brand-blue">Gerando QR Code PIX</CardTitle>
            <CardDescription>
              Aguarde enquanto geramos seu código PIX...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <QrCode className="w-12 h-12 text-brand-blue" />
            </div>
            <CardTitle className="text-2xl text-brand-blue">Pagamento via PIX</CardTitle>
            <CardDescription>
              Escaneie o QR Code ou copie o código para realizar o pagamento
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Payment Info */}
            {paymentStatus.orderDetails && (
              <div className="bg-brand-blue/10 p-4 rounded-lg">
                <h3 className="font-semibold text-brand-blue mb-2">Detalhes do Pedido</h3>
                <div className="space-y-1 text-sm text-brand-blue/90">
                  <p><strong>Email:</strong> {paymentStatus.orderDetails.email}</p>
                  <p><strong>Produto:</strong> {paymentStatus.orderDetails.productId}</p>
                  <p><strong>Valor:</strong> R$ {paymentStatus.orderDetails.finalPrice.toFixed(2)}</p>
                  {paymentStatus.pixData?.expirationDate && (
                    <p><strong>Expira em:</strong> {new Date(paymentStatus.pixData.expirationDate).toLocaleString('pt-BR')}</p>
                  )}
                </div>
              </div>
            )}

            {/* QR Code Display */}
            {paymentStatus.pixData?.qrCodeBase64 && (
              <div className="bg-white p-6 rounded-lg border-2 border-gray-200 flex flex-col items-center">
                <div className="relative w-64 h-64 mb-4">
                  <Image
                    src={`data:image/png;base64,${paymentStatus.pixData.qrCodeBase64}`}
                    alt="QR Code PIX"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <p className="text-sm text-gray-600 text-center">
                  Abra o app do seu banco e escaneie este QR Code
                </p>
              </div>
            )}

            {/* Copy PIX Code */}
            {paymentStatus.pixData?.qrPayload && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Ou copie o código PIX Copia e Cola:
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={paymentStatus.pixData.qrPayload}
                      readOnly
                      className="w-full p-3 pr-12 border border-gray-300 rounded-lg bg-gray-50 text-xs font-mono overflow-hidden text-ellipsis"
                    />
                  </div>
                  <Button
                    onClick={handleCopyPixCode}
                    className="flex items-center gap-2"
                    variant={copied ? "default" : "outline"}
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Instructions */}
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Como pagar:</strong></p>
                  <ol className="text-sm space-y-1 ml-4 list-decimal">
                    <li>Abra o aplicativo do seu banco</li>
                    <li>Acesse a área PIX</li>
                    <li>Escolha Pagar com QR Code ou PIX Copia e Cola</li>
                    <li>Escaneie o código acima ou cole o código copiado</li>
                    <li>Confirme o pagamento</li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>

            {/* Real-time status */}
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-yellow-900">Aguardando pagamento...</span>
              </div>
              <p className="text-sm text-yellow-800">
                Esta página atualiza automaticamente quando o pagamento for confirmado.
                Você será redirecionado assim que recebermos a confirmação do seu banco.
              </p>
            </div>

            {/* Manual Check Option */}
            {showManualCheck && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <p><strong>Está demorando mais que o esperado?</strong></p>
                    <p className="text-sm">
                      A confirmação do pagamento PIX pode levar alguns minutos.
                      Se você já realizou o pagamento, aguarde a confirmação.
                      Esta página detectará automaticamente quando o pagamento for confirmado.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => router.push('/')}
                className="w-full"
              >
                Voltar ao Início
              </Button>
              <p className="text-xs text-center text-gray-500">
                Não feche esta página até a confirmação do pagamento
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PixPaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    }>
      <PixPaymentContent />
    </Suspense>
  );
}
