'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';

import CheckoutEmailModal from '@/components/checkout-email-modal';
import { Button } from '@/components/ui/button';

import { Doc } from '../../../convex/_generated/dataModel';

interface PricingClientProps {
  plans: Doc<'pricingPlans'>[];
}

export function PricingClient({ plans }: PricingClientProps) {
  const [showEmailModal, setShowEmailModal] = useState(false);

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50 py-8">
      <div className="container mx-auto mb-16 px-4 text-center">
        <h1 className="mb-3 text-4xl font-bold text-blue-500">
          Orto<span className="text-blue-500">Q</span>Bank
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-gray-600">
          Escolha o plano ideal para sua preparação e garante sua aprovação no
          TEOT
        </p>
      </div>
      <div className="container mx-auto mt-8 px-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-6 lg:flex-row">
          {plans?.map((plan, index) => (
            <div
              key={plan._id}
              className="group relative flex min-h-[500px] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl transition-all duration-300 hover:scale-105 hover:bg-blue-500 hover:shadow-2xl lg:w-72"
            >
              <div className="py-4 text-center">
                <div className="inline-block rounded-full bg-blue-100 px-4 py-1 text-xs font-bold text-blue-600 transition-all duration-300 group-hover:bg-white group-hover:text-blue-600">
                  {plan.badge}
                </div>
              </div>

              <div className="px-6 pb-6 text-center">
                <div className="flex h-20 flex-col justify-center">
                  <div className="mb-2 min-h-[1.5em] text-lg text-red-500 line-through transition-all duration-300 group-hover:text-white/70">
                    {plan.originalPrice && <span>{plan.originalPrice}</span>}
                  </div>
                  <div className="mb-2 text-4xl font-bold text-gray-900 transition-all duration-300 group-hover:text-white">
                    {plan.price}
                  </div>
                </div>
                <div className="text-sm text-gray-600 transition-all duration-300 group-hover:text-white">
                  {plan.installments}
                </div>
              </div>

              <div className="px-6 pb-6">
                <p className="text-center text-sm text-gray-600 transition-all duration-300 group-hover:text-white/90">
                  {plan.description}
                </p>
              </div>

              <div className="flex-grow px-6">
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-3">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 transition-all duration-300 group-hover:bg-white/20">
                        <Check className="h-3 w-3 text-blue-600 transition-all duration-300 group-hover:text-white" />
                      </div>
                      <span className="text-sm text-gray-700 transition-all duration-300 group-hover:text-white">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-6 pb-6">
                <Button
                  className="cursor-pointer hover:bg-opacity-90 w-full bg-[#2196F3] text-lg font-semibold text-white"
                  onClick={() => setShowEmailModal(true)}
                >
                  {plan.buttonText}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <CheckoutEmailModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
      />
    </div>
  );
}
