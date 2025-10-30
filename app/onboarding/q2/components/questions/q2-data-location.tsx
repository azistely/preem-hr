/**
 * Question 2: Where is your employee data?
 * HCI: Visual cards with icons, progressive disclosure
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Briefcase, FileText, ChevronLeft } from 'lucide-react';

interface DataLocationQuestionProps {
  onAnswer: (source: 'excel' | 'sage' | 'manual') => void;
  onBack: () => void;
}

export function DataLocationQuestion({ onAnswer, onBack }: DataLocationQuestionProps) {
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
          Où sont vos données actuelles ?
        </h2>
        <p className="text-muted-foreground text-lg">
          Nous allons vous guider selon votre système
        </p>
      </div>

      <div className="grid gap-4">
        {/* Option 1: Excel/CSV */}
        <Card
          className="cursor-pointer hover:border-primary hover:shadow-lg transition-all"
          onClick={() => onAnswer('excel')}
        >
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">
                  📊 Excel / CSV
                </h3>
                <p className="text-muted-foreground">
                  J'ai un fichier Excel ou CSV avec mes employés
                </p>
                <p className="text-sm text-green-600 mt-2">
                  ✓ Import rapide et automatique
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Option 2: SAGE/CIEL/Odoo */}
        <Card
          className="cursor-pointer hover:border-primary hover:shadow-lg transition-all"
          onClick={() => onAnswer('sage')}
        >
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">
                  💼 SAGE / CIEL / Odoo
                </h3>
                <p className="text-muted-foreground">
                  J'utilise un logiciel de paie professionnel
                </p>
                <p className="text-sm text-blue-600 mt-2">
                  ✓ Guide pas à pas pour exporter vos données
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Option 3: Paper/Manual */}
        <Card
          className="cursor-pointer hover:border-primary hover:shadow-lg transition-all"
          onClick={() => onAnswer('manual')}
        >
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-8 h-8 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">
                  📝 Papier / Manuel
                </h3>
                <p className="text-muted-foreground">
                  Mes données ne sont pas encore informatisées
                </p>
                <p className="text-sm text-orange-600 mt-2">
                  ✓ Assistance WhatsApp disponible
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Helper text */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          💡 <strong>Peu importe votre choix :</strong> Nous avons une solution adaptée pour importer vos employés facilement.
        </p>
      </div>
    </div>
  );
}
