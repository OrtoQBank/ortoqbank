import { fetchQuery } from 'convex/nextjs';

import { api } from '../../../convex/_generated/api';
import { PricingClient } from './pricing-client';

// Force static rendering and revalidate every 1 hour
export const dynamic = 'force-static';
export const revalidate = 3600;

// Server component that fetches the data
export default async function Pricing() {
  try {
    const plans = await fetchQuery(api.pricingPlans.getPricingPlans);
    return <PricingClient plans={plans} />;
  } catch (error) {
    console.error('Failed to fetch pricing plans:', error);
    return <PricingClient plans={[]} />;
  }
}