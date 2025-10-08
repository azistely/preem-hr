'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { OnboardingLayout } from '@/features/onboarding/components/onboarding-layout';
import { QuestionOptionCard } from '@/features/onboarding/components/question-option-card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface QuestionOption {
  value: string;
  icon: string;
  label: string;
  description: string;
  disabled?: boolean;
}

interface Question {
  id: string;
  title: string;
  subtitle: string;
  options: QuestionOption[];
}

const QUESTIONS: Question[] = [
  {
    id: 'company_size',
    title: 'Combien d\'employés avez-vous ?',
    subtitle: 'Comptez tous vos employés actuels, y compris vous-même',
    options: [
      {
        value: 'solo',
        icon: '🧍',
        label: 'Juste moi',
        description: 'Travailleur autonome',
      },
      {
        value: 'small_team',
        icon: '👥',
        label: '2-10 employés',
        description: 'Petite équipe',
      },
      {
        value: 'medium',
        icon: '👔',
        label: '11-50 employés',
        description: 'Moyenne entreprise',
      },
      {
        value: 'large',
        icon: '🏢',
        label: '51+ employés',
        description: 'Grande organisation',
      },
    ],
  },
  {
    id: 'has_departments',
    title: 'Votre entreprise a-t-elle des départements ?',
    subtitle: 'Par exemple: Direction, Commercial, Comptabilité',
    options: [
      {
        value: 'false',
        icon: '❌',
        label: 'Non, équipe plate',
        description: 'Tous les employés au même niveau',
      },
      {
        value: 'true',
        icon: '✅',
        label: 'Oui, plusieurs départements',
        description: 'Organisation structurée par départements',
      },
    ],
  },
  {
    id: 'contract_types',
    title: 'Avez-vous des employés avec des types de contrat différents ?',
    subtitle: 'Par exemple: temps partiel, stages, CDD',
    options: [
      {
        value: 'full_time_only',
        icon: '❌',
        label: 'Non, tous à temps plein',
        description: 'Uniquement des contrats à temps plein',
      },
      {
        value: 'multiple',
        icon: '✅',
        label: 'Oui, plusieurs types',
        description: 'Temps partiel, stages, CDD, etc.',
      },
    ],
  },
  {
    id: 'compensation',
    title: 'Comment payez-vous vos employés ?',
    subtitle: 'Sélectionnez le type de rémunération',
    options: [
      {
        value: 'fixed_salary',
        icon: '💰',
        label: 'Salaire fixe seulement',
        description: 'Salaire de base uniquement',
      },
      {
        value: 'with_allowances',
        icon: '🎁',
        label: 'Salaire + primes/indemnités',
        description: 'Transport, logement, etc.',
      },
      {
        value: 'with_commissions',
        icon: '📊',
        label: 'Salaire + commissions',
        description: 'Pour les équipes commerciales',
      },
      {
        value: 'full',
        icon: '🎯',
        label: 'Tout ça',
        description: 'Salaire + primes + commissions',
      },
    ],
  },
  {
    id: 'time_tracking',
    title: 'Voulez-vous suivre le temps de travail (pointage) ?',
    subtitle: 'Contrôlez les heures d\'arrivée et de départ',
    options: [
      {
        value: 'none',
        icon: '❌',
        label: 'Non, pas pour l\'instant',
        description: 'Vous pourrez activer plus tard',
      },
      {
        value: 'basic',
        icon: '⏰',
        label: 'Oui, pointage simple',
        description: 'Entrée et sortie basiques',
      },
      {
        value: 'geofencing',
        icon: '📍',
        label: 'Oui, avec géolocalisation',
        description: 'Pointage uniquement au bureau',
      },
      {
        value: 'overtime',
        icon: '📊',
        label: 'Oui, avec heures supplémentaires',
        description: 'Suivi complet du temps',
      },
    ],
  },
  {
    id: 'time_off',
    title: 'Voulez-vous gérer les congés ?',
    subtitle: 'Congés payés, permissions, absences',
    options: [
      {
        value: 'none',
        icon: '❌',
        label: 'Non, pas pour l\'instant',
        description: 'Vous pourrez activer plus tard',
      },
      {
        value: 'legal_only',
        icon: '✅',
        label: 'Oui, congés légaux seulement',
        description: '2,2 jours par mois (CI)',
      },
      {
        value: 'custom_policies',
        icon: '🎯',
        label: 'Oui, avec politiques personnalisées',
        description: 'Congés maladie, maternité, etc.',
      },
    ],
  },
  {
    id: 'payroll_frequency',
    title: 'Quelle est la fréquence de paie ?',
    subtitle: 'À quelle fréquence payez-vous vos employés ?',
    options: [
      {
        value: 'monthly',
        icon: '📅',
        label: 'Mensuel (fin du mois)',
        description: 'Paiement une fois par mois',
      },
      {
        value: 'bi_weekly',
        icon: '📆',
        label: 'Bi-mensuel (2x par mois)',
        description: 'Paiement deux fois par mois',
      },
    ],
  },
];

export default function QuestionnairePage() {
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState(0);

  // Fetch current state
  const { data: questionnaireState } = api.onboarding.getQuestionnaireState.useQuery();
  const answerQuestion = api.onboarding.answerQuestion.useMutation();

  // Set current question based on existing answers
  useEffect(() => {
    if (questionnaireState) {
      setCurrentQuestion(questionnaireState.currentQuestionIndex);

      // If already complete, redirect to preview
      if (questionnaireState.isComplete) {
        router.push('/onboarding/preview');
      }
    }
  }, [questionnaireState, router]);

  const handleAnswer = async (answer: string) => {
    const question = QUESTIONS[currentQuestion];

    try {
      // Convert string boolean to actual boolean for has_departments
      const answerValue = question.id === 'has_departments'
        ? answer === 'true'
        : answer;

      const result = await answerQuestion.mutateAsync({
        questionId: question.id as any,
        answer: answerValue as any,
      });

      // Move to next question or preview
      if (result.questionnaireComplete) {
        toast.success('Questionnaire complété !');
        router.push('/onboarding/preview');
      } else if (currentQuestion < QUESTIONS.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const question = QUESTIONS[currentQuestion];

  if (!question) {
    return null;
  }

  return (
    <OnboardingLayout
      title={question.title}
      subtitle={question.subtitle}
      currentStep={currentQuestion + 1}
      totalSteps={QUESTIONS.length}
    >
      <div className="space-y-4">
        {/* Question options */}
        <div className="grid gap-3">
          {question.options.map((option) => (
            <QuestionOptionCard
              key={option.value}
              icon={option.icon}
              label={option.label}
              description={option.description}
              disabled={option.disabled}
              onClick={() => handleAnswer(option.value)}
              className="min-h-[72px]"
            />
          ))}
        </div>

        {/* Back button */}
        {currentQuestion > 0 && (
          <Button
            variant="ghost"
            onClick={handleBack}
            className="w-full min-h-[44px]"
          >
            ← Retour
          </Button>
        )}
      </div>
    </OnboardingLayout>
  );
}
