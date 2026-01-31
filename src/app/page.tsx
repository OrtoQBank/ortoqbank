import {
  getServerTenantContext,
  getServerTenantId,
} from '@/lib/tenant-server';

import About from './components/about';
import FAQ from './components/faq';
import Footer from './components/footer';
import Header from './components/header';
import Hero from './components/hero';
import Pricing from './components/pricing';
import StaffSection from './components/staff-section';
import WaitlistHero from './components/waitlist-hero';

// Dynamic rendering to support tenant-specific content
export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const { config } = await getServerTenantContext();

  return {
    title: `${config.branding.name} - ${config.content.tagline}`,
    description: config.content.metaDescription,
  };
}

export default async function Home() {
  const tenantId = await getServerTenantId();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main>
        <WaitlistHero />
        <Hero />

        <About />
        <StaffSection />
        <Pricing tenantId={tenantId} />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
