'use client';

import { useQuery } from 'convex-helpers/react/cache/hooks';
import {
  Area,
  AreaChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Skeleton } from '@/components/ui/skeleton';
import { formatWeekString } from '@/utils/dateUtils';

import { api } from '../../../../../convex/_generated/api';

export function ProgressOverTimeChart() {
  const weeklyData = useQuery(
    api.aggregateQueries.getUserWeeklyProgressWithAggregates,
  );

  if (weeklyData === undefined) {
    return (
      <div className="bg-card text-card-foreground rounded-lg border p-3 shadow-sm">
        <div className="mb-2">
          <h3 className="text-md font-semibold">Progresso ao Longo do Tempo</h3>
          <p className="text-muted-foreground text-xs">
            Total de questões respondidas por semana
          </p>
        </div>
        <Skeleton className="h-[220px] w-full" />
      </div>
    );
  }

  if (weeklyData.length === 0) {
    return (
      <div className="bg-card text-card-foreground rounded-lg border p-3 shadow-sm">
        <div className="mb-2">
          <h3 className="text-md font-semibold">Progresso ao Longo do Tempo</h3>
          <p className="text-muted-foreground text-xs">
            Total de questões respondidas por semana
          </p>
        </div>
        <div className="flex h-[220px] items-center justify-center">
          <p className="text-muted-foreground text-sm">
            Nenhum dado de progresso disponível ainda.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-card text-card-foreground rounded-lg border p-3 shadow-sm">
      <div className="mb-2">
        <h3 className="text-md font-semibold">Progresso ao Longo do Tempo</h3>
        <p className="text-muted-foreground text-xs">
          Total de questões respondidas por semana
        </p>
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={weeklyData}
            margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
          >
            <defs>
              <linearGradient id="colorAnswered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11 }}
              tickFormatter={value => formatWeekString(value, 'short')}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={value => value.toString()}
            />
            <Tooltip
              formatter={(value, name) => [
                `${value} questões`,
                name === 'totalAnswered' ? 'Total Acumulado' : 'Esta Semana',
              ]}
              labelFormatter={label => formatWeekString(label, 'long')}
            />
            <Area
              type="monotone"
              dataKey="totalAnswered"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#colorAnswered)"
            >
              <LabelList
                dataKey="totalAnswered"
                position="top"
                className="fill-blue-600 font-semibold"
                fontSize={12}
                offset={5}
                dx={8}
              />
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
