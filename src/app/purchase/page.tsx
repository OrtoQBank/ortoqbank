'use client';

import { SignOutButton, useUser } from '@clerk/nextjs';
import { CheckCircle, CreditCard, Lock, LogOut } from 'lucide-react';
import Link from 'next/link';

import { useTenant } from '@/components/providers/TenantProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import Header from '../components/header';


export default function PurchasePage() {
  const { isSignedIn, user } = useUser();
  const { data } = useTenant();
  const appName = data?.name;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50 to-indigo-100">
      <Header />
      <div className="flex items-center justify-center p-6 pt-24">
        <Card className="w-full max-w-lg border-0 shadow-xl">
          <CardHeader className="pb-2 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Lock className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Acesso Restrito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isSignedIn && (
              <p className="text-center text-gray-600">
                Olá, <span className="font-medium">{user?.firstName}</span>!
                Você está logado, mas ainda não possui acesso a esta plataforma.
              </p>
            )}
            <p className="text-center text-gray-600">
              Esta área é exclusiva para assinantes do {appName}. Adquira seu
              acesso e tenha disponível:
            </p>

            <ul className="space-y-3">
              {[
                'Acesso ilimitado a todas as questões',
                'Conteúdo exclusivo e atualizado',
                'Acompanhamento de progresso',
                'Suporte prioritário',
              ].map((feature, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 text-sm text-gray-700"
                >
                  <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="space-y-3 pt-4">
              <Button asChild className="w-full" size="lg">
                <Link href="/">
                  <CreditCard className="mr-2 h-5 w-5" />
                  Adquirir Acesso
                </Link>
              </Button>

              <Button asChild variant="outline" className="w-full" size="lg">
                <a href="mailto:Ortoqbankb@gmail.com">Precisa de ajuda?</a>
              </Button>

              {isSignedIn && (
                <SignOutButton redirectUrl="/">
                  <Button variant="ghost" className="w-full" size="lg">
                    <LogOut className="mr-2 h-5 w-5" />
                    Sair da conta
                  </Button>
                </SignOutButton>
              )}
            </div>

            <p className="pt-2 text-center text-xs text-gray-500">
              Já tem uma assinatura? Entre em contato com o suporte.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
