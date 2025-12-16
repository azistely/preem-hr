/**
 * Training Evaluation Types
 *
 * Kirkpatrick 4-Level Evaluation Model:
 * Level 1: Reaction - Participant satisfaction
 * Level 2: Learning - Knowledge/skills acquired
 * Level 3: Behavior - Application on the job
 * Level 4: Results - Business impact
 */

// ============================================================================
// KIRKPATRICK LEVELS
// ============================================================================

export type KirkpatrickLevel = 1 | 2 | 3 | 4;

export const KIRKPATRICK_LEVELS: Record<KirkpatrickLevel, {
  name: string;
  description: string;
  timing: string;
  evaluator: string;
}> = {
  1: {
    name: 'Réaction',
    description: 'Satisfaction et engagement des participants',
    timing: 'Immédiatement après la formation',
    evaluator: 'Participant',
  },
  2: {
    name: 'Apprentissage',
    description: 'Connaissances et compétences acquises',
    timing: 'À la fin de la formation',
    evaluator: 'Formateur / Auto-évaluation',
  },
  3: {
    name: 'Comportement',
    description: 'Application des acquis au travail',
    timing: '30-90 jours après la formation',
    evaluator: 'Manager / Participant',
  },
  4: {
    name: 'Résultats',
    description: 'Impact sur les objectifs de l\'entreprise',
    timing: '3-6 mois après la formation',
    evaluator: 'RH / Direction',
  },
};

// ============================================================================
// QUESTION TYPES
// ============================================================================

export type QuestionType = 'rating' | 'text' | 'multiple_choice' | 'yes_no' | 'scale';

export interface EvaluationQuestion {
  id: string;
  type: QuestionType;
  question: string;
  required: boolean;
  options?: string[]; // For multiple choice
  minLabel?: string;  // For scale/rating (e.g., "Pas du tout d'accord")
  maxLabel?: string;  // For scale/rating (e.g., "Tout à fait d'accord")
  maxValue?: number;  // For rating (default 5)
}

// ============================================================================
// LEVEL 1: REACTION QUESTIONS
// ============================================================================

export const LEVEL_1_QUESTIONS: EvaluationQuestion[] = [
  {
    id: 'overall_satisfaction',
    type: 'rating',
    question: 'Dans l\'ensemble, êtes-vous satisfait(e) de cette formation ?',
    required: true,
    maxValue: 5,
    minLabel: 'Pas du tout satisfait',
    maxLabel: 'Très satisfait',
  },
  {
    id: 'content_relevance',
    type: 'rating',
    question: 'Le contenu était pertinent pour votre travail ?',
    required: true,
    maxValue: 5,
    minLabel: 'Pas du tout pertinent',
    maxLabel: 'Très pertinent',
  },
  {
    id: 'instructor_quality',
    type: 'rating',
    question: 'Comment évaluez-vous la qualité du formateur ?',
    required: true,
    maxValue: 5,
    minLabel: 'Insuffisant',
    maxLabel: 'Excellent',
  },
  {
    id: 'materials_quality',
    type: 'rating',
    question: 'La qualité des supports de formation ?',
    required: true,
    maxValue: 5,
    minLabel: 'Insuffisant',
    maxLabel: 'Excellent',
  },
  {
    id: 'organization',
    type: 'rating',
    question: 'L\'organisation logistique (lieu, horaires, etc.) ?',
    required: true,
    maxValue: 5,
    minLabel: 'Mal organisé',
    maxLabel: 'Très bien organisé',
  },
  {
    id: 'would_recommend',
    type: 'yes_no',
    question: 'Recommanderiez-vous cette formation à un collègue ?',
    required: true,
  },
  {
    id: 'strengths',
    type: 'text',
    question: 'Quels sont les points forts de cette formation ?',
    required: false,
  },
  {
    id: 'improvements',
    type: 'text',
    question: 'Quelles améliorations suggéreriez-vous ?',
    required: false,
  },
];

// ============================================================================
// LEVEL 2: LEARNING QUESTIONS
// ============================================================================

export const LEVEL_2_QUESTIONS: EvaluationQuestion[] = [
  {
    id: 'knowledge_gain',
    type: 'rating',
    question: 'Avez-vous acquis de nouvelles connaissances ?',
    required: true,
    maxValue: 5,
    minLabel: 'Rien appris',
    maxLabel: 'Beaucoup appris',
  },
  {
    id: 'skill_confidence',
    type: 'rating',
    question: 'Vous sentez-vous capable d\'appliquer ce que vous avez appris ?',
    required: true,
    maxValue: 5,
    minLabel: 'Pas du tout',
    maxLabel: 'Tout à fait',
  },
  {
    id: 'objectives_met',
    type: 'rating',
    question: 'Les objectifs pédagogiques ont-ils été atteints ?',
    required: true,
    maxValue: 5,
    minLabel: 'Pas du tout',
    maxLabel: 'Complètement',
  },
  {
    id: 'key_learnings',
    type: 'text',
    question: 'Quels sont les 3 principaux apprentissages de cette formation ?',
    required: true,
  },
  {
    id: 'quiz_score',
    type: 'scale',
    question: 'Score au quiz final (si applicable)',
    required: false,
    minLabel: '0%',
    maxLabel: '100%',
    maxValue: 100,
  },
];

// ============================================================================
// LEVEL 3: BEHAVIOR QUESTIONS
// ============================================================================

