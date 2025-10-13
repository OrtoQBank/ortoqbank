import About from './components/about';
import FAQ from './components/faq';
import Header from './components/header';
import Hero from './components/hero';
import PaymentErrorAlert from './components/payment-error-alert';
import Pricing from './components/pricing';
import StaffSection from './components/staff-section';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main>
        <Hero />
        
        {/* Payment Required Error Alert */}
        <PaymentErrorAlert />
        
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
