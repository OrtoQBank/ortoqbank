'use client';

import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { AlertCircleIcon, CheckCircleIcon, LoaderIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { api } from '../../../../convex/_generated/api';

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();
  
  const orderId = searchParams.get('order');
  const [onboardingStep, setOnboardingStep] = useState<'loading' | 'welcome' | 'complete' | 'error'>('loading');
  
  // Get pending order details
  const pendingOrder = useQuery(
    api.asaas.getPendingOrder,
    orderId ? { checkoutId: orderId } : "skip"
  );

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      // User not signed in yet, stay on loading
      return;
    }

    if (!orderId) {
      // No order ID, redirect to dashboard
      router.push('/');
      return;
    }

    if (pendingOrder) {
      if (pendingOrder.status === 'completed') {
        setOnboardingStep('complete');
      } else if (pendingOrder.status === 'provisionable') {
        setOnboardingStep('welcome');
      } else {
        setOnboardingStep('error');
      }
    }
  }, [user, isLoaded, pendingOrder, orderId, router]);

  const handleGetStarted = () => {
    router.push('/');
  };

  const handleResendInvite = () => {
    // TODO: Implement resend invite functionality
    console.log('Resending invite...');
  };

  if (!isLoaded || onboardingStep === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-center space-y-4">
              <LoaderIcon className="h-8 w-8 animate-spin text-blue-600" />
              <h2 className="text-xl font-semibold">Configurando sua conta...</h2>
              <p className="text-center text-muted-foreground">
                Aguarde enquanto finalizamos o processo de ativação da sua conta.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (onboardingStep === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-center space-y-4">
              <AlertCircleIcon className="h-8 w-8 text-red-600" />
              <h2 className="text-xl font-semibold">Erro na ativação</h2>
              <p className="text-center text-muted-foreground">
                Houve um problema ao ativar sua conta. Entre em contato com o suporte.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push('/')}>
                  Ir para o início
                </Button>
                <Button onClick={handleResendInvite}>
                  Tentar novamente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (onboardingStep === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl">Bem-vindo ao OrtoQBank 2025!</CardTitle>
            <p className="text-muted-foreground">
              Seu pagamento foi confirmado e sua conta está sendo ativada.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {pendingOrder && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-800 mb-2">Detalhes da compra</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Produto:</span>
                    <span>OrtoQBank 2025</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Email:</span>
                    <span>{pendingOrder.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor pago:</span>
                    <span>R$ {pendingOrder.finalPrice.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <Badge variant="outline" className="text-green-700 border-green-300">
                      Ativo
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-semibold">O que você pode fazer agora:</h3>
              <div className="grid gap-3">
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="h-2 w-2 bg-blue-600 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">Acessar questões</h4>
                    <p className="text-sm text-muted-foreground">
                      Milhares de questões organizadas por especialidade
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="h-2 w-2 bg-blue-600 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">Criar simulados</h4>
                    <p className="text-sm text-muted-foreground">
                      Monte simulados personalizados para seu estudo
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="h-2 w-2 bg-blue-600 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">Acompanhar progresso</h4>
                    <p className="text-sm text-muted-foreground">
                      Veja suas estatísticas e evolução nos estudos
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button onClick={handleGetStarted} className="w-full" size="lg">
                Começar a estudar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (onboardingStep === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold">Conta ativada!</h2>
              <p className="text-center text-muted-foreground">
                Sua conta já está ativa e você pode começar a usar o OrtoQBank.
              </p>
              <Button onClick={handleGetStarted} className="w-full">
                Ir para o dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
