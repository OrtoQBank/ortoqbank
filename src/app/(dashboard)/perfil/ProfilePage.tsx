'use client';

import { useMutation } from 'convex/react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import {
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenantQuery } from '@/hooks/useTenantQuery';

import { api } from '../../../../convex/_generated/api';
import { StatCard } from './components/stat-card';

// Dynamically import charts that aren't visible on initial load
const ProgressOverTimeChart = dynamic(
  () =>
    import('./charts/progress-over-time-chart').then(
      m => m.ProgressOverTimeChart,
    ),
  {
    loading: () => <Skeleton className="h-60 w-full rounded-lg" />,
    ssr: false,
  },
);

const ThemeBarChart = dynamic(
  () => import('./charts/theme-bar-chart').then(m => m.ThemeBarChart),
  {
    loading: () => <Skeleton className="h-[300px] w-full rounded-lg" />,
    ssr: false,
  },
);

const ThemeRadarChart = dynamic(
  () => import('./charts/theme-radar-chart').then(m => m.ThemeRadarChart),
  {
    loading: () => <Skeleton className="h-[300px] w-full rounded-lg" />,
    ssr: false,
  },
);

// Helper function to safely extract values regardless of stats type
function getStatsValues(stats: any) {
  if (!stats) return;

  // Check if we have the new flat structure (UserStatsSummary)
  if ('totalAnswered' in stats) {
    return {
      totalAnswered: stats.totalAnswered,
      totalCorrect: stats.totalCorrect,
      totalIncorrect: stats.totalIncorrect,
      totalBookmarked: stats.totalBookmarked,
      correctPercentage: stats.correctPercentage,
      totalQuestions: stats.totalQuestions,
    };
  }

  // Otherwise we have the nested structure (UserStats)
  if (stats.overall) {
    return {
      totalAnswered: stats.overall.totalAnswered,
      totalCorrect: stats.overall.totalCorrect,
      totalIncorrect: stats.overall.totalIncorrect,
      totalBookmarked: stats.overall.totalBookmarked,
      correctPercentage: stats.overall.correctPercentage,
      totalQuestions: stats.totalQuestions,
    };
  }

  return;
}

