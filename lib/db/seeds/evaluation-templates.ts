/**
 * Default Evaluation Templates Seed
 *
 * Universal starter templates that work for any company, any industry.
 * These templates are marked as `isSystem: true` and visible to all tenants.
 */

import type {
  FormDefinition,
  FormFieldDefinition,
  FormSectionDefinition,
  FormScoringConfig,
  RatingScaleConfig,
} from '@/lib/db/schema/hr-forms';

// ============================================================================
// SHARED CONFIGURATIONS
// ============================================================================

/**
 * Standard French 5-point rating scale
 */
const RATING_SCALE_5: RatingScaleConfig = {
  type: 'numeric',
  scale: 5,
  labels: {
    1: 'Insuffisant',
    2: 'À améliorer',
    3: 'Satisfaisant',
    4: 'Très bien',
    5: 'Excellent',
  },
  lowLabel: 'Insuffisant',
  highLabel: 'Excellent',
};

/**
 * Standard scoring thresholds (based on 1-5 scale)
 */
const STANDARD_THRESHOLDS = [
  { label: 'Excellent', min: 4.5, max: 5, color: '#22c55e' },
  { label: 'Très bien', min: 3.5, max: 4.49, color: '#3b82f6' },
  { label: 'Satisfaisant', min: 2.5, max: 3.49, color: '#f59e0b' },
  { label: 'À améliorer', min: 1, max: 2.49, color: '#ef4444' },
];

/**
 * Emoji rating scale for quick check-ins
 */
const EMOJI_RATING_SCALE: RatingScaleConfig = {
  type: 'emoji',
  scale: 5,
  labels: {
    1: '😞 Très difficile',
    2: '😕 Difficile',
    3: '😐 Normal',
    4: '😊 Bien',
    5: '🤩 Excellent',
  },
};

// ============================================================================
// TEMPLATE 1: AUTO-ÉVALUATION SIMPLE
// ============================================================================

const selfEvaluationFields: FormFieldDefinition[] = [
  // Section 1: Performance Générale
  {
    id: 'perf_globale',
    type: 'rating',
    label: 'Comment évaluez-vous votre performance globale ?',
    helpText: 'Considérez l\'ensemble de votre travail sur la période',
    required: true,
    section: 'performance',
    order: 1,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'realisations',
    type: 'textarea',
    label: 'Quelles sont vos principales réalisations ?',
    helpText: 'Listez 2-3 accomplissements dont vous êtes fier(e)',
    placeholder: 'Ex: J\'ai terminé le projet X en avance, j\'ai formé 3 nouveaux collègues...',
    required: true,
    section: 'performance',
    order: 2,
  },
  {
    id: 'defis',
    type: 'textarea',
    label: 'Quels défis avez-vous rencontrés ?',
    helpText: 'Décrivez les difficultés et comment vous les avez gérées',
    placeholder: 'Ex: Difficultés techniques sur le projet Y, manque de ressources...',
    required: false,
    section: 'performance',
    order: 3,
  },

  // Section 2: Compétences
  {
    id: 'comp_communication',
    type: 'rating',
    label: 'Communication',
    helpText: 'Clarté, écoute, partage d\'information',
    required: true,
    section: 'competences',
    order: 1,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'comp_equipe',
    type: 'rating',
    label: 'Travail d\'équipe',
    helpText: 'Collaboration, entraide, esprit d\'équipe',
    required: true,
    section: 'competences',
    order: 2,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'comp_initiative',
    type: 'rating',
    label: 'Initiative',
    helpText: 'Proactivité, propositions d\'amélioration',
    required: true,
    section: 'competences',
    order: 3,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'comp_qualite',
    type: 'rating',
    label: 'Qualité du travail',
    helpText: 'Précision, attention aux détails, rigueur',
    required: true,
    section: 'competences',
    order: 4,
    ratingConfig: RATING_SCALE_5,
  },

  // Section 3: Développement
  {
    id: 'objectifs_futurs',
    type: 'textarea',
    label: 'Quels objectifs souhaitez-vous atteindre ?',
    helpText: 'Décrivez vos ambitions pour la prochaine période',
    placeholder: 'Ex: Maîtriser une nouvelle technologie, prendre plus de responsabilités...',
    required: true,
    section: 'developpement',
    order: 1,
  },
  {
    id: 'besoins_formation',
    type: 'textarea',
    label: 'De quelle formation avez-vous besoin ?',
    helpText: 'Formations, accompagnement, ressources souhaitées',
    placeholder: 'Ex: Formation en gestion de projet, coaching en leadership...',
    required: false,
    section: 'developpement',
    order: 2,
  },
];

