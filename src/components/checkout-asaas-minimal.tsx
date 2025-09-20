'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useMutation } from 'convex/react';
import { CreditCard, FileText, Loader2, QrCode } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../convex/_generated/api';

interface CheckoutAsaasMinimalProps {
  productId: string;
  productName: string;
  regularPrice: number;
  pixPrice: number;
  description: string;
}

/**
 * Checkout AsaaS Minimal - Só pede email e vai direto para checkout
 * O usuário preenche todos os dados na própria AsaaS
 */
export function CheckoutAsaasMinimal({
  productId,
  productName,
  regularPrice,
  pixPrice,
  description
}: CheckoutAsaasMinimalProps) {
  const initiateCheckout = useMutation(api.asaas.initiateCheckout);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  const isEmailValid = () => {
    return email.trim() !== '' && email.includes('@');
  };

  const handleCheckout = async () => {
    if (!isEmailValid()) {
      alert('Por favor, digite um email válido.');
      return;
    }

    setLoading(true);
    try {
      const result = await initiateCheckout({
        productId,
        email: email.trim(),
        // Dados mínimos - usuário preencherá o resto na AsaaS
        firstName: 'Cliente', // Placeholder
        lastName: 'AsaaS', // Placeholder
        cpf: '00000000000', // Placeholder - será preenchido na AsaaS
      });

      if (result.success) {
        console.log('Checkout iniciado:', result);
        alert('Redirecionando para checkout...');
        
        // Em uma implementação real, você poderia:
        // 1. Redirecionar imediatamente para uma página de loading
        // 2. Usar o componente reativo para monitorar status
        // 3. Ou implementar polling aqui mesmo
      }
    } catch (error) {
      console.error('Erro ao iniciar checkout:', error);
      alert('Erro ao processar checkout. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <CreditCard className="h-5 w-5" />
          {productName}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
        
        {/* Preços */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="text-lg font-bold">
            R$ {regularPrice.toFixed(2)}
          </div>
          <div className="text-sm text-green-600">
            PIX: R$ {pixPrice.toFixed(2)} (economize R$ {(regularPrice - pixPrice).toFixed(2)})
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Apenas email */}
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            autoFocus
          />
          <p className="text-xs text-muted-foreground mt-1">
            Você completará seus dados na página de pagamento segura
          </p>
        </div>

        {/* Métodos de Pagamento */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Métodos Disponíveis</h3>
          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <CreditCard className="h-4 w-4" />
              <span>Cartão</span>
            </div>
            <div className="flex items-center gap-1">
              <QrCode className="h-4 w-4" />
              <span>PIX</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>Boleto</span>
            </div>
          </div>
        </div>

        {/* Botão de Checkout */}
        <Button
          onClick={handleCheckout}
          disabled={loading || !isEmailValid()}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            'Continuar para Pagamento'
          )}
        </Button>

        {/* Informações */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>🔒 Checkout 100% seguro via AsaaS</p>
          <p>📄 Você preencherá seus dados na próxima etapa</p>
          <p>💰 Melhor preço no PIX</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default CheckoutAsaasMinimal;
