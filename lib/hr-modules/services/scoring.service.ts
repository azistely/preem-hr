/**
 * Scoring Service
 * Form scoring calculations, evaluation grading, and performance metrics
 */

import type {
  FormScoringConfig,
  ComputedScores,
  FormFieldDefinition,
  FormSectionDefinition,
  RatingScaleConfig,
} from '@/lib/db/schema/hr-forms';

import type { ScoringInput } from '../types/form-builder.types';

// Re-export ScoringInput for convenience
export type { ScoringInput };

// ============================================================================
// TYPES
// ============================================================================

/**
 * Field score result
 */
export interface FieldScoreResult {
  fieldId: string;
  fieldLabel: string;
  rawValue: unknown;
  score: number;
  maxScore: number;
  percentage: number;
  weight: number;
  weightedScore: number;
}

/**
 * Section score result
 */
export interface SectionScoreResult {
  sectionId: string;
  sectionTitle: string;
  fieldScores: FieldScoreResult[];
  totalScore: number;
  maxScore: number;
  percentage: number;
  weight: number;
  weightedScore: number;
}

/**
 * Complete scoring result
 */
export interface ScoringResult {
  byField: Record<string, FieldScoreResult>;
  bySection: Record<string, SectionScoreResult>;
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  category?: string;
  categoryColor?: string;
}

// ============================================================================
// MAIN SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate scores for a form submission
 */
export function calculateFormScores(input: ScoringInput): ScoringResult {
  const { config, fieldDefinitions: fields, sectionDefinitions: sections, data } = input;

  if (!config.enabled) {
    return {
      byField: {},
      bySection: {},
      totalScore: 0,
      maxPossibleScore: 0,
      percentage: 0,
    };
  }

  // Calculate field scores
  const fieldScores: Record<string, FieldScoreResult> = {};
  const scorableFields = fields.filter((f) => isScorableField(f));

  for (const field of scorableFields) {
    const value = data[field.id];
    const weight = config.fieldWeights?.[field.id] ?? 1;
    const { score, maxScore } = calculateFieldScore(field, value);

    fieldScores[field.id] = {
      fieldId: field.id,
      fieldLabel: field.label,
      rawValue: value,
      score,
      maxScore,
      percentage: maxScore > 0 ? (score / maxScore) * 100 : 0,
      weight,
      weightedScore: score * weight,
    };
  }

  // Calculate section scores
  const sectionScores: Record<string, SectionScoreResult> = {};

  for (const section of sections) {
    const sectionFields = scorableFields.filter((f) => f.section === section.id);
    const sectionFieldScores = sectionFields.map((f) => fieldScores[f.id]).filter(Boolean);

    if (sectionFieldScores.length === 0) continue;

    const sectionWeight = config.sectionWeights?.[section.id] ?? 1;
    const totalScore = sectionFieldScores.reduce((sum, fs) => sum + fs.weightedScore, 0);
    const maxScore = sectionFieldScores.reduce((sum, fs) => sum + fs.maxScore * fs.weight, 0);

    sectionScores[section.id] = {
      sectionId: section.id,
      sectionTitle: section.title,
      fieldScores: sectionFieldScores,
      totalScore,
      maxScore,
      percentage: maxScore > 0 ? (totalScore / maxScore) * 100 : 0,
      weight: sectionWeight,
      weightedScore: totalScore * sectionWeight,
    };
  }

  // Handle unsectioned fields
  const unsectionedFields = scorableFields.filter((f) => !f.section);
  if (unsectionedFields.length > 0) {
    const unsectionedFieldScores = unsectionedFields.map((f) => fieldScores[f.id]).filter(Boolean);
    const totalScore = unsectionedFieldScores.reduce((sum, fs) => sum + fs.weightedScore, 0);
    const maxScore = unsectionedFieldScores.reduce((sum, fs) => sum + fs.maxScore * fs.weight, 0);

    sectionScores['_unsectioned'] = {
      sectionId: '_unsectioned',
      sectionTitle: 'Autres',
      fieldScores: unsectionedFieldScores,
      totalScore,
      maxScore,
      percentage: maxScore > 0 ? (totalScore / maxScore) * 100 : 0,
      weight: 1,
      weightedScore: totalScore,
    };
  }

  // Calculate totals based on scoring method
  let totalScore: number;
  let maxPossibleScore: number;

  switch (config.method) {
    case 'sum':
      totalScore = Object.values(sectionScores).reduce((sum, s) => sum + s.weightedScore, 0);
      maxPossibleScore = Object.values(sectionScores).reduce((sum, s) => sum + s.maxScore * s.weight, 0);
      break;

    case 'average': {
      const allFieldScores = Object.values(fieldScores);
      totalScore =
        allFieldScores.length > 0
          ? allFieldScores.reduce((sum, fs) => sum + fs.score, 0) / allFieldScores.length
          : 0;
      maxPossibleScore =
        allFieldScores.length > 0
          ? allFieldScores.reduce((sum, fs) => sum + fs.maxScore, 0) / allFieldScores.length
          : 0;
      break;
    }

    case 'weighted': {
      const totalWeightedScore = Object.values(sectionScores).reduce((sum, s) => sum + s.weightedScore, 0);
      const totalWeight = Object.values(sectionScores).reduce((sum, s) => sum + s.weight, 0);
      totalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
      maxPossibleScore = Object.values(sectionScores).reduce((sum, s) => sum + s.maxScore, 0) /
        (Object.keys(sectionScores).length || 1);
      break;
    }

    case 'custom':
    default:
      totalScore = Object.values(sectionScores).reduce((sum, s) => sum + s.totalScore, 0);
      maxPossibleScore = Object.values(sectionScores).reduce((sum, s) => sum + s.maxScore, 0);
  }

  // Calculate percentage
  const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

  // Determine category based on thresholds
  let category: string | undefined;
  let categoryColor: string | undefined;

  if (config.thresholds && config.thresholds.length > 0) {
    for (const threshold of config.thresholds) {
      if (percentage >= threshold.min && percentage <= threshold.max) {
        category = threshold.label;
        categoryColor = threshold.color;
        break;
      }
    }
  }

  return {
    byField: fieldScores,
    bySection: sectionScores,
    totalScore,
    maxPossibleScore,
    percentage,
    category,
    categoryColor,
  };
}

