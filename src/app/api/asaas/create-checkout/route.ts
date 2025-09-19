import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';

import type { AsaasCharge, AsaasCustomer } from '../../../../lib/asaas';
import { asaasClient } from '../../../../lib/asaas';

// Import existing rate limiting and coupon logic
import { getDynamicCoupon, type Coupon } from '../../../../lib/coupons';
import { isRateLimited } from '../../../../lib/rate-limiter';

// Constants - same as MercadoPago implementation
const REGULAR_PRICE = 39.9;
const PIX_PRICE = 34.9;

// Helper function to calculate discounted price (reused from MercadoPago)
function calculateDiscountedPrice(
  originalPrice: number,
  coupon?: Coupon,
): {
  finalPrice: number;
  discountAmount: number;
  discountDescription: string;
} {
  if (!coupon) {
    return {
      finalPrice: originalPrice,
      discountAmount: 0,
      discountDescription: '',
    };
  }

  let discountAmount = 0;
  let discountDescription = '';

  switch (coupon.type) {
    case 'percentage':
      discountAmount = (originalPrice * coupon.value) / 100;
      discountDescription = `${coupon.value}% de desconto`;
      break;
    case 'fixed':
      discountAmount = coupon.value;
      discountDescription = `R$ ${coupon.value.toFixed(2)} de desconto`;
      break;
    case 'fixed_price':
      discountAmount = originalPrice - coupon.value;
      discountDescription = `Preço promocional R$ ${coupon.value.toFixed(2)}`;
      break;
  }

  return {
    finalPrice: Math.max(0, originalPrice - discountAmount),
    discountAmount,
    discountDescription,
  };
}

