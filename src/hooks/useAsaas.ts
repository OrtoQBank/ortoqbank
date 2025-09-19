import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from './use-toast';

interface Address {
  street: string;
  number: string;
  zipcode: string;
  city: string;
  state: string;
}

interface Identification {
  type: string;
  number: string;
}

interface Phone {
  area_code: string;
  number: string;
}

interface CheckoutData {
  userEmail: string;
  userName?: string;
  userLastName?: string;
  testeId?: string;
  userAddress?: Address;
  userIdentification?: Identification;
  userPhone?: Phone;
  couponCode?: string;
}

interface AsaasCheckoutResponse {
  success: boolean;
  chargeId: string;
  pixChargeId: string;
  customerId: string;
  
  // Payment URLs
  invoiceUrl?: string;
  bankSlipUrl?: string;
  
  // PIX data
  pixQrCode?: string;
  pixCopyPaste?: string;
  pixExpirationDate?: string;
  
  // Pricing info
  originalPrice: number;
  regularPrice: number;
  pixPrice: number;
  couponApplied?: string;
  discountAmount: number;
  discountDescription: string;
  
  // Charge details
  charge: {
    id: string;
    status: string;
    dueDate: string;
    value: number;
    description: string;
  };
}

const useAsaas = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkoutData, setCheckoutData] = useState<AsaasCheckoutResponse | null>(null);

  async function validateCoupon(couponCode: string) {
    try {
      const response = await fetch(
        `/api/asaas/create-checkout?coupon=${couponCode}`,
      );
      const data = await response.json();

      if (data.valid) {
        toast({
          title: 'Cupom válido!',
          description: `${data.coupon.description} aplicado com sucesso.`,
          variant: 'default',
        });
        return data;
      } else {
        toast({
          title: 'Cupom inválido',
          description: data.message || 'Este cupom não existe ou expirou.',
          variant: 'destructive',
        });
        return null;
      }
    } catch {
      toast({
        title: 'Erro ao validar cupom',
        description: 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
      return null;
    }
  }

  async function createAsaasCheckout(checkoutData: CheckoutData): Promise<AsaasCheckoutResponse | null> {
    setLoading(true);
    
    try {
      if (checkoutData.couponCode) {
        const couponValidation = await validateCoupon(checkoutData.couponCode);
        if (!couponValidation) {
          setLoading(false);
          return null;
        }
      }

      const response = await fetch('/api/asaas/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkoutData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setCheckoutData(data);

      toast({
        title: 'Checkout criado com sucesso!',
        description: checkoutData.couponCode && data.couponApplied
          ? `Cupom ${data.couponApplied} aplicado: ${data.discountDescription}`
          : 'Escolha sua forma de pagamento.',
        variant: 'default',
      });

      return data;

    } catch (error) {
      console.error('Error creating AsaaS checkout:', error);
      toast({
        title: 'Erro ao criar checkout',
        description:
          error instanceof Error
            ? error.message
            : 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }

  function openBoleto() {
    if (checkoutData?.bankSlipUrl) {
      window.open(checkoutData.bankSlipUrl, '_blank');
    } else if (checkoutData?.invoiceUrl) {
      window.open(checkoutData.invoiceUrl, '_blank');
    } else {
      toast({
        title: 'Erro',
        description: 'URL do boleto não disponível.',
        variant: 'destructive',
      });
    }
  }

  function copyPixCode() {
    if (checkoutData?.pixCopyPaste) {
      navigator.clipboard.writeText(checkoutData.pixCopyPaste).then(() => {
        toast({
          title: 'Código PIX copiado!',
          description: 'Cole no seu app de pagamentos.',
          variant: 'default',
        });
      });
    } else {
      toast({
        title: 'Erro',
        description: 'Código PIX não disponível.',
        variant: 'destructive',
      });
    }
  }

  function downloadPixQr() {
    if (checkoutData?.pixQrCode) {
      // Create a download link for the base64 QR code image
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
    } else {
      toast({
        title: 'Erro',
        description: 'QR Code não disponível.',
        variant: 'destructive',
      });
    }
  }

  // Function to check payment status (for polling)
  async function checkPaymentStatus(chargeId: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/asaas/payment-status?chargeId=${chargeId}`);
      const data = await response.json();
      
      if (data.status === 'RECEIVED' || data.status === 'CONFIRMED') {
        toast({
          title: 'Pagamento confirmado!',
          description: 'Redirecionando para área do aluno...',
          variant: 'default',
        });
        
        // Redirect to success page
        router.push('/?status=sucesso');
        return data.status;
      }
      
      return data.status;
    } catch (error) {
      console.error('Error checking payment status:', error);
      return null;
    }
  }

  // Function to start payment status polling
  function startPaymentPolling(chargeId: string, intervalMs: number = 5000) {
    const pollInterval = setInterval(async () => {
      const status = await checkPaymentStatus(chargeId);
      
      if (status === 'RECEIVED' || status === 'CONFIRMED') {
        clearInterval(pollInterval);
      }
    }, intervalMs);

    // Stop polling after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 10 * 60 * 1000);

    return pollInterval;
  }

  return {
    createAsaasCheckout,
    validateCoupon,
    openBoleto,
    copyPixCode,
    downloadPixQr,
    checkPaymentStatus,
    startPaymentPolling,
    loading,
    checkoutData,
    clearCheckoutData: () => setCheckoutData(null),
  };
};

export default useAsaas;