/**
 * Convert scoring result to ComputedScores for storage
 */
export function toComputedScores(result: ScoringResult): ComputedScores {
  return {
    byField: Object.fromEntries(
      Object.entries(result.byField).map(([id, fs]) => [id, fs.score])
    ),
    bySection: Object.fromEntries(
      Object.entries(result.bySection).map(([id, ss]) => [id, ss.totalScore])
    ),
    total: result.totalScore,
    percentage: result.percentage,
    category: result.category,
  };
}

// ============================================================================
// FIELD SCORING
// ============================================================================

/**
 * Check if a field is scorable
 */
export function isScorableField(field: FormFieldDefinition): boolean {
  const scorableTypes = ['rating', 'slider', 'number', 'select', 'radio', 'checkbox'];
  return scorableTypes.includes(field.type);
}

/**
 * Calculate score for a single field
 */
export function calculateFieldScore(
  field: FormFieldDefinition,
  value: unknown
): { score: number; maxScore: number } {
  if (value === null || value === undefined) {
    return { score: 0, maxScore: getFieldMaxScore(field) };
  }

  switch (field.type) {
    case 'rating': {
      const numValue = Number(value);
      if (isNaN(numValue)) return { score: 0, maxScore: field.ratingConfig?.scale ?? 5 };
      return {
        score: numValue,
        maxScore: field.ratingConfig?.scale ?? 5,
      };
    }

    case 'slider': {
      const numValue = Number(value);
      if (isNaN(numValue)) return { score: 0, maxScore: field.sliderConfig?.max ?? 100 };
      const min = field.sliderConfig?.min ?? 0;
      const max = field.sliderConfig?.max ?? 100;
      // Normalize to 0-max range
      return {
        score: numValue - min,
        maxScore: max - min,
      };
    }

    case 'number': {
      const numValue = Number(value);
      if (isNaN(numValue)) return { score: 0, maxScore: field.max ?? 100 };
      return {
        score: Math.max(0, Math.min(numValue, field.max ?? numValue)),
        maxScore: field.max ?? 100,
      };
    }

    case 'select':
    case 'radio': {
      // Score based on option position (first = 0, last = max)
      if (!field.options || field.options.length === 0) {
        return { score: 0, maxScore: 1 };
      }
      const optionIndex = field.options.findIndex((o) => o.value === value);
      if (optionIndex === -1) return { score: 0, maxScore: field.options.length - 1 };
      return {
        score: optionIndex,
        maxScore: field.options.length - 1,
      };
    }

    case 'checkbox': {
      return {
        score: value === true ? 1 : 0,
        maxScore: 1,
      };
    }

    default:
      return { score: 0, maxScore: 0 };
  }
}

