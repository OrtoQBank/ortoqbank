'use client';

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface PieChartDemoProps {
  correctCount: number;
  incorrectCount: number;
  unansweredCount?: number; // Make unanswered optional
}

export function PieChartDemo({
  correctCount,
  incorrectCount,
  unansweredCount = 0, // Default to 0
}: PieChartDemoProps) {
  // Now focus on correct vs incorrect answers
  const data = [
    { name: 'Corretas', value: correctCount, color: '#22c55b' }, // Green
    { name: 'Incorretas', value: incorrectCount, color: '#ef4444' }, // Red
  ];

  return (
    <div className="bg-card text-card-foreground rounded-lg border p-3 shadow-sm">
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
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={60}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) =>
                `${name}: ${(percent * 100).toFixed(0)}%`
              }
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={value => [`${value} questões`, '']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
