'use client';

import { useQuery } from 'convex/react';
import { Check } from 'lucide-react';
import { useState } from 'react';

import CheckoutEmailModal from '@/components/checkout-email-modal';
import { Button } from '@/components/ui/button';

import { api } from '../../../convex/_generated/api';

export default function Pricing() {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const plans = useQuery(api.pricingPlans.getPricingPlans);
  

  return (
    <div className=" bg-gradient-to-br from-slate-50 to-blue-50 py-8">
      <div className="container mx-auto px-4 text-center mb-16">
        <h1 className="text-4xl font-bold mb-3" style={{ color: "#4A9EFF" }}>
          Orto<span style={{ color: "#4A9EFF" }}>Q</span>Bank
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Escolha o plano ideal para sua preparação e garante sua aprovação no TEOT
        </p>
      </div>
      <div className="container mx-auto px-4 mt-8">
        <div className="flex flex-col lg:flex-row items-center justify-center gap-6 max-w-6xl mx-auto">
          {plans?.map((plan, index) => (
            <div
              key={plan._id}
              className="relative bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-105 w-full lg:w-72 group min-h-[500px] flex flex-col"
            >
              <div className="text-center py-4">
                <div className="inline-block px-4 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-600 group-hover:bg-white group-hover:text-blue-600 transition-all duration-300">
                  {plan.badge}
                </div>
              </div>

              <div className="text-center px-6 pb-6">
                <div className="h-20 flex flex-col justify-center">
               
                    <div className="text-lg line-through mb-2 text-red-500 group-hover:text-white/70 transition-all duration-300 min-h-[1.5em]">
                      {plan.originalPrice && <span>{plan.originalPrice}</span>}
                    </div>
                  <div className="text-4xl font-bold mb-2 text-gray-900 group-hover:text-white transition-all duration-300">
                    {plan.price}
                  </div>
                </div>
                <div className="text-sm text-gray-600 group-hover:text-white transition-all duration-300">
                  {plan.installments}
                </div>
              </div>

              <div className="px-6 pb-6">
                <p className="text-sm text-center text-gray-600 group-hover:text-white/90 transition-all duration-300">
                  {plan.description}
                </p>
              </div>

              <div className="px-6 flex-grow">
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center bg-blue-100 group-hover:bg-white/20 transition-all duration-300">
                        <Check className="w-3 h-3 text-blue-600 group-hover:text-white transition-all duration-300" />
                      </div>
                      <span className="text-sm text-gray-700 group-hover:text-white transition-all duration-300">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 flex-shrink-0">
                <Button 
                  onClick={() => setShowEmailModal(true)}
                  className={`w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-300 ${plan.popular ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white group-hover:bg-white group-hover:text-blue-600 shadow-lg hover:shadow-xl'}`}
                  disabled={plan.popular}
                  >
                  {plan.buttonText}
                  <CheckoutEmailModal
                    open={showEmailModal}
                    onOpenChange={setShowEmailModal}
                  />
                
                </Button>
              </div>

              <div
                className={`absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-100 transition-all duration-300 -z-10 rounded-2xl ${plan.popular ? 'opacity-100' : ''}`}
              >
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


