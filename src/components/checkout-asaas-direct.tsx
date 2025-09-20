'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { useMutation, useQuery } from 'convex/react';
import { ArrowRight, CreditCard, FileText, Loader2, QrCode } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface CheckoutAsaasDirectProps {
  productId: string;
  productName: string;
  regularPrice: number;
  pixPrice: number;
  description: string;
}

/**
 * Checkout AsaaS Direto - Zero formulários
 * Usuário clica e vai direto para checkout da AsaaS
 */
export function CheckoutAsaasDirect({
  productId,
  productName,
  regularPrice,
  pixPrice,
  description
}: CheckoutAsaasDirectProps) {
  const initiateCheckout = useMutation(api.asaas.initiateCheckout);
  const [loading, setLoading] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState<Id<"pendingOrders"> | null>(null);

  // Subscribe to checkout status
  const checkoutStatus = useQuery(
    api.asaas.getCheckoutStatus,
    checkoutRequestId ? { checkoutRequestId } : "skip"
  );

  // Auto-redirect when checkout URL is ready
  if (checkoutStatus?.checkoutUrl) {
    window.location.href = checkoutStatus.checkoutUrl;
  }

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const result = await initiateCheckout({
        productId,
        // No email needed - zero friction checkout!
      });

      if (result.success) {
        console.log('Checkout iniciado:', result);
        setCheckoutRequestId(result.checkoutRequestId);
        // Will auto-redirect when URL is ready
      }
    } catch (error) {
      console.error('Erro ao iniciar checkout:', error);
      alert('Erro ao processar. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          {productName}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Preço Destaque */}
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900">
            R$ {regularPrice.toFixed(2)}
          </div>
          <div className="text-lg text-green-600 font-medium">
            PIX: R$ {pixPrice.toFixed(2)}
          </div>
          <div className="text-sm text-muted-foreground">
            Economize R$ {(regularPrice - pixPrice).toFixed(2)} no PIX
          </div>
        </div>

        {/* Métodos de Pagamento */}
        <div className="flex justify-center gap-4 text-sm text-gray-600">
          <div className="flex flex-col items-center gap-1">
            <CreditCard className="h-6 w-6" />
            <span>Cartão</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <QrCode className="h-6 w-6 text-green-600" />
            <span>PIX</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <FileText className="h-6 w-6" />
            <span>Boleto</span>
          </div>
        </div>

        {/* Botão Principal */}
        <Button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full h-12 text-lg"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              Comprar Agora
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>

        {/* Info Segurança */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>🔒 Pagamento 100% seguro</p>
          <p>📱 Checkout otimizado para mobile</p>
          <p>⚡ Aprovação instantânea no PIX</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default CheckoutAsaasDirect;