export const LEVEL_3_QUESTIONS: EvaluationQuestion[] = [
  {
    id: 'skills_applied',
    type: 'rating',
    question: 'Avez-vous pu appliquer les compétences acquises dans votre travail ?',
    required: true,
    maxValue: 5,
    minLabel: 'Pas du tout',
    maxLabel: 'Régulièrement',
  },
  {
    id: 'behavior_change',
    type: 'rating',
    question: 'Cette formation a-t-elle modifié vos pratiques professionnelles ?',
    required: true,
    maxValue: 5,
    minLabel: 'Aucun changement',
    maxLabel: 'Changement significatif',
  },
  {
    id: 'barriers',
    type: 'multiple_choice',
    question: 'Quels obstacles avez-vous rencontrés pour appliquer vos acquis ?',
    required: false,
    options: [
      'Manque de temps',
      'Manque de ressources',
      'Manque de soutien du manager',
      'Contenu non applicable',
      'Oubli des acquis',
      'Aucun obstacle',
    ],
  },
  {
    id: 'manager_support',
    type: 'rating',
    question: 'Votre manager vous a-t-il soutenu dans l\'application des acquis ?',
    required: true,
    maxValue: 5,
    minLabel: 'Pas du tout',
    maxLabel: 'Beaucoup',
  },
  {
    id: 'concrete_examples',
    type: 'text',
    question: 'Donnez un exemple concret d\'application de vos acquis',
    required: false,
  },
];

// ============================================================================
// LEVEL 4: RESULTS QUESTIONS
// ============================================================================

export const LEVEL_4_QUESTIONS: EvaluationQuestion[] = [
  {
    id: 'productivity_impact',
    type: 'rating',
    question: 'Impact sur la productivité',
    required: true,
    maxValue: 5,
    minLabel: 'Aucun impact',
    maxLabel: 'Fort impact positif',
  },
  {
    id: 'quality_impact',
    type: 'rating',
    question: 'Impact sur la qualité du travail',
    required: true,
    maxValue: 5,
    minLabel: 'Aucun impact',
    maxLabel: 'Fort impact positif',
  },
  {
    id: 'error_reduction',
    type: 'rating',
    question: 'Réduction des erreurs ou incidents',
    required: true,
    maxValue: 5,
    minLabel: 'Aucune réduction',
    maxLabel: 'Forte réduction',
  },
  {
    id: 'kpi_improvement',
    type: 'text',
    question: 'Indicateurs clés améliorés suite à la formation',
    required: false,
  },
  {
    id: 'roi_estimate',
    type: 'multiple_choice',
    question: 'Estimation du retour sur investissement',
    required: false,
    options: [
      'ROI négatif (coût > bénéfice)',
      'ROI neutre (coût = bénéfice)',
      'ROI positif faible (1-50%)',
      'ROI positif moyen (51-100%)',
      'ROI positif élevé (>100%)',
      'Impossible à estimer',
    ],
  },
  {
    id: 'business_outcomes',
    type: 'text',
    question: 'Résultats business observables attribuables à cette formation',
    required: false,
  },
];

// ============================================================================
// GET QUESTIONS BY LEVEL
// ============================================================================

export function getQuestionsForLevel(level: KirkpatrickLevel): EvaluationQuestion[] {
  switch (level) {
    case 1:
      return LEVEL_1_QUESTIONS;
    case 2:
      return LEVEL_2_QUESTIONS;
    case 3:
      return LEVEL_3_QUESTIONS;
    case 4:
      return LEVEL_4_QUESTIONS;
    default:
      return [];
  }
}

// ============================================================================
// EVALUATION RESPONSE TYPES
// ============================================================================

export interface EvaluationResponse {
  questionId: string;
  value: string | number | boolean | string[];
}

export interface EvaluationSubmission {
  enrollmentId: string;
  level: KirkpatrickLevel;
  responses: EvaluationResponse[];
}

// ============================================================================
// EVALUATION SUMMARY TYPES
// ============================================================================

export interface LevelScore {
  level: KirkpatrickLevel;
  averageScore: number;
  responseCount: number;
  completionRate: number;
}

export interface CourseEffectiveness {
  courseId: string;
  courseName: string;
  totalParticipants: number;
  levelScores: LevelScore[];
  overallScore: number;
  recommendationRate: number; // % who would recommend
}

export interface TrainingEffectivenessDashboard {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalSessions: number;
    totalParticipants: number;
    averageSatisfaction: number; // Level 1 avg
    averageLearning: number;     // Level 2 avg
    averageApplication: number;  // Level 3 avg
    averageImpact: number;       // Level 4 avg
    overallEffectiveness: number;
  };
  byCategory: Array<{
    category: string;
    categoryLabel: string;
    sessionCount: number;
    participantCount: number;
    averageScore: number;
  }>;
  topCourses: CourseEffectiveness[];
  pendingEvaluations: {
    level1: number;
    level2: number;
    level3: number;
    level4: number;
  };
}

// ============================================================================
// SKILL ACQUISITION TYPES
// ============================================================================

export interface SkillAcquisition {
  enrollmentId: string;
  employeeId: string;
  courseId: string;
  competencyId: string;
  competencyName: string;
  previousLevel: number | null;
  newLevel: number;
  validatedAt: string | null;
  validatedBy: string | null;
}
