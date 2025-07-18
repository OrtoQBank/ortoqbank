'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ThemeStats {
  themeId: string;
  themeName: string;
  total: number;
  correct: number;
  percentage: number;
}

// Helper function to determine fill color
const getFillColor = (percentage: number): string => {
  if (percentage > 70) {
    return '#22c55e'; // green-500
  }
  if (percentage > 40) {
    return '#3b82f6'; // blue-500 (medium performance)
  }
  return '#ef4444'; // red-500
};

interface ThemeBarChartProps {
  themeStats: ThemeStats[];
}

export function ThemeBarChart({ themeStats = [] }: ThemeBarChartProps) {
  // Get top 10 themes by question count
  const data = (themeStats || []).slice(0, 10).map(theme => ({
    name: theme.themeName,
    percentage: theme.percentage,
    total: theme.total,
    fill: getFillColor(theme.percentage),
  }));

  return (
    <div className="bg-card text-card-foreground rounded-lg border p-3 shadow-sm">
      <div className="mb-2">
        <h3 className="text-md font-semibold">Desempenho por Tema</h3>
        <p className="text-muted-foreground text-xs">
          Porcentagem de acerto por tema
        </p>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 15, left: 15, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              tickFormatter={value =>
                value.length > 12 ? `${value.slice(0, 12)}...` : value
              }
            />
            <YAxis
              tickFormatter={value => `${value}%`}
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'percentage')
                  return [`${value}%`, 'Taxa de Acerto'];
                return [`${value} questões`, 'Total de Questões'];
              }}
              labelFormatter={label => `Tema: ${label}`}
            />
            <Legend
              payload={[
                { value: 'Excelente (>70%)', type: 'rect', color: '#22c55e' },
                { value: 'Bom (40-70%)', type: 'rect', color: '#3b82f6' },
                {
                  value: 'Precisa Melhorar (<40%)',
                  type: 'rect',
                  color: '#ef4444',
                },
              ]}
            />
            <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getFillColor(entry.percentage)}
                />
              ))}
              <LabelList
                dataKey="percentage"
                position="top"
                className="fill-gray-700 font-semibold"
                fontSize={10}
                offset={5}
                formatter={(value: number) => `${value.toFixed(1)}%`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
