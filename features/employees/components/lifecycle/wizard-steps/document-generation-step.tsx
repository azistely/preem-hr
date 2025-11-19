/**
 * Step 4: Document Generation Configuration
 *
 * Collects information needed for generating termination documents:
 * - Who is issuing the documents
 * - Payment date for final payslip
 * - Optional version notes
 *
 * Documents generated:
 * 1. Certificat de Travail (Work Certificate)
 * 2. Bulletin de Paie Final (Final Payslip)
 * 3. Attestation CNPS (CNPS Attestation)
 */

'use client';

import { UseFormReturn } from 'react-hook-form';
import type { WizardData } from '../terminate-employee-wizard';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Receipt, Shield, Info, Clock, User } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DocumentGenerationStepProps {
  form: UseFormReturn<WizardData>;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

const documents = [
  {
    title: 'Certificat de Travail',
    description: 'Document attestant la période d\'emploi et les postes occupés',
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    deadline: '48 heures après la cessation',
  },
  {
    title: 'Bulletin de Paie Final',
    description: 'Bulletin de paie final avec le STC complet',
    icon: Receipt,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    deadline: 'Immédiatement',
  },
  {
    title: 'Attestation CNPS',
    description: 'Récapitulatif des cotisations sociales durant l\'emploi',
    icon: Shield,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    deadline: '15 jours après la cessation',
  },
];

export function DocumentGenerationStep({ form, employee }: DocumentGenerationStepProps) {
  return (
    <div className="space-y-6">
      {/* Documents to be generated */}
      <Card>
        <CardHeader>
          <CardTitle>Documents à générer</CardTitle>
          <CardDescription>
            Les 3 documents obligatoires seront créés automatiquement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {documents.map((doc) => {
              const Icon = doc.icon;
              return (
                <Card key={doc.title} className={cn('border-2', doc.bgColor)}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className={cn('rounded-full p-3', doc.bgColor)}>
                        <Icon className={cn('h-6 w-6', doc.color)} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm mb-1">{doc.title}</h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          {doc.description}
                        </p>
                        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{doc.deadline}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Configuration form */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration des documents</CardTitle>
          <CardDescription>
            Informations nécessaires pour la génération des documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            {/* Issued By */}
            <FormField
              control={form.control}
              name="issuedBy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Émis par *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: Marie Kouadio, Responsable RH"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Nom et titre de la personne qui émet les documents officiels
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pay Date */}
            <FormField
              control={form.control}
              name="payDate"
              render={({ field }) => {
                const selectedDate = field.value ? new Date(field.value) : new Date();

                return (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      Date de paiement *
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'min-h-[48px] pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(selectedDate, 'PPP', { locale: fr })
                            ) : (
                              <span>Sélectionner une date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => field.onChange(date?.toISOString())}
                          disabled={(date) => date < new Date('1900-01-01')}
                          initialFocus
                          locale={fr}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Date de paiement du Solde de Tout Compte (pour le bulletin de paie final)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* Version Notes (Optional) */}
            <FormField
              control={form.control}
              name="versionNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Notes internes ou raisons de cette génération..."
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Notes internes pour traçabilité (non visibles sur les documents)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Form>
        </CardContent>
      </Card>

      {/* Important notes */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-2">Informations importantes:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>
              Les documents seront stockés dans le système de gestion documentaire
            </li>
            <li>
              Tous les documents seront versionnés et disponibles pour signature électronique
            </li>
            <li>
              Une copie sera envoyée par email à l'employé (si configuré)
            </li>
            <li>
              Les documents sont générés selon les modèles conformes à la Convention Collective
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Action info */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium mb-1">
                Prêt pour la génération
              </p>
              <p className="text-sm text-muted-foreground">
                Cliquez sur "Générer les documents" pour créer les 3 documents officiels.
                Cette opération peut prendre quelques secondes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
