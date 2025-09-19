import { NextRequest, NextResponse } from 'next/server';

import { asaasClient } from '../../../../lib/asaas';
import { isRateLimited } from '../../../../lib/rate-limiter';

export async function GET(req: NextRequest) {
  // Rate limiting
  if (isRateLimited(req, 'asaas-payment-status', 60, 60_000)) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const chargeId = searchParams.get('chargeId');

  if (!chargeId) {
    return NextResponse.json({ error: 'Missing chargeId parameter' }, { status: 400 });
  }

  try {
    const charge = await asaasClient.getCharge(chargeId);
    
    return NextResponse.json({
      id: charge.id,
      status: charge.status,
      value: charge.value,
      dueDate: charge.dueDate,
      confirmedDate: charge.confirmedDate,
      paymentDate: charge.paymentDate,
      billingType: charge.billingType,
    });

  } catch (error) {
    console.error('Error fetching payment status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment status' },
      { status: 500 }
    );
  }
}
