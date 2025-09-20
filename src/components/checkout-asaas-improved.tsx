'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useMutation } from 'convex/react';
import { CreditCard, FileText, Loader2, QrCode } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../convex/_generated/api';

interface CheckoutAsaasImprovedProps {
  productId: string;
  productName: string;
  regularPrice: number;
  pixPrice: number;
  description: string;
}

/**
 * Versão melhorada do Checkout AsaaS seguindo o padrão recomendado:
 * 1. Mutation captura a intenção e escreve no DB
 * 2. Mutation agenda a action para processar o checkout
 * 3. Cliente monitora o status via subscription
 */
export function CheckoutAsaasImproved({
  productId,
  productName,
  regularPrice,
  pixPrice,
  description
}: CheckoutAsaasImprovedProps) {
  // ✅ Padrão recomendado: usar mutation que agenda action
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
      // ✅ Padrão recomendado: mutation que captura intenção e agenda action
      const result = await initiateCheckout({
        productId,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        cpf: formData.cpf.replace(/\D/g, ''),
        phone: formData.phone ? formData.phone.replace(/\D/g, '') : undefined,
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
        
        // Aqui você pode:
        // 1. Mostrar loading state
        // 2. Usar subscription para monitorar status
        // 3. Redirecionar quando checkout URL estiver pronto
        alert('Checkout sendo processado... Você será redirecionado em breve.');
        
        // Em uma implementação real, você usaria uma subscription
        // para monitorar quando a action completa e o checkout URL fica pronto
      }
    } catch (error) {
      console.error('Erro ao iniciar checkout:', error);
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
          Checkout AsaaS (Versão Melhorada) - {productName}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
        
        {/* Padrão Convex Info */}
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
          <p className="font-medium text-blue-900">✅ Seguindo padrão recomendado Convex:</p>
          <p className="text-blue-700">Mutation captura intenção → Agenda Action → Monitora status</p>
        </div>
        
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
              Processando checkout...
            </>
          ) : (
            `Pagar - R$ ${regularPrice.toFixed(2)}`
          )}
        </Button>

        {/* Informações sobre o processo */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Checkout processado de forma assíncrona (padrão Convex)</p>
          <p>• Você será redirecionado para o checkout seguro da AsaaS</p>
          <p>• Pagamento com PIX tem desconto (R$ {pixPrice.toFixed(2)})</p>
          <p>• Checkout expira em 24 horas</p>
          <p>• Após pagamento, você receberá acesso por email</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default CheckoutAsaasImproved;
