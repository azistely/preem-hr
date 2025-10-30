/**
 * Question 3: How comfortable are you with exports?
 * HCI: Different options based on technical comfort
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, BookOpen, MessageCircle, ChevronLeft } from 'lucide-react';

interface ComfortLevelQuestionProps {
  dataSource: 'excel' | 'sage' | 'manual';
  onAnswer: (level: 'confident' | 'need_guide' | 'need_help') => void;
  onBack: () => void;
}

export function ComfortLevelQuestion({ dataSource, onAnswer, onBack }: ComfortLevelQuestionProps) {
  const systemName = dataSource === 'excel' ? 'Excel/CSV' : 'SAGE/CIEL';

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-2"
      >
        <ChevronLeft className="w-4 h-4 mr-2" />
        Retour
      </Button>

      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold">
          Savez-vous comment exporter vos données ?
        </h2>
        <p className="text-muted-foreground text-lg">
          De {systemName} vers un fichier que nous pouvons lire
        </p>
      </div>

      <div className="grid gap-4">
        {/* Option 1: Confident */}
        <Card
          className="cursor-pointer hover:border-primary hover:shadow-lg transition-all"
          onClick={() => onAnswer('confident')}
        >
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">
                  ✅ Oui, je peux le faire moi-même
                </h3>
                <p className="text-muted-foreground">
                  Je vais télécharger votre modèle et importer mon fichier
                </p>
                <p className="text-sm text-green-600 mt-2">
                  ⚡ Plus rapide - 5 minutes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Option 2: Need guide */}
        <Card
          className="cursor-pointer hover:border-primary hover:shadow-lg transition-all"
          onClick={() => onAnswer('need_guide')}
        >
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">
                  🤔 J'ai besoin d'un guide pas à pas
                </h3>
                <p className="text-muted-foreground">
                  Montrez-moi comment exporter depuis {systemName}
                </p>
                <p className="text-sm text-blue-600 mt-2">
                  📖 Instructions avec captures d'écran
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Option 3: Need WhatsApp help */}
        <Card
          className="cursor-pointer hover:border-primary hover:shadow-lg transition-all"
          onClick={() => onAnswer('need_help')}
        >
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-8 h-8 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">
                  💬 J'ai besoin d'aide via WhatsApp
                </h3>
                <p className="text-muted-foreground">
                  Quelqu'un peut le faire pour moi ou me guider par téléphone
                </p>
                <p className="text-sm text-orange-600 mt-2">
                  🤝 Assistance personnalisée - 24-48h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Helper text */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          💡 <strong>Aucun jugement :</strong> Choisissez l'option la plus confortable pour vous. Toutes fonctionnent parfaitement !
        </p>
      </div>
    </div>
  );
}
