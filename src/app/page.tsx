import { getServerTenantId } from '@/lib/tenant-server';

import Footer from './components/footer';
import Header from './components/header';
import Pricing from './components/pricing';

export default async function Home() {
  const tenantId = await getServerTenantId();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {tenantId ? (
        <Pricing tenantId={tenantId} />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">
            Não foi possível carregar os planos. Tente novamente mais tarde.
          </p>
        </div>
      )}
      <Footer />
    </div>
  );
}
