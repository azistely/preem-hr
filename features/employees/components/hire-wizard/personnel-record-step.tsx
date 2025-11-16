/**
 * Personnel Record Step - Hire Wizard
 *
 * Legal fields required for Personnel Registry (Registre du Personnel) in Côte d'Ivoire
 */

import { UseFormReturn } from 'react-hook-form';
import {
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

interface PersonnelRecordStepProps {
  form: UseFormReturn<any>;
}

export function PersonnelRecordStep({ form }: PersonnelRecordStepProps) {
  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Ces informations sont requises pour le registre du personnel et les documents officiels en Côte d'Ivoire.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="nationalityZone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zone de nationalité *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="LOCAL">Local (Côte d'Ivoire)</SelectItem>
                  <SelectItem value="CEDEAO">CEDEAO (Afrique de l'Ouest)</SelectItem>
                  <SelectItem value="HORS_CEDEAO">Hors CEDEAO</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Classification géographique pour les statistiques
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="employeeType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type d'employé *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="LOCAL">Local</SelectItem>
                  <SelectItem value="EXPAT">Expatrié (ITS 10,4%)</SelectItem>
                  <SelectItem value="DETACHE">Détaché</SelectItem>
                  <SelectItem value="STAGIAIRE">Stagiaire</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Utilisé pour le calcul des cotisations fiscales
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="placeOfBirth"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Lieu de naissance (optionnel)</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="Ex: Abidjan, Côte d'Ivoire"
                className="min-h-[48px]"
              />
            </FormControl>
            <FormDescription>
              Requis pour certains documents officiels
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="fatherName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom du père (optionnel)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Nom complet du père"
                  className="min-h-[48px]"
                />
              </FormControl>
              <FormDescription>
                Requis pour le registre du personnel
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="motherName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom de la mère (optionnel)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Nom complet de la mère"
                  className="min-h-[48px]"
                />
              </FormControl>
              <FormDescription>
                Requis pour le registre du personnel
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="emergencyContactName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Personne à contacter en cas d'urgence (optionnel)</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="Nom complet et lien de parenté"
                className="min-h-[48px]"
              />
            </FormControl>
            <FormDescription>
              Personne à joindre en cas d'accident ou d'urgence médicale
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
