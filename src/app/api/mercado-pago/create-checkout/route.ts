import { ConvexHttpClient } from 'convex/browser';
import { Preference } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';

import { api } from '@/../convex/_generated/api';
import mpClient from '@/lib/mercado-pago';

// Define coupon configurations with direct discount calculations
type Coupon = {
  type: 'percentage' | 'fixed' | 'fixed_price';
  value: number;
  description: string;
  validFrom?: number; // epoch ms
  validUntil?: number; // epoch ms
};

const COUPON_CONFIG = {
  // Base prices
  REGULAR_PRICE: 1999.9,
  PIX_PRICE: 1899.9,

  // Coupon discounts (percentage, fixed amount, or fixed price)
  coupons: {
    DESCONTO10: {
      type: 'percentage',
      value: 10,
      description: '10% de desconto',
    },
    SAVE50: { type: 'fixed', value: 50, description: 'R$ 50 de desconto' },
    ESTUDANTE: {
      type: 'percentage',
      value: 15,
      description: '15% desconto estudante',
    },
    PROMO100: { type: 'fixed', value: 100, description: 'R$ 100 de desconto' },
    GRUPO25: {
      type: 'fixed_price',
      value: 1500,
      description: 'Preço especial grupo R$ 1500',
    },
    APRENDA: {
      type: 'percentage',
      value: 10,
      description: '10% de desconto',
    },
    // Time-bound 48h coupon: SOMOS1K (15%)
    SOMOS1K: {
      type: 'percentage',
      value: 15,
      description: '15% de desconto (SOMOS1K - 48h)',
      validFrom: Date.now(),
      validUntil: Date.now() + 48 * 60 * 60 * 1000,
    },
  } as Record<string, Coupon>,
};

function isCouponActive(coupon?: Coupon): boolean {
  if (!coupon) return false;
  const now = Date.now();
  if (coupon.validFrom !== undefined && now < coupon.validFrom) return false;
  if (coupon.validUntil !== undefined && now > coupon.validUntil) return false;
  return true;
}

async function getDynamicCoupon(code?: string): Promise<Coupon | undefined> {
  if (!code) return undefined;
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) return undefined;
    const client = new ConvexHttpClient(convexUrl);
    const dynamic = await client.query(api.promoCoupons.getByCode, {
      code: code.toUpperCase(),
    });
    if (!dynamic || !dynamic.active) return undefined;
    return {
      type: dynamic.type,
      value: dynamic.value,
      description: dynamic.description,
      validFrom: dynamic.validFrom ?? undefined,
      validUntil: dynamic.validUntil ?? undefined,
    } satisfies Coupon;
  } catch {
    return undefined;
  }
}

function calculateDiscountedPrice(
  originalPrice: number,
  couponCodeOrCoupon?: string | Coupon,
): {
  finalPrice: number;
  discountAmount: number;
  discountDescription: string;
} {
  const coupon: Coupon | undefined =
    typeof couponCodeOrCoupon === 'string'
      ? COUPON_CONFIG.coupons[couponCodeOrCoupon.toUpperCase()]
      : couponCodeOrCoupon;

  if (!coupon || !isCouponActive(coupon)) {
    return {
      finalPrice: originalPrice,
      discountAmount: 0,
      discountDescription: '',
    };
  }

  let finalPrice: number;
  let discountAmount: number;

  if (coupon.type === 'fixed_price') {
    // Set the final price to the fixed value
    finalPrice = coupon.value;
    discountAmount = originalPrice - coupon.value;
  } else if (coupon.type === 'percentage') {
    discountAmount = (originalPrice * coupon.value) / 100;
    finalPrice = originalPrice - discountAmount;
  } else {
    // fixed discount
    discountAmount = coupon.value;
    finalPrice = originalPrice - discountAmount;
  }

  // Ensure final price is not negative
  finalPrice = Math.max(finalPrice, 0);
  // Ensure discount amount is not greater than original price
  discountAmount = Math.min(discountAmount, originalPrice);

  return {
    finalPrice: Math.round(finalPrice * 100) / 100, // Round to 2 decimal places
    discountAmount: Math.round(discountAmount * 100) / 100,
    discountDescription: coupon.description,
  };
}

