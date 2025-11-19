/**
 * Step 5: Confirmation
 *
 * Success screen showing:
 * - Termination completed successfully
 * - Links to generated documents
 * - Summary of STC calculation
 * - Next steps
 */

'use client';

import { UseFormReturn } from 'react-hook-form';
import type { WizardData } from '../terminate-employee-wizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  FileText,
  Receipt,
  Shield,
  ExternalLink,
  ArrowRight,
  Download,
  Mail,
} from 'lucide-react';

interface ConfirmationStepProps {
  form: UseFormReturn<WizardData>;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export function ConfirmationStep({ form, employee }: ConfirmationStepProps) {
  const stcResult = form.getValues('stcResult');
  const terminationId = form.getValues('terminationId');
  const departureType = form.getValues('departureType');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDepartureTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      FIN_CDD: 'Fin de CDD',
      DEMISSION_CDI: 'Démission CDI',
      DEMISSION_CDD: 'Démission CDD',
      LICENCIEMENT: 'Licenciement',
      RUPTURE_CONVENTIONNELLE: 'Rupture conventionnelle',
      RETRAITE: 'Retraite',
      DECES: 'Décès',
    };
    return labels[type] || type;
  };

  const documents = [
    {
      title: 'Certificat de Travail',
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      category: 'work_certificate',
    },
    {
      title: 'Bulletin de Paie Final',
      icon: Receipt,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      category: 'final_payslip',
    },
    {
      title: 'Attestation CNPS',
      icon: Shield,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      category: 'cnps_attestation',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-900 mb-2">
                Cessation terminée avec succès!
              </h2>
              <p className="text-green-700">
                Le contrat de {employee.firstName} {employee.lastName} a été résilié
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* STC Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé du Solde de Tout Compte (STC)</CardTitle>
          <CardDescription>
            {departureType ? getDepartureTypeLabel(departureType) : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Montant brut</p>
              <p className="text-2xl font-bold">
                {formatCurrency(stcResult?.taxation?.totalGrossAmount || 0)}
              </p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Déductions</p>
              <p className="text-2xl font-bold text-red-600">
                -{formatCurrency(
                  (stcResult?.taxation?.estimatedITS || 0) +
                  (stcResult?.taxation?.estimatedCNPSEmployee || 0)
                )}
              </p>
            </div>
            <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground mb-1">Net à payer</p>
              <p className="text-3xl font-bold text-primary">
                {formatCurrency(stcResult?.taxation?.estimatedNetPayable || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Documents générés</CardTitle>
          <CardDescription>
            Les 3 documents officiels ont été créés et sont disponibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {documents.map((doc) => {
              const Icon = doc.icon;
              return (
                <Card key={doc.title} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${doc.bgColor}`}>
                          <Icon className={`h-5 w-5 ${doc.color}`} />
                        </div>
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Versionnage et signature électronique disponibles
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Télécharger
                        </Button>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Voir
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Prochaines étapes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary mt-0.5">
                1
              </div>
              <div>
                <p className="font-medium">Vérifier et signer les documents</p>
                <p className="text-muted-foreground text-xs">
                  Accédez à la gestion documentaire pour signer électroniquement
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary mt-0.5">
                2
              </div>
              <div>
                <p className="font-medium">Effectuer le paiement du STC</p>
                <p className="text-muted-foreground text-xs">
                  Montant net: {formatCurrency(stcResult?.taxation?.estimatedNetPayable || 0)}
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary mt-0.5">
                3
              </div>
              <div>
                <p className="font-medium">Remettre les documents à l'employé</p>
                <p className="text-muted-foreground text-xs">
                  Certificat de travail sous 48h, Attestation CNPS sous 15 jours
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary mt-0.5">
                4
              </div>
              <div>
                <p className="font-medium">Déclarer la cessation à la CNPS</p>
                <p className="text-muted-foreground text-xs">
                  Dans les délais légaux avec les documents appropriés
                </p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="flex-1 min-h-[48px]">
          <FileText className="h-4 w-4 mr-2" />
          Voir tous les documents
        </Button>
        <Button variant="outline" className="flex-1 min-h-[48px]">
          <Mail className="h-4 w-4 mr-2" />
          Envoyer par email
        </Button>
        <Button variant="outline" className="flex-1 min-h-[48px]">
          <Download className="h-4 w-4 mr-2" />
          Télécharger tout
        </Button>
      </div>

      {/* Termination ID for reference */}
      {terminationId && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <p className="text-xs text-muted-foreground">
              Référence de cessation: <code className="font-mono font-semibold">{terminationId}</code>
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
