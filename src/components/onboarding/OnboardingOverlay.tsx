'use client';

import { useMutation } from 'convex/react';
import { ArrowRight, X } from 'lucide-react';
import { useState } from 'react';

import { api } from '../../../convex/_generated/api';

interface OnboardingOverlayProps {
  onComplete: () => void;
}

export default function OnboardingOverlay({
  onComplete,
}: OnboardingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const completeOnboarding = useMutation(api.users.completeOnboarding);

  const steps = [
    {
      id: 'welcome',
      title: '🎉 Bem-vindo ao OrtoQBank!',
      description:
        'Vamos fazer um tour rápido pela plataforma para você começar seus estudos.',
      position: 'center',
    },
    {
      id: 'simulados',
      title: 'Simulados',
      description:
        'Pratique com simulados completos baseados em provas reais de residência.',
      target: '[data-sidebar="simulados"]',
      position: 'right',
    },
    {
      id: 'trilhas',
      title: 'Trilhas de Estudo',
      description:
        'Siga trilhas organizadas por especialidade e nível de dificuldade.',
      target: '[data-sidebar="trilhas"]',
      position: 'right',
    },
    {
      id: 'criar-teste',
      title: 'Criar Teste',
      description:
        'Monte seus próprios testes personalizados com filtros específicos.',
      target: '[data-sidebar="criar-teste"]',
      position: 'right',
    },
    {
      id: 'testes-previos',
      title: 'Testes Anteriores',
      description: 'Revise seus testes anteriores e acompanhe seu progresso.',
      target: '[data-sidebar="testes-previos"]',
      position: 'right',
    },
    {
      id: 'perfil',
      title: 'Seu Perfil',
      description: 'Acompanhe suas estatísticas e configure suas preferências.',
      target: '[data-sidebar="perfil"]',
      position: 'right',
    },
  ];

  const currentStepData = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    try {
      await completeOnboarding();
      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      onComplete(); // Complete anyway to not block user
    }
  };

  const getTooltipPosition = () => {
    if (currentStepData.position === 'center') {
      return 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
    }

    const target = currentStepData.target
      ? document.querySelector(currentStepData.target)
      : null;
    if (!target) {
      return 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
    }

    const rect = target.getBoundingClientRect();

    if (currentStepData.position === 'right') {
      return `fixed left-[${rect.right + 20}px] top-[${rect.top + rect.height / 2 - 60}px]`;
    }

    return 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
  };

  const getArrowComponent = () => {
    if (currentStepData.position === 'center' || !currentStepData.target)
      return null;

    const target = document.querySelector(currentStepData.target);
    if (!target) return null;

    const rect = target.getBoundingClientRect();

    if (currentStepData.position === 'right') {
      return (
        <ArrowRight
          className="text-brand-blue absolute top-1/2 -left-6 -translate-y-1/2 transform"
          size={24}
        />
      );
    }

    return null;
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {/* Highlight target element */}
      {currentStepData.target && (
        <div
          className="border-brand-blue pointer-events-none absolute rounded-lg border-4 transition-all duration-300"
          style={{
            ...(() => {
              const target = document.querySelector(currentStepData.target!);
              if (!target) return {};
              const rect = target.getBoundingClientRect();
              return {
                left: rect.left - 4,
                top: rect.top - 4,
                width: rect.width + 8,
                height: rect.height + 8,
              };
            })(),
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className={`${getTooltipPosition()} pointer-events-auto relative z-10 max-w-sm rounded-lg bg-white p-6 shadow-xl transition-all duration-300`}
        style={
          currentStepData.position === 'center'
            ? {}
            : {
                position: 'fixed',
                ...(() => {
                  const target = currentStepData.target
                    ? document.querySelector(currentStepData.target)
                    : null;
                  if (!target) return {};
                  const rect = target.getBoundingClientRect();
                  return {
                    left: rect.right + 20,
                    top: rect.top + rect.height / 2 - 80,
                  };
                })(),
              }
        }
      >
        {getArrowComponent()}

        {/* Close button */}
        <button
          onClick={handleComplete}
          className="absolute top-2 right-2 text-gray-400 transition-colors hover:text-gray-600"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="pr-6">
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            {currentStepData.title}
          </h3>
          <p className="mb-4 text-sm text-gray-600">
            {currentStepData.description}
          </p>

          {/* Progress */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    index <= currentStep ? 'bg-brand-blue' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            <div className="flex space-x-2">
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-3 py-1 text-sm text-gray-600 transition-colors hover:text-gray-800"
                >
                  Anterior
                </button>
              )}
              <button
                onClick={handleNext}
                className="bg-brand-blue hover:bg-brand-blue/90 rounded-lg px-4 py-2 text-sm text-white transition-colors"
              >
                {currentStep === steps.length - 1 ? 'Finalizar' : 'Próximo'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
