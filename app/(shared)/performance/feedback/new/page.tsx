/**
 * New Feedback Page
 *
 * Dedicated page for giving feedback to a colleague.
 * HCI-compliant wizard-style form for low digital literacy users.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Sparkles,
  Lightbulb,
  Heart,
  Send,
  User,
  Lock,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';

// Feedback type options
const feedbackTypes = [
  {
    value: 'recognition',
    label: 'Reconnaissance',
    description: 'Féliciter un collègue pour son excellent travail',
    icon: Sparkles,
    color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  {
    value: 'constructive',
    label: 'Constructif',
    description: 'Suggérer des pistes d\'amélioration',
    icon: Lightbulb,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  {
    value: 'coaching',
    label: 'Coaching',
    description: 'Accompagner et guider un collègue',
    icon: Heart,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
];

export default function NewFeedbackPage() {
  const router = useRouter();
  const utils = api.useUtils();

  // Form state
  const [employeeId, setEmployeeId] = useState('');
  const [feedbackType, setFeedbackType] = useState<'recognition' | 'constructive' | 'coaching'>('recognition');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [tags, setTags] = useState('');

  // Fetch employees
  const { data: employeesData, isLoading: employeesLoading } = api.employees.list.useQuery({
    status: 'active',
    limit: 100,
  });

  // Create mutation
  const createFeedback = api.performance.feedback.create.useMutation({
    onSuccess: () => {
      toast.success('Feedback envoyé avec succès !');
      utils.performance.getGuideStatus.invalidate();
      router.push('/performance/feedback');
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'envoi du feedback');
    },
  });

  const employees = employeesData?.employees ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!employeeId) {
      toast.error('Veuillez sélectionner un collaborateur');
      return;
    }

    if (!content.trim()) {
      toast.error('Veuillez écrire votre feedback');
      return;
    }

    createFeedback.mutate({
      employeeId,
      feedbackType,
      title: title || undefined,
      content: content.trim(),
      isPrivate,
      isAnonymous,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    });
  };

  const selectedType = feedbackTypes.find((t) => t.value === feedbackType);
  const TypeIcon = selectedType?.icon || Sparkles;

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/performance/feedback"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux feedbacks
        </Link>
        <h1 className="text-3xl font-bold">Donner du feedback</h1>
        <p className="text-muted-foreground mt-1">
          Reconnaissance, feedback constructif ou coaching
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Select Employee */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              À qui souhaitez-vous envoyer ce feedback ?
            </CardTitle>
            <CardDescription>
              Sélectionnez le collaborateur concerné
            </CardDescription>
          </CardHeader>
          <CardContent>
            {employeesLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder="Choisir un collaborateur..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                      {emp.jobTitle && (
                        <span className="text-muted-foreground ml-2">
                          — {emp.jobTitle}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Select Type */}
        <Card>
          <CardHeader>
            <CardTitle>Quel type de feedback ?</CardTitle>
            <CardDescription>
              Choisissez le type qui correspond le mieux à votre message
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {feedbackTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = feedbackType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFeedbackType(type.value as typeof feedbackType)}
                    className={`flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all min-h-[72px] ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-primary/50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${type.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{type.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {type.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Content */}
        <Card>
          <CardHeader>
            <div className={`inline-flex items-center gap-2 p-2 rounded-lg ${selectedType?.color} w-fit mb-2`}>
              <TypeIcon className="h-4 w-4" />
              <span className="text-sm font-medium">{selectedType?.label}</span>
            </div>
            <CardTitle>Votre message</CardTitle>
            <CardDescription>
              Soyez spécifique et donnez des exemples concrets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre (optionnel)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Excellent travail sur le projet X"
                className="min-h-[48px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Message *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Décrivez en détail votre feedback..."
                rows={5}
                className="min-h-[120px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (optionnel)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="leadership, collaboration, innovation (séparés par des virgules)"
                className="min-h-[48px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Step 4: Options */}
        <Card>
          <CardHeader>
            <CardTitle>Options</CardTitle>
            <CardDescription>
              Configurez la visibilité de votre feedback
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Feedback privé</p>
                  <p className="text-sm text-muted-foreground">
                    Visible uniquement par le destinataire et son manager
                  </p>
                </div>
              </div>
              <Switch
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <EyeOff className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Feedback anonyme</p>
                  <p className="text-sm text-muted-foreground">
                    Votre nom ne sera pas affiché
                  </p>
                </div>
              </div>
              <Switch
                checked={isAnonymous}
                onCheckedChange={setIsAnonymous}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/performance/feedback')}
            className="min-h-[48px]"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={createFeedback.isPending || !employeeId || !content.trim()}
            className="min-h-[48px] min-w-[150px]"
          >
            {createFeedback.isPending ? (
              'Envoi en cours...'
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Envoyer
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
