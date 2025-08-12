'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Trophy, Users, Target } from 'lucide-react';

const EVENT_NAME = 'simulado-nacional-2025';

export default function SimuladoNacional2025() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [university, setUniversity] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const registerUser = useMutation(api.eventQuiz.registerEventUser);
  const eventUser = useQuery(
    api.eventQuiz.getEventUser,
    email ? { email, eventName: EVENT_NAME } : 'skip',
  );
  const eventStats = useQuery(api.eventQuiz.getEventStats, {
    eventName: EVENT_NAME,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await registerUser({
        email,
        firstName,
        lastName,
        phone: phone || undefined,
        university: university || undefined,
        graduationYear: graduationYear ? parseInt(graduationYear) : undefined,
        city: city || undefined,
        state: state || undefined,
        socialMedia: {
          instagram: instagram || undefined,
          linkedin: linkedin || undefined,
          whatsapp: whatsapp || undefined,
        },
        eventName: EVENT_NAME,
      });

      // Redirect to quiz page
      router.push(
        `/simulado-nacional-2025/quiz?email=${encodeURIComponent(email)}`,
      );
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar. Tente novamente.');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="mx-auto max-w-4xl pt-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center">
            <Trophy className="h-16 w-16 text-yellow-500" />
          </div>
          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            Simulado Nacional 2025
          </h1>
          <p className="mb-6 text-xl text-gray-600">
            Participe do maior simulado de ortopedia do Brasil
          </p>

          {/* Event Stats */}
          {eventStats && (
            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <Users className="mx-auto mb-2 h-6 w-6 text-blue-500" />
                <div className="text-2xl font-bold text-gray-900">
                  {eventStats.totalRegistered}
                </div>
                <div className="text-sm text-gray-600">Inscritos</div>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <Target className="mx-auto mb-2 h-6 w-6 text-green-500" />
                <div className="text-2xl font-bold text-gray-900">
                  {eventStats.totalCompleted}
                </div>
                <div className="text-sm text-gray-600">Finalizaram</div>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <Clock className="mx-auto mb-2 h-6 w-6 text-orange-500" />
                <div className="text-2xl font-bold text-gray-900">4h</div>
                <div className="text-sm text-gray-600">Tempo Limite</div>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <Trophy className="mx-auto mb-2 h-6 w-6 text-yellow-500" />
                <div className="text-2xl font-bold text-gray-900">1</div>
                <div className="text-sm text-gray-600">Vencedor</div>
              </div>
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Sobre o Exame
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>
                  • <strong>50 questões</strong> selecionadas aleatoriamente
                </li>
                <li>
                  • <strong>4 horas</strong> para completar o exame
                </li>
                <li>
                  • <strong>Sem pausas</strong> - uma vez iniciado, deve ser
                  finalizado
                </li>
                <li>
                  • <strong>Uma tentativa apenas</strong> por participante
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Premiação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">🥇 1º Lugar</Badge>
                  <span>1 ano gratuito do app</span>
                </div>
                <p className="mt-4 text-xs text-gray-600">
                  * Classificação baseada na pontuação e tempo de conclusão
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Registration Form */}
        <Card>
          <CardHeader>
            <CardTitle>Inscrever-se no Simulado</CardTitle>
            <CardDescription>
              Preencha seus dados para participar do evento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="firstName">Nome *</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Sobrenome *</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="university">Universidade</Label>
                  <Input
                    id="university"
                    type="text"
                    value={university}
                    onChange={e => setUniversity(e.target.value)}
                    placeholder="Ex: USP, UNIFESP, UFRJ..."
                  />
                </div>
                <div>
                  <Label htmlFor="graduationYear">Ano de Formação</Label>
                  <Input
                    id="graduationYear"
                    type="number"
                    value={graduationYear}
                    onChange={e => setGraduationYear(e.target.value)}
                    placeholder="2025"
                    min="2020"
                    max="2030"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="São Paulo"
                  />
                </div>
                <div>
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    type="text"
                    value={state}
                    onChange={e => setState(e.target.value)}
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Redes Sociais (opcional)</Label>
                <div className="grid gap-2 md:grid-cols-3">
                  <Input
                    placeholder="Instagram (@usuario)"
                    value={instagram}
                    onChange={e => setInstagram(e.target.value)}
                  />
                  <Input
                    placeholder="LinkedIn (perfil)"
                    value={linkedin}
                    onChange={e => setLinkedin(e.target.value)}
                  />
                  <Input
                    placeholder="WhatsApp (número)"
                    value={whatsapp}
                    onChange={e => setWhatsapp(e.target.value)}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? 'Registrando...' : 'Registrar e Iniciar Exame'}
              </Button>

              <p className="text-center text-xs text-gray-600">
                Ao se registrar, você concorda em participar do evento e
                autoriza o uso dos seus dados para fins de classificação e
                contato.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