export async function POST(req: NextRequest) {
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
    const REGULAR_PRICE = COUPON_CONFIG.REGULAR_PRICE;
    const PIX_PRICE = COUPON_CONFIG.PIX_PRICE;

    // Prefer dynamic Convex coupon, fallback to static
    const dynamicCoupon = await getDynamicCoupon(couponCode);
    const effectiveCoupon = dynamicCoupon ?? couponCode;

    // Calculate prices with coupon discount
    const regularPricing = calculateDiscountedPrice(
      REGULAR_PRICE,
      effectiveCoupon,
    );
    const pixPricing = calculateDiscountedPrice(PIX_PRICE, effectiveCoupon);

    const preference = new Preference(mpClient);
    const origin = req.headers.get('origin') || 'https://ortoqbank.com.br';

    // Create item title with coupon info if applicable
    let itemTitle = 'Ortoqbank 2025';
    let itemDescription = 'Acesso ao ortoqbank 2025';

    if (couponCode && regularPricing.discountAmount > 0) {
      itemTitle += ` (${regularPricing.discountDescription})`;
      itemDescription += ` - Cupom: ${couponCode.toUpperCase()}`;
    }

    const createdPreference = await preference.create({
      body: {
        external_reference: testeId,
        metadata: {
          testeId,
          userEmail,
          couponCode: couponCode?.toUpperCase() || undefined,
          originalPrice: REGULAR_PRICE,
          discountAmount: regularPricing.discountAmount,
          finalPrice: regularPricing.finalPrice,
        },
        ...(userEmail && {
          payer: {
            name: userName || 'Cliente',
            surname: userLastName || 'Ortoqbank',
            email: userEmail,
            ...(userIdentification && {
              identification: {
                type: userIdentification.type,
                number: userIdentification.number,
              },
            }),
            ...(userPhone && {
              phone: {
                area_code: userPhone.area_code,
                number: userPhone.number,
              },
            }),
            ...(userAddress && {
              address: {
                zip_code: userAddress.zipcode,
                street_name: userAddress.street,
                street_number: userAddress.number,
              },
            }),
          },
        }),

        // Items with coupon-adjusted price
        items: [
          {
            id: '4042011329',
            description: itemDescription,
            title: itemTitle,
            quantity: 1,
            unit_price: regularPricing.finalPrice, // Use the discounted price
            currency_id: 'BRL',
            category_id: 'education',
          },
        ],

        // Payment method configuration with PIX discount on top of coupon
        payment_methods: {
          // PIX discount is calculated on the already discounted price
          discounts: [
            {
              payment_method_id: 'pix',
              type: 'fixed',
              value: regularPricing.finalPrice - pixPricing.finalPrice,
            },
          ],
          installments: 12,
        } as Record<string, any>,

        // Add webhook notification URL
        notification_url: `${origin}/api/mercado-pago/webhook`,

        // Only use auto_return in production
        ...(process.env.NODE_ENV === 'production' && {
          auto_return: 'approved',
        }),

        back_urls: {
          success: `${origin}/?status=sucesso`,
          failure: `${origin}/?status=falha`,
          pending: `${origin}/api/mercado-pago/pending`,
        },

        statement_descriptor: 'ORTOQBANK',
      },
    });

    if (!createdPreference.id) {
      throw new Error('Failed to create preference');
    }

    return NextResponse.json({
      preferenceId: createdPreference.id,
      initPoint: createdPreference.init_point,
      originalPrice: REGULAR_PRICE,
      regularPrice: regularPricing.finalPrice,
      pixPrice: pixPricing.finalPrice,
      couponApplied: couponCode?.toUpperCase() || undefined,
      discountAmount: regularPricing.discountAmount,
      discountDescription: regularPricing.discountDescription,
    });
  } catch (error) {
    console.error('Error creating Mercado Pago preference:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout preference' },
      { status: 500 },
    );
  }
}

// Endpoint to validate coupon codes
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const couponCode = searchParams.get('coupon');

  if (!couponCode) {
    return NextResponse.json(
      { error: 'Coupon code is required' },
      { status: 400 },
    );
  }

  // Try dynamic coupon first, then static
  const dynamicCoupon = await getDynamicCoupon(couponCode);
  const staticCoupon = COUPON_CONFIG.coupons[couponCode.toUpperCase()];
  const effectiveCoupon: Coupon | undefined = dynamicCoupon ?? staticCoupon;

  if (!effectiveCoupon) {
    return NextResponse.json({ valid: false, message: 'Cupom inválido' });
  }
  if (!isCouponActive(effectiveCoupon)) {
    return NextResponse.json({ valid: false, message: 'Cupom expirado' });
  }

  const regularPricing = calculateDiscountedPrice(
    COUPON_CONFIG.REGULAR_PRICE,
    dynamicCoupon ?? couponCode,
  );
  const pixPricing = calculateDiscountedPrice(
    COUPON_CONFIG.PIX_PRICE,
    dynamicCoupon ?? couponCode,
  );

  return NextResponse.json({
    valid: true,
    coupon: {
      code: couponCode.toUpperCase(),
      description: effectiveCoupon.description,
      type: effectiveCoupon.type,
      value: effectiveCoupon.value,
    },
    pricing: {
      originalPrice: COUPON_CONFIG.REGULAR_PRICE,
      originalPixPrice: COUPON_CONFIG.PIX_PRICE,
      discountAmount: regularPricing.discountAmount,
      finalRegularPrice: regularPricing.finalPrice,
      finalPixPrice: pixPricing.finalPrice,
    },
  });
}