export async function POST(req: NextRequest) {
  // Rate limiting
  if (isRateLimited(req, 'create-asaas-checkout', 20, 60_000)) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  const {
    testeId,
    userEmail,
    userName,
    userLastName,
    userAddress,
    userIdentification,
    userPhone,
    couponCode,
  } = await req.json();

  try {
    Sentry.addBreadcrumb({
      message: 'AsaaS create checkout request received',
      category: 'checkout',
      level: 'info',
      data: { testeId, userEmail: !!userEmail, couponCode: couponCode || '' },
    });

    // Fetch dynamic coupon
    const dynamicCoupon = await getDynamicCoupon(couponCode);
    
    Sentry.addBreadcrumb({
      message: 'Coupon resolved',
      category: 'checkout',
      level: 'info',
      data: { hasCoupon: !!dynamicCoupon },
    });

    // Calculate prices with coupon discount
    const regularPricing = calculateDiscountedPrice(REGULAR_PRICE, dynamicCoupon);
    const pixPricing = calculateDiscountedPrice(PIX_PRICE, dynamicCoupon);

    // Create or get customer in AsaaS
    let customer: AsaasCustomer;
    
    try {
      // First, try to find existing customer by email
      const existingCustomers = await asaasClient.getCustomerByEmail(userEmail);
      
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
        
        // Update customer data if needed
        if (userName || userLastName || userAddress || userPhone) {
          const updateData: Partial<AsaasCustomer> = {};
          
          if (userName && userLastName) {
            updateData.name = `${userName} ${userLastName}`;
          }
          
          if (userAddress) {
            updateData.address = userAddress.street;
            updateData.addressNumber = userAddress.number;
            updateData.postalCode = userAddress.zipcode.replace(/\D/g, '');
            updateData.city = userAddress.city;
            updateData.state = userAddress.state;
          }
          
          if (userPhone) {
            updateData.phone = `${userPhone.area_code}${userPhone.number}`;
            updateData.mobilePhone = `${userPhone.area_code}${userPhone.number}`;
          }
          
          customer = await asaasClient.updateCustomer(customer.id!, updateData);
        }
      } else {
        // Create new customer
        const newCustomer: AsaasCustomer = {
          name: `${userName || 'Cliente'} ${userLastName || 'Ortoqbank'}`,
          email: userEmail,
          cpfCnpj: userIdentification?.number || '',
        };
        
        if (userAddress) {
          newCustomer.address = userAddress.street;
          newCustomer.addressNumber = userAddress.number;
          newCustomer.postalCode = userAddress.zipcode.replace(/\D/g, '');
          newCustomer.city = userAddress.city;
          newCustomer.state = userAddress.state;
        }
        
        if (userPhone) {
          newCustomer.phone = `${userPhone.area_code}${userPhone.number}`;
          newCustomer.mobilePhone = `${userPhone.area_code}${userPhone.number}`;
        }
        
        customer = await asaasClient.createCustomer(newCustomer);
      }
    } catch (customerError) {
      console.error('Error handling customer:', customerError);
      throw new Error('Failed to create or update customer');
    }

    // Create description with coupon info if applicable
    let description = 'Ortoqbank 2025 - Acesso completo';
    if (couponCode && regularPricing.discountAmount > 0) {
      description += ` - Cupom: ${couponCode.toUpperCase()}`;
    }

    // Calculate due date (1 day from now for boleto, immediate for PIX/credit card)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // Create charge for credit card/boleto (UNDEFINED allows all payment methods)
    const chargeData: AsaasCharge = {
      customer: customer.id!,
      billingType: 'UNDEFINED', // Allows customer to choose payment method
      value: regularPricing.finalPrice,
      dueDate: dueDateStr,
      description,
      externalReference: testeId,
    };

    // Add PIX discount if applicable
    if (pixPricing.finalPrice < regularPricing.finalPrice) {
      chargeData.discount = {
        value: regularPricing.finalPrice - pixPricing.finalPrice,
        dueDateLimitDays: 0, // Immediate discount for PIX
        type: 'FIXED',
      };
    }

    const charge = await asaasClient.createCharge(chargeData);

    // Create PIX charge separately for QR code generation
    const pixChargeData: AsaasCharge = {
      customer: customer.id!,
      billingType: 'PIX',
      value: pixPricing.finalPrice,
      dueDate: dueDateStr,
      description: description + ' - PIX',
      externalReference: `${testeId}-pix`,
    };

    const pixCharge = await asaasClient.createCharge(pixChargeData);
    let pixQrCode: any = null;

    try {
      pixQrCode = await asaasClient.getPixQrCode(pixCharge.id);
    } catch (pixError) {
      console.warn('Failed to generate PIX QR code:', pixError);
    }

    Sentry.addBreadcrumb({
      message: 'AsaaS charges created',
      category: 'checkout',
      level: 'info',
      data: { 
        chargeId: charge.id, 
        pixChargeId: pixCharge.id,
        hasPixQrCode: !!pixQrCode 
      },
    });

    return NextResponse.json({
      success: true,
      chargeId: charge.id,
      pixChargeId: pixCharge.id,
      customerId: customer.id,
      
      // Payment URLs
      invoiceUrl: charge.invoiceUrl,
      bankSlipUrl: charge.bankSlipUrl,
      
      // PIX data
      pixQrCode: pixQrCode?.encodedImage,
      pixCopyPaste: pixQrCode?.payload,
      pixExpirationDate: pixQrCode?.expirationDate,
      
      // Pricing info
      originalPrice: REGULAR_PRICE,
      regularPrice: regularPricing.finalPrice,
      pixPrice: pixPricing.finalPrice,
      couponApplied: couponCode?.toUpperCase() || undefined,
      discountAmount: regularPricing.discountAmount,
      discountDescription: regularPricing.discountDescription,
      
      // AsaaS specific data
      charge: {
        id: charge.id,
        status: charge.status,
        dueDate: charge.dueDate,
        value: charge.value,
        description: charge.description,
      },
    });

  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'create-asaas-checkout' },
    });
    console.error('Error creating AsaaS checkout:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    );
  }
}

// Endpoint to validate coupon codes (reuse MercadoPago logic)
export async function GET(req: NextRequest) {
  if (isRateLimited(req, 'validate-asaas-coupon', 30, 60_000)) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const couponCode = searchParams.get('coupon');

  if (!couponCode) {
    return NextResponse.json({ valid: false, message: 'Coupon code is required' });
  }

  try {
    const dynamicCoupon = await getDynamicCoupon(couponCode);

    if (!dynamicCoupon) {
      return NextResponse.json({ 
        valid: false, 
        message: 'Cupom inválido ou expirado' 
      });
    }

    const regularPricing = calculateDiscountedPrice(REGULAR_PRICE, dynamicCoupon);
    const pixPricing = calculateDiscountedPrice(PIX_PRICE, dynamicCoupon);

    return NextResponse.json({
      valid: true,
      coupon: {
        code: dynamicCoupon.code,
        description: dynamicCoupon.description,
        type: dynamicCoupon.type,
        value: dynamicCoupon.value,
      },
      pricing: {
        original: REGULAR_PRICE,
        regular: regularPricing,
        pix: pixPricing,
      },
    });

  } catch (error) {
    console.error('Error validating coupon:', error);
    return NextResponse.json({ 
      valid: false, 
      message: 'Erro interno do servidor' 
    });
  }
}