const selfEvaluationSections: FormSectionDefinition[] = [
  {
    id: 'performance',
    title: 'Performance Générale',
    description: 'Évaluez votre performance globale sur la période',
    icon: 'Target',
    order: 1,
  },
  {
    id: 'competences',
    title: 'Compétences',
    description: 'Auto-évaluation de vos compétences clés',
    icon: 'Star',
    order: 2,
  },
  {
    id: 'developpement',
    title: 'Développement',
    description: 'Vos objectifs et besoins de développement',
    icon: 'TrendingUp',
    order: 3,
  },
];

export const SELF_EVALUATION_TEMPLATE = {
  name: 'Auto-Évaluation Simple',
  slug: 'auto-evaluation-simple',
  description: 'Formulaire d\'auto-évaluation standard pour tous les employés. Couvre la performance, les compétences et le développement.',
  module: 'performance' as const,
  category: 'self_evaluation',
  definition: {
    version: '1.0',
    fields: selfEvaluationFields,
    sections: selfEvaluationSections,
    showProgress: true,
    allowDraft: true,
    autoSave: true,
    autoSaveInterval: 30,
    completionMessage: 'Merci ! Votre auto-évaluation a été soumise avec succès.',
  } satisfies FormDefinition,
  scoringEnabled: true,
  scoringConfig: {
    enabled: true,
    method: 'average' as const,
    thresholds: STANDARD_THRESHOLDS,
  } satisfies FormScoringConfig,
  defaultRatingScale: RATING_SCALE_5,
  isSystem: true,
  isActive: true,
};

// ============================================================================
// TEMPLATE 2: ÉVALUATION MANAGER
// ============================================================================

