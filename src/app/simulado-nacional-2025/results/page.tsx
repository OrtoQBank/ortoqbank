'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Clock, Target, Users, Medal, Star, Award } from 'lucide-react';

const EVENT_NAME = 'simulado-nacional-2025';

export default function EventResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  const eventUser = useQuery(
    api.eventQuiz.getEventUser,
    email ? { email, eventName: EVENT_NAME } : 'skip',
  );
  const userScore = useQuery(
    api.eventQuiz.getEventUserScore,
    eventUser ? { eventUserId: eventUser._id, eventName: EVENT_NAME } : 'skip',
  );
  const leaderboard = useQuery(api.eventQuiz.getEventLeaderboard, {
    eventName: EVENT_NAME,
    limit: 20,
  });
  const eventStats = useQuery(api.eventQuiz.getEventStats, {
    eventName: EVENT_NAME,
  });

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="mb-4 text-red-600">Email não fornecido</p>
            <Button onClick={() => router.push('/simulado-nacional-2025')}>
              Voltar para Inscrição
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!eventUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="mb-4 text-red-600">Usuário não encontrado</p>
            <Button onClick={() => router.push('/simulado-nacional-2025')}>
              Voltar para Inscrição
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!eventUser.hasCompletedExam || !userScore) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="mb-4 text-yellow-600">
              Você ainda não completou o exame
            </p>
            <Button
              onClick={() =>
                router.push(
                  `/simulado-nacional-2025/quiz?email=${encodeURIComponent(email)}`,
                )
              }
            >
              Continuar Exame
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Find user's rank in leaderboard
  const userRank = leaderboard?.findIndex(entry => entry.email === email) ?? -1;
  const userLeaderboardEntry = userRank >= 0 ? leaderboard![userRank] : null;

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-orange-600" />;
      default:
        return <Star className="h-6 w-6 text-blue-500" />;
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <Badge className="bg-yellow-500 text-yellow-900">🥇 1º Lugar</Badge>
        );
      case 2:
        return <Badge className="bg-gray-400 text-gray-900">🥈 2º Lugar</Badge>;
      case 3:
        return (
          <Badge className="bg-orange-600 text-orange-100">🥉 3º Lugar</Badge>
        );
      default:
        return <Badge variant="outline">{rank}º Lugar</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="mx-auto max-w-6xl pt-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center">
            {userRank === 0 ? (
              <Trophy className="h-20 w-20 text-yellow-500" />
            ) : (
              <Target className="h-20 w-20 text-blue-500" />
            )}
          </div>
          <h1 className="mb-2 text-4xl font-bold text-gray-900">
            {userRank === 0
              ? '🎉 Parabéns, Campeão!'
              : 'Resultados do Simulado Nacional 2025'}
          </h1>
          <p className="text-xl text-gray-600">
            {eventUser.firstName} {eventUser.lastName}
          </p>
          {userRank === 0 && (
            <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-100 p-4">
              <p className="text-lg font-bold text-yellow-800">
                🏆 Você ganhou 1 ano gratuito do app! 🏆
              </p>
              <p className="text-sm text-yellow-700">
                Entraremos em contato em breve pelos dados fornecidos.
              </p>
            </div>
          )}
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-3">
          {/* User Score Card */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Seu Desempenho
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="mb-2 text-4xl font-bold text-blue-600">
                        {userScore.percentage.toFixed(1)}%
                      </div>
                      <p className="text-gray-600">Aproveitamento</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {userScore.score}
                        </div>
                        <p className="text-sm text-gray-600">Acertos</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-600">
                          {userScore.totalQuestions - userScore.score}
                        </div>
                        <p className="text-sm text-gray-600">Erros</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                      <span className="text-sm font-medium">
                        Questões totais:
                      </span>
                      <span className="font-bold">
                        {userScore.totalQuestions}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                      <span className="flex items-center gap-1 text-sm font-medium">
                        <Clock className="h-4 w-4" />
                        Tempo utilizado:
                      </span>
                      <span className="font-bold">
                        {formatTime(userScore.timeSpentMinutes)}
                      </span>
                    </div>

                    {userLeaderboardEntry && (
                      <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3">
                        <span className="text-sm font-medium">
                          Sua classificação:
                        </span>
                        <div className="flex items-center gap-2">
                          {getRankIcon(userRank + 1)}
                          {getRankBadge(userRank + 1)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Event Stats */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Estatísticas do Evento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {eventStats ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {eventStats.totalRegistered}
                      </div>
                      <p className="text-sm text-gray-600">
                        Participantes inscritos
                      </p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Finalizaram:</span>
                        <span className="font-medium">
                          {eventStats.totalCompleted}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Taxa de conclusão:</span>
                        <span className="font-medium">
                          {eventStats.completionRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Média geral:</span>
                        <span className="font-medium">
                          {eventStats.averageScore.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tempo médio:</span>
                        <span className="font-medium">
                          {formatTime(eventStats.averageTimeMinutes)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>Carregando estatísticas...</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Classificação Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard ? (
              <div className="space-y-2">
                {leaderboard.map((entry, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between rounded-lg p-4 transition-colors ${
                      entry.email === email
                        ? 'border-2 border-blue-300 bg-blue-100'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getRankIcon(entry.rank)}
                        <span className="text-lg font-bold">#{entry.rank}</span>
                      </div>

                      <div>
                        <div className="font-medium">
                          {entry.name}
                          {entry.email === email && (
                            <Badge variant="outline" className="ml-2">
                              Você
                            </Badge>
                          )}
                          {entry.isWinner && (
                            <Badge className="ml-2 bg-yellow-500 text-yellow-900">
                              VENCEDOR
                            </Badge>
                          )}
                        </div>
                        {entry.university && (
                          <div className="text-sm text-gray-600">
                            {entry.university}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {entry.percentage.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">
                        {entry.score}/{entry.totalQuestions} •{' '}
                        {formatTime(entry.timeSpentMinutes)}
                      </div>
                    </div>
                  </div>
                ))}

                {leaderboard.length === 0 && (
                  <div className="py-8 text-center text-gray-500">
                    Nenhum resultado disponível ainda.
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                <p>Carregando classificação...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="mt-8 space-y-4 text-center">
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => router.push('/simulado-nacional-2025')}
            >
              Voltar ao Início
            </Button>

            <Button onClick={() => window.location.reload()}>
              Atualizar Resultados
            </Button>
          </div>

          <p className="mx-auto max-w-2xl text-sm text-gray-600">
            Os resultados são atualizados em tempo real. O vencedor será
            contactado pelos dados fornecidos no cadastro para receber o prêmio
            de 1 ano gratuito do aplicativo.
          </p>
        </div>
      </div>
    </div>
  );
}
