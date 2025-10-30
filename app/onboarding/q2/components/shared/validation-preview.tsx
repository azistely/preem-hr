/**
 * Validation Preview
 * Shows validation results before import
 * HCI: Clear visual indicators, allow corrections
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ValidationResult {
  totalRecords: number;
  validRecords: number;
  warnings: number;
  errors: number;
  details: Array<{
    row: number;
    type: 'error' | 'warning';
    message: string;
  }>;
}

interface ValidationPreviewProps {
  result: ValidationResult;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ValidationPreview({ result, onConfirm, onCancel }: ValidationPreviewProps) {
  const [isOpen, setIsOpen] = useState(true);

  const canProceed = result.errors === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className={`
          w-20 h-20 rounded-full mx-auto flex items-center justify-center
          ${canProceed ? 'bg-green-100' : 'bg-red-100'}
        `}>
          {canProceed ? (
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          ) : (
            <XCircle className="w-10 h-10 text-red-600" />
          )}
        </div>
        <h3 className="text-2xl font-bold">
          {canProceed ? '✅ Validation réussie' : '❌ Erreurs détectées'}
        </h3>
        <p className="text-muted-foreground">
          {canProceed
            ? 'Vos données sont prêtes à être importées'
            : 'Veuillez corriger les erreurs avant de continuer'}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">
              {result.totalRecords}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Total
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600">
              {result.validRecords}
            </div>
            <div className="text-sm text-green-700 mt-1 font-medium">
              Valides
            </div>
          </CardContent>
        </Card>

        <Card className={result.warnings > 0 ? 'border-orange-200 bg-orange-50' : ''}>
          <CardContent className="p-4 text-center">
            <div className={`text-3xl font-bold ${result.warnings > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
              {result.warnings}
            </div>
            <div className={`text-sm mt-1 ${result.warnings > 0 ? 'text-orange-700 font-medium' : 'text-muted-foreground'}`}>
              Avertissements
            </div>
          </CardContent>
        </Card>

        <Card className={result.errors > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="p-4 text-center">
            <div className={`text-3xl font-bold ${result.errors > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {result.errors}
            </div>
            <div className={`text-sm mt-1 ${result.errors > 0 ? 'text-red-700 font-medium' : 'text-muted-foreground'}`}>
              Erreurs
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      {result.details.length > 0 && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <CardTitle className="text-lg">
                    {result.errors > 0 ? 'Erreurs et avertissements' : 'Avertissements'}
                  </CardTitle>
                  <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="space-y-2">
                  {result.details.map((detail, index) => (
                    <div
                      key={index}
                      className={`
                        p-3 rounded-lg flex items-start gap-3
                        ${detail.type === 'error' ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}
                      `}
                    >
                      {detail.type === 'error' ? (
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${detail.type === 'error' ? 'text-red-900' : 'text-orange-900'}`}>
                          Ligne {detail.row}
                        </p>
                        <p className={`text-sm ${detail.type === 'error' ? 'text-red-700' : 'text-orange-700'}`}>
                          {detail.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Helper text */}
      {result.warnings > 0 && result.errors === 0 && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-900">
            ⚠️ <strong>Avertissements :</strong> Vous pouvez continuer, mais nous vous recommandons de vérifier ces points.
            Les valeurs manquantes ou incorrectes seront corrigées automatiquement avec des valeurs par défaut.
          </p>
        </div>
      )}

      {result.errors > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-900 mb-2">
            ❌ <strong>Erreurs critiques :</strong> Ces erreurs empêchent l'import. Veuillez:
          </p>
          <ul className="text-sm text-red-800 space-y-1 ml-6 list-disc">
            <li>Corriger les valeurs dans votre fichier</li>
            <li>Télécharger à nouveau le fichier corrigé</li>
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1 min-h-[56px] text-lg"
        >
          Corriger le fichier
        </Button>
        <Button
          onClick={onConfirm}
          disabled={!canProceed}
          className="flex-1 min-h-[56px] text-lg bg-green-600 hover:bg-green-700 disabled:opacity-50"
        >
          {canProceed ? 'Importer maintenant →' : 'Impossible d\'importer'}
        </Button>
      </div>
    </div>
  );
}
