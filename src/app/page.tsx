import { getServerTenantId } from '@/lib/tenant-server';

import Footer from './components/footer';
import Header from './components/header';
import Pricing from './components/pricing';

export default async function Home() {
  const tenantId = await getServerTenantId();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <Pricing tenantId={tenantId} />


      <Footer />
    </div>
  );
}
