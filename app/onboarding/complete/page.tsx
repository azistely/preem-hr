'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Building, Users, Folder, Clock, Calendar } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ConfiguredItemProps {
  icon: React.ReactNode;
  text: string;
}

function ConfiguredItem({ icon, text }: ConfiguredItemProps) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted">
      <div className="text-primary">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

interface NextStepCardProps {
  number: number;
  title: string;
  description: string;
  action: string;
  href: string;
}

function NextStepCard({ number, title, description, action, href }: NextStepCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground mb-2">{description}</p>
          <Link href={href}>
            <Button variant="outline" size="sm">
              {action} →
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function CompletePage() {
  const router = useRouter();
  const [showConfetti, setShowConfetti] = useState(true);

  const { data: summary } = api.onboarding.getSummary.useQuery();
  const complete = api.onboarding.complete.useMutation();

  useEffect(() => {
    // Trigger confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    // Hide confetti after 3 seconds
    const timer = setTimeout(() => setShowConfetti(false), 3000);

    // Mark onboarding as complete
    complete.mutate();

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-green-50 to-blue-50 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Félicitations ! 🎉
          </h1>
          <p className="text-lg text-muted-foreground">
            Votre espace Preem est configuré et prêt à l'emploi
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* What was configured */}
          <div>
            <h2 className="font-semibold mb-3">Ce qui a été configuré:</h2>
            <div className="grid gap-2">
              <ConfiguredItem
                icon={<Building className="h-5 w-5" />}
                text={`Entreprise: ${summary?.companyName || 'Votre entreprise'}`}
              />
              <ConfiguredItem
                icon={<Users className="h-5 w-5" />}
                text={`${summary?.employeeCount || 0} employé(s) ajouté(s)`}
              />
              {(summary?.departmentCount ?? 0) > 0 && (
                <ConfiguredItem
                  icon={<Folder className="h-5 w-5" />}
                  text={`${summary?.departmentCount} département(s)`}
                />
              )}
              {summary?.timeTrackingEnabled && (
                <ConfiguredItem
                  icon={<Clock className="h-5 w-5" />}
                  text="Pointage activé"
                />
              )}
              {summary?.timeOffEnabled && (
                <ConfiguredItem
                  icon={<Calendar className="h-5 w-5" />}
                  text="Gestion des congés activée"
                />
              )}
            </div>
          </div>

          {/* Next steps */}
          <div>
            <h2 className="font-semibold mb-3">Prochaines étapes:</h2>
            <div className="space-y-3">
              <NextStepCard
                number={1}
                title="Lancez votre première paie"
                description="Générez les bulletins de paie de vos employés"
                action="Aller à Paie"
                href="/payroll"
              />
              <NextStepCard
                number={2}
                title="Invitez vos employés"
                description="Ils pourront consulter leurs bulletins et pointer"
                action="Gérer les accès"
                href="/employees"
              />
              {!summary?.timeTrackingEnabled && (
                <NextStepCard
                  number={3}
                  title="Activer le pointage (optionnel)"
                  description="Suivez les heures de travail de vos employés"
                  action="Configurer"
                  href="/settings/time-tracking"
                />
              )}
            </div>
          </div>

          <Button
            onClick={() => router.push('/dashboard')}
            className="w-full min-h-[56px] text-lg"
          >
            Accéder à mon tableau de bord
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
