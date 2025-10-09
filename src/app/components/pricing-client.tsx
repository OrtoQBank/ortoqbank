'use client';

import { Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { Doc } from '../../../convex/_generated/dataModel';

interface PricingClientProps {
  plans: Doc<'pricingPlans'>[];
}

export function PricingClient({ plans }: PricingClientProps) {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const router = useRouter();

   const handleCheckout = async (plan: Doc<'pricingPlans'>) => {
     setLoadingPlanId(plan._id);
     
     try {
       // Redirect to transparent checkout with plan details
       const searchParams = new URLSearchParams({
         plan: plan.productId || plan._id,
       });
       
       router.push(`/checkout?${searchParams.toString()}`);
     } catch (error) {
       console.error('Erro ao redirecionar para checkout:', error);
       setLoadingPlanId(null);
     }
   };

  return (
    <div id="pricing" className="bg-gradient-to-br from-slate-50 to-blue-50 py-8">
      <div className="container mx-auto mb-16 px-4 text-center">
        <h1 className="mb-3 text-4xl font-bold text-blue-500">
          Orto<span className="text-blue-500">Q</span>Bank
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-gray-600">
          Escolha o plano ideal para sua preparação e garante sua aprovação no
          TEOT
        </p>
      </div>
      <div className="container mx-auto mt-8 px-4 sm:px-6">
        <div className="mx-auto flex flex-col items-center justify-center gap-6 lg:flex-row lg:items-stretch">
          {plans?.map((plan, index) => (
            <div
              key={plan._id}
              className="group relative flex w-full max-w-sm flex-col rounded-2xl bg-white shadow-xl transition-all duration-300 hover:scale-105 hover:bg-blue-500 hover:shadow-2xl lg:w-90 lg:max-w-none"
            >
              <div className="py-4 text-center">
                <div className="inline-block rounded-full bg-blue-100 px-6 py-2 text-md font-bold text-blue-600 transition-all duration-300 group-hover:bg-white group-hover:text-blue-600">
                  {plan.badge}
                </div>
              </div>

              <div className="px-6 pb-6 text-center">
                <div className="mb-2 min-h-[2rem] text-xl text-red-500 transition-all duration-300 group-hover:text-white/70">
                  {plan.originalPrice ? (
                    <span>
                      <span className="font-medium">De: </span>
                      <span className="line-through">{plan.originalPrice}</span>
                    </span>
                  ) : (
                    <span className="invisible">placeholder</span>
                  )}
                </div>
                <div className="mb-2 text-gray-900 transition-all duration-300 group-hover:text-white">
                  <span className="text-lg font-medium">Para: </span>
                  <span className="text-4xl font-bold">{plan.price}</span>
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

              <div className="flex-grow px-6 pb-6">
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

              <div className="mt-auto px-6 pb-6">
                <Button
                  className="cursor-pointer hover:bg-opacity-90 w-full bg-[#2196F3] text-lg font-semibold text-white"
                  onClick={() => handleCheckout(plan)}
                  disabled={loadingPlanId === plan._id}
                >
                  {loadingPlanId === plan._id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    plan.buttonText
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