const managerEvaluationFields: FormFieldDefinition[] = [
  // Section 1: Performance de l'Employé
  {
    id: 'perf_globale',
    type: 'rating',
    label: 'Performance globale',
    helpText: 'Évaluation générale de la performance de l\'employé',
    required: true,
    section: 'performance',
    order: 1,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'objectifs_atteints',
    type: 'rating',
    label: 'Atteinte des objectifs',
    helpText: 'Dans quelle mesure les objectifs fixés ont été atteints',
    required: true,
    section: 'performance',
    order: 2,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'realisations_observees',
    type: 'textarea',
    label: 'Principales réalisations observées',
    helpText: 'Décrivez les accomplissements significatifs de l\'employé',
    placeholder: 'Ex: A mené à bien le projet X, a amélioré le processus Y de 30%...',
    required: true,
    section: 'performance',
    order: 3,
  },

  // Section 2: Compétences Clés
  {
    id: 'comp_techniques',
    type: 'rating',
    label: 'Compétences techniques',
    helpText: 'Maîtrise des compétences métier requises',
    required: true,
    section: 'competences',
    order: 1,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'comp_communication',
    type: 'rating',
    label: 'Communication',
    helpText: 'Clarté, écoute active, partage d\'information',
    required: true,
    section: 'competences',
    order: 2,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'comp_collaboration',
    type: 'rating',
    label: 'Collaboration',
    helpText: 'Travail d\'équipe, coopération, esprit collectif',
    required: true,
    section: 'competences',
    order: 3,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'comp_autonomie',
    type: 'rating',
    label: 'Autonomie',
    helpText: 'Capacité à travailler de manière indépendante',
    required: true,
    section: 'competences',
    order: 4,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'comp_ponctualite',
    type: 'rating',
    label: 'Ponctualité et assiduité',
    helpText: 'Respect des horaires et présence régulière',
    required: true,
    section: 'competences',
    order: 5,
    ratingConfig: RATING_SCALE_5,
  },

  // Section 3: Points d'Amélioration
  {
    id: 'points_forts',
    type: 'textarea',
    label: 'Points forts observés',
    helpText: 'Qualités et atouts de l\'employé',
    placeholder: 'Ex: Excellente rigueur, très bon relationnel avec les clients...',
    required: true,
    section: 'amelioration',
    order: 1,
  },
  {
    id: 'axes_amelioration',
    type: 'textarea',
    label: 'Axes d\'amélioration recommandés',
    helpText: 'Domaines où l\'employé peut progresser',
    placeholder: 'Ex: Améliorer la gestion du temps, développer les compétences en présentation...',
    required: true,
    section: 'amelioration',
    order: 2,
  },
  {
    id: 'actions_developpement',
    type: 'textarea',
    label: 'Actions de développement suggérées',
    helpText: 'Formations, accompagnement, projets recommandés',
    placeholder: 'Ex: Formation en leadership, mentorat avec un senior, participation au projet Z...',
    required: false,
    section: 'amelioration',
    order: 3,
  },

  // Section 4: Recommandation
  {
    id: 'recommandation',
    type: 'select',
    label: 'Recommandation',
    helpText: 'Votre recommandation pour cet employé',
    required: true,
    section: 'recommandation',
    order: 1,
    options: [
      { value: 'promotion', label: 'Promotion' },
      { value: 'augmentation', label: 'Augmentation de salaire' },
      { value: 'formation', label: 'Formation prioritaire' },
      { value: 'maintien', label: 'Maintien dans le poste' },
      { value: 'plan_amelioration', label: 'Plan d\'amélioration' },
    ],
  },
  {
    id: 'commentaire_final',
    type: 'textarea',
    label: 'Commentaire final',
    helpText: 'Synthèse et remarques additionnelles',
    placeholder: 'Résumez votre évaluation et ajoutez tout commentaire utile...',
    required: false,
    section: 'recommandation',
    order: 2,
  },
];

const managerEvaluationSections: FormSectionDefinition[] = [
  {
    id: 'performance',
    title: 'Performance de l\'Employé',
    description: 'Évaluation de la performance globale et des objectifs',
    icon: 'Target',
    order: 1,
  },
  {
    id: 'competences',
    title: 'Compétences Clés',
    description: 'Évaluation des compétences professionnelles',
    icon: 'Star',
    order: 2,
  },
  {
    id: 'amelioration',
    title: 'Points d\'Amélioration',
    description: 'Forces et axes de progression',
    icon: 'TrendingUp',
    order: 3,
  },
  {
    id: 'recommandation',
    title: 'Recommandation',
    description: 'Votre recommandation finale',
    icon: 'Award',
    order: 4,
  },
];

export const MANAGER_EVALUATION_TEMPLATE = {
  name: 'Évaluation Manager',
  slug: 'evaluation-manager',
  description: 'Formulaire d\'évaluation par le manager. Couvre la performance, les compétences, les axes d\'amélioration et la recommandation.',
  module: 'performance' as const,
  category: 'manager_evaluation',
  definition: {
    version: '1.0',
    fields: managerEvaluationFields,
    sections: managerEvaluationSections,
    showProgress: true,
    allowDraft: true,
    autoSave: true,
    autoSaveInterval: 30,
    completionMessage: 'Merci ! L\'évaluation a été soumise avec succès.',
  } satisfies FormDefinition,
  scoringEnabled: true,
  scoringConfig: {
    enabled: true,
    method: 'weighted' as const,
    sectionWeights: {
      performance: 0.4,
      competences: 0.6,
    },
    thresholds: STANDARD_THRESHOLDS,
  } satisfies FormScoringConfig,
  defaultRatingScale: RATING_SCALE_5,
  isSystem: true,
  isActive: true,
};

// ============================================================================
// TEMPLATE 3: FEEDBACK 360°
// ============================================================================

