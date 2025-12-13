/**
 * Competency Rating Scales
 *
 * Pre-built scale templates for competency evaluation.
 * Supports two-tier configuration:
 * - Tenant default: HR sets organization-wide default in Settings
 * - Per-competency override: Individual competencies can use different scales
 *
 * @see lib/db/schema/tenant-settings.schema.ts for CompetencyScaleType enum
 */

import type { CompetencyScaleType } from "@/lib/db/schema/tenant-settings.schema";

/**
 * Proficiency level definition
 */
export interface ProficiencyLevel {
  level: number;
  name: string;
  description: string;
  behaviors?: string[];
}

/**
 * Scale template with metadata
 */
export interface ScaleTemplate {
  type: CompetencyScaleType;
  name: string;
  description: string;
  levels: ProficiencyLevel[];
  /** Special handling flag for percentage type (uses slider instead of discrete levels) */
  isPercentage?: boolean;
}

/**
 * Pre-built scale templates
 * These can be selected at tenant level or per-competency level
 */
export const SCALE_TEMPLATES: Record<Exclude<CompetencyScaleType, "custom">, ScaleTemplate> = {
  french_descriptive: {
    type: "french_descriptive",
    name: "Niveaux FR (Recommandé)",
    description: "Échelle descriptive française de 1 à 5",
    levels: [
      {
        level: 1,
        name: "Non acquis",
        description: "La compétence n'est pas encore développée",
        behaviors: ["Ne connaît pas les concepts de base", "Nécessite une formation complète"]
      },
      {
        level: 2,
        name: "En cours d'acquisition",
        description: "Débute dans l'apprentissage de la compétence",
        behaviors: ["Connaît les concepts théoriques", "Applique avec supervision", "Fait des erreurs régulières"]
      },
      {
        level: 3,
        name: "Acquis",
        description: "Maîtrise la compétence de façon autonome",
        behaviors: ["Travaille de façon autonome", "Gère les situations courantes", "Peut aider les débutants"]
      },
      {
        level: 4,
        name: "Maîtrisé",
        description: "Excelle et peut former les autres",
        behaviors: ["Gère les situations complexes", "Forme et accompagne les collègues", "Propose des améliorations"]
      },
      {
        level: 5,
        name: "Expert",
        description: "Référence dans l'organisation pour cette compétence",
        behaviors: ["Reconnu comme expert", "Définit les standards", "Innove et anticipe les évolutions"]
      },
    ],
  },

  numeric_1_5: {
    type: "numeric_1_5",
    name: "Échelle 1-5",
    description: "Échelle numérique simple de 1 (insuffisant) à 5 (excellent)",
    levels: [
      { level: 1, name: "1 - Insuffisant", description: "Niveau très faible, nécessite une formation urgente" },
      { level: 2, name: "2 - À améliorer", description: "Niveau insuffisant, nécessite du développement" },
      { level: 3, name: "3 - Satisfaisant", description: "Niveau acceptable, répond aux attentes de base" },
      { level: 4, name: "4 - Bon", description: "Bon niveau, au-dessus des attentes" },
      { level: 5, name: "5 - Excellent", description: "Niveau excellent, dépasse les attentes" },
    ],
  },

  numeric_1_4: {
    type: "numeric_1_4",
    name: "Échelle 1-4 (sans neutre)",
    description: "Échelle sans option neutre, force un avis positif ou négatif",
    levels: [
      { level: 1, name: "1 - Inadéquat", description: "Ne répond pas aux attentes" },
      { level: 2, name: "2 - Acceptable", description: "Répond partiellement aux attentes" },
      { level: 3, name: "3 - Bon", description: "Répond aux attentes" },
      { level: 4, name: "4 - Excellent", description: "Dépasse les attentes" },
    ],
  },

  numeric_1_3: {
    type: "numeric_1_3",
    name: "Échelle 1-3 simple",
    description: "Échelle simplifiée à 3 niveaux",
    levels: [
      { level: 1, name: "Insuffisant", description: "En dessous des attentes, nécessite un développement" },
      { level: 2, name: "Satisfaisant", description: "Conforme aux attentes" },
      { level: 3, name: "Excellent", description: "Au-delà des attentes" },
    ],
  },

  numeric_1_10: {
    type: "numeric_1_10",
    name: "Échelle 1-10 détaillée",
    description: "Échelle détaillée permettant une évaluation fine",
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      name: `${i + 1}/10`,
      description: getLevelDescription10(i + 1),
    })),
  },

  letter_grade: {
    type: "letter_grade",
    name: "Notes A-F",
    description: "Système de notation par lettres (style universitaire)",
    levels: [
      { level: 1, name: "F", description: "Échec - Compétence non démontrée" },
      { level: 2, name: "D", description: "Insuffisant - En dessous des attentes minimales" },
      { level: 3, name: "C", description: "Passable - Répond aux exigences de base" },
      { level: 4, name: "B", description: "Bien - Au-dessus des attentes" },
      { level: 5, name: "A", description: "Excellent - Performance exceptionnelle" },
    ],
  },

  percentage: {
    type: "percentage",
    name: "Pourcentage (0-100%)",
    description: "Évaluation en pourcentage avec curseur",
    isPercentage: true,
    levels: [
      { level: 0, name: "0%", description: "Compétence non démontrée" },
      { level: 25, name: "25%", description: "Niveau débutant" },
      { level: 50, name: "50%", description: "Niveau intermédiaire" },
      { level: 75, name: "75%", description: "Niveau avancé" },
      { level: 100, name: "100%", description: "Maîtrise complète" },
    ],
  },
};

