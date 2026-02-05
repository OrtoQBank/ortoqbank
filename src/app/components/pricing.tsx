import { fetchQuery } from 'convex/nextjs';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { PricingClient } from './pricing-client';

interface PricingProps {
  tenantId: Id<'apps'>;
}

// Helper function to fetch plans with error handling
async function getPlans(tenantId: Id<'apps'>) {
  try {
    // Pass tenantId to filter plans for the current tenant
    return await fetchQuery(api.pricingPlans.getPricingPlans, {
      tenantId,
    });
  } catch (error) {
    console.error('Failed to fetch pricing plans:', error);
    return [];
  }
}

// Server component that fetches the data
export default async function Pricing({ tenantId }: PricingProps) {
  const plans = await getPlans(tenantId);
  return <PricingClient plans={plans} />;
}
