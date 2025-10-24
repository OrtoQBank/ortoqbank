import About from './components/about';
import FAQ from './components/faq';
import Header from './components/header';
import Hero from './components/hero';
import Pricing from './components/pricing';
import StaffSection from './components/staff-section';

// Force static generation with revalidation every 1 hour
export const dynamic = 'force-static';
export const revalidate = 3600;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main>
        <Hero />       
   
        <About />
        <StaffSection />
        <Pricing />
        <FAQ />
      </main>
      <footer className="mt-auto bg-brand-blue py-4 text-white">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2025 OrtoQBank. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
