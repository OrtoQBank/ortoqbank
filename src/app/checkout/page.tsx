'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useAction, useMutation } from 'convex/react';
import { Loader2 } from 'lucide-react';
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
  // Required for credit card by Asaas
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  addressNumber: z.string().optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

function CheckoutPageContent() {
  const router = useRouter();
  const planId = useSearchParams().get('plan'); // get planId from url
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');

  // Convex actions and mutations
  const createPendingOrder = useMutation(api.payments.createPendingOrder);
  const linkPaymentToOrder = useMutation(api.payments.linkPaymentToOrder);
  const createCustomer = useAction(api.asaas.createAsaasCustomer);
  const createPixPayment = useAction(api.asaas.createPixPayment);
  const createCreditCardPayment = useAction(api.asaas.createCreditCardPayment);

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

  if (!planId) {
    return <div>Plano não encontrado</div>;
  }

  const onSubmit = async (data: CheckoutForm) => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Create pending order first (robust pattern)
      const { pendingOrderId, claimToken } = await createPendingOrder({
        email: data.email,
        cpf: data.cpf.replaceAll(/\D/g, ''),
        name: data.name,
        productId: planId,
        paymentMethod: data.paymentMethod,
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
      } else {
        // Validate credit card fields
        if (!data.cardHolderName || !data.cardNumber || !data.cardExpiryMonth || !data.cardExpiryYear || !data.cardCvv || !data.postalCode || !data.phone || !data.addressNumber) {
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
            postalCode: data.postalCode,
            addressNumber: data.addressNumber,
            phone: data.phone,
            mobilePhone: data.phone,
          },
        });
      }

      // Step 4: Link payment to order
      await linkPaymentToOrder({
        pendingOrderId,
        asaasPaymentId: payment.paymentId,
      });

      // Redirect to processing page with pendingOrderId
      router.push(`/payment/processing?order=${pendingOrderId}`);

    } catch (error) {
      console.error('Checkout error:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Finalizar Compra</CardTitle>
            <CardDescription>
              Preencha seus dados e escolha a forma de pagamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

              {/* CPF */}
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  {...register('cpf')}
                  onChange={handleCPFChange}
                  maxLength={14}
                  disabled={isLoading}
                />
                {errors.cpf && (
                  <p className="text-sm text-red-600">{errors.cpf.message}</p>
                )}
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-3">
                <Label>Forma de Pagamento</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedPaymentMethod === 'PIX'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedPaymentMethod('PIX');
                      setValue('paymentMethod', 'PIX');
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
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedPaymentMethod('CREDIT_CARD');
                      setValue('paymentMethod', 'CREDIT_CARD');
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

              {/* Credit Card Fields (conditional) */}
              {selectedPaymentMethod === 'CREDIT_CARD' && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold text-gray-900">Dados do Cartão</h3>

                  {/* Card Holder Name */}
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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

                  {/* Expiry and CVV */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="cardExpiryMonth">Mês</Label>
                      <Input
                        id="cardExpiryMonth"
                        type="text"
                        placeholder="MM"
                        {...register('cardExpiryMonth')}
                        disabled={isLoading}
                        maxLength={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cardExpiryYear">Ano</Label>
                      <Input
                        id="cardExpiryYear"
                        type="text"
                        placeholder="AAAA"
                        {...register('cardExpiryYear')}
                        disabled={isLoading}
                        maxLength={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cardCvv">CVV</Label>
                      <Input
                        id="cardCvv"
                        type="text"
                        placeholder="000"
                        {...register('cardCvv')}
                        disabled={isLoading}
                        maxLength={4}
                      />
                    </div>
                  </div>

                  {/* Required fields for Asaas */}
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium text-gray-900">Informações Adicionais (Obrigatórias)</h4>
                    
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">CEP *</Label>
                      <Input
                        id="postalCode"
                        type="text"
                        placeholder="00000-000"
                        {...register('postalCode')}
                        disabled={isLoading}
                        maxLength={9}
                        onChange={(e) => {
                          const value = e.target.value.replaceAll(/\D/g, '');
                          const formatted = value.replace(/(\d{5})(\d{3})/, '$1-$2');
                          e.target.value = formatted;
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
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

                      <div className="space-y-2">
                        <Label htmlFor="addressNumber">Número do Endereço *</Label>
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
              )}

              {/* Order Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Resumo do Pedido</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Plano {planId}</span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span>Total:</span>
                    <span className="text-green-600">
                      {selectedPaymentMethod === 'PIX' ? 'Preço PIX' : 'Preço Cartão'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    * Preço final será calculado no servidor
                  </p>
                </div>
              </div>

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
                  selectedPaymentMethod === 'PIX' ? 'Gerar Pagamento PIX' : 'Pagar com Cartão'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  );
}