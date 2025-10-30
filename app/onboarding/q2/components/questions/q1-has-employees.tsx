/**
 * Question 1: Do you have existing employees?
 * HCI: Large touch targets, emoji + icons, clear language
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { User, Users } from 'lucide-react';

interface HasEmployeesQuestionProps {
  onAnswer: (hasEmployees: boolean) => void;
}

export function HasEmployeesQuestion({ onAnswer }: HasEmployeesQuestionProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold">
          Avez-vous déjà des employés ?
        </h2>
        <p className="text-muted-foreground text-lg">
          Nous allons adapter le processus à votre situation
        </p>
      </div>

      <div className="grid gap-4">
        {/* Option 1: No employees */}
        <Card
          className="cursor-pointer hover:border-primary hover:shadow-lg transition-all"
          onClick={() => onAnswer(false)}
        >
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">
                  👤 Non, je démarre
                </h3>
                <p className="text-muted-foreground">
                  Je vais ajouter mes employés un par un au fur et à mesure
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Option 2: Has employees */}
        <Card
          className="cursor-pointer hover:border-primary hover:shadow-lg transition-all"
          onClick={() => onAnswer(true)}
        >
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">
                  👥 Oui, j'ai déjà des employés
                </h3>
                <p className="text-muted-foreground">
                  Je veux importer mes données existantes pour gagner du temps
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Helper text */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          💡 <strong>Pas d'inquiétude :</strong> Vous pourrez toujours ajouter ou importer des employés plus tard depuis les paramètres.
        </p>
      </div>
    </div>
  );
}