/**
 * Get maximum possible score for a field
 */
export function getFieldMaxScore(field: FormFieldDefinition): number {
  switch (field.type) {
    case 'rating':
      return field.ratingConfig?.scale ?? 5;
    case 'slider':
      return (field.sliderConfig?.max ?? 100) - (field.sliderConfig?.min ?? 0);
    case 'number':
      return field.max ?? 100;
    case 'select':
    case 'radio':
      return (field.options?.length ?? 1) - 1;
    case 'checkbox':
      return 1;
    default:
      return 0;
  }
}

// ============================================================================
// PERFORMANCE EVALUATION SCORING
// ============================================================================

/**
 * Performance rating levels (French)
 */
export const PerformanceLevels = {
  EXCEPTIONAL: { min: 90, label: 'Exceptionnel', color: '#22c55e' },
  EXCEEDS: { min: 75, label: 'Dépasse les attentes', color: '#84cc16' },
  MEETS: { min: 60, label: 'Répond aux attentes', color: '#eab308' },
  BELOW: { min: 40, label: 'En dessous des attentes', color: '#f97316' },
  UNSATISFACTORY: { min: 0, label: 'Insuffisant', color: '#ef4444' },
} as const;

/**
 * Get performance level from percentage
 */
export function getPerformanceLevel(percentage: number): {
  level: keyof typeof PerformanceLevels;
  label: string;
  color: string;
} {
  if (percentage >= PerformanceLevels.EXCEPTIONAL.min) {
    return { level: 'EXCEPTIONAL', ...PerformanceLevels.EXCEPTIONAL };
  }
  if (percentage >= PerformanceLevels.EXCEEDS.min) {
    return { level: 'EXCEEDS', ...PerformanceLevels.EXCEEDS };
  }
  if (percentage >= PerformanceLevels.MEETS.min) {
    return { level: 'MEETS', ...PerformanceLevels.MEETS };
  }
  if (percentage >= PerformanceLevels.BELOW.min) {
    return { level: 'BELOW', ...PerformanceLevels.BELOW };
  }
  return { level: 'UNSATISFACTORY', ...PerformanceLevels.UNSATISFACTORY };
}

/**
 * Calculate weighted average of multiple evaluations
 */
export function calculateWeightedEvaluationAverage(
  evaluations: Array<{
    score: number;
    maxScore: number;
    weight: number;
    evaluatorRole: string;
  }>
): { score: number; maxScore: number; percentage: number } {
  if (evaluations.length === 0) {
    return { score: 0, maxScore: 0, percentage: 0 };
  }

  let totalWeightedScore = 0;
  let totalWeightedMaxScore = 0;
  let totalWeight = 0;

  for (const eval_ of evaluations) {
    totalWeightedScore += eval_.score * eval_.weight;
    totalWeightedMaxScore += eval_.maxScore * eval_.weight;
    totalWeight += eval_.weight;
  }

  const score = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  const maxScore = totalWeight > 0 ? totalWeightedMaxScore / totalWeight : 0;
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

  return { score, maxScore, percentage };
}

