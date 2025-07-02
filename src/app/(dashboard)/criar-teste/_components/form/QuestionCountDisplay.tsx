import { Badge } from '@/components/ui/badge';

interface QuestionCountDisplayProps {
  count: number;
  isLoading?: boolean;
  className?: string;
}

export function QuestionCountDisplay({
  count,
  isLoading = false,
  className = '',
}: QuestionCountDisplayProps) {
  if (isLoading) {
    return (
      <Badge
        variant="secondary"
        className={`animate-pulse bg-gray-200 text-transparent ${className}`}
      >
        999
      </Badge>
    );
  }

  // Color coding based on question count
  const getVariant = () => {
    if (count === 0) return 'destructive';
    if (count < 10) return 'outline';
    if (count < 50) return 'secondary';
    return 'default';
  };

  return (
    <Badge variant={getVariant()} className={className}>
      {count}
    </Badge>
  );
}

interface QuestionModeCountsProps {
  allCount: number;
  unansweredCount: number;
  incorrectCount: number;
  bookmarkedCount: number;
  isLoading?: boolean;
  className?: string;
}

export function QuestionModeCounts({
  allCount,
  unansweredCount,
  incorrectCount,
  bookmarkedCount,
  isLoading = false,
  className = '',
}: QuestionModeCountsProps) {
  const counts = [
    { label: 'Todas', count: allCount },
    { label: 'Não resp.', count: unansweredCount },
    { label: 'Incorretas', count: incorrectCount },
    { label: 'Marcadas', count: bookmarkedCount },
  ];

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {counts.map(({ label, count }) => (
        <div key={label} className="flex items-center gap-1">
          <span className="text-xs text-gray-600">{label}:</span>
          <QuestionCountDisplay count={count} isLoading={isLoading} />
        </div>
      ))}
    </div>
  );
}
