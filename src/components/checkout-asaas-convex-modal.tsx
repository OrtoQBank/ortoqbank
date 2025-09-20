'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from "convex/react";
import {
    CheckIcon,
    CopyIcon,
    CreditCardIcon,
    DownloadIcon,
    FileTextIcon,
    LoaderIcon,
    QrCodeIcon,
    TagIcon
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useToast } from '../hooks/use-toast';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from './ui/form';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

import { api } from "../../convex/_generated/api";

// CPF validation helper function
const isCPFValid = (cpf: string) => {
  cpf = cpf.replaceAll(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum += Number.parseInt(cpf.slice(i - 1, i)) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== Number.parseInt(cpf.slice(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += Number.parseInt(cpf.slice(i - 1, i)) * (12 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== Number.parseInt(cpf.slice(10, 11))) return false;

  return true;
};

const formSchema = z
  .object({
    firstName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    lastName: z.string().min(2, 'Sobrenome deve ter pelo menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    confirmEmail: z.string().email('Email inválido'),
    cpf: z
      .string()
      .min(11, 'CPF deve ter 11 dígitos')
      .max(14, 'CPF não pode ter mais que 14 caracteres')
      .refine(val => isCPFValid(val), { message: 'CPF inválido' }),
    phone: z
      .string()
      .min(10, 'Telefone deve ter pelo menos 10 dígitos')
      .max(15, 'Telefone não pode ter mais que 15 caracteres')
      .regex(
        /^\(?[1-9]{2}\)? ?(?:[2-8]|9[1-9])[0-9]{3}\-?[0-9]{4}$/,
        'Telefone inválido',
      ),
    street: z.string().min(3, 'Endereço deve ter pelo menos 3 caracteres'),
    number: z.string().min(1, 'Número é obrigatório'),
    zipcode: z
      .string()
      .min(8, 'CEP deve ter 8 dígitos')
      .max(9, 'CEP não pode ter mais que 9 caracteres')
      .regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
    city: z.string().min(2, 'Cidade deve ter pelo menos 2 caracteres'),
    state: z.string().length(2, 'Estado deve ter 2 caracteres'),
    couponCode: z.string().optional(),
  })
  .refine(data => data.email === data.confirmEmail, {
    message: 'Os emails não coincidem',
    path: ['confirmEmail'],
  });

type FormValues = z.infer<typeof formSchema>;

interface CheckoutAsaasConvexModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CheckoutAsaasConvexModal({
  open,
  onOpenChange,
}: CheckoutAsaasConvexModalProps) {
  const { toast } = useToast();
  const [couponValidation, setCouponValidation] = useState<any>();
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [currentStep, setCurrentStep] = useState<'form' | 'payment'>('form');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'pix' | 'boleto' | 'card'>('pix');
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Convex mutations and queries
  const createCheckout = useMutation(api.asaas.createCheckout);
  const validateCoupon = useQuery(api.asaas.validateCoupon, 
    couponValidation?.couponCode ? { couponCode: couponValidation.couponCode } : "skip"
  );
  const getPendingOrder = useQuery(api.asaas.getPendingOrder,
    checkoutData?.checkoutId ? { checkoutId: checkoutData.checkoutId } : "skip"
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      confirmEmail: '',
      cpf: '',
      phone: '',
      street: '',
      number: '',
      zipcode: '',
      city: '',
      state: '',
      couponCode: '',
    },
  });

  const handleValidateCoupon = async () => {
    const couponCode = form.getValues('couponCode');
    if (!couponCode?.trim()) return;

    setIsValidatingCoupon(true);
    setCouponValidation({ couponCode: couponCode.toUpperCase() });
    setIsValidatingCoupon(false);
  };

  const handleCreateCheckout = async (values: FormValues) => {
    try {
      const result = await createCheckout({
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        cpf: values.cpf.replaceAll(/\D/g, ''),
        phone: values.phone.replaceAll(/\D/g, ''),
        address: {
          street: values.street,
          number: values.number,
          zipcode: values.zipcode,
          city: values.city,
          state: values.state,
        },
        couponCode: values.couponCode,
      });

      setCheckoutData(result);
      setCurrentStep('payment');

      toast({
        title: 'Checkout criado com sucesso!',
        description: values.couponCode && result.couponApplied
          ? `Cupom ${result.couponApplied} aplicado: ${result.discountDescription}`
          : 'Escolha sua forma de pagamento.',
        variant: 'default',
      });

      // Start polling for payment status
      startPaymentPolling(result.checkoutId);

    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: 'Erro ao criar checkout',
        description: error instanceof Error ? error.message : 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    }
  };

  const startPaymentPolling = (checkoutId: string) => {
    const interval = setInterval(() => {
      // The polling is handled by the useQuery hook
      // We just need to keep track of the interval for cleanup
    }, 5000);

    setPollingInterval(interval);

    // Stop polling after 10 minutes
    setTimeout(() => {
      clearInterval(interval);
      setPollingInterval(null);
    }, 10 * 60 * 1000);
  };

  // Effect to handle payment status changes
  useEffect(() => {
    if (getPendingOrder?.status === 'completed' || getPendingOrder?.status === 'provisionable') {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }

      toast({
        title: 'Pagamento confirmado!',
        description: 'Redirecionando...',
        variant: 'default',
      });

      // Redirect to success page or onboarding
      window.location.href = getPendingOrder.status === 'completed' 
        ? '/?status=sucesso'
        : `/onboarding?order=${checkoutData?.checkoutId}`;
    }
  }, [getPendingOrder?.status, pollingInterval, checkoutData?.checkoutId]);

  const copyPixCode = () => {
    if (checkoutData?.pixCopyPaste) {
      navigator.clipboard.writeText(checkoutData.pixCopyPaste).then(() => {
        toast({
          title: 'Código PIX copiado!',
          description: 'Cole no seu app de pagamentos.',
          variant: 'default',
        });
      });
    }
  };

  const downloadPixQr = () => {
    if (checkoutData?.pixQrCode) {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${checkoutData.pixQrCode}`;
      link.download = 'qr-code-pix.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'QR Code baixado!',
        description: 'Escaneie com seu app de pagamentos.',
        variant: 'default',
      });
    }
  };

  const openBoleto = () => {
    if (checkoutData?.bankSlipUrl) {
      window.open(checkoutData.bankSlipUrl, '_blank');
    } else if (checkoutData?.invoiceUrl) {
      window.open(checkoutData.invoiceUrl, '_blank');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setCurrentStep('form');
    setSelectedPaymentMethod('pix');
    setCouponValidation(undefined);
    setCheckoutData(null);
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    form.reset();
  };

  const renderPaymentMethods = () => {
    if (!checkoutData) return null;

    return (
      <Tabs value={selectedPaymentMethod} onValueChange={(value) => setSelectedPaymentMethod(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pix" className="flex items-center gap-2">
            <QrCodeIcon className="h-4 w-4" />
            PIX
            <Badge variant="secondary" className="ml-1">
              -{Math.round(((checkoutData.regularPrice - checkoutData.pixPrice) / checkoutData.regularPrice) * 100)}%
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="boleto" className="flex items-center gap-2">
            <FileTextIcon className="h-4 w-4" />
            Boleto
          </TabsTrigger>
          <TabsTrigger value="card" className="flex items-center gap-2">
            <CreditCardIcon className="h-4 w-4" />
            Cartão
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pix" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCodeIcon className="h-5 w-5 text-green-600" />
                Pagamento via PIX
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  R$ {checkoutData.pixPrice.toFixed(2).replace('.', ',')}
                </div>
                <div className="text-sm text-muted-foreground line-through">
                  R$ {checkoutData.regularPrice.toFixed(2).replace('.', ',')}
                </div>
              </div>
              
              {checkoutData.pixQrCode && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-white p-4 rounded-lg border">
                    <img 
                      src={`data:image/png;base64,${checkoutData.pixQrCode}`}
                      alt="QR Code PIX"
                      className="w-48 h-48"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={copyPixCode} variant="outline" size="sm">
                      <CopyIcon className="h-4 w-4 mr-2" />
                      Copiar código
                    </Button>
                    <Button onClick={downloadPixQr} variant="outline" size="sm">
                      <DownloadIcon className="h-4 w-4 mr-2" />
                      Baixar QR
                    </Button>
                  </div>
                  
                  <div className="text-center text-sm text-muted-foreground">
                    <p>Escaneie o QR Code ou copie o código PIX</p>
                    <p>Aguardando confirmação do pagamento...</p>
                    {pollingInterval && (
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <LoaderIcon className="h-4 w-4 animate-spin" />
                        <span>Verificando pagamento</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="boleto" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileTextIcon className="h-5 w-5 text-blue-600" />
                Pagamento via Boleto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  R$ {checkoutData.regularPrice.toFixed(2).replace('.', ',')}
                </div>
                <div className="text-sm text-muted-foreground">
                  Vencimento: 1 dia útil
                </div>
              </div>
              
              <Button onClick={openBoleto} className="w-full" size="lg">
                <FileTextIcon className="h-4 w-4 mr-2" />
                Abrir Boleto
              </Button>
              
              <div className="text-center text-sm text-muted-foreground">
                <p>O boleto pode ser pago em qualquer banco ou app</p>
                <p>Compensação em até 2 dias úteis</p>
                {pollingInterval && (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                    <span>Aguardando pagamento</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="card" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCardIcon className="h-5 w-5 text-purple-600" />
                Pagamento via Cartão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  R$ {checkoutData.regularPrice.toFixed(2).replace('.', ',')}
                </div>
                <div className="text-sm text-muted-foreground">
                  Em até 12x sem juros
                </div>
              </div>
              
              {checkoutData.invoiceUrl && (
                <Button 
                  onClick={() => window.open(checkoutData.invoiceUrl, '_blank')} 
                  className="w-full" 
                  size="lg"
                >
                  <CreditCardIcon className="h-4 w-4 mr-2" />
                  Pagar com Cartão
                </Button>
              )}
              
              <div className="text-center text-sm text-muted-foreground">
                <p>Aceitamos Visa, Mastercard, Elo e Hipercard</p>
                <p>Aprovação imediata</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {currentStep === 'form' ? 'Finalizar Compra' : 'Escolha sua forma de pagamento'}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 'form' 
              ? 'Preencha seus dados para acessar o OrtoQBank 2025'
              : 'Selecione como deseja pagar sua assinatura'
            }
          </DialogDescription>
        </DialogHeader>

        {currentStep === 'form' ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateCheckout)} className="space-y-6">
              {/* Coupon Section */}
              <div className="rounded-lg border bg-blue-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <TagIcon className="h-5 w-5 text-[#2096f4]" />
                  <h3 className="font-medium text-[#2096f4]">
                    Cupom de Desconto
                  </h3>
                </div>
                <div className="flex gap-2">
                  <FormField
                    control={form.control}
                    name="couponCode"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            placeholder="Digite seu cupom (opcional)"
                            {...field}
                            onChange={e => {
                              field.onChange(e.target.value.toUpperCase());
                              setCouponValidation(undefined);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleValidateCoupon}
                    disabled={isValidatingCoupon || !form.watch('couponCode')?.trim()}
                  >
                    {isValidatingCoupon ? 'Validando...' : 'Aplicar'}
                  </Button>
                </div>
                {validateCoupon?.valid && validateCoupon.coupon && (
                  <div className="mt-3 rounded border border-green-300 bg-green-100 p-3">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckIcon className="h-4 w-4" />
                      <span className="font-medium">
                        Cupom válido: {validateCoupon.coupon.description}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-green-700">
                      Desconto será aplicado automaticamente no checkout
                    </p>
                  </div>
                )}
              </div>

              {/* Personal Information - same as before */}
              <div className="space-y-4">
                <h3 className="font-medium">Informações Pessoais</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="João" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sobrenome</FormLabel>
                        <FormControl>
                          <Input placeholder="Silva" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="joao@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar Email</FormLabel>
                        <FormControl>
                          <Input placeholder="joao@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="000.000.000-00"
                            {...field}
                            onChange={e => {
                              let value = e.target.value.replaceAll(/\D/g, '');
                              if (value.length > 3) {
                                value = value.replace(/^(\d{3})/, '$1.');
                              }
                              if (value.length > 7) {
                                value = value.replace(/^(\d{3})\.(\d{3})/, '$1.$2.');
                              }
                              if (value.length > 11) {
                                value = value.replace(/^(\d{3})\.(\d{3})\.(\d{3})/, '$1.$2.$3-');
                              }
                              field.onChange(value);
                            }}
                            maxLength={14}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 99999-9999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Address Information - same as before */}
              <div className="space-y-4">
                <h3 className="font-medium">Endereço</h3>
                <FormField
                  control={form.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua das Flores" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input placeholder="123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="zipcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="00000-000"
                            {...field}
                            onChange={e => {
                              let value = e.target.value.replaceAll(/\D/g, '');
                              if (value.length > 5) {
                                value = value.slice(0, 5) + '-' + value.slice(5);
                              }
                              field.onChange(value);
                            }}
                            maxLength={9}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input placeholder="São Paulo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <FormControl>
                          <Input placeholder="SP" {...field} maxLength={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" className="w-full">
                  Continuar para Pagamento
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-6">
            {renderPaymentMethods()}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setCurrentStep('form')}>
                Voltar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