export default function ProfilePage() {
  // Use tenant-aware queries - Convex handles caching automatically
  const userStats = useTenantQuery(api.userStats.getUserStatsFast, {});
  const [showThemeStats, setShowThemeStats] = useState(false);

  // Determine if we're loading the data
  const isLoadingSummary = userStats === undefined;

  // Use the userStats directly (includes both summary and theme stats)
  const stats = userStats;

  // Extract the values safely
  const values = getStatsValues(stats);

  // Normalize theme stats to handle both payload shapes
  const themeStats = userStats?.byTheme ?? [];

  // Use extracted values or defaults
  const totalAnswered = values?.totalAnswered || 0;
  const totalCorrect = values?.totalCorrect || 0;
  const totalIncorrect = values?.totalIncorrect || 0;
  const totalBookmarked = values?.totalBookmarked || 0;
  const correctPercentage = values?.correctPercentage || 0;
  const totalQuestions = values?.totalQuestions || 0;

  // Calculate completion percentage
  const completionPercentage =
    !values || totalQuestions === 0
      ? 0
      : Math.round((totalAnswered / totalQuestions) * 100);

  // Prepare data for the progress pie chart
  const progressData = values
    ? [
        {
          name: 'Respondidas',
          value: totalAnswered,
          color: '#2388e2', // blue
        },
        {
          name: 'Não Respondidas',
          value: totalQuestions - totalAnswered,
          color: 'rgba(35, 33, 34, 0.25)', // gray
        },
      ]
    : [];

  // Prepare data for the correctness pie chart
  const correctnessData = values
    ? [
        {
          name: 'Corretas',
          value: totalCorrect,
          color: '#22c55e', // green
        },
        {
          name: 'Incorretas',
          value: totalIncorrect,
          color: '#ef4444', // red
        },
      ]
    : [];

  return (
    <div className="container mx-auto pt-2 md:p-6">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
        Meu Perfil
      </h1>

      {isLoadingSummary ? (
        // Loading state
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : values ? (
        // Stats cards - only render if stats are available
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            title="Questões Respondidas"
            value={totalAnswered}
            description={`${completionPercentage}% do banco de questões (${totalQuestions} total)`}
            color="sky"
          />
          <StatCard
            title="Taxa de Acerto"
            value={`${correctPercentage}%`}
            description={`${totalCorrect} respostas corretas`}
            color="green"
          />

          <StatCard
            title="Questões Salvas"
            value={totalBookmarked}
            description="Questões marcadas para revisão"
            color="purple"
          />
        </div>
      ) : undefined}

      {/* Use a 2-column grid for charts */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {isLoadingSummary ? (
          // Loading state for charts
          <>
            <Skeleton className="h-60 w-full rounded-lg" />
            <Skeleton className="h-60 w-full rounded-lg" />
          </>
        ) : values ? (
          <>
            {/* Progress Pie Chart */}
            <div className="bg-card text-card-foreground rounded-lg border p-4 shadow-sm">
              <div className="mb-2">
                <h3 className="text-md font-semibold">Progresso Geral</h3>
                <p className="text-muted-foreground text-xs">
                  Questões respondidas de {totalQuestions} no total
                </p>
              </div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={progressData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={75}
                      dataKey="value"
                    >
                      {progressData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="inside"
                        className="fill-white font-semibold"
                        stroke="none"
                        fontSize={14}
                        formatter={(value: number, entry: any) => {
                          const total = progressData.reduce(
                            (sum, item) => sum + item.value,
                            0,
                          );
                          const percent = ((value / total) * 100).toFixed(0);
                          return `${percent}%`;
                        }}
                      />
                    </Pie>
                    <Tooltip formatter={value => [`${value} questões`, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Correctness Pie Chart */}
            <div className="bg-card text-card-foreground rounded-lg border p-4 shadow-sm">
              <div className="mb-2">
                <h3 className="text-md font-semibold">Desempenho</h3>
                <p className="text-muted-foreground text-xs">
                  Respostas Corretas vs Incorretas
                </p>
              </div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={correctnessData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={75}
                      dataKey="value"
                    >
                      {correctnessData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="inside"
                        className="fill-white font-semibold"
                        stroke="none"
                        fontSize={14}
                        formatter={(value: number) => {
                          const total = correctnessData.reduce(
                            (sum, item) => sum + item.value,
                            0,
                          );
                          const percent =
                            total === 0
                              ? 0
                              : ((value / total) * 100).toFixed(0);
                          return `${percent}%`;
                        }}
                      />
                    </Pie>
                    <Tooltip formatter={value => [`${value} questões`, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : undefined}
      </div>

      {/* Progress over time chart */}
      {!isLoadingSummary && values && (
        <div className="mb-6">
          <ProgressOverTimeChart />
        </div>
      )}

      {/* Theme stats - now included in the main query */}
      {!isLoadingSummary &&
        !showThemeStats &&
        values &&
        userStats &&
        themeStats.length > 0 && (
          <div className="mt-6 flex justify-center">
            <Button onClick={() => setShowThemeStats(true)} variant="outline">
              Ver estatísticas por tema
            </Button>
          </div>
        )}

      {showThemeStats && (
        <div
          className={`mb-6 grid grid-cols-1 gap-4 ${
            process.env.NODE_ENV === 'development' ? 'md:grid-cols-2' : ''
          }`}
        >
          {themeStats.length === 0 ? (
            <>
              <div className="bg-card text-card-foreground flex h-[300px] items-center justify-center rounded-lg border p-3 shadow-sm">
                <p className="text-muted-foreground text-sm">
                  Não há dados suficientes sobre temas para exibir o gráfico.
                </p>
              </div>
              {process.env.NODE_ENV === 'development' && (
                <div className="bg-card text-card-foreground flex h-[300px] items-center justify-center rounded-lg border p-3 shadow-sm">
                  <p className="text-muted-foreground text-sm">
                    Não há dados suficientes sobre temas para exibir o radar.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <ThemeBarChart themeStats={themeStats} />
              {process.env.NODE_ENV === 'development' && <ThemeRadarChart />}
            </>
          )}
        </div>
      )}

      {/* Danger zone: reset stats */}
      <div className="mt-8 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">
              Zerar estatísticas
            </h3>
            <p className="text-xs text-red-600 dark:text-red-400">
              Isto vai limpar suas estatísticas de respostas (não afeta questões
              salvas).
            </p>
          </div>
          <ResetStatsButton />
        </div>
      </div>
    </div>
  );
}

function ResetStatsButton() {
  const [isPending, setIsPending] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const reset = useMutation(api.userStats.resetMyStatsCounts);

  const handleReset = async () => {
    try {
      setIsPending(true);
      await reset({});
      setIsDialogOpen(false);
      if (typeof globalThis !== 'undefined' && globalThis.location) {
        globalThis.location.reload();
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" disabled={isPending}>
          Zerar estatísticas
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar reset de estatísticas</DialogTitle>
          <DialogDescription>
            Tem certeza de que deseja zerar todas as suas estatísticas de
            respostas? Esta ação não pode ser desfeita.
            <br />
            <br />
            <strong>Nota:</strong> Suas questões salvas não serão afetadas.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsDialogOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={isPending}
          >
            {isPending ? 'Limpando…' : 'Confirmar reset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
