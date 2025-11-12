import { Badge } from '@/components/ui/badge';

interface TeamCoverageIndicatorProps {
  date: Date;
  coverage: {
    totalEmployees: number;
    onLeaveCount: number;
    coveragePercentage: number;
  };
}

export function TeamCoverageIndicator({ date, coverage }: TeamCoverageIndicatorProps) {
  const { totalEmployees, onLeaveCount, coveragePercentage } = coverage;

  // Déterminer variante selon %
  const getVariant = (pct: number): 'default' | 'secondary' | 'destructive' => {
    if (pct >= 80) return 'default'; // Vert (default dans ce contexte)
    if (pct >= 60) return 'secondary'; // Jaune/orange
    return 'destructive'; // Rouge
  };

  const presentCount = totalEmployees - onLeaveCount;

  return (
    <div className="text-xs text-center mt-1">
      <Badge
        variant={getVariant(coveragePercentage)}
        className="px-1 py-0 h-4 text-[10px]"
      >
        {presentCount}/{totalEmployees} ({Math.round(coveragePercentage)}%)
      </Badge>
    </div>
  );
}
