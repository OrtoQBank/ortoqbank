'use client';

import { useQuery } from 'convex-helpers/react/cache/hooks';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts';

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

import { api } from '../../../../../convex/_generated/api';

const chartConfig = {
  percentage: {
    label: 'Taxa de Acerto (%)',
    color: '#3b82f6',
  },
} satisfies ChartConfig;

// Helper function to break long theme names into multiple lines
function breakThemeName(name: string): string {
  if (name.length <= 12) return name;

  // Try to break at a space near the middle
  const midPoint = Math.floor(name.length / 2);
  const spaceIndex = name.indexOf(' ', midPoint);

  if (spaceIndex !== -1 && spaceIndex < name.length - 3) {
    return name.slice(0, spaceIndex) + '\n' + name.slice(spaceIndex + 1);
  }

  // If no good space found, break at character 12
  return name.slice(0, 12) + '\n' + name.slice(12);
}

export function ThemeRadarChart() {
  const userStats = useQuery(
    api.aggregateQueries.getUserThemeStatsWithAggregates,
  );

  if (userStats === undefined) {
    return (
      <div className="bg-card text-card-foreground rounded-lg border p-3 shadow-sm">
        <div className="mb-2">
          <h3 className="text-md font-semibold">Desempenho por Tema</h3>
          <p className="text-muted-foreground text-xs">
            Radar de performance por área de conhecimento
          </p>
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (!userStats || userStats.length === 0) {
    return (
      <div className="bg-card text-card-foreground rounded-lg border p-3 shadow-sm">
        <div className="mb-2">
          <h3 className="text-md font-semibold">Desempenho por Tema</h3>
          <p className="text-muted-foreground text-xs">
            Radar de performance por área de conhecimento
          </p>
        </div>
        <div className="flex h-[300px] items-center justify-center">
          <p className="text-muted-foreground text-sm">
            Não há dados suficientes sobre temas para exibir o radar.
          </p>
        </div>
      </div>
    );
  }

  // Get top 6 themes with most questions answered (fewer for better label visibility)
  const chartData = userStats
    .filter(theme => theme.total > 0)
    .slice(0, 6)
    .map(theme => ({
      theme: breakThemeName(theme.themeName),
      percentage: theme.percentage,
      total: theme.total,
      correct: theme.correct,
    }));

  return (
    <div className="bg-card text-card-foreground rounded-lg border p-3 shadow-sm">
      <div className="mb-2">
        <h3 className="text-md font-semibold">Desempenho por Tema</h3>
        <p className="text-muted-foreground text-xs">
          Radar de performance por área de conhecimento
        </p>
      </div>
      <div className="h-[300px]">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[300px] p-2"
        >
          <RadarChart
            data={chartData}
            margin={{ top: 15, right: 20, left: 20, bottom: 15 }}
          >
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [`${value}%`, 'Taxa de Acerto']}
                  labelFormatter={label => `Tema: ${label}`}
                />
              }
            />
            <PolarAngleAxis
              dataKey="theme"
              tick={{ fontSize: 10, fill: '#374151' }}
              tickFormatter={value => value}
            />
            <PolarGrid gridType="polygon" />
            <Radar
              dataKey="percentage"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </RadarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
