/**
 * Training Request Wizard
 *
 * Multi-step form for employees to request training.
 * - Step 1: Select course type (catalog or custom)
 * - Step 2: Provide justification
 * - Step 3: Set preferences (dates, urgency)
 * - Step 4: Review and submit
 */

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  FileText,
  Calendar,
  AlertCircle,
  Check,
  Clock,
  Send,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

// Step configuration
const STEPS = [
  { id: 1, title: 'Type de formation', icon: BookOpen },
  { id: 2, title: 'Justification', icon: FileText },
  { id: 3, title: 'Préférences', icon: Calendar },
  { id: 4, title: 'Confirmation', icon: Check },
];

// Urgency options
const URGENCY_OPTIONS = [
  { value: 'low', label: 'Faible', description: 'Dans les 6 prochains mois' },
  { value: 'normal', label: 'Normal', description: 'Dans les 3 prochains mois' },
  { value: 'high', label: 'Élevé', description: 'Dans le prochain mois' },
  { value: 'urgent', label: 'Urgent', description: 'Dès que possible' },
] as const;

const urgencyColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  high: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

type CourseType = 'catalog' | 'custom';

export default function NewTrainingRequestPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [courseType, setCourseType] = useState<CourseType>('catalog');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [customCourseName, setCustomCourseName] = useState('');
  const [customCourseDescription, setCustomCourseDescription] = useState('');
  const [justification, setJustification] = useState('');
  const [preferredStartDate, setPreferredStartDate] = useState('');
  const [preferredEndDate, setPreferredEndDate] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [courseSearch, setCourseSearch] = useState('');

  // Fetch courses for catalog selection
  const { data: coursesData, isLoading: coursesLoading } = api.training.courses.list.useQuery({
    isActive: true,
    search: courseSearch || undefined,
    limit: 20,
  });

  // Create request mutation
  const createRequest = api.training.requests.create.useMutation({
    onSuccess: () => {
      toast.success('Demande de formation soumise avec succès');
      router.push('/training/requests');
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la soumission');
    },
  });

  const courses = coursesData?.data ?? [];

  // Get selected course details
  const selectedCourse = useMemo(() => {
    if (!selectedCourseId) return null;
    return courses.find((c) => c.id === selectedCourseId);
  }, [selectedCourseId, courses]);

  // Validation
  const canGoToStep2 =
    (courseType === 'catalog' && selectedCourseId) ||
    (courseType === 'custom' && customCourseName.trim().length > 0);

  const canGoToStep3 = justification.trim().length >= 10;

  const canGoToStep4 = true; // Preferences are optional

  const canSubmit =
    canGoToStep2 &&
    canGoToStep3 &&
    canGoToStep4;

  // Navigation
  const goToNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Submit handler
  const handleSubmit = () => {
    createRequest.mutate({
      courseId: courseType === 'catalog' ? selectedCourseId : undefined,
      customCourseName: courseType === 'custom' ? customCourseName : undefined,
      customCourseDescription: courseType === 'custom' ? customCourseDescription : undefined,
      justification,
      requestOrigin: 'self',
      preferredStartDate: preferredStartDate || undefined,
      preferredEndDate: preferredEndDate || undefined,
      urgency,
    });
  };

  return (
    <div className="container max-w-3xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/training/requests')}
          className="-ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux demandes
        </Button>

        <div>
          <h1 className="text-2xl font-bold">Nouvelle demande de formation</h1>
          <p className="text-muted-foreground mt-1">
            Complétez les étapes ci-dessous pour soumettre votre demande
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline text-sm font-medium">
                  {step.title}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-2 ${
                    isCompleted ? 'bg-green-500' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
          <CardDescription>
            {currentStep === 1 && 'Choisissez une formation du catalogue ou décrivez une formation personnalisée'}
            {currentStep === 2 && 'Expliquez pourquoi cette formation est nécessaire'}
            {currentStep === 3 && 'Indiquez vos préférences de dates et d\'urgence'}
            {currentStep === 4 && 'Vérifiez les informations et soumettez votre demande'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Course Type */}
          {currentStep === 1 && (
            <>
              <RadioGroup
                value={courseType}
                onValueChange={(value) => setCourseType(value as CourseType)}
                className="space-y-3"
              >
                <div
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    courseType === 'catalog'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/50'
                  }`}
                  onClick={() => setCourseType('catalog')}
                >
                  <RadioGroupItem value="catalog" id="catalog" />
                  <Label htmlFor="catalog" className="flex-1 cursor-pointer">
                    <div className="font-medium">Catalogue de formations</div>
                    <div className="text-sm text-muted-foreground">
                      Choisissez parmi les formations disponibles
                    </div>
                  </Label>
                </div>

                <div
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    courseType === 'custom'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/50'
                  }`}
                  onClick={() => setCourseType('custom')}
                >
                  <RadioGroupItem value="custom" id="custom" />
                  <Label htmlFor="custom" className="flex-1 cursor-pointer">
                    <div className="font-medium">Formation personnalisée</div>
                    <div className="text-sm text-muted-foreground">
                      Décrivez une formation qui n'est pas dans le catalogue
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              {/* Catalog Selection */}
              {courseType === 'catalog' && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher une formation..."
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      className="pl-10 min-h-[48px]"
                    />
                  </div>

                  {coursesLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : courses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Aucune formation trouvée</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {courses.map((course) => (
                        <div
                          key={course.id}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                            selectedCourseId === course.id
                              ? 'border-primary bg-primary/5'
                              : 'border-muted hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedCourseId(course.id)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="font-medium">{course.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {course.code} • {course.durationHours}h
                                {course.isMandatory && (
                                  <Badge variant="outline" className="ml-2">
                                    Obligatoire
                                  </Badge>
                                )}
                              </div>
                              {course.shortDescription && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {course.shortDescription}
                                </p>
                              )}
                            </div>
                            {selectedCourseId === course.id && (
                              <Check className="h-5 w-5 text-primary flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Custom Course */}
              {courseType === 'custom' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customName">
                      Nom de la formation <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="customName"
                      placeholder="Ex: Formation Excel avancé"
                      value={customCourseName}
                      onChange={(e) => setCustomCourseName(e.target.value)}
                      className="min-h-[48px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customDescription">Description (optionnel)</Label>
                    <Textarea
                      id="customDescription"
                      placeholder="Décrivez le contenu souhaité de la formation..."
                      value={customCourseDescription}
                      onChange={(e) => setCustomCourseDescription(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 2: Justification */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="justification">
                  Pourquoi cette formation est-elle nécessaire?{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="justification"
                  placeholder="Expliquez comment cette formation vous aidera dans votre travail..."
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="min-h-[150px]"
                />
                <p className="text-sm text-muted-foreground">
                  Minimum 10 caractères • {justification.length} caractères
                </p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                  Conseils pour une bonne justification
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Décrivez les compétences que vous souhaitez acquérir</li>
                  <li>• Expliquez comment cela améliore votre travail quotidien</li>
                  <li>• Mentionnez les objectifs professionnels concernés</li>
                  <li>• Indiquez si c'est lié à une nouvelle responsabilité</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 3: Preferences */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Niveau d'urgence</Label>
                <RadioGroup
                  value={urgency}
                  onValueChange={(value) =>
                    setUrgency(value as 'low' | 'normal' | 'high' | 'urgent')
                  }
                  className="grid grid-cols-2 gap-3"
                >
                  {URGENCY_OPTIONS.map((option) => (
                    <div
                      key={option.value}
                      className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        urgency === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                      }`}
                      onClick={() => setUrgency(option.value)}
                    >
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="cursor-pointer">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Date de début souhaitée</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={preferredStartDate}
                    onChange={(e) => setPreferredStartDate(e.target.value)}
                    className="min-h-[48px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">Date de fin souhaitée</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={preferredEndDate}
                    onChange={(e) => setPreferredEndDate(e.target.value)}
                    min={preferredStartDate}
                    className="min-h-[48px]"
                  />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Les dates sont indicatives. Les RH vous proposeront des sessions
                disponibles après approbation.
              </p>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="space-y-4">
                {/* Course Info */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">
                    FORMATION
                  </h4>
                  <p className="text-lg font-medium">
                    {courseType === 'catalog'
                      ? selectedCourse?.name
                      : customCourseName}
                  </p>
                  {courseType === 'catalog' && selectedCourse && (
                    <p className="text-sm text-muted-foreground">
                      {selectedCourse.code} • {selectedCourse.durationHours}h
                    </p>
                  )}
                  {courseType === 'custom' && customCourseDescription && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {customCourseDescription}
                    </p>
                  )}
                </div>

                {/* Justification */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">
                    JUSTIFICATION
                  </h4>
                  <p className="text-sm">{justification}</p>
                </div>

                {/* Preferences */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">
                    PRÉFÉRENCES
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    <Badge className={urgencyColors[urgency]}>
                      <Clock className="h-3 w-3 mr-1" />
                      Urgence: {URGENCY_OPTIONS.find((o) => o.value === urgency)?.label}
                    </Badge>
                    {preferredStartDate && (
                      <Badge variant="outline">
                        <Calendar className="h-3 w-3 mr-1" />
                        À partir du{' '}
                        {format(new Date(preferredStartDate), 'dd MMM yyyy', {
                          locale: fr,
                        })}
                      </Badge>
                    )}
                    {preferredEndDate && (
                      <Badge variant="outline">
                        <Calendar className="h-3 w-3 mr-1" />
                        Jusqu'au{' '}
                        {format(new Date(preferredEndDate), 'dd MMM yyyy', {
                          locale: fr,
                        })}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Après soumission, votre demande sera examinée par votre manager
                  puis par les RH. Vous serez notifié(e) de chaque étape.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={goToPreviousStep}
          disabled={currentStep === 1}
          className="min-h-[48px]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Précédent
        </Button>

        {currentStep < 4 ? (
          <Button
            onClick={goToNextStep}
            disabled={
              (currentStep === 1 && !canGoToStep2) ||
              (currentStep === 2 && !canGoToStep3) ||
              (currentStep === 3 && !canGoToStep4)
            }
            className="min-h-[48px]"
          >
            Suivant
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || createRequest.isPending}
            className="min-h-[48px]"
          >
            {createRequest.isPending ? (
              'Soumission...'
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Soumettre la demande
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