const feedback360Fields: FormFieldDefinition[] = [
  // Section 1: Relation de Travail
  {
    id: 'relation',
    type: 'select',
    label: 'Quelle est votre relation avec cette personne ?',
    helpText: 'Cela nous aide à contextualiser votre feedback',
    required: true,
    section: 'relation',
    order: 1,
    options: [
      { value: 'manager', label: 'Je suis son/sa manager' },
      { value: 'collegue', label: 'Collègue (même équipe)' },
      { value: 'autre_equipe', label: 'Collègue (autre équipe)' },
      { value: 'subordonne', label: 'Il/elle est mon/ma manager' },
      { value: 'client_interne', label: 'Client interne' },
    ],
  },
  {
    id: 'frequence_interaction',
    type: 'select',
    label: 'À quelle fréquence travaillez-vous ensemble ?',
    required: true,
    section: 'relation',
    order: 2,
    options: [
      { value: 'quotidien', label: 'Quotidiennement' },
      { value: 'hebdomadaire', label: 'Plusieurs fois par semaine' },
      { value: 'mensuel', label: 'Plusieurs fois par mois' },
      { value: 'occasionnel', label: 'Occasionnellement' },
    ],
  },

  // Section 2: Évaluation des Comportements
  {
    id: 'collaboration',
    type: 'rating',
    label: 'Collaboration et esprit d\'équipe',
    helpText: 'Travaille bien avec les autres, partage l\'information',
    required: true,
    section: 'comportements',
    order: 1,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'communication',
    type: 'rating',
    label: 'Communication efficace',
    helpText: 'S\'exprime clairement, écoute activement',
    required: true,
    section: 'comportements',
    order: 2,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'leadership',
    type: 'rating',
    label: 'Leadership et influence',
    helpText: 'Inspire les autres, prend des initiatives',
    required: true,
    section: 'comportements',
    order: 3,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'resolution_problemes',
    type: 'rating',
    label: 'Résolution de problèmes',
    helpText: 'Analyse les situations, trouve des solutions',
    required: true,
    section: 'comportements',
    order: 4,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'fiabilite',
    type: 'rating',
    label: 'Fiabilité et engagement',
    helpText: 'Respecte ses engagements, est digne de confiance',
    required: true,
    section: 'comportements',
    order: 5,
    ratingConfig: RATING_SCALE_5,
  },

  // Section 3: Commentaires
  {
    id: 'points_forts',
    type: 'textarea',
    label: 'Quels sont les points forts de cette personne ?',
    helpText: 'Décrivez ce qu\'elle fait particulièrement bien',
    placeholder: 'Ex: Très à l\'écoute, toujours disponible pour aider...',
    required: true,
    section: 'commentaires',
    order: 1,
  },
  {
    id: 'conseils_developpement',
    type: 'textarea',
    label: 'Quels conseils donneriez-vous pour son développement ?',
    helpText: 'Suggestions constructives pour progresser',
    placeholder: 'Ex: Pourrait déléguer davantage, gagnerait à mieux structurer ses présentations...',
    required: false,
    section: 'commentaires',
    order: 2,
  },
];

const feedback360Sections: FormSectionDefinition[] = [
  {
    id: 'relation',
    title: 'Relation de Travail',
    description: 'Contexte de votre collaboration',
    icon: 'Users',
    order: 1,
  },
  {
    id: 'comportements',
    title: 'Évaluation des Comportements',
    description: 'Évaluez les comportements professionnels observés',
    icon: 'Star',
    order: 2,
  },
  {
    id: 'commentaires',
    title: 'Commentaires',
    description: 'Vos observations et conseils',
    icon: 'MessageSquare',
    order: 3,
  },
];

export const FEEDBACK_360_TEMPLATE = {
  name: 'Feedback 360°',
  slug: 'feedback-360',
  description: 'Formulaire de feedback multi-évaluateurs. Permet aux collègues, managers et subordonnés de donner un retour anonyme.',
  module: 'performance' as const,
  category: '360_feedback',
  definition: {
    version: '1.0',
    fields: feedback360Fields,
    sections: feedback360Sections,
    showProgress: true,
    allowDraft: true,
    autoSave: true,
    autoSaveInterval: 30,
    completionMessage: 'Merci pour votre feedback ! Vos réponses resteront anonymes.',
  } satisfies FormDefinition,
  scoringEnabled: true,
  scoringConfig: {
    enabled: true,
    method: 'average' as const,
    thresholds: STANDARD_THRESHOLDS,
  } satisfies FormScoringConfig,
  defaultRatingScale: RATING_SCALE_5,
  isSystem: true,
  isActive: true,
};

