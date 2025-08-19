'use client';

import { useMutation, useQuery } from 'convex/react';
import { Award, CheckCircle, Clock, Target, Trophy, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { api } from '../../../convex/_generated/api';

const EVENT_NAME = 'simulado-nacional-2025';

export default function SimuladoNacional2025() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [socialMedia, setSocialMedia] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const registerUser = useMutation(api.eventQuiz.registerEventUser);
  const eventUser = useQuery(
    api.eventQuiz.getEventUser,
    email ? { email, eventName: EVENT_NAME } : 'skip',
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await registerUser({
        email,
        firstName,
        lastName,
        socialMedia: {
          instagram: socialMedia || undefined,
        },
        eventName: EVENT_NAME,
      });

      // Redirect to quiz page
      router.push(
        `/simulado-nacional-2025/quiz?email=${encodeURIComponent(email)}`,
      );
    } catch (error_: any) {
      setError(error_.message || 'Erro ao registrar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // If user is already registered, show access to quiz
  if (eventUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="mx-auto max-w-2xl pt-8">
          <Card>
            <CardHeader className="text-center">
              <div className="mb-4 flex items-center justify-center">
                <Trophy className="h-12 w-12 text-yellow-500" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Bem-vindo de volta, {eventUser.firstName}!
              </CardTitle>
              <CardDescription>
                Você já está registrado para o Simulado Nacional 2025
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {eventUser.hasCompletedExam ? (
                <div className="text-center">
                  <p className="mb-4 font-semibold text-green-600">
                    ✅ Você já completou o exame!
                  </p>
                  <Button
                    onClick={() =>
                      router.push(
                        `/simulado-nacional-2025/results?email=${encodeURIComponent(email)}`,
                      )
                    }
                    className="w-full"
                  >
                    Ver Resultados e Classificação
                  </Button>
                </div>
              ) : eventUser.hasStartedExam ? (
                <div className="text-center">
                  <p className="mb-4 font-semibold text-blue-600">
                    📝 Você já iniciou o exame
                  </p>
                  <Button
                    onClick={() =>
                      router.push(
                        `/simulado-nacional-2025/quiz?email=${encodeURIComponent(email)}`,
                      )
                    }
                    className="w-full"
                  >
                    Continuar Exame
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="mb-4 text-gray-600">
                    Pronto para começar o Simulado Nacional 2025?
                  </p>
                  <Button
                    onClick={() =>
                      router.push(
                        `/simulado-nacional-2025/quiz?email=${encodeURIComponent(email)}`,
                      )
                    }
                    className="w-full"
                    size="lg"
                  >
                    Iniciar Exame
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <main className="mx-auto max-w-6xl px-4 py-12">
        {/* Hero Section */}
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-5xl leading-tight font-bold text-gray-900">
            Simulado Nacional
            <span className="block text-blue-600">2025</span>
          </h1>
          <p className="mx-auto max-w-2xl text-xl leading-relaxed text-gray-600">
            Participe do maior simulado de ortopedia do Brasil e teste seus
            conhecimentos com questões de alta qualidade
          </p>
        </div>

        <div className="grid items-start gap-12 lg:grid-cols-2">
          {/* Left Column - Information */}
          <div className="space-y-8">
            {/* How it Works Card */}
            <Card className="border-0 bg-white/70 shadow-lg backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                  </div>
                  Como Funciona
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="flex items-start gap-4 rounded-xl bg-blue-50 p-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                      1
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold text-gray-900">
                        Questões de Ortopedia
                      </h3>
                      <p className="text-sm text-gray-600">
                        Teste seus conhecimentos com questões elaboradas por
                        especialistas
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 rounded-xl bg-green-50 p-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-sm font-semibold text-white">
                      2
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold text-gray-900">
                        4 horas para completar
                      </h3>
                      <p className="text-sm text-gray-600">
                        Tempo suficiente para demonstrar todo seu conhecimento
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 rounded-xl bg-indigo-50 p-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                      3
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold text-gray-900">
                        Uma tentativa apenas
                      </h3>
                      <p className="text-sm text-gray-600">
                        Uma vez iniciado, deve ser finalizado por participante
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Prize Card */}
            <Card className="border-0 bg-gradient-to-br from-yellow-50 to-orange-50 shadow-lg">
              <CardContent className="p-8">
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500">
                    <Award className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Prêmio Especial
                    </h3>
                    <p className="text-gray-600">Para o vencedor</p>
                  </div>
                </div>
                <div className="rounded-xl bg-white/80 p-4">
                  <p className="mb-2 text-lg font-semibold text-gray-900">
                    Vencedor ganha 1 ano gratuito do aplicativo
                  </p>
                  <p className="text-sm text-gray-600">
                    * Classificação baseada na pontuação e tempo de conclusão
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Registration Form */}
          <div className="lg:sticky lg:top-24">
            <Card className="border-0 bg-white shadow-xl">
              <CardHeader className="pb-6">
                <CardTitle className="text-center text-2xl">
                  Inscrever-se no Simulado
                </CardTitle>
                <p className="text-center text-gray-600">
                  Preencha seus dados para participar do evento
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="firstName"
                        className="text-sm font-medium text-gray-700"
                      >
                        Nome *
                      </Label>
                      <Input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        required
                        placeholder="Seu nome"
                        className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="lastName"
                        className="text-sm font-medium text-gray-700"
                      >
                        Sobrenome *
                      </Label>
                      <Input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        required
                        placeholder="Seu sobrenome"
                        className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="text-sm font-medium text-gray-700"
                    >
                      Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="seuemail@exemplo.com"
                      className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="socialMedia"
                      className="text-sm font-medium text-gray-700"
                    >
                      Instagram (opcional)
                    </Label>
                    <Input
                      id="socialMedia"
                      type="text"
                      value={socialMedia}
                      onChange={e => setSocialMedia(e.target.value)}
                      placeholder="@seu_instagram"
                      className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="h-14 w-full bg-gradient-to-r from-blue-600 to-blue-700 text-lg font-semibold shadow-lg hover:from-blue-700 hover:to-blue-800"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Registrando...' : 'Registrar e Iniciar Exame'}
                  </Button>

                  <div className="rounded-xl bg-blue-50 p-4">
                    <p className="text-center text-sm leading-relaxed text-blue-800">
                      Ao se registrar, você concorda em participar do evento e
                      autoriza o uso dos seus dados para fins de classificação e
                      contato.
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
