'use client';

import { Check } from 'lucide-react';
import { parseAsBoolean, useQueryState } from 'nuqs';

import { Button } from '@/components/ui/button';
import { WaitlistModal } from '@/components/waitlist/WaitlistModal';

export default function WaitlistHeroSection() {
  const [, setIsModalOpen] = useQueryState(
    'waitlist',
    parseAsBoolean.withDefault(false)
  );

  return (
    <>
      <section className="w-full bg-gradient-to-br from-gray-50 to-blue-50 py-16 md:py-20">
        <div className="container mx-auto px-6 md:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-[400px_1fr] lg:gap-20">
              {/* Left side - Image/Card */}
              <div className="flex justify-center lg:justify-start">
                <img 
                  src="/hero1.1.jpeg" 
                  alt="OrtoClub TEOT" 
                  width={400} 
                  height={533} 
                  className="rounded-2xl shadow-xl" 
                />
              </div>

              {/* Right side - Content */}
              <div className="flex flex-col justify-center space-y-6 lg:space-y-8">
                <h1 className="text-5xl font-bold text-brand-blue md:text-6xl lg:text-7xl">
                  OrtoClub TEOT
                </h1>

                <p className="text-lg text-gray-600 md:text-xl">
                  Acelere sua aprovação no TEOT aprendendo exatamente o que cai na prova.
                </p>

                <ul className="space-y-5">
                  {[
                    'Vídeo-aulas com especialistas da USP.',
                    'Aprenda os atalhos que utilizamos para nos diferenciar na prova da SBOT.',
                  ].map((text) => (
                    <li key={text} className="flex items-start gap-4">
                      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-brand-blue">
                        <Check className="h-4 w-4 text-brand-blue" />
                      </div>
                      <span className="flex-1 text-base text-gray-700 md:text-lg">
                        {text}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-5 pt-2">
                  <p className="text-2xl font-semibold text-brand-blue md:text-3xl">
                    Clique no botão abaixo para saber mais.
                  </p>
                  <Button
                    size="lg"
                    onClick={() => setIsModalOpen(true)}
                    className="cursor-pointer bg-brand-blue px-10 py-6 text-base font-medium text-white hover:bg-brand-blue/90"
                  >
                    Em breve novas turmas
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <WaitlistModal />
    </>
  );
}

