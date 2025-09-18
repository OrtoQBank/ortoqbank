import { fetchQuery } from 'convex/nextjs';

import { api } from '../../../convex/_generated/api';
import { PricingClient } from './pricing-client';

// Server component that fetches the data
export default async function Pricing() {
  const plans = await fetchQuery(api.pricingPlans.getPricingPlans);

  return <PricingClient plans={plans} />;
}