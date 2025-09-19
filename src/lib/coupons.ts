import { ConvexHttpClient } from 'convex/browser';

import { api } from '@/../convex/_generated/api';

// Define coupon structure returned from Convex
export type Coupon = {
  code?: string;
  type: 'percentage' | 'fixed' | 'fixed_price';
  value: number;
  description: string;
  validFrom?: number; // epoch ms
  validUntil?: number; // epoch ms
};

export function isCouponActive(coupon?: Coupon): boolean {
  if (!coupon) return false;
  const now = Date.now();
  if (coupon.validFrom !== undefined && now < coupon.validFrom) return false;
  if (coupon.validUntil !== undefined && now > coupon.validUntil) return false;
  return true;
}

export async function getDynamicCoupon(code?: string): Promise<Coupon | undefined> {
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
      code: dynamic.code,
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
