'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useMutation } from 'convex/react';
import { CreditCard, FileText, Loader2, QrCode } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../convex/_generated/api';

interface CheckoutAsaasExampleProps {
  productId: string;
  productName: string;
  regularPrice: number;
  pixPrice: number;
  description: string;
}

/**
 * Componente de exemplo para Checkout AsaaS
 * 
 * ✅ ATUALIZADO: Agora usa useMutation em vez de useAction
 * 
 * Esta versão demonstra:
 * - Mutation captura intenção no database
 * - Action é executada em background automaticamente  
 * - Mais simples que a versão reativa, mas ainda segue padrão recomendado
 * 
 * Para versão completa com subscription e status em tempo real:
 * @see checkout-asaas-reactive.tsx
 */
export function CheckoutAsaasExample({
  productId,
  productName,
  regularPrice,
  pixPrice,
  description
}: CheckoutAsaasExampleProps) {
  const initiateCheckout = useMutation(api.asaas.initiateCheckout);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    cpf: '',
    phone: '',
    street: '',
    number: '',
    zipcode: '',
    city: '',
    state: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const formatZipcode = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{3})\d+?$/, '$1');
  };

  const isFormValid = () => {
    const required = ['email', 'firstName', 'lastName', 'cpf'];
    return required.every(field => formData[field as keyof typeof formData].trim() !== '');
  };

  const handleCheckout = async () => {
    if (!isFormValid()) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      // ✅ Padrão recomendado: usar mutation em vez de action diretamente
      const result = await initiateCheckout({
        productId,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        cpf: formData.cpf.replace(/\D/g, ''), // Remove formatação
        phone: formData.phone ? formData.phone.replace(/\D/g, '') : undefined,
        // Endereço é opcional mas melhora a experiência
        address: formData.street && formData.number ? {
          street: formData.street,
          number: formData.number,
          zipcode: formData.zipcode.replace(/\D/g, ''),
          city: formData.city,
          state: formData.state
        } : undefined
      });

      if (result.success) {
        console.log('Checkout iniciado:', {
          checkoutRequestId: result.checkoutRequestId,
          status: result.status
        });
        
        // Em uma versão mais simples, podemos apenas mostrar sucesso
        // O checkout será processado em background
        alert('Checkout iniciado! O processamento está em andamento...');
        
        // Opcional: implementar polling ou redirect para uma página de status
        // Para exemplo completo com subscription, ver checkout-asaas-reactive.tsx
      }
    } catch (error) {
      console.error('Erro ao criar checkout:', error);
      alert('Erro ao processar checkout. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Checkout AsaaS (Mutation) - {productName}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
        
        {/* Preços */}
        <div className="flex gap-4 pt-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Cartão/Boleto: </span>
            <span className="font-semibold">R$ {regularPrice.toFixed(2)}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">PIX: </span>
            <span className="font-semibold text-green-600">R$ {pixPrice.toFixed(2)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Informações Pessoais - Obrigatórias */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Informações Pessoais *</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">Nome *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="João"
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Sobrenome *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Silva"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="joao@email.com"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) => handleInputChange('cpf', formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', formatPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                maxLength={15}
              />
            </div>
          </div>
        </div>

        {/* Endereço - Opcional mas melhora UX */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Endereço (Opcional)</h3>
          <p className="text-xs text-muted-foreground">
            Preencher o endereço agiliza o checkout na AsaaS
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="street">Rua</Label>
              <Input
                id="street"
                value={formData.street}
                onChange={(e) => handleInputChange('street', e.target.value)}
                placeholder="Rua das Flores"
              />
            </div>
            <div>
              <Label htmlFor="number">Número</Label>
              <Input
                id="number"
                value={formData.number}
                onChange={(e) => handleInputChange('number', e.target.value)}
                placeholder="123"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="zipcode">CEP</Label>
              <Input
                id="zipcode"
                value={formData.zipcode}
                onChange={(e) => handleInputChange('zipcode', formatZipcode(e.target.value))}
                placeholder="01234-567"
                maxLength={9}
              />
            </div>
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="São Paulo"
              />
            </div>
            <div>
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value.toUpperCase())}
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>
        </div>

        {/* Métodos de Pagamento Suportados */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Métodos de Pagamento</h3>
          <div className="flex gap-4 text-sm text-muted-foreground">
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
          disabled={loading || !isFormValid()}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Iniciando checkout...
            </>
          ) : (
            `Iniciar Checkout - R$ ${regularPrice.toFixed(2)}`
          )}
        </Button>

        {/* Informações sobre o processo */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• ✅ Usa Mutation em vez de Action direta (padrão recomendado)</p>
          <p>• 🔄 Checkout processado em background</p>
          <p>• 💰 PIX com desconto (R$ {pixPrice.toFixed(2)})</p>
          <p>• ⏰ Para monitoramento em tempo real, veja checkout-asaas-reactive.tsx</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default CheckoutAsaasExample;
