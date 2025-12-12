/**
 * Spider/Radar Chart Component
 *
 * Visualizes competency assessments with current level vs target level.
 * Shows gap analysis visually with overlaid polygons.
 *
 * Features:
 * - Current level vs target level comparison
 * - Gap highlighting
 * - Responsive design
 * - French labels
 * - Legend with summary stats
 * - Interactive tooltips
 */

'use client';

import { useMemo } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Competency data point
export interface CompetencyDataPoint {
  /** Competency name (short label for chart) */
  name: string;
  /** Full competency name (for tooltip) */
  fullName?: string;
  /** Current proficiency level (1-5) */
  currentLevel: number;
  /** Target proficiency level (1-5) */
  targetLevel: number;
  /** Competency category (optional) */
  category?: string;
}

// Component props
interface SpiderChartProps {
  /** Chart title */
  title?: string;
  /** Chart description */
  description?: string;
  /** Competency data points */
  data: CompetencyDataPoint[];
  /** Max scale value (default: 5) */
  maxScale?: number;
  /** Show gap indicators */
  showGaps?: boolean;
  /** Show legend */
  showLegend?: boolean;
  /** Show summary stats */
  showSummary?: boolean;
  /** Custom colors */
  colors?: {
    current?: string;
    target?: string;
    grid?: string;
  };
  /** Height of the chart (default: 400) */
  height?: number;
  /** Custom class name */
  className?: string;
}

// Proficiency level labels (French)
const proficiencyLabels: Record<number, string> = {
  1: 'Débutant',
  2: 'Intermédiaire',
  3: 'Confirmé',
  4: 'Expert',
  5: 'Maître',
};

// Custom tooltip
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CompetencyDataPoint }> }) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  const gap = data.targetLevel - data.currentLevel;

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 min-w-[180px]">
      <p className="font-medium text-sm mb-2">{data.fullName || data.name}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between items-center gap-4">
          <span className="text-muted-foreground">Niveau actuel:</span>
          <span className="font-medium">{data.currentLevel}/5 ({proficiencyLabels[data.currentLevel] || 'N/A'})</span>
        </div>
        <div className="flex justify-between items-center gap-4">
          <span className="text-muted-foreground">Niveau cible:</span>
          <span className="font-medium">{data.targetLevel}/5 ({proficiencyLabels[data.targetLevel] || 'N/A'})</span>
        </div>
        <div className="flex justify-between items-center gap-4 pt-1 border-t">
          <span className="text-muted-foreground">Écart:</span>
          <span className={cn(
            'font-medium',
            gap > 0 ? 'text-red-600' : gap < 0 ? 'text-green-600' : 'text-muted-foreground'
          )}>
            {gap > 0 ? `+${gap}` : gap}
          </span>
        </div>
      </div>
    </div>
  );
}

// Custom legend
function CustomLegend() {
  return (
    <div className="flex items-center justify-center gap-6 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-blue-500" />
        <span className="text-muted-foreground">Niveau actuel</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-emerald-500" />
        <span className="text-muted-foreground">Niveau cible</span>
      </div>
    </div>
  );
}

