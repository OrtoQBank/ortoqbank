'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useAction, useMutation, useQuery } from 'convex/react';
import { Loader2, Tag } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { api } from '../../../convex/_generated/api';

// Utility functions
const formatCPF = (value: string) => {
  const numbers = value.replaceAll(/\D/g, '');
  return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const formatted = formatCPF(e.target.value);
  e.target.value = formatted;
};

// Form validation schema
const checkoutSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  cpf: z.string().min(11, 'CPF deve ter 11 dígitos').max(14, 'CPF inválido'),
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD']),
  // Credit card fields (conditional)
  cardHolderName: z.string().optional(),
  cardNumber: z.string().optional(),
  cardExpiryMonth: z.string().optional(),
  cardExpiryYear: z.string().optional(),
  cardCvv: z.string().optional(),
  // Required by Asaas for credit card payments
  phone: z.string().optional(),
  postalCode: z.string().optional(),
  address: z.string().optional(),
  addressNumber: z.string().optional(),
  // Installments
  installments: z.number().min(1).max(12).optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

function CheckoutPageContent() {
  const router = useRouter();
  const planId = useSearchParams().get('plan'); // get planId from url
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [selectedInstallments, setSelectedInstallments] = useState<number>(1);
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  // Convex actions and mutations
  const createPendingOrder = useMutation(api.payments.createPendingOrder);
  const linkPaymentToOrder = useMutation(api.payments.linkPaymentToOrder);
  const createCustomer = useAction(api.asaas.createAsaasCustomer);
  const createPixPayment = useAction(api.asaas.createPixPayment);
  const createCreditCardPayment = useAction(api.asaas.createCreditCardPayment);
  
  // Get pricing plan
  const pricingPlan = useQuery(api.pricingPlans.getByProductId, planId ? { productId: planId } : 'skip');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      paymentMethod: 'PIX',
    },
  });

  // ViaCEP integration
  const handleCepChange = async (cep: string) => {
    const cleanCep = cep.replaceAll(/\D/g, '');
    
    if (cleanCep.length === 8) {
      setIsLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        
        if (data.erro) {
          setError('CEP não encontrado');
        } else {
          // Auto-fill address fields
          setValue('address', `${data.logradouro}, ${data.bairro}`);
          setValue('postalCode', data.cep);
          setError(null);
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        setError('Erro ao buscar CEP');
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  // Validate coupon
  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Digite um código de cupom');
      return;
    }

    if (!pricingPlan) {
      setCouponError('Aguarde o carregamento do plano');
      return;
    }

    setIsValidatingCoupon(true);
    setCouponError(null);
    
    try {
      // Use the appropriate base price based on payment method (matches backend logic)
      const regularPrice = pricingPlan.regularPriceNum || 0;
      const pixPrice = pricingPlan.pixPriceNum || regularPrice;
      const originalPrice = selectedPaymentMethod === 'PIX' ? pixPrice : regularPrice;
      
      // Import convex client to make the query
      const { ConvexHttpClient } = await import('convex/browser');
      const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      
      const validateResult: any = await client.query(api.promoCoupons.validateAndApplyCoupon, {
        code: couponCode,
        originalPrice,
      });

      if (validateResult.isValid) {
        setAppliedCoupon(validateResult);
        setCouponError(null);
      } else {
        setCouponError(validateResult.errorMessage || 'Cupom inválido');
        setAppliedCoupon(null);
      }
    } catch (error_) {
      console.error('Coupon validation error:', error_);
      setCouponError('Erro ao validar cupom');
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponError(null);
  };

  if (!planId) {
    return <div>Plano não encontrado</div>;
  }

  if (!pricingPlan) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  // Calculate prices based on payment method
  const regularPrice = pricingPlan.regularPriceNum || 0;
  const pixPrice = pricingPlan.pixPriceNum || regularPrice;
  const basePrice = selectedPaymentMethod === 'PIX' ? pixPrice : regularPrice;
  const pixSavings = regularPrice - pixPrice; // How much you save by choosing PIX

  const onSubmit = async (data: CheckoutForm) => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Create pending order first (robust pattern)
      const { pendingOrderId, priceBreakdown } = await createPendingOrder({
        email: data.email,
        cpf: data.cpf.replaceAll(/\D/g, ''),
        name: data.name,
        productId: planId,
        paymentMethod: data.paymentMethod,
        couponCode: appliedCoupon ? couponCode : undefined,
      });

      // Step 2: Create customer using Convex action
      const { customerId } = await createCustomer({
        name: data.name,
        email: data.email,
        cpf: data.cpf.replaceAll(/\D/g, ''),
      });

      let payment: any;

      // Step 3: Create payment based on selected method
      if (data.paymentMethod === 'PIX') {
        payment = await createPixPayment({
          customerId,
          productId: planId,
          pendingOrderId,
        });
        
        // Step 4: Link payment to order with PIX data
        await linkPaymentToOrder({
          pendingOrderId,
          asaasPaymentId: payment.paymentId,
          pixData: {
            qrPayload: payment.qrPayload,
            qrCodeBase64: payment.qrCodeBase64,
            expirationDate: payment.expirationDate,
          },
        });

        // Redirect to PIX payment page to show QR code
        router.push(`/payment/pix?order=${pendingOrderId}`);
        return; // Exit early for PIX
      } else {
        // Validate credit card fields
        if (!data.cardHolderName || !data.cardNumber || !data.cardExpiryMonth || !data.cardExpiryYear || !data.cardCvv || !data.phone || !data.postalCode || !data.address || !data.addressNumber) {
          throw new Error('Todos os campos do cartão são obrigatórios');
        }

        payment = await createCreditCardPayment({
          customerId,
          productId: planId,
          pendingOrderId,
          creditCard: {
            holderName: data.cardHolderName,
            number: data.cardNumber.replaceAll(/\s/g, ''),
            expiryMonth: data.cardExpiryMonth,
            expiryYear: data.cardExpiryYear,
            ccv: data.cardCvv,
          },
          creditCardHolderInfo: {
            name: data.name,
            email: data.email,
            cpfCnpj: data.cpf.replaceAll(/\D/g, ''),
            phone: data.phone,
            mobilePhone: data.phone,
            postalCode: data.postalCode,
            address: data.address,
            addressNumber: data.addressNumber,
          },
          installments: selectedInstallments > 1 ? selectedInstallments : undefined,
        });
        
        // Step 4: Link payment to order
        await linkPaymentToOrder({
          pendingOrderId,
          asaasPaymentId: payment.paymentId,
        });

        // Redirect to processing page for credit card
        router.push(`/payment/processing?order=${pendingOrderId}`);
      }

    } catch (error) {
      console.error('Checkout error:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form - Takes 2 columns on desktop */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Finalizar Compra</CardTitle>
                <CardDescription>
                  Preencha seus dados e escolha a forma de pagamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome completo"
                    {...register('name')}
                    disabled={isLoading}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                {/* CPF */}
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    {...register('cpf')}
                    disabled={isLoading}
                    maxLength={14}
                    onChange={handleCPFChange}
                  />
                  {errors.cpf && (
                    <p className="text-sm text-red-600">{errors.cpf.message}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  {...register('email')}
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-3">
                <Label>Forma de Pagamento</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedPaymentMethod === 'PIX'
                        ? 'border-brand-blue bg-brand-blue/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedPaymentMethod('PIX');
                      setValue('paymentMethod', 'PIX');
                      // Clear coupon when changing payment method
                      if (appliedCoupon) {
                        handleRemoveCoupon();
                      }
                    }}
                  >
                    <div className="text-center">
                      <div className="font-semibold">PIX</div>
                      <div className="text-sm text-gray-600">Desconto especial</div>
                    </div>
                  </div>
                  <div
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedPaymentMethod === 'CREDIT_CARD'
                        ? 'border-brand-blue bg-brand-blue/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedPaymentMethod('CREDIT_CARD');
                      setValue('paymentMethod', 'CREDIT_CARD');
                      // Clear coupon when changing payment method
                      if (appliedCoupon) {
                        handleRemoveCoupon();
                      }
                    }}
                  >
                    <div className="text-center">
                      <div className="font-semibold">Cartão</div>
                      <div className="text-sm text-gray-600">Aprovação imediata</div>
                    </div>
                  </div>
                </div>
                <input type="hidden" {...register('paymentMethod')} />
              </div>

              {/* Coupon Code */}
              <div className="space-y-2">
                <Label htmlFor="couponCode">Cupom de Desconto (Opcional)</Label>
                {appliedCoupon ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <Tag className="h-4 w-4 text-green-600" />
                    <div className="flex-1">
                      <div className="font-medium text-green-900">{couponCode}</div>
                      <div className="text-sm text-green-700">{appliedCoupon.couponDescription}</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveCoupon}
                      disabled={isLoading}
                      className="text-green-700 hover:text-green-900"
                    >
                      Remover
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="couponCode"
                        type="text"
                        placeholder="Digite o código do cupom"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        disabled={isLoading || isValidatingCoupon}
                        className="pl-10"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleValidateCoupon();
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleValidateCoupon}
                      disabled={isLoading || isValidatingCoupon || !couponCode.trim()}
                    >
                      {isValidatingCoupon ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Aplicar'
                      )}
                    </Button>
                  </div>
                )}
                {couponError && (
                  <p className="text-sm text-red-600">{couponError}</p>
                )}
              </div>

              {/* Credit Card Fields (conditional) */}
              {selectedPaymentMethod === 'CREDIT_CARD' && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold text-gray-900">Dados do Cartão</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Card Holder Name */}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="cardHolderName">Nome no Cartão</Label>
                      <Input
                        id="cardHolderName"
                        type="text"
                        placeholder="Nome como está no cartão"
                        {...register('cardHolderName')}
                        disabled={isLoading}
                      />
                    </div>

                    {/* Card Number */}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="cardNumber">Número do Cartão</Label>
                      <Input
                        id="cardNumber"
                        type="text"
                        placeholder="0000 0000 0000 0000"
                        {...register('cardNumber')}
                        disabled={isLoading}
                        maxLength={19}
                        onChange={(e) => {
                          const value = e.target.value.replaceAll(/\D/g, '');
                          const formatted = value.replaceAll(/(\d{4})(?=\d)/g, '$1 ');
                          e.target.value = formatted;
                        }}
                      />
                    </div>

                    {/* Expiry and CVV in one row */}
                    <div className="space-y-2 md:col-span-2">
                      <Label>Mês / Ano / CVV </Label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Input
                            id="cardExpiryMonth"
                            type="text"
                            placeholder="MM"
                            {...register('cardExpiryMonth')}
                            disabled={isLoading}
                            maxLength={2}
                            className="text-center"
                          />
                        </div>
                        <div>
                          <Input
                            id="cardExpiryYear"
                            type="text"
                            placeholder="AAAA"
                            {...register('cardExpiryYear')}
                            disabled={isLoading}
                            maxLength={4}
                            className="text-center"
                          />
                        </div>
                        <div>
                          <Input
                            id="cardCvv"
                            type="text"
                            placeholder="CVV"
                            {...register('cardCvv')}
                            disabled={isLoading}
                            maxLength={3}
                            className="text-center"
                          />
                        </div>
                      </div>
                  
                    </div>
                  </div>

                  {/* Required fields for Asaas credit card */}
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium text-gray-900">Dados de Faturamento</h4>
                                     
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* CEP */}
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">CEP *</Label>
                        <div className="relative">
                          <Input
                            id="postalCode"
                            type="text"
                            placeholder="00000-000"
                            {...register('postalCode')}
                            disabled={isLoading || isLoadingCep}
                            maxLength={9}
                            onChange={(e) => {
                              const value = e.target.value.replaceAll(/\D/g, '');
                              const formatted = value.replace(/(\d{5})(\d{3})/, '$1-$2');
                              e.target.value = formatted;
                              handleCepChange(formatted);
                            }}
                          />
                          {isLoadingCep && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone com DDD *</Label>
                        <Input
                          id="phone"
                          type="text"
                          placeholder="(11) 99999-9999"
                          {...register('phone')}
                          disabled={isLoading}
                          maxLength={15}
                          onChange={(e) => {
                            const value = e.target.value.replaceAll(/\D/g, '');
                            const formatted = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                            e.target.value = formatted;
                          }}
                        />
                      </div>

                      {/* Address - Takes more space */}
                      <div className="space-y-2 md:col-span-2">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="md:col-span-3 space-y-2">
                            <Label htmlFor="address">Endereço *</Label>
                            <Input
                              id="address"
                              type="text"
                              placeholder="Rua das Flores"
                              {...register('address')}
                              disabled={isLoading}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="addressNumber">Número *</Label>
                            <Input
                              id="addressNumber"
                              type="text"
                              placeholder="123"
                              {...register('addressNumber')}
                              disabled={isLoading}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Installments Selection */}
                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="installments">Parcelamento</Label>
                    <select
                      id="installments"
                      value={selectedInstallments}
                      onChange={(e) => setSelectedInstallments(Number(e.target.value))}
                      disabled={isLoading}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => {
                        // Use the final price after coupon discount if coupon is applied
                        const priceForInstallments = appliedCoupon ? appliedCoupon.finalPrice : regularPrice;
                        const installmentValue = priceForInstallments / num;
                        return (
                          <option key={num} value={num}>
                            {num === 1 
                              ? `À vista - R$ ${priceForInstallments.toFixed(2)}`
                              : `${num}x de R$ ${installmentValue.toFixed(2)} - Total: R$ ${priceForInstallments.toFixed(2)}`
                            }
                          </option>
                        );
                      })}
                    </select>
                    {selectedInstallments > 1 && (
                      <p className="text-xs text-gray-600">
                        💳 Parcelamento sem juros no cartão de crédito
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {selectedPaymentMethod === 'PIX' ? 'Gerando PIX...' : 'Processando Cartão...'}
                  </>
                ) : (
                  selectedPaymentMethod === 'PIX' 
                    ? 'Gerar Pagamento PIX' 
                    : selectedInstallments > 1 
                      ? `Pagar ${selectedInstallments}x no Cartão`
                      : 'Pagar com Cartão'
                )}
              </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary Sidebar - Takes 1 column on desktop */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-8">
              <Card>
                <CardHeader>
                  <CardTitle>Resumo do Pedido</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{pricingPlan.name}</span>
                      <span className="font-medium">
                        {selectedPaymentMethod === 'PIX' ? (
                          <>
                            <span className="line-through text-gray-400 mr-2">R$ {regularPrice.toFixed(2)}</span>
                            <span>R$ {pixPrice.toFixed(2)}</span>
                          </>
                        ) : (
                          <span>R$ {regularPrice.toFixed(2)}</span>
                        )}
                      </span>
                    </div>
                    
                    {selectedPaymentMethod === 'CREDIT_CARD' && selectedInstallments > 1 && (
                      <div className="flex justify-between items-center text-sm text-brand-blue">
                        <span>💳 Parcelamento</span>
                        <span>{selectedInstallments}x de R$ {((appliedCoupon ? appliedCoupon.finalPrice : regularPrice) / selectedInstallments).toFixed(2)}</span>
                      </div>
                    )}
                    
                    {selectedPaymentMethod === 'PIX' && pixSavings > 0 && !appliedCoupon && (
                      <div className="flex justify-between items-center text-sm text-brand-blue">
                        <span>💰 Desconto PIX</span>
                        <span>- R$ {pixSavings.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {selectedPaymentMethod === 'PIX' && appliedCoupon && (
                      <>
                        <div className="flex justify-between items-center text-sm text-brand-blue">
                          <span>💰 Desconto PIX</span>
                          <span>- R$ {pixSavings.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-green-600">
                          <span>🎟️ Cupom ({couponCode})</span>
                          <span>- R$ {appliedCoupon.discountAmount.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    
                    {selectedPaymentMethod === 'CREDIT_CARD' && appliedCoupon && (
                      <div className="flex justify-between items-center text-sm text-green-600">
                        <span>🎟️ Cupom ({couponCode})</span>
                        <span>- R$ {appliedCoupon.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="border-t pt-4 flex justify-between items-center font-bold text-lg">
                      <span>Total:</span>
                      <span className="text-green-600">
                        R$ {appliedCoupon ? appliedCoupon.finalPrice.toFixed(2) : basePrice.toFixed(2)}
                      </span>
                    </div>
                    
                    {(appliedCoupon || (selectedPaymentMethod === 'PIX' && pixSavings > 0)) && (
                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-sm text-green-700 font-medium">
                          ✓ Você está economizando R$ {(() => {
                            let totalSavings = 0;
                            if (selectedPaymentMethod === 'PIX') {
                              totalSavings += pixSavings;
                            }
                            if (appliedCoupon) {
                              totalSavings += appliedCoupon.discountAmount;
                            }
                            return totalSavings.toFixed(2);
                          })()}!
                        </p>
                      </div>
                    )}

                    <div className="border-t pt-4 space-y-2 text-xs text-gray-600">
                      <div className="flex items-center gap-2">
                        <span>🔒</span>
                        <span>Pagamento seguro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>✓</span>
                        <span>Acesso imediato após aprovação</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  );
}