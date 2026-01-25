import { fetchQuery } from 'convex/nextjs';

import { api } from '../../../convex/_generated/api';
import { PricingClient } from './pricing-client';

// Force static rendering and revalidate every 1 hour
export const dynamic = 'force-static';
export const revalidate = 3600;

// Helper function to fetch plans with error handling
async function getPlans() {
  try {
    return await fetchQuery(api.pricingPlans.getPricingPlans, {});
  } catch (error) {
    console.error('Failed to fetch pricing plans:', error);
    return [];
  }
}

// Server component that fetches the data
export default async function Pricing() {
  const plans = await getPlans();
  return <PricingClient plans={plans} />;
}
