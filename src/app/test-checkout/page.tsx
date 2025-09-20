'use client';

import { CheckoutAsaasDirect } from '@/components/checkout-asaas-direct';
import { CheckoutAsaasExample } from '@/components/checkout-asaas-example';
import { CheckoutAsaasMinimal } from '@/components/checkout-asaas-minimal';
import { CheckoutAsaasReactive } from '@/components/checkout-asaas-reactive';
import { useState } from 'react';

export default function TestCheckoutPage() {
  const [activeComponent, setActiveComponent] = useState<'simple' | 'reactive' | 'minimal' | 'direct'>('direct');

  // Real product data from database
  const mockProduct = {
    productId: '1', // Using real productId from R3 plan
    productName: 'R3 - TEOT 2026',
    regularPrice: 1999.00,
    pixPrice: 1799.00, // 10% discount for PIX
    description: 'Ideal para quem está começando a preparação para o TEOT 2026'
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Test Checkout Components
          </h1>
          <p className="text-gray-600">
            Teste as duas implementações do checkout AsaaS
          </p>
        </div>

        {/* Component Selector */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-sm border grid grid-cols-2 md:grid-cols-4 gap-1">
            <button
              onClick={() => setActiveComponent('direct')}
              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                activeComponent === 'direct'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Direct ⚡
            </button>
            <button
              onClick={() => setActiveComponent('minimal')}
              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                activeComponent === 'minimal'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Minimal 📧
            </button>
            <button
              onClick={() => setActiveComponent('simple')}
              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                activeComponent === 'simple'
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Simple 📝
            </button>
            <button
              onClick={() => setActiveComponent('reactive')}
              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                activeComponent === 'reactive'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Reactive 🔄
            </button>
          </div>
        </div>

        {/* Component Display */}
        <div className="flex justify-center">
          {activeComponent === 'direct' && <CheckoutAsaasDirect {...mockProduct} />}
          {activeComponent === 'minimal' && <CheckoutAsaasMinimal {...mockProduct} />}
          {activeComponent === 'simple' && <CheckoutAsaasExample {...mockProduct} />}
          {activeComponent === 'reactive' && <CheckoutAsaasReactive {...mockProduct} />}
        </div>

        {/* Info */}
        <div className="mt-8 max-w-2xl mx-auto">
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <h3 className="font-medium text-gray-900 mb-2">
              {activeComponent === 'direct' && 'Direct Checkout ⚡'}
              {activeComponent === 'minimal' && 'Minimal Checkout 📧'}
              {activeComponent === 'simple' && 'Simple Checkout 📝'}
              {activeComponent === 'reactive' && 'Reactive Checkout 🔄'}
            </h3>
            <p className="text-sm text-gray-600">
              {activeComponent === 'direct' && 'Zero forms! User clicks and goes straight to AsaaS checkout.'}
              {activeComponent === 'minimal' && 'Only asks for email. User completes other info at AsaaS.'}
              {activeComponent === 'simple' && 'Full form with useMutation. Basic feedback, action runs in background.'}
              {activeComponent === 'reactive' && 'Full form with real-time status updates and auto-redirect.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