export function SpiderChart({
  title,
  description,
  data,
  maxScale = 5,
  showGaps = true,
  showLegend = true,
  showSummary = true,
  colors = {},
  height = 400,
  className,
}: SpiderChartProps) {
  // Calculate summary statistics
  const summary = useMemo(() => {
    if (!data.length) return null;

    const totalCurrent = data.reduce((sum, d) => sum + d.currentLevel, 0);
    const totalTarget = data.reduce((sum, d) => sum + d.targetLevel, 0);
    const avgCurrent = totalCurrent / data.length;
    const avgTarget = totalTarget / data.length;
    const avgGap = avgTarget - avgCurrent;

    const gapsBelow = data.filter(d => d.currentLevel < d.targetLevel).length;
    const gapsAbove = data.filter(d => d.currentLevel > d.targetLevel).length;
    const gapsAtTarget = data.filter(d => d.currentLevel === d.targetLevel).length;

    const coveragePercent = Math.round((totalCurrent / totalTarget) * 100);

    return {
      avgCurrent: avgCurrent.toFixed(1),
      avgTarget: avgTarget.toFixed(1),
      avgGap: avgGap.toFixed(1),
      gapsBelow,
      gapsAbove,
      gapsAtTarget,
      coveragePercent,
      total: data.length,
    };
  }, [data]);

  // Colors
  const currentColor = colors.current || 'hsl(217, 91%, 60%)'; // Blue
  const targetColor = colors.target || 'hsl(152, 76%, 48%)';  // Green
  const gridColor = colors.grid || 'hsl(var(--muted-foreground) / 0.2)';

  // Empty state
  if (!data.length) {
    return (
      <Card className={className}>
        {(title || description) && (
          <CardHeader>
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent className="flex items-center justify-center" style={{ height }}>
          <p className="text-muted-foreground">Aucune donnée à afficher</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              {title && <CardTitle>{title}</CardTitle>}
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            {showSummary && summary && (
              <Badge variant="outline" className="ml-2">
                {summary.coveragePercent}% couvert
              </Badge>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent>
        {/* Summary stats */}
        {showSummary && summary && (
          <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-red-600">
                <TrendingDown className="h-4 w-4" />
                <span className="text-2xl font-bold">{summary.gapsBelow}</span>
              </div>
              <p className="text-xs text-muted-foreground">Sous la cible</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <Minus className="h-4 w-4" />
                <span className="text-2xl font-bold">{summary.gapsAtTarget}</span>
              </div>
              <p className="text-xs text-muted-foreground">À la cible</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-2xl font-bold">{summary.gapsAbove}</span>
              </div>
              <p className="text-xs text-muted-foreground">Au-dessus</p>
            </div>
          </div>
        )}

        {/* Radar chart */}
        <ResponsiveContainer width="100%" height={height}>
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke={gridColor} />
            <PolarAngleAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
              tickLine={false}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, maxScale]}
              tickCount={maxScale + 1}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
            />

            {/* Target level (background) */}
            <Radar
              name="Niveau cible"
              dataKey="targetLevel"
              stroke={targetColor}
              fill={targetColor}
              fillOpacity={0.2}
              strokeWidth={2}
              strokeDasharray="5 5"
            />

            {/* Current level (foreground) */}
            <Radar
              name="Niveau actuel"
              dataKey="currentLevel"
              stroke={currentColor}
              fill={currentColor}
              fillOpacity={0.4}
              strokeWidth={2}
            />

            <Tooltip content={<CustomTooltip />} />

            {showLegend && <Legend content={<CustomLegend />} />}
          </RadarChart>
        </ResponsiveContainer>

        {/* Gap legend */}
        {showGaps && summary && Number(summary.avgGap) !== 0 && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-sm text-muted-foreground">
              Écart moyen: {' '}
              <span className={cn(
                'font-medium',
                Number(summary.avgGap) > 0 ? 'text-red-600' : 'text-green-600'
              )}>
                {Number(summary.avgGap) > 0 ? '+' : ''}{summary.avgGap} niveau{Math.abs(Number(summary.avgGap)) > 1 ? 'x' : ''}
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Simplified spider chart (just the chart, no card wrapper)
 */
export function SpiderChartSimple({
  data,
  maxScale = 5,
  colors = {},
  height = 300,
  className,
}: Omit<SpiderChartProps, 'title' | 'description' | 'showGaps' | 'showLegend' | 'showSummary'>) {
  const currentColor = colors.current || 'hsl(217, 91%, 60%)';
  const targetColor = colors.target || 'hsl(152, 76%, 48%)';
  const gridColor = colors.grid || 'hsl(var(--muted-foreground) / 0.2)';

  if (!data.length) {
    return (
      <div
        className={cn('flex items-center justify-center', className)}
        style={{ height }}
      >
        <p className="text-muted-foreground text-sm">Aucune donnée</p>
      </div>
    );
  }

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke={gridColor} />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, maxScale]}
            tickCount={maxScale + 1}
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
          />

          <Radar
            name="Cible"
            dataKey="targetLevel"
            stroke={targetColor}
            fill={targetColor}
            fillOpacity={0.2}
            strokeWidth={2}
            strokeDasharray="5 5"
          />

          <Radar
            name="Actuel"
            dataKey="currentLevel"
            stroke={currentColor}
            fill={currentColor}
            fillOpacity={0.4}
            strokeWidth={2}
          />

          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SpiderChart;
