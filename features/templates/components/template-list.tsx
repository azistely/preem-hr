/**
 * Template List Component
 *
 * Displays all payslip templates with create/edit/delete actions
 */

'use client';

import { useState } from 'react';
import { Plus, Edit2, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TemplateEditor } from './template-editor';
import { trpc } from '@/lib/trpc';

export function TemplateList() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: templates, isLoading } = trpc.templates.list.useQuery();
  const utils = trpc.useUtils();
  const deleteMutation = trpc.templates.delete.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
    },
  });

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  if (isCreating || selectedTemplateId) {
    return (
      <TemplateEditor
        templateId={selectedTemplateId}
        onClose={() => {
          setIsCreating(false);
          setSelectedTemplateId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Vos modèles</h3>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau modèle
        </Button>
      </div>

      {templates && templates.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              Aucun modèle personnalisé. Utilisez le modèle standard ou créez le vôtre.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates?.map((template: {
            id: string;
            templateName: string;
            isDefault: boolean | null;
            layoutType: string | null;
            logoUrl?: string | null;
            primaryColor?: string | null;
            showEmployerContributions?: boolean | null;
            showYearToDate?: boolean | null;
            showLeaveBalance?: boolean | null;
          }) => (
            <Card key={template.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {template.templateName}
                      {template.isDefault && (
                        <Badge variant="default" className="gap-1">
                          <Star className="h-3 w-3" />
                          Par défaut
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {template.layoutType === 'STANDARD' && 'Mise en page standard'}
                      {template.layoutType === 'COMPACT' && 'Mise en page compacte'}
                      {template.layoutType === 'DETAILED' && 'Mise en page détaillée'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    {!template.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Supprimer ce modèle ?')) {
                            deleteMutation.mutate({ id: template.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {template.logoUrl && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Logo:</span>
                      <img
                        src={template.logoUrl}
                        alt="Logo"
                        className="h-8 object-contain"
                      />
                    </div>
                  )}
                  {template.primaryColor && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Couleur:</span>
                      <div
                        className="h-6 w-6 rounded border"
                        style={{ backgroundColor: template.primaryColor }}
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {template.showEmployerContributions && (
                      <Badge variant="outline">Cotisations patronales</Badge>
                    )}
                    {template.showYearToDate && (
                      <Badge variant="outline">Cumul annuel</Badge>
                    )}
                    {template.showLeaveBalance && (
                      <Badge variant="outline">Solde de congés</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
