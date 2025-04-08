import About from './components/about';
import FAQ from './components/faq';
import Header from './components/header';
import Hero from './components/hero';
import Pricing from './components/pricing';
import StaffSection from './components/staff-section';

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
      <footer className="mt-auto bg-[#2196F3] py-4 text-white">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2025 OrtoQBank. Todos os direitos reservados. BR</p>
        </div>
      </footer>
    </div>
  );
}
