/**
 * Step 1: Departure Type Selection
 *
 * User-friendly selection of departure type with clear French labels and descriptions.
 * Supports all 7 types per Convention Collective.
 */

'use client';

import { UseFormReturn } from 'react-hook-form';
import type { WizardData } from '../terminate-employee-wizard';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Form,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  FileText,
  UserX,
  Briefcase,
  HandshakeIcon,
  Gift,
  Heart,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DepartureTypeStepProps {
  form: UseFormReturn<WizardData>;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    contractType?: 'CDI' | 'CDD'; // Simplified for filtering logic
    contract?: {
      contractType: string; // Actual contract type from database (CDI, CDD, CDDTI, INTERIM)
    };
  };
}

const departureTypes = [
  {
    value: 'FIN_CDD',
    label: 'Fin de contrat CDD',
    description: 'Arrivée à terme d\'un contrat à durée déterminée',
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    availableFor: ['CDD'],
  },
  {
    value: 'DEMISSION_CDI',
    label: 'Démission (CDI)',
    description: 'L\'employé démissionne de son poste en CDI',
    icon: UserX,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    availableFor: ['CDI'],
  },
  {
    value: 'DEMISSION_CDD',
    label: 'Démission (CDD)',
    description: 'L\'employé démissionne avant la fin de son CDD',
    icon: UserX,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    availableFor: ['CDD'],
  },
  {
    value: 'LICENCIEMENT',
    label: 'Licenciement',
    description: 'L\'employeur met fin au contrat (économique, faute, inaptitude...)',
    icon: Briefcase,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    availableFor: ['CDI', 'CDD'],
  },
  {
    value: 'RUPTURE_CONVENTIONNELLE',
    label: 'Rupture conventionnelle',
    description: 'Accord mutuel entre l\'employeur et l\'employé',
    icon: HandshakeIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    availableFor: ['CDI'],
  },
  {
    value: 'RETRAITE',
    label: 'Départ à la retraite',
    description: 'L\'employé part à la retraite',
    icon: Gift,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    availableFor: ['CDI', 'CDD'],
  },
  {
    value: 'DECES',
    label: 'Décès',
    description: 'Décès de l\'employé (paiement aux ayants droit)',
    icon: Heart,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    availableFor: ['CDI', 'CDD'],
  },
] as const;

export function DepartureTypeStep({ form, employee }: DepartureTypeStepProps) {
  const contractType = employee.contractType || 'CDI';
  const selectedValue = form.watch('departureType');

  // Get actual contract type from database for display
  const actualContractType = employee.contract?.contractType || contractType;

  // Filter departure types based on contract type
  const availableTypes = departureTypes.filter((type) =>
    (type.availableFor as readonly string[]).includes(contractType)
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-muted p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium mb-1">Type de contrat: {actualContractType}</p>
            <p className="text-sm text-muted-foreground">
              {availableTypes.length} types de cessation disponibles pour ce contrat
            </p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <FormField
          control={form.control}
          name="departureType"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg font-semibold">
                Sélectionnez le type de cessation *
              </FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value ?? ''}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  {availableTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = field.value === type.value;

                    return (
                      <label
                        key={type.value}
                        htmlFor={type.value}
                        className="cursor-pointer"
                      >
                        <Card
                          className={cn(
                            'transition-all hover:shadow-md',
                            isSelected && 'ring-2 ring-primary shadow-md'
                          )}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start gap-3">
                              <div
                                className={cn(
                                  'rounded-lg p-2',
                                  type.bgColor
                                )}
                              >
                                <Icon className={cn('h-5 w-5', type.color)} />
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-base flex items-center justify-between">
                                  {type.label}
                                  <RadioGroupItem
                                    value={type.value}
                                    id={type.value}
                                    className="ml-2"
                                  />
                                </CardTitle>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <CardDescription className="text-sm">
                              {type.description}
                            </CardDescription>
                          </CardContent>
                        </Card>
                      </label>
                    );
                  })}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>

      {selectedValue && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
          <p className="text-sm font-medium text-primary">
            Type sélectionné: {departureTypes.find((t) => t.value === selectedValue)?.label}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Cliquez sur "Suivant" pour continuer la configuration
          </p>
        </div>
      )}
    </div>
  );
}
