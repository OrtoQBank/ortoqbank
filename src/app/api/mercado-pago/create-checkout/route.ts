import * as Sentry from '@sentry/nextjs';
import { ConvexHttpClient } from 'convex/browser';
import { Preference } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';

import { api } from '@/../convex/_generated/api';
import mpClient from '@/lib/mercado-pago';

// Define coupon structure returned from Convex
type Coupon = {
  type: 'percentage' | 'fixed' | 'fixed_price';
  value: number;
  description: string;
  validFrom?: number; // epoch ms
  validUntil?: number; // epoch ms
};

// Base prices (kept as local constants)
const REGULAR_PRICE = 1999.9;
const PIX_PRICE = 1899.9;

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
  coupon?: Coupon,
): {
  finalPrice: number;
  discountAmount: number;
  discountDescription: string;
} {
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
  // Basic per-IP rate limit (best-effort, process-local)
  if (isRateLimited(req, 'create-checkout', 20, 60_000)) {
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
      message: 'Create checkout request received',
      category: 'checkout',
      level: 'info',
      data: { testeId, userEmail: !!userEmail, couponCode: couponCode || '' },
    });
    // Fetch dynamic Convex coupon (no static fallback)
    const dynamicCoupon = await getDynamicCoupon(couponCode);
    Sentry.addBreadcrumb({
      message: 'Coupon resolved',
      category: 'checkout',
      level: 'info',
      data: { hasCoupon: !!dynamicCoupon },
    });

    // Calculate prices with coupon discount
    const regularPricing = calculateDiscountedPrice(
      REGULAR_PRICE,
      dynamicCoupon,
    );
    const pixPricing = calculateDiscountedPrice(PIX_PRICE, dynamicCoupon);

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

    Sentry.addBreadcrumb({
      message: 'Preference created',
      category: 'checkout',
      level: 'info',
      data: { preferenceId: createdPreference.id },
    });

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
    Sentry.captureException(error, {
      tags: { operation: 'create-checkout' },
    });
    console.error('Error creating Mercado Pago preference:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout preference' },
      { status: 500 },
    );
  }
}

// Endpoint to validate coupon codes
export async function GET(req: NextRequest) {
  // Basic per-IP rate limit (best-effort, process-local)
  if (isRateLimited(req, 'validate-coupon', 60, 60_000)) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const couponCode = searchParams.get('coupon');

  if (!couponCode) {
    return NextResponse.json(
      { error: 'Coupon code is required' },
      { status: 400 },
    );
  }

  // Validate only against dynamic coupons stored in Convex
  const dynamicCoupon = await getDynamicCoupon(couponCode);
  const effectiveCoupon: Coupon | undefined = dynamicCoupon;

  if (!effectiveCoupon) {
    return NextResponse.json({ valid: false, message: 'Cupom inválido' });
  }
  if (!isCouponActive(effectiveCoupon)) {
    return NextResponse.json({ valid: false, message: 'Cupom expirado' });
  }

  const regularPricing = calculateDiscountedPrice(REGULAR_PRICE, dynamicCoupon);
  const pixPricing = calculateDiscountedPrice(PIX_PRICE, dynamicCoupon);

  return NextResponse.json({
    valid: true,
    coupon: {
      code: couponCode.toUpperCase(),
      description: effectiveCoupon.description,
      type: effectiveCoupon.type,
      value: effectiveCoupon.value,
    },
    pricing: {
      originalPrice: REGULAR_PRICE,
      originalPixPrice: PIX_PRICE,
      discountAmount: regularPricing.discountAmount,
      finalRegularPrice: regularPricing.finalPrice,
      finalPixPrice: pixPricing.finalPrice,
    },
  });
}

// -----------------
// Simple per-IP rate limiter (process-local, best-effort)
// -----------------
const globalAny = globalThis as any;
type WindowCounter = { count: number; resetAt: number };
if (!globalAny.__mpRateLimit) {
  globalAny.__mpRateLimit = new Map<string, WindowCounter>();
}
const RATE_MAP: Map<string, WindowCounter> = globalAny.__mpRateLimit;

function getClientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

function isRateLimited(
  req: NextRequest,
  routeKey: string,
  limit: number,
  windowMs: number,
): boolean {
  try {
    const ip = getClientIp(req);
    const key = `${routeKey}:${ip}`;
    const now = Date.now();
    const entry = RATE_MAP.get(key);
    if (!entry || now > entry.resetAt) {
      RATE_MAP.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }
    if (entry.count >= limit) return true;
    entry.count += 1;
    return false;
  } catch {
    return false;
  }
}
