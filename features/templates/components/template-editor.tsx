/**
 * Template Editor Component (GAP-DOC-002)
 *
 * Form to create/edit payslip templates with live preview
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Upload } from 'lucide-react';
import { TemplatePreview } from './template-preview';
import { trpc } from '@/lib/trpc';

const templateSchema = z.object({
  templateName: z.string().min(1, 'Le nom est requis'),
  layoutType: z.enum(['STANDARD', 'COMPACT', 'DETAILED']).default('STANDARD'),
  logoUrl: z.string().optional(),
  companyNameOverride: z.string().optional(),
  headerText: z.string().optional(),
  footerText: z.string().optional(),
  fontFamily: z.string().default('Helvetica'),
  primaryColor: z.string().default('#000000'),
  showEmployerContributions: z.boolean().default(true),
  showYearToDate: z.boolean().default(true),
  showLeaveBalance: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateEditorProps {
  templateId: string | null;
  onClose: () => void;
}

export function TemplateEditor({ templateId, onClose }: TemplateEditorProps) {
  const [previewData, setPreviewData] = useState<TemplateFormData | null>(null);
  const utils = trpc.useUtils();

  const { data: template } = trpc.templates.get.useQuery(
    { id: templateId! },
    { enabled: !!templateId }
  );

  const createMutation = trpc.templates.create.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      onClose();
    },
  });

  const updateMutation = trpc.templates.update.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      onClose();
    },
  });

  const form = useForm({
    resolver: zodResolver(templateSchema),
    defaultValues: template ? {
      templateName: template.templateName,
      layoutType: (template.layoutType as 'STANDARD' | 'COMPACT' | 'DETAILED') || 'STANDARD',
      logoUrl: template.logoUrl || undefined,
      companyNameOverride: template.companyNameOverride || undefined,
      headerText: template.headerText || undefined,
      footerText: template.footerText || undefined,
      fontFamily: template.fontFamily || 'Helvetica',
      primaryColor: template.primaryColor || '#000000',
      showEmployerContributions: template.showEmployerContributions ?? true,
      showYearToDate: template.showYearToDate ?? true,
      showLeaveBalance: template.showLeaveBalance ?? true,
      isDefault: template.isDefault ?? false,
    } : {
      templateName: '',
      layoutType: 'STANDARD' as const,
      fontFamily: 'Helvetica',
      primaryColor: '#000000',
      showEmployerContributions: true,
      showYearToDate: true,
      showLeaveBalance: true,
      isDefault: false,
    },
  });

  const onSubmit = (data: TemplateFormData) => {
    if (templateId) {
      updateMutation.mutate({ id: templateId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const watchedValues = form.watch();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Editor Form */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {templateId ? 'Modifier le modèle' : 'Nouveau modèle'}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Template Name */}
            <div className="space-y-2">
              <Label htmlFor="templateName">Nom du modèle</Label>
              <Input
                id="templateName"
                {...form.register('templateName')}
                placeholder="Mon modèle personnalisé"
              />
            </div>

            {/* Layout Type */}
            <div className="space-y-2">
              <Label htmlFor="layoutType">Mise en page</Label>
              <Select
                value={form.watch('layoutType')}
                onValueChange={(value) =>
                  form.setValue('layoutType', value as 'STANDARD' | 'COMPACT' | 'DETAILED')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANDARD">Standard</SelectItem>
                  <SelectItem value="COMPACT">Compacte</SelectItem>
                  <SelectItem value="DETAILED">Détaillée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Logo de l'entreprise</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Télécharger
                </Button>
                {form.watch('logoUrl') && (
                  <img
                    src={form.watch('logoUrl')}
                    alt="Logo"
                    className="h-10 object-contain"
                  />
                )}
              </div>
            </div>

            {/* Header/Footer */}
            <div className="space-y-2">
              <Label htmlFor="headerText">Texte d'en-tête</Label>
              <Input
                id="headerText"
                {...form.register('headerText')}
                placeholder="BULLETIN DE PAIE"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="footerText">Texte de pied de page</Label>
              <Textarea
                id="footerText"
                {...form.register('footerText')}
                placeholder="Ce document est confidentiel..."
                rows={3}
              />
            </div>

            {/* Primary Color */}
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Couleur principale</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  {...form.register('primaryColor')}
                  className="w-20 h-10"
                />
                <Input
                  {...form.register('primaryColor')}
                  placeholder="#000000"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Section Toggles */}
            <div className="space-y-4">
              <Label>Sections à afficher</Label>

              <div className="flex items-center justify-between">
                <Label htmlFor="showEmployerContributions" className="font-normal">
                  Cotisations patronales
                </Label>
                <Switch
                  id="showEmployerContributions"
                  checked={form.watch('showEmployerContributions')}
                  onCheckedChange={(checked) =>
                    form.setValue('showEmployerContributions', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="showYearToDate" className="font-normal">
                  Cumul annuel
                </Label>
                <Switch
                  id="showYearToDate"
                  checked={form.watch('showYearToDate')}
                  onCheckedChange={(checked) =>
                    form.setValue('showYearToDate', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="showLeaveBalance" className="font-normal">
                  Solde de congés
                </Label>
                <Switch
                  id="showLeaveBalance"
                  checked={form.watch('showLeaveBalance')}
                  onCheckedChange={(checked) =>
                    form.setValue('showLeaveBalance', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="isDefault" className="font-normal">
                  Modèle par défaut
                </Label>
                <Switch
                  id="isDefault"
                  checked={form.watch('isDefault')}
                  onCheckedChange={(checked) =>
                    form.setValue('isDefault', checked)
                  }
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                {templateId ? 'Enregistrer' : 'Créer'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Annuler
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Aperçu</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplatePreview template={watchedValues} />
        </CardContent>
      </Card>
    </div>
  );
}