/**
 * Helper to generate description for 1-10 scale
 */
function getLevelDescription10(level: number): string {
  if (level <= 2) return "Très insuffisant";
  if (level <= 4) return "Insuffisant";
  if (level <= 5) return "Passable";
  if (level <= 6) return "Satisfaisant";
  if (level <= 7) return "Bon";
  if (level <= 8) return "Très bon";
  if (level <= 9) return "Excellent";
  return "Exceptionnel";
}

/**
 * Scale labels for UI dropdowns
 */
export const SCALE_TYPE_LABELS: Record<CompetencyScaleType, string> = {
  french_descriptive: "Niveaux FR (Non acquis → Expert)",
  numeric_1_5: "Échelle 1-5",
  numeric_1_4: "Échelle 1-4 (sans neutre)",
  numeric_1_3: "Échelle 1-3 simple",
  numeric_1_10: "Échelle 1-10 détaillée",
  letter_grade: "Notes A-F",
  percentage: "Pourcentage (0-100%)",
  custom: "Personnalisé",
};

/**
 * Default scale type when tenant hasn't configured one
 */
export const DEFAULT_SCALE_TYPE: Exclude<CompetencyScaleType, "custom"> = "french_descriptive";

/**
 * Check if scale type uses percentage slider instead of discrete levels
 */
export function isPercentageScale(scaleType: CompetencyScaleType): boolean {
  return scaleType === "percentage";
}

/**
 * Get proficiency levels for a scale type
 * For custom scales, returns empty array (must use competency.proficiencyLevels)
 */
export function getScaleLevels(scaleType: CompetencyScaleType): ProficiencyLevel[] {
  if (scaleType === "custom") {
    return [];
  }
  return SCALE_TEMPLATES[scaleType].levels;
}

/**
 * Get the resolved proficiency levels for a competency
 * Resolves in order: competency.proficiencyLevels → competency.scaleType → tenant default → system default
 *
 * @param competency - The competency with optional proficiencyLevels and scaleType
 * @param tenantDefaultScale - The tenant's default scale from settings
 * @returns The proficiency levels to use for this competency
 */
export function getCompetencyScale(
  competency: {
    scaleType?: string | null;
    proficiencyLevels?: ProficiencyLevel[] | null;
  },
  tenantDefaultScale?: CompetencyScaleType | null
): ProficiencyLevel[] {
  // 1. If competency has custom proficiency levels, use them
  if (competency.proficiencyLevels && competency.proficiencyLevels.length > 0) {
    return competency.proficiencyLevels;
  }

  // 2. If competency has a specific scale type, use that template
  if (competency.scaleType && competency.scaleType !== "custom") {
    const template = SCALE_TEMPLATES[competency.scaleType as Exclude<CompetencyScaleType, "custom">];
    if (template) {
      return template.levels;
    }
  }

  // 3. Use tenant default if set
  if (tenantDefaultScale && tenantDefaultScale !== "custom") {
    const template = SCALE_TEMPLATES[tenantDefaultScale as Exclude<CompetencyScaleType, "custom">];
    if (template) {
      return template.levels;
    }
  }

  // 4. Fall back to system default (French descriptive)
  return SCALE_TEMPLATES[DEFAULT_SCALE_TYPE].levels;
}

/**
 * Get the scale type for a competency (for UI display)
 * Returns the effective scale type after resolution
 */
export function getEffectiveScaleType(
  competency: {
    scaleType?: string | null;
    proficiencyLevels?: ProficiencyLevel[] | null;
  },
  tenantDefaultScale?: CompetencyScaleType | null
): CompetencyScaleType {
  // 1. If competency has custom levels, it's custom
  if (competency.proficiencyLevels && competency.proficiencyLevels.length > 0) {
    return "custom";
  }

  // 2. If competency has a specific scale type
  if (competency.scaleType && competency.scaleType in SCALE_TEMPLATES) {
    return competency.scaleType as CompetencyScaleType;
  }

  // 3. Tenant default
  if (tenantDefaultScale && tenantDefaultScale in SCALE_TEMPLATES) {
    return tenantDefaultScale;
  }

  // 4. System default
  return DEFAULT_SCALE_TYPE;
}

/**
 * Normalize a rating to 0-100 scale for consistent scoring
 * Used when calculating competenciesScore on evaluations
 *
 * @param rating - The raw rating value
 * @param maxLevel - The maximum level in the scale (e.g., 5 for 1-5 scale)
 * @returns Normalized score from 0 to 100
 */
export function normalizeScore(rating: number, maxLevel: number): number {
  if (maxLevel <= 1) return 100;
  // For 1-based scales: rating 1 → 0%, rating maxLevel → 100%
  return ((rating - 1) / (maxLevel - 1)) * 100;
}

/**
 * Get the maximum level for a scale type
 */
export function getMaxLevel(scaleType: CompetencyScaleType): number {
  if (scaleType === "percentage") return 100;
  if (scaleType === "custom") return 5; // Default assumption for custom

  const levels = SCALE_TEMPLATES[scaleType].levels;
  return Math.max(...levels.map(l => l.level));
}
