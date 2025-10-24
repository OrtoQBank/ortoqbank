import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  color:
    | 'blue'
    | 'green'
    | 'red'
    | 'purple'
    | 'indigo'
    | 'cyan'
    | 'sky'
    | 'violet'
    | 'white';
}

const colorMap = {
  blue: 'bg-brand-blue/10 text-brand-blue/90 border-brand-blue/20',
  green: 'bg-green-50 text-green-800 border-green-200',
  red: 'bg-red-50 text-red-800 border-red-200',
  purple: 'bg-purple-50 text-purple-800 border-purple-200',
  indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  cyan: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  sky: 'bg-sky-50 text-sky-800 border-sky-200',
  violet: 'bg-violet-50 text-violet-800 border-violet-200',
  white: 'bg-white text-gray-800 border-gray-200',
};

export function StatCard({ title, value, description, color }: StatCardProps) {
  return (
    <Card className={`border ${colorMap[color]} shadow-sm`}>
      <CardContent className="p-6">
        <h3 className="text-md font-medium">{title}</h3>
        <div className="mt-2 flex items-baseline">
          <p className="text-3xl font-semibold">{value}</p>
        </div>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </CardContent>
    </Card>
  );
}
