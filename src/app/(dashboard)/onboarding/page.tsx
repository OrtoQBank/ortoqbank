'use client';

import { CheckCircleIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser();

  useEffect(() => {
    if (!isLoading && user) {
      // User is authenticated, redirect to dashboard
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="border-t-brand-blue h-8 w-8 animate-spin rounded-full border-4 border-gray-300" />
              <h2 className="text-xl font-semibold">Carregando...</h2>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="from-brand-blue/10 flex min-h-screen items-center justify-center bg-gradient-to-br to-indigo-100">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            Bem-vindo ao OrtoQBank 2025!
          </CardTitle>
          <p className="text-muted-foreground">
            Sua conta está ativa e pronta para uso.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">O que você pode fazer agora:</h3>
            <div className="grid gap-3">
              <div className="bg-brand-blue/10 flex items-start gap-3 rounded-lg p-3">
                <div className="bg-brand-blue mt-2 h-2 w-2 rounded-full"></div>
                <div>
                  <h4 className="font-medium">Acessar questões</h4>
                  <p className="text-muted-foreground text-sm">
                    Milhares de questões organizadas por especialidade
                  </p>
                </div>
              </div>
              <div className="bg-brand-blue/10 flex items-start gap-3 rounded-lg p-3">
                <div className="bg-brand-blue mt-2 h-2 w-2 rounded-full"></div>
                <div>
                  <h4 className="font-medium">Criar simulados</h4>
                  <p className="text-muted-foreground text-sm">
                    Monte simulados personalizados para seu estudo
                  </p>
                </div>
              </div>
              <div className="bg-brand-blue/10 flex items-start gap-3 rounded-lg p-3">
                <div className="bg-brand-blue mt-2 h-2 w-2 rounded-full"></div>
                <div>
                  <h4 className="font-medium">Acompanhar progresso</h4>
                  <p className="text-muted-foreground text-sm">
                    Veja suas estatísticas e evolução nos estudos
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Button
              onClick={() => router.push('/')}
              className="w-full"
              size="lg"
            >
              Começar a estudar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