/**
 * Standard evaluation weights by role
 */
export const StandardEvaluationWeights = {
  self: 0.2,        // 20%
  manager: 0.5,     // 50%
  peer: 0.15,       // 15% (each peer)
  skip_level: 0.15, // 15%
} as const;

/**
 * Calculate 360 degree feedback average
 */
export function calculate360Average(
  evaluations: Array<{
    evaluatorRole: 'self' | 'manager' | 'peer' | 'skip_level';
    score: number;
    maxScore: number;
  }>
): { score: number; maxScore: number; percentage: number; breakdown: Record<string, number> } {
  const byRole: Record<string, { scores: number[]; maxScores: number[] }> = {
    self: { scores: [], maxScores: [] },
    manager: { scores: [], maxScores: [] },
    peer: { scores: [], maxScores: [] },
    skip_level: { scores: [], maxScores: [] },
  };

  // Group by role
  for (const eval_ of evaluations) {
    byRole[eval_.evaluatorRole].scores.push(eval_.score);
    byRole[eval_.evaluatorRole].maxScores.push(eval_.maxScore);
  }

  // Calculate averages per role
  const roleAverages: Record<string, { avgScore: number; avgMaxScore: number }> = {};
  for (const [role, data] of Object.entries(byRole)) {
    if (data.scores.length > 0) {
      roleAverages[role] = {
        avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        avgMaxScore: data.maxScores.reduce((a, b) => a + b, 0) / data.maxScores.length,
      };
    }
  }

  // Calculate weighted average
  let totalWeightedScore = 0;
  let totalWeightedMaxScore = 0;
  let totalWeight = 0;

  for (const [role, avg] of Object.entries(roleAverages)) {
    const weight = StandardEvaluationWeights[role as keyof typeof StandardEvaluationWeights] ?? 0.1;
    totalWeightedScore += avg.avgScore * weight;
    totalWeightedMaxScore += avg.avgMaxScore * weight;
    totalWeight += weight;
  }

  const score = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  const maxScore = totalWeight > 0 ? totalWeightedMaxScore / totalWeight : 0;
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

  // Breakdown percentages by role
  const breakdown: Record<string, number> = {};
  for (const [role, avg] of Object.entries(roleAverages)) {
    breakdown[role] = avg.avgMaxScore > 0 ? (avg.avgScore / avg.avgMaxScore) * 100 : 0;
  }

  return { score, maxScore, percentage, breakdown };
}

// ============================================================================
// COMPETENCY SCORING
// ============================================================================

/**
 * Proficiency levels
 */
export const ProficiencyLevels = {
  1: { label: 'Débutant', description: 'Connaissance de base, besoin de supervision' },
  2: { label: 'Intermédiaire', description: 'Peut exécuter avec guidance occasionnelle' },
  3: { label: 'Compétent', description: 'Travail autonome, qualité constante' },
  4: { label: 'Avancé', description: 'Expertise, peut former les autres' },
  5: { label: 'Expert', description: 'Référent, innovation, leadership' },
} as const;

/**
 * Calculate competency gap
 */
export function calculateCompetencyGap(
  currentLevel: number,
  targetLevel: number
): {
  gap: number;
  status: 'exceeds' | 'meets' | 'below' | 'critical';
  label: string;
  color: string;
} {
  const gap = targetLevel - currentLevel;

  if (gap <= -1) {
    return { gap, status: 'exceeds', label: 'Dépasse le niveau requis', color: '#22c55e' };
  }
  if (gap <= 0) {
    return { gap, status: 'meets', label: 'Niveau atteint', color: '#84cc16' };
  }
  if (gap <= 1) {
    return { gap, status: 'below', label: 'À développer', color: '#f97316' };
  }
  return { gap, status: 'critical', label: 'Écart critique', color: '#ef4444' };
}

/**
 * Calculate overall competency profile score
 */