// ============================================================================
// TEMPLATE 4: ÉVALUATION PÉRIODE D'ESSAI
// ============================================================================

const probationFields: FormFieldDefinition[] = [
  // Section 1: Intégration
  {
    id: 'adaptation_equipe',
    type: 'rating',
    label: 'Adaptation à l\'équipe',
    helpText: 'S\'intègre bien, crée des liens avec les collègues',
    required: true,
    section: 'integration',
    order: 1,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'comprehension_poste',
    type: 'rating',
    label: 'Compréhension du poste',
    helpText: 'Comprend ses responsabilités et ses missions',
    required: true,
    section: 'integration',
    order: 2,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'respect_procedures',
    type: 'rating',
    label: 'Respect des procédures',
    helpText: 'Suit les règles et processus de l\'entreprise',
    required: true,
    section: 'integration',
    order: 3,
    ratingConfig: RATING_SCALE_5,
  },

  // Section 2: Performance Initiale
  {
    id: 'qualite_travail',
    type: 'rating',
    label: 'Qualité du travail',
    helpText: 'Produit un travail de qualité, avec rigueur',
    required: true,
    section: 'performance',
    order: 1,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'respect_delais',
    type: 'rating',
    label: 'Respect des délais',
    helpText: 'Livre son travail dans les temps impartis',
    required: true,
    section: 'performance',
    order: 2,
    ratingConfig: RATING_SCALE_5,
  },
  {
    id: 'autonomie_acquise',
    type: 'rating',
    label: 'Autonomie acquise',
    helpText: 'Devient progressivement autonome sur ses tâches',
    required: true,
    section: 'performance',
    order: 3,
    ratingConfig: RATING_SCALE_5,
  },

  // Section 3: Décision
  {
    id: 'decision',
    type: 'radio',
    label: 'Recommandation',
    helpText: 'Votre décision concernant la période d\'essai',
    required: true,
    section: 'decision',
    order: 1,
    options: [
      { value: 'confirmer', label: '✅ Confirmer dans le poste', color: '#22c55e' },
      { value: 'prolonger', label: '⏳ Prolonger la période d\'essai', color: '#f59e0b' },
      { value: 'ne_pas_confirmer', label: '❌ Ne pas confirmer', color: '#ef4444' },
    ],
  },
  {
    id: 'justification',
    type: 'textarea',
    label: 'Justification de la décision',
    helpText: 'Expliquez les raisons de votre recommandation',
    placeholder: 'Ex: L\'employé a démontré une excellente capacité d\'adaptation...',
    required: true,
    section: 'decision',
    order: 2,
  },
  {
    id: 'objectifs_si_prolongation',
    type: 'textarea',
    label: 'Objectifs si prolongation',
    helpText: 'En cas de prolongation, quels objectifs doit atteindre l\'employé ?',
    placeholder: 'Ex: Maîtriser l\'outil X, atteindre 80% de satisfaction client...',
    required: false,
    section: 'decision',
    order: 3,
    conditions: [{
      conditions: [{ field: 'decision', operator: 'equals', value: 'prolonger' }],
      logic: 'AND',
      action: 'show',
    }],
  },
];

const probationSections: FormSectionDefinition[] = [
  {
    id: 'integration',
    title: 'Intégration',
    description: 'Évaluation de l\'intégration du nouvel employé',
    icon: 'Users',
    order: 1,
  },
  {
    id: 'performance',
    title: 'Performance Initiale',
    description: 'Évaluation de la performance durant la période d\'essai',
    icon: 'Target',
    order: 2,
  },
  {
    id: 'decision',
    title: 'Décision',
    description: 'Votre recommandation finale',
    icon: 'CheckCircle',
    order: 3,
  },
];

