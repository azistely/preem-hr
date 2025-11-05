/**
 * Template Create/Edit Dialog
 *
 * HCI Principles Applied:
 * - Zero Learning Curve: Simple form with visual preview
 * - Smart Defaults: Common shift times pre-filled
 * - Error Prevention: Validation, calculated fields auto-update
 * - Immediate Feedback: Live preview of paid hours
 * - Progressive Disclosure: Advanced options in collapsible
 * - Task-Oriented: "Créer un modèle" not "Insert template record"
 *
 * Features:
 * - Create/edit shift templates
 * - Auto-calculate duration and paid hours
 * - Color picker for visual identification
 * - Overtime multiplier support
 * - Mobile-optimized with large touch targets
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Clock,
  Palette,
  ChevronDown,
  Loader2,
  Coffee,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import type { ShiftTemplate } from '@/lib/db/schema/shift-planning';

// ============================================
// Types & Schema
// ============================================

const templateFormSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  code: z.string().min(1, 'Code requis').max(20, 'Code trop long (max 20)'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Heure invalide (HH:MM)'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Heure invalide (HH:MM)'),
  breakMinutes: z.number().int().min(0).default(0),
  shiftType: z.enum(['regular', 'night', 'weekend', 'holiday']),
  color: z.string().optional(),
  description: z.string().optional(),
  overtimeMultiplier: z.string().optional(),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

export type TemplateCreateEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  template?: ShiftTemplate | null; // If editing
};

// Common shift colors
const SHIFT_COLORS = [
  { value: '#3b82f6', label: 'Bleu' },
  { value: '#10b981', label: 'Vert' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#ef4444', label: 'Rouge' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#ec4899', label: 'Rose' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#84cc16', label: 'Lime' },
];

// ============================================
// Component
// ============================================

export function TemplateCreateEditDialog({
  open,
  onOpenChange,
  onSuccess,
  template,
}: TemplateCreateEditDialogProps) {
  const isEditMode = !!template;
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Create/Update mutations
  const createMutation = trpc.shiftPlanning.createTemplate.useMutation({
    onSuccess: () => {
      toast.success('Modèle créé avec succès!');
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updateMutation = trpc.shiftPlanning.updateTemplate.useMutation({
    onSuccess: () => {
      toast.success('Modèle modifié avec succès!');
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Form
  const form = useForm({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: '',
      code: '',
      startTime: '08:00',
      endTime: '17:00',
      breakMinutes: 60,
      shiftType: 'regular' as const,
      color: SHIFT_COLORS[0].value,
      description: '',
      overtimeMultiplier: '',
    },
  });

  // Load existing template data for editing
  useEffect(() => {
    if (template && isEditMode) {
      form.reset({
        name: template.name,
        code: template.code || '',
        startTime: template.startTime.slice(0, 5), // HH:MM
        endTime: template.endTime.slice(0, 5),
        breakMinutes: template.breakMinutes || 0,
        shiftType: template.shiftType as any,
        color: template.color || SHIFT_COLORS[0].value,
        description: template.description || '',
        overtimeMultiplier: template.overtimeMultiplier || '',
      });
    } else if (!template && !isEditMode) {
      // Reset to defaults when opening for create
      form.reset({
        name: '',
        code: '',
        startTime: '08:00',
        endTime: '17:00',
        breakMinutes: 60,
        shiftType: 'regular',
        color: SHIFT_COLORS[0].value,
        description: '',
        overtimeMultiplier: '',
      });
    }
  }, [template, isEditMode, form, open]);

  // Calculate duration and paid hours
  const { durationHours, paidHours } = useMemo(() => {
    const startTime = form.watch('startTime');
    const endTime = form.watch('endTime');
    const breakMinutes = form.watch('breakMinutes') || 0;

    if (!startTime || !endTime) return { durationHours: 0, paidHours: 0 };

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    let totalMinutes = endMinutes - startMinutes;
    if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight shifts

    const paidMinutes = Math.max(0, totalMinutes - breakMinutes);

    return {
      durationHours: (totalMinutes / 60).toFixed(2),
      paidHours: (paidMinutes / 60).toFixed(2),
    };
  }, [form.watch('startTime'), form.watch('endTime'), form.watch('breakMinutes')]);

  // Submit handler
  const onSubmit = async (data: TemplateFormValues) => {
    const payload = {
      ...data,
      startTime: `${data.startTime}:00`,
      endTime: `${data.endTime}:00`,
      // Convert empty strings to undefined for optional fields
      overtimeMultiplier: data.overtimeMultiplier?.trim() || undefined,
      description: data.description?.trim() || undefined,
    };

    if (isEditMode && template) {
      await updateMutation.mutateAsync({
        id: template.id,
        data: payload,
      });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {isEditMode ? 'Modifier le Modèle' : 'Créer un Nouveau Modèle'}
          </DialogTitle>
          <DialogDescription>
            Les modèles permettent de créer rapidement des quarts avec des horaires prédéfinis
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg">Nom du Modèle</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Quart de Jour"
                        className="min-h-[48px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg">Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="DAY"
                        className="min-h-[48px] font-mono uppercase"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormDescription>Code court (ex: DAY, NIGHT, WE)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Shift Type & Color */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="shiftType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg">Type de Quart</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[48px]">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="regular">Régulier</SelectItem>
                        <SelectItem value="night">Nuit</SelectItem>
                        <SelectItem value="weekend">Weekend</SelectItem>
                        <SelectItem value="holiday">Jour Férié</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      Couleur
                    </FormLabel>
                    <div className="grid grid-cols-4 gap-2">
                      {SHIFT_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => field.onChange(color.value)}
                          className={cn(
                            'h-12 rounded-md border-2 transition-all',
                            field.value === color.value
                              ? 'border-foreground scale-110'
                              : 'border-transparent hover:scale-105'
                          )}
                          style={{ backgroundColor: color.value }}
                          title={color.label}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Time Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Configuration Horaire
              </h3>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Heure de début</FormLabel>
                      <FormControl>
                        <Input type="time" className="min-h-[48px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Heure de fin</FormLabel>
                      <FormControl>
                        <Input type="time" className="min-h-[48px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="breakMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Coffee className="h-4 w-4" />
                        Pause (min)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="15"
                          className="min-h-[48px]"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Duration Preview */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-muted/50 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Durée totale:</span>
                    <span className="text-xl font-bold">{durationHours}h</span>
                  </div>
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Heures payées:</span>
                    <span className="text-xl font-bold text-primary">{paidHours}h</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Options (Progressive Disclosure) */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    showAdvanced && 'transform rotate-180'
                  )}
                />
                Options avancées
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 space-y-4">
                <FormField
                  control={form.control}
                  name="overtimeMultiplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Multiplicateur Heures Sup (optionnel)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="1"
                          max="3"
                          placeholder="1.5"
                          className="min-h-[48px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Exemple: 1.5 pour +50%, 2.0 pour +100%
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Description du quart, consignes particulières..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleContent>
            </Collapsible>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSaving} className="min-h-[44px]">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? 'Modification...' : 'Création...'}
                  </>
                ) : (
                  <>{isEditMode ? 'Modifier le Modèle' : 'Créer le Modèle'}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
