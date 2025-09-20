'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useMutation, useQuery } from 'convex/react';
import { AlertCircle, CheckCircle, Clock, CreditCard, FileText, Loader2, QrCode } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface CheckoutAsaasReactiveProps {
  productId: string;
  productName: string;
  regularPrice: number;
  pixPrice: number;
  description: string;
}

/**
 * ✅ Implementação COMPLETA seguindo padrão Convex:
 * 1. Mutation captura intenção e agenda action
 * 2. Subscription monitora status em tempo real
 * 3. Redirecionamento automático quando pronto
 */
export function CheckoutAsaasReactive({
  productId,
  productName,
  regularPrice,
  pixPrice,
  description
}: CheckoutAsaasReactiveProps) {
  const initiateCheckout = useMutation(api.asaas.initiateCheckout);
  const [checkoutRequestId, setCheckoutRequestId] = useState<Id<"pendingOrders"> | null>(null);
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

  // ✅ Subscription para monitorar status do checkout em tempo real
  const checkoutStatus = useQuery(
    api.asaas.getCheckoutStatus,
    checkoutRequestId ? { checkoutRequestId } : "skip"
  );

  // ✅ Auto-redirect quando checkout está pronto
  useEffect(() => {
    if (checkoutStatus?.status === 'ready' && checkoutStatus.checkoutUrl) {
      console.log('Checkout pronto! Redirecionando...', checkoutStatus.checkoutUrl);
      
      // Pequeno delay para mostrar o status "pronto" ao usuário
      setTimeout(() => {
        window.location.href = checkoutStatus.checkoutUrl!;
      }, 1500);
    }
  }, [checkoutStatus]);

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
        setCheckoutRequestId(result.checkoutRequestId);
        console.log('Checkout iniciado:', result);
      }
    } catch (error) {
      console.error('Erro ao iniciar checkout:', error);
      alert('Erro ao processar checkout. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Renderizar status do checkout
  const renderCheckoutStatus = () => {
    if (!checkoutStatus) return null;

    const getStatusConfig = (status: string) => {
      switch (status) {
        case 'creating':
          return {
            icon: <Clock className="h-4 w-4" />,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50 border-blue-200',
            title: 'Criando checkout...',
            description: 'Processando seu pedido na AsaaS'
          };
        case 'ready':
          return {
            icon: <CheckCircle className="h-4 w-4" />,
            color: 'text-green-600',
            bgColor: 'bg-green-50 border-green-200',
            title: 'Checkout pronto!',
            description: 'Redirecionando para pagamento...'
          };
        case 'failed':
          return {
            icon: <AlertCircle className="h-4 w-4" />,
            color: 'text-red-600',
            bgColor: 'bg-red-50 border-red-200',
            title: 'Erro ao criar checkout',
            description: checkoutStatus.error || 'Erro desconhecido'
          };
        default:
          return {
            icon: <Clock className="h-4 w-4" />,
            color: 'text-gray-600',
            bgColor: 'bg-gray-50 border-gray-200',
            title: `Status: ${status}`,
            description: 'Processando...'
          };
      }
    };

    const config = getStatusConfig(checkoutStatus.status);

    return (
      <Alert className={`${config.bgColor} ${config.color}`}>
        <div className="flex items-center gap-2">
          {config.icon}
          <div>
            <h4 className="font-medium">{config.title}</h4>
            <AlertDescription>{config.description}</AlertDescription>
          </div>
        </div>
      </Alert>
    );
  };

  const isProcessing = loading || (checkoutStatus && ['creating', 'ready'].includes(checkoutStatus.status));

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Checkout AsaaS (Reativo) - {productName}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
        
        {/* Status do Padrão Convex */}
        <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
          <p className="font-medium text-green-900">✅ Padrão Convex Implementado:</p>
          <p className="text-green-700">Mutation → Action → Real-time Subscription → Auto-redirect</p>
        </div>
        
        {/* Status do Checkout */}
        {renderCheckoutStatus()}
        
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
        {/* Form só aparece se não estiver processando */}
        {!isProcessing && (
          <>
            {/* Informações Pessoais */}
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

            {/* Endereço Opcional */}
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

            {/* Métodos de Pagamento */}
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
          </>
        )}

        {/* Botão de Checkout */}
        <Button
          onClick={handleCheckout}
          disabled={isProcessing || !isFormValid()}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {checkoutStatus?.status === 'creating' && 'Criando checkout...'}
              {checkoutStatus?.status === 'ready' && 'Redirecionando...'}
              {loading && 'Processando...'}
            </>
          ) : (
            `Iniciar Checkout - R$ ${regularPrice.toFixed(2)}`
          )}
        </Button>

        {/* Informações */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• ✅ Padrão Convex: Mutation → Action → Subscription</p>
          <p>• 🔄 Status monitorado em tempo real</p>
          <p>• 🚀 Redirecionamento automático quando pronto</p>
          <p>• 💰 PIX com desconto (R$ {pixPrice.toFixed(2)})</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default CheckoutAsaasReactive;
