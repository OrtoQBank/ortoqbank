import { preloadQuery } from 'convex/nextjs';

import { api } from '../../../../../../convex/_generated/api';
import { TestFormClient } from './TestFormClient';

export default async function TestFormServer() {
  // Preload taxonomy data on the server
  const preloadedTaxonomy = await preloadQuery(
    api.taxonomy.getHierarchicalData,
  );

  return <TestFormClient preloadedTaxonomy={preloadedTaxonomy} />;
}