export const PROBATION_EVALUATION_TEMPLATE = {
  name: 'Évaluation Période d\'Essai',
  slug: 'evaluation-periode-essai',
  description: 'Formulaire d\'évaluation de fin de période d\'essai. Permet de confirmer, prolonger ou ne pas confirmer l\'employé.',
  module: 'performance' as const,
  category: 'manager_evaluation',
  definition: {
    version: '1.0',
    fields: probationFields,
    sections: probationSections,
    showProgress: true,
    allowDraft: true,
    autoSave: true,
    autoSaveInterval: 30,
    completionMessage: 'L\'évaluation de période d\'essai a été soumise.',
  } satisfies FormDefinition,
  scoringEnabled: true,
  scoringConfig: {
    enabled: true,
    method: 'average' as const,
    thresholds: STANDARD_THRESHOLDS,
  } satisfies FormScoringConfig,
  defaultRatingScale: RATING_SCALE_5,
  isSystem: true,
  isActive: true,
};

// ============================================================================
// TEMPLATE 5: ÉVALUATION RAPIDE (QUICK CHECK-IN)
// ============================================================================

const quickCheckinFields: FormFieldDefinition[] = [
  {
    id: 'sentiment',
    type: 'rating',
    label: 'Comment vous sentez-vous au travail ?',
    helpText: 'Votre bien-être général en ce moment',
    required: true,
    section: 'etat',
    order: 1,
    ratingConfig: EMOJI_RATING_SCALE,
  },
  {
    id: 'accomplissements',
    type: 'textarea',
    label: 'Qu\'avez-vous accompli récemment ?',
    helpText: 'Vos réalisations depuis le dernier check-in',
    placeholder: 'Ex: J\'ai terminé la documentation du projet, résolu 5 tickets support...',
    required: true,
    section: 'etat',
    order: 2,
  },
  {
    id: 'besoins',
    type: 'textarea',
    label: 'De quoi avez-vous besoin pour mieux travailler ?',
    helpText: 'Ressources, soutien, ou changements souhaités',
    placeholder: 'Ex: Plus de temps pour la formation, meilleur équipement, aide d\'un collègue...',
    required: false,
    section: 'etat',
    order: 3,
  },
  {
    id: 'blocages',
    type: 'textarea',
    label: 'Y a-t-il des blocages ou difficultés ?',
    helpText: 'Obstacles qui freinent votre travail',
    placeholder: 'Ex: En attente de validation, problème technique non résolu...',
    required: false,
    section: 'etat',
    order: 4,
  },
];

const quickCheckinSections: FormSectionDefinition[] = [
  {
    id: 'etat',
    title: 'État Actuel',
    description: 'Un aperçu rapide de votre situation',
    icon: 'Activity',
    order: 1,
  },
];

export const QUICK_CHECKIN_TEMPLATE = {
  name: 'Évaluation Rapide',
  slug: 'evaluation-rapide',
  description: 'Check-in rapide pour les petites équipes ou les évaluations fréquentes. Simple et efficace.',
  module: 'performance' as const,
  category: 'self_evaluation',
  definition: {
    version: '1.0',
    fields: quickCheckinFields,
    sections: quickCheckinSections,
    showProgress: false,
    allowDraft: false,
    autoSave: false,
    completionMessage: 'Merci pour ce check-in ! Votre manager sera informé.',
  } satisfies FormDefinition,
  scoringEnabled: false,
  scoringConfig: null,
  defaultRatingScale: EMOJI_RATING_SCALE,
  isSystem: true,
  isActive: true,
};

// ============================================================================
// ALL TEMPLATES EXPORT
// ============================================================================

export const DEFAULT_EVALUATION_TEMPLATES = [
  SELF_EVALUATION_TEMPLATE,
  MANAGER_EVALUATION_TEMPLATE,
  FEEDBACK_360_TEMPLATE,
  PROBATION_EVALUATION_TEMPLATE,
  QUICK_CHECKIN_TEMPLATE,
];
