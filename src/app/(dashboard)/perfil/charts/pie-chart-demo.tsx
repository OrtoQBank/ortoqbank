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
  unansweredCount: number;
}

export function PieChartDemo({
  correctCount,
  incorrectCount,
  unansweredCount,
}: PieChartDemoProps) {
  const answeredCount = correctCount + incorrectCount;

  const data = [
    { name: 'Respondidas', value: answeredCount, color: '#3b82f6' }, // Blue shade
    { name: 'Não Respondidas', value: unansweredCount, color: '#93c5fd' }, // Lighter blue
  ];

  return (
    <div className="bg-card text-card-foreground rounded-lg border p-3 shadow-sm">
      <div className="mb-2">
        <h3 className="text-md font-semibold">Progresso de Questões</h3>
        <p className="text-muted-foreground text-xs">
          Respondidas vs Não Respondidas
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
