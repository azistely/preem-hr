/**
 * Step 2: Termination Configuration
 *
 * Dynamic form fields based on selected departure type.
 * Common fields: terminationDate, noticePeriodStatus
 * Type-specific fields: licenciementType, ruptureNegotiatedAmount, beneficiaries
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface ConfigurationStepProps {
  form: UseFormReturn<WizardData>;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    hireDate: string;
  };
}

export function ConfigurationStep({ form, employee }: ConfigurationStepProps) {
  const departureType = form.watch('departureType');
  const [beneficiariesCount, setBeneficiariesCount] = useState(1);

  const addBeneficiary = () => {
    const current = form.getValues('beneficiaries') || [];
    form.setValue('beneficiaries', [
      ...current,
      {
        name: '',
        relationship: 'spouse' as const,
        identityDocument: '',
        bankAccount: '',
        sharePercentage: 0,
      },
    ]);
    setBeneficiariesCount((prev) => prev + 1);
  };

  const removeBeneficiary = (index: number) => {
    const current = form.getValues('beneficiaries') || [];
    form.setValue(
      'beneficiaries',
      current.filter((_, i) => i !== index)
    );
    setBeneficiariesCount((prev) => prev - 1);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuration de la cessation</CardTitle>
          <CardDescription>
            Remplissez les détails de la cessation selon le type sélectionné
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            {/* Termination Date - Required for all types */}
            <FormField
              control={form.control}
              name="terminationDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date de cessation *</FormLabel>
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
                            format(field.value, 'PPP', { locale: fr })
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
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date(employee.hireDate) || date > new Date()
                        }
                        initialFocus
                        locale={fr}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Doit être entre la date d'embauche ({format(new Date(employee.hireDate), 'PP', { locale: fr })}) et aujourd'hui
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notice Period Status - Required for all types */}
            <FormField
              control={form.control}
              name="noticePeriodStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut du préavis *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue placeholder="Sélectionner le statut du préavis" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="worked">
                        Préavis effectué (travaillé)
                      </SelectItem>
                      <SelectItem value="paid_by_employer">
                        Préavis payé par l'employeur (dispense)
                      </SelectItem>
                      <SelectItem value="paid_by_employee">
                        Préavis payé par l'employé (démission sans préavis)
                      </SelectItem>
                      <SelectItem value="waived">
                        Préavis dispensé (faute grave/lourde)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Comment le préavis a-t-il été traité?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Licenciement Type - Only for LICENCIEMENT */}
            {departureType === 'LICENCIEMENT' && (
              <FormField
                control={form.control}
                name="licenciementType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de licenciement *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[48px]">
                          <SelectValue placeholder="Sélectionner le type de licenciement" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="economique">
                          Licenciement économique
                        </SelectItem>
                        <SelectItem value="faute_simple">
                          Licenciement pour faute simple
                        </SelectItem>
                        <SelectItem value="faute_grave">
                          Licenciement pour faute grave
                        </SelectItem>
                        <SelectItem value="faute_lourde">
                          Licenciement pour faute lourde
                        </SelectItem>
                        <SelectItem value="inaptitude">
                          Licenciement pour inaptitude
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Le type de licenciement affecte le calcul des indemnités
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Rupture Negotiated Amount - Only for RUPTURE_CONVENTIONNELLE */}
            {departureType === 'RUPTURE_CONVENTIONNELLE' && (
              <FormField
                control={form.control}
                name="ruptureNegotiatedAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant négocié (FCFA) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Ex: 1500000"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Montant de l'indemnité négocié entre l'employeur et l'employé
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Beneficiaries - Only for DECES */}
            {departureType === 'DECES' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <FormLabel>Ayants droit *</FormLabel>
                    <FormDescription>
                      Personnes qui recevront les montants dus au défunt
                    </FormDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addBeneficiary}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter
                  </Button>
                </div>

                {Array.from({ length: beneficiariesCount }).map((_, index) => (
                  <Card key={index} className="bg-muted/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">
                          Ayant droit #{index + 1}
                        </CardTitle>
                        {beneficiariesCount > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBeneficiary(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`beneficiaries.${index}.name` as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nom complet *</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Ex: Marie Kouassi"
                                  className="min-h-[48px]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`beneficiaries.${index}.relationship` as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Lien de parenté *</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="min-h-[48px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="spouse">Conjoint(e)</SelectItem>
                                  <SelectItem value="child">Enfant</SelectItem>
                                  <SelectItem value="parent">Parent</SelectItem>
                                  <SelectItem value="other">Autre</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`beneficiaries.${index}.identityDocument` as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pièce d'identité *</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Ex: CNI N° 123456789"
                                  className="min-h-[48px]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`beneficiaries.${index}.bankAccount` as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Compte bancaire *</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Ex: CI93 1234 5678 9012 3456 7890 12"
                                  className="min-h-[48px]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name={`beneficiaries.${index}.sharePercentage` as any}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Part (%) *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseFloat(e.target.value))
                                }
                                placeholder="Ex: 50"
                                className="min-h-[48px]"
                              />
                            </FormControl>
                            <FormDescription>
                              Part du montant total (doit totaliser 100%)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
