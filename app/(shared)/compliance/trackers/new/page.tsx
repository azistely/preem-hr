/**
 * New Tracker Wizard Page
 *
 * 4-step wizard for creating new compliance trackers:
 * 1. Choose tracker type
 * 2. Fill in information (dynamic form)
 * 3. Assignment (assignee, due date, priority)
 * 4. Confirmation
 *
 * HR Manager + Admin only access
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  AlertTriangle,
  Briefcase,
  Award,
  Gavel,
  Calendar as CalendarIcon,
  User,
  Flag,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { TrackerForm } from '@/components/compliance/tracker-form';
import { cn } from '@/lib/utils';

// Map tracker type slugs to icons
const trackerTypeIcons: Record<string, React.ReactNode> = {
  accidents: <AlertTriangle className="h-8 w-8" />,
  visites: <Briefcase className="h-8 w-8" />,
  certifications: <Award className="h-8 w-8" />,
  disciplinaire: <Gavel className="h-8 w-8" />,
};

const trackerTypeColors: Record<string, string> = {
  accidents: 'border-red-200 hover:border-red-400 hover:bg-red-50',
  visites: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50',
  certifications: 'border-amber-200 hover:border-amber-400 hover:bg-amber-50',
  disciplinaire: 'border-purple-200 hover:border-purple-400 hover:bg-purple-50',
};

const priorityOptions = [
  { value: 'low', label: 'Basse', color: 'bg-slate-100 text-slate-800' },
  { value: 'medium', label: 'Moyenne', color: 'bg-blue-100 text-blue-800' },
  { value: 'high', label: 'Haute', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critique', color: 'bg-red-100 text-red-800' },
];

type WizardStep = 'type' | 'information' | 'assignment' | 'confirmation';

interface TrackerTypeDefinition {
  fields: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
    helpText?: string;
    section?: string;
    readOnly?: boolean;
    computed?: {
      type: 'add_hours' | 'add_business_days';
      sourceField: string;
      value: number;
    };
  }>;
  sections?: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

export default function NewTrackerWizardPage() {
  const router = useRouter();
  const utils = api.useUtils();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('type');
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | undefined>(addDays(new Date(), 14));
  const [priority, setPriority] = useState('medium');

  // Fetch tracker types
  const { data: trackerTypes, isLoading: typesLoading } = api.complianceTrackerTypes.list.useQuery();

  // Fetch employees for assignee picker
  const { data: employees } = api.employees.list.useQuery({ status: 'active', limit: 100 });

  // Get selected tracker type
  const selectedType = trackerTypes?.find((t) => t.id === selectedTypeId);

  // Create tracker mutation
  const createTracker = api.complianceTrackers.create.useMutation({
    onSuccess: (data) => {
      toast.success('Dossier créé avec succès');
      // Invalidate cache in background (don't await)
      utils.complianceTrackers.list.invalidate();
      utils.complianceTrackers.getDashboardStats.invalidate();
      // Navigate immediately using window.location for reliability
      window.location.href = `/compliance/trackers/${data.id}`;
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la création du dossier');
    },
  });

  // Step navigation
  const steps: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
    { id: 'type', label: 'Type', icon: <FileText className="h-4 w-4" /> },
    { id: 'information', label: 'Informations', icon: <FileText className="h-4 w-4" /> },
    { id: 'assignment', label: 'Assignation', icon: <User className="h-4 w-4" /> },
    { id: 'confirmation', label: 'Confirmation', icon: <Check className="h-4 w-4" /> },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const canProceed = () => {
    switch (currentStep) {
      case 'type':
        return selectedTypeId !== null;
      case 'information':
        return title.trim().length > 0 && Object.keys(formData).length > 0;
      case 'assignment':
        return true; // Optional
      case 'confirmation':
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const goPrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleFormSubmit = (data: Record<string, unknown>) => {
    setFormData(data);
    goNext();
  };

  const handleCreate = () => {
    if (!selectedTypeId) return;

    createTracker.mutate({
      trackerTypeId: selectedTypeId,
      title,
      data: formData,
      assigneeId: assigneeId || undefined,
      dueDate: dueDate?.toISOString() || undefined,
      priority: priority as 'low' | 'medium' | 'high' | 'critical',
    });
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'type':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Choisir le type de dossier</h2>
              <p className="text-muted-foreground">
                Sélectionnez le type de suivi que vous souhaitez créer
              </p>
            </div>

            {typesLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {trackerTypes?.map((type) => (
                  <Card
                    key={type.id}
                    className={cn(
                      'cursor-pointer transition-all border-2',
                      trackerTypeColors[type.slug] || 'hover:border-primary',
                      selectedTypeId === type.id && 'border-primary ring-2 ring-primary/20'
                    )}
                    onClick={() => setSelectedTypeId(type.id)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-primary/10 text-primary">
                          {trackerTypeIcons[type.slug] || <FileText className="h-8 w-8" />}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{type.name}</h3>
                          {type.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {type.description}
                            </p>
                          )}
                        </div>
                        {selectedTypeId === type.id && (
                          <CheckCircle2 className="h-6 w-6 text-primary" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case 'information':
        if (!selectedType) return null;
        const definition = selectedType.definition as TrackerTypeDefinition;

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Informations du dossier</h2>
              <p className="text-muted-foreground">
                Remplissez les informations relatives à ce {selectedType.name.toLowerCase()}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="after:content-['*'] after:ml-0.5 after:text-destructive">
                  Titre du dossier
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Accident atelier mécanique - 15/01/2025"
                  className="min-h-[48px]"
                />
              </div>

              <TrackerForm
                definition={definition as any}
                initialData={formData}
                onSubmit={handleFormSubmit}
                mode="create"
              />
            </div>
          </div>
        );

      case 'assignment':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Assignation</h2>
              <p className="text-muted-foreground">
                Définissez qui est responsable et quand le dossier doit être traité
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="assignee">Responsable</Label>
                <Select
                  value={assigneeId || 'unassigned'}
                  onValueChange={(v) => setAssigneeId(v === 'unassigned' ? null : v)}
                >
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue placeholder="Sélectionner un responsable..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Non assigné</SelectItem>
                    {employees?.employees?.map((emp: { id: string; firstName: string; lastName: string }) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date d'échéance</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full min-h-[48px] justify-start text-left font-normal',
                        !dueDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate
                        ? format(dueDate, 'dd MMMM yyyy', { locale: fr })
                        : 'Sélectionner une date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      locale={fr}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Priorité</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {priorityOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={priority === option.value ? 'default' : 'outline'}
                      className={cn('min-h-[48px]', priority === option.value && option.color)}
                      onClick={() => setPriority(option.value)}
                    >
                      <Flag className="mr-2 h-4 w-4" />
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'confirmation':
        const selectedEmployee = employees?.employees?.find((e: { id: string; firstName: string; lastName: string }) => e.id === assigneeId);

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Confirmation</h2>
              <p className="text-muted-foreground">
                Vérifiez les informations avant de créer le dossier
              </p>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {trackerTypeIcons[selectedType?.slug || ''] || <FileText className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type de dossier</p>
                    <p className="font-medium">{selectedType?.name}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Titre</p>
                  <p className="font-medium">{title}</p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Responsable</p>
                    <p className="font-medium">
                      {selectedEmployee
                        ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
                        : 'Non assigné'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date d'échéance</p>
                    <p className="font-medium">
                      {dueDate
                        ? format(dueDate, 'dd MMMM yyyy', { locale: fr })
                        : 'Non définie'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Priorité</p>
                    <Badge
                      className={
                        priorityOptions.find((p) => p.value === priority)?.color || ''
                      }
                    >
                      {priorityOptions.find((p) => p.value === priority)?.label}
                    </Badge>
                  </div>
                </div>

                {Object.keys(formData).length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Données du formulaire</p>
                    <div className="text-sm space-y-1">
                      {Object.entries(formData)
                        .filter(([_, v]) => v !== null && v !== undefined && v !== '')
                        .slice(0, 5)
                        .map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground capitalize">
                              {key.replace(/_/g, ' ')}:
                            </span>
                            <span className="font-medium truncate max-w-[200px]">
                              {value instanceof Date
                                ? format(value, 'dd/MM/yyyy', { locale: fr })
                                : String(value)}
                            </span>
                          </div>
                        ))}
                      {Object.keys(formData).length > 5 && (
                        <p className="text-muted-foreground">
                          + {Object.keys(formData).length - 5} autres champs...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto max-w-3xl py-6 px-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/compliance/trackers">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux dossiers
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold">Nouveau dossier</h1>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors',
                  index < currentStepIndex && 'bg-primary border-primary text-primary-foreground',
                  index === currentStepIndex && 'border-primary text-primary',
                  index > currentStepIndex && 'border-muted text-muted-foreground'
                )}
              >
                {index < currentStepIndex ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.icon
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-1 mx-2',
                    index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((step) => (
            <span
              key={step.id}
              className={cn(
                'text-xs font-medium',
                step.id === currentStep ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      {currentStep !== 'information' && (
        <div className="flex flex-col-reverse md:flex-row gap-3 mt-6">
          {currentStepIndex > 0 && (
            <Button
              variant="outline"
              onClick={goPrevious}
              className="min-h-[48px]"
              disabled={createTracker.isPending}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Précédent
            </Button>
          )}

          {currentStep === 'confirmation' ? (
            <Button
              onClick={handleCreate}
              className="min-h-[56px] flex-1"
              disabled={createTracker.isPending}
            >
              {createTracker.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Créer le dossier
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={goNext}
              className="min-h-[56px] flex-1"
              disabled={!canProceed()}
            >
              Suivant
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