export function calculateCompetencyProfileScore(
  assessments: Array<{
    competencyId: string;
    currentLevel: number;
    targetLevel: number;
    weight?: number;
  }>
): {
  averageLevel: number;
  averageTarget: number;
  overallGap: number;
  percentage: number;
  gapsByCompetency: Record<string, number>;
} {
  if (assessments.length === 0) {
    return {
      averageLevel: 0,
      averageTarget: 0,
      overallGap: 0,
      percentage: 0,
      gapsByCompetency: {},
    };
  }

  let totalWeightedLevel = 0;
  let totalWeightedTarget = 0;
  let totalWeight = 0;
  const gapsByCompetency: Record<string, number> = {};

  for (const assessment of assessments) {
    const weight = assessment.weight ?? 1;
    totalWeightedLevel += assessment.currentLevel * weight;
    totalWeightedTarget += assessment.targetLevel * weight;
    totalWeight += weight;
    gapsByCompetency[assessment.competencyId] = assessment.targetLevel - assessment.currentLevel;
  }

  const averageLevel = totalWeight > 0 ? totalWeightedLevel / totalWeight : 0;
  const averageTarget = totalWeight > 0 ? totalWeightedTarget / totalWeight : 0;
  const overallGap = averageTarget - averageLevel;
  const percentage = averageTarget > 0 ? (averageLevel / averageTarget) * 100 : 0;

  return {
    averageLevel,
    averageTarget,
    overallGap,
    percentage,
    gapsByCompetency,
  };
}

// ============================================================================
// TRAINING SCORING (Kirkpatrick Model)
// ============================================================================

/**
 * Kirkpatrick evaluation levels
 */
export const KirkpatrickLevels = {
  REACTION: { level: 1, label: 'Réaction', description: 'Satisfaction des participants' },
  LEARNING: { level: 2, label: 'Apprentissage', description: 'Acquisition des connaissances' },
  BEHAVIOR: { level: 3, label: 'Comportement', description: 'Application sur le terrain' },
  RESULTS: { level: 4, label: 'Résultats', description: 'Impact sur la performance' },
} as const;

/**
 * Calculate training effectiveness score
 */
export function calculateTrainingEffectiveness(
  evaluations: Array<{
    level: 1 | 2 | 3 | 4;
    score: number;
    maxScore: number;
  }>
): {
  byLevel: Record<number, number>;
  overall: number;
  recommendation: string;
} {
  const byLevel: Record<number, { total: number; count: number }> = {
    1: { total: 0, count: 0 },
    2: { total: 0, count: 0 },
    3: { total: 0, count: 0 },
    4: { total: 0, count: 0 },
  };

  for (const eval_ of evaluations) {
    const percentage = eval_.maxScore > 0 ? (eval_.score / eval_.maxScore) * 100 : 0;
    byLevel[eval_.level].total += percentage;
    byLevel[eval_.level].count++;
  }

  const levelPercentages: Record<number, number> = {};
  for (const [level, data] of Object.entries(byLevel)) {
    levelPercentages[Number(level)] = data.count > 0 ? data.total / data.count : 0;
  }

  // Overall weighted (higher levels weighted more)
  const weights = { 1: 0.15, 2: 0.25, 3: 0.30, 4: 0.30 };
  let overall = 0;
  for (const [level, percentage] of Object.entries(levelPercentages)) {
    overall += percentage * (weights[Number(level) as keyof typeof weights] ?? 0);
  }

  // Generate recommendation
  let recommendation: string;
  if (overall >= 80) {
    recommendation = 'Formation très efficace, à recommander';
  } else if (overall >= 60) {
    recommendation = 'Formation satisfaisante, quelques améliorations possibles';
  } else if (overall >= 40) {
    recommendation = 'Formation à améliorer, revoir le contenu ou la méthode';
  } else {
    recommendation = 'Formation peu efficace, refonte nécessaire';
  }

  return {
    byLevel: levelPercentages,
    overall,
    recommendation,
  };
}
