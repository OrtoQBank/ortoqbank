'use client';

import { useQuery } from 'convex/react';
import { Check } from 'lucide-react';

import { api } from '../../../convex/_generated/api';
import { Doc } from '../../../convex/_generated/dataModel';

export default function Pricing() {
  const plans: Doc<"pricingPlans">[] | undefined = useQuery(api.pricingPlans.getPricingPlans);
  
  

  return (
    <div className=" bg-gradient-to-br from-slate-50 to-blue-50 py-8">
      <div className="container mx-auto px-4 text-center mb-16">
        <h1 className="text-4xl font-bold mb-3 text-blue-500">
          Orto<span className="text-blue-500">Q</span>Bank
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
              className="relative bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-105 hover:bg-blue-500 w-full lg:w-72 group min-h-[500px] flex flex-col"
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
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


