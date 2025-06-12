'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';

import CheckoutEmailModal from '@/components/checkout-email-modal';
import { Button } from '@/components/ui/button';

export default function Pricing() {
  const [showEmailModal, setShowEmailModal] = useState(false);

  return (
    <section id="precos" className="bg-gray-100 py-12 md:py-16">
      <div className="container mx-auto px-4">
        <h2 className="mb-2 text-center text-3xl font-bold text-[#2196F3] md:text-4xl">
          OrtoQBank 2026
        </h2>
        <p className="mb-8 text-center text-lg text-gray-700">
          Garanta o seu acesso até o TEOT 2026
        </p>
        <div className="flex justify-center">
          <div className="w-full max-w-md rounded-lg border border-[#2196F3] bg-white p-8 shadow-lg">
            <ul className="mb-8 space-y-4">
              {[
                'Trilhas de estudo com questões inéditas',
                'Simulados e provas antigas',
                'Testes personalizados',
                'Estude apenas fazendo questões e alcance um desempenho diferenciado!',
              ].map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mb-8 text-center">
              <p className="mb-4 text-2xl font-bold text-[#2196F3]">
                R$1.999,90 em 2x sem juros
              </p>
              <p className="text-lg font-medium text-gray-700">
                parcelado em até 12x
              </p>
            </div>

            <Button
              className="hover:bg-opacity-90 w-full bg-[#2196F3] text-lg font-semibold text-white"
              onClick={() => setShowEmailModal(true)}
            >
              GARANTIR MINHA VAGA AGORA!
            </Button>
          </div>
        </div>
      </div>

      <CheckoutEmailModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
      />
    </section>
  );
}
