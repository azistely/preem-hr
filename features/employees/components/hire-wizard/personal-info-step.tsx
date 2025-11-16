/**
 * Personal Info Step - Hire Wizard
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
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';

interface PersonalInfoStepProps {
  form: UseFormReturn<any>;
}

export function PersonalInfoStep({ form }: PersonalInfoStepProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prénom *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Jean"
                  className="min-h-[48px]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Kouassi"
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
        name="preferredName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nom préféré (optionnel)</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="Comment l'employé préfère être appelé"
                className="min-h-[48px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (optionnel)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder="jean.kouassi@example.com"
                  className="min-h-[48px]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Téléphone *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="tel"
                  placeholder="+225 01 23 45 67 89"
                  className="min-h-[48px]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Genre *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="male">Homme</SelectItem>
                  <SelectItem value="female">Femme</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="dateOfBirth"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date de naissance *</FormLabel>
              <FormControl>
                <DatePicker
                  value={field.value || null}
                  onChange={field.onChange}
                  placeholder="Sélectionner une date"
                  fromYear={1940}
                  toYear={new Date().getFullYear()}
                  disabled={(date) => date > new Date() || date < new Date('1940-01-01')}
                  allowManualInput={true}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="nationalId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Numéro d'identité national (optionnel)</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="CNI ou passeport"
                className="min-h-[48px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="maritalStatus"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Situation matrimoniale *</FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value || 'single'}
            >
              <FormControl>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="single">Célibataire</SelectItem>
                <SelectItem value="married">Marié(e)</SelectItem>
                <SelectItem value="divorced">Divorcé(e)</SelectItem>
                <SelectItem value="widowed">Veuf/Veuve</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              Utilisé pour les déductions familiales
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
