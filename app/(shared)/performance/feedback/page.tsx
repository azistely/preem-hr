/**
 * Continuous Feedback Page
 *
 * Give and receive feedback between colleagues.
 * - Recognition wall (public kudos)
 * - Constructive feedback
 * - Coaching notes
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus,
  MessageSquare,
  Award,
  Lightbulb,
  Heart,
  User,
  Lock,
  EyeOff,
  ThumbsUp,
  Sparkles,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';

// Feedback type styling
const feedbackTypeColors: Record<string, string> = {
  recognition: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  constructive: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  coaching: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const feedbackTypeLabels: Record<string, string> = {
  recognition: 'Reconnaissance',
  constructive: 'Constructif',
  coaching: 'Coaching',
};

const feedbackTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  recognition: Sparkles,
  constructive: Lightbulb,
  coaching: Heart,
};

// Feedback card component
function FeedbackCard({
  feedback,
}: {
  feedback: {
    id: string;
    title: string | null;
    content: string;
    feedbackType: string;
    isPrivate: boolean;
    isAnonymous: boolean;
    tags: string[] | null;
    createdAt: Date;
    employee?: { id: string; firstName: string; lastName: string } | null;
  };
}) {
  const FeedbackIcon = feedbackTypeIcons[feedback.feedbackType] || MessageSquare;

  return (
    <Card className="hover:bg-muted/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-full ${feedbackTypeColors[feedback.feedbackType]}`}>
            <FeedbackIcon className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                {feedback.title && (
                  <h3 className="font-medium mb-1">{feedback.title}</h3>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>
                    {feedback.employee?.firstName} {feedback.employee?.lastName}
                  </span>
                  <span>•</span>
                  <span>
                    {formatDistanceToNow(new Date(feedback.createdAt), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </span>
                </div>
              </div>

              <div className="flex gap-1 flex-shrink-0">
                <Badge className={feedbackTypeColors[feedback.feedbackType]}>
                  {feedbackTypeLabels[feedback.feedbackType]}
                </Badge>
                {feedback.isPrivate && (
                  <Badge variant="secondary">
                    <Lock className="h-3 w-3 mr-1" />
                    Privé
                  </Badge>
                )}
                {feedback.isAnonymous && (
                  <Badge variant="secondary">
                    <EyeOff className="h-3 w-3 mr-1" />
                    Anonyme
                  </Badge>
                )}
              </div>
            </div>

            <p className="text-sm whitespace-pre-wrap mb-3">{feedback.content}</p>

            {feedback.tags && feedback.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {feedback.tags.map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FeedbackPage() {
  const [selectedTab, setSelectedTab] = useState<'all' | 'recognition' | 'constructive' | 'coaching'>(
    'all'
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    employeeId: '',
    feedbackType: 'recognition' as 'recognition' | 'constructive' | 'coaching',
    title: '',
    content: '',
    isPrivate: false,
    isAnonymous: false,
    tags: '',
  });

  const utils = api.useUtils();

  // Fetch feedback
  const { data: feedbackData, isLoading } = api.performance.feedback.list.useQuery({
    feedbackType:
      selectedTab !== 'all'
        ? (selectedTab as 'recognition' | 'constructive' | 'coaching')
        : undefined,
    limit: 50,
  });

  // Fetch employees for dropdown
  const { data: employeesData } = api.employees.list.useQuery({
    status: 'active',
    limit: 100,
  });

  // Create mutation
  const createFeedback = api.performance.feedback.create.useMutation({
    onSuccess: () => {
      toast.success('Feedback envoyé avec succès');
      setShowCreateDialog(false);
      resetForm();
      utils.performance.feedback.list.invalidate();
      utils.performance.getGuideStatus.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'envoi');
    },
  });

  const feedbackList = feedbackData?.data ?? [];
  const employees = employeesData?.employees ?? [];

  // Stats
  const recognitionCount = feedbackList.filter((f) => f.feedbackType === 'recognition').length;
  const constructiveCount = feedbackList.filter((f) => f.feedbackType === 'constructive').length;
  const coachingCount = feedbackList.filter((f) => f.feedbackType === 'coaching').length;

  const resetForm = () => {
    setFormData({
      employeeId: '',
      feedbackType: 'recognition',
      title: '',
      content: '',
      isPrivate: false,
      isAnonymous: false,
      tags: '',
    });
  };

  const handleCreate = () => {
    if (!formData.employeeId || !formData.content.trim()) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    createFeedback.mutate({
      employeeId: formData.employeeId,
      feedbackType: formData.feedbackType,
      title: formData.title || undefined,
      content: formData.content,
      isPrivate: formData.isPrivate,
      isAnonymous: formData.isAnonymous,
      tags: formData.tags ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Feedback continu</h1>
          <p className="text-muted-foreground mt-1">
            Reconnaissance et feedback entre collègues
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="min-h-[48px]">
          <Plus className="mr-2 h-4 w-4" />
          Donner du feedback
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <Sparkles className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reconnaissance</p>
                <p className="text-2xl font-bold">{recognitionCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Lightbulb className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Constructif</p>
                <p className="text-2xl font-bold">{constructiveCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Heart className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Coaching</p>
                <p className="text-2xl font-bold">{coachingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as typeof selectedTab)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all" className="min-h-[44px]">
            <MessageSquare className="mr-2 h-4 w-4" />
            Tous
          </TabsTrigger>
          <TabsTrigger value="recognition" className="min-h-[44px]">
            <Sparkles className="mr-2 h-4 w-4" />
            Reconnaissance
          </TabsTrigger>
          <TabsTrigger value="constructive" className="min-h-[44px]">
            <Lightbulb className="mr-2 h-4 w-4" />
            Constructif
          </TabsTrigger>
          <TabsTrigger value="coaching" className="min-h-[44px]">
            <Heart className="mr-2 h-4 w-4" />
            Coaching
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : feedbackList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun feedback</h3>
                <p className="text-muted-foreground mb-6">
                  Soyez le premier à donner du feedback
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Donner du feedback
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {feedbackList.map((feedback) => (
                <FeedbackCard key={feedback.id} feedback={feedback} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Donner du feedback</DialogTitle>
            <DialogDescription>
              Envoyez une reconnaissance ou un feedback constructif
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="employeeId">
                Destinataire <span className="text-destructive">*</span>
              </Label>
              <select
                id="employeeId"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                className="w-full min-h-[48px] px-3 rounded-md border border-input bg-background"
              >
                <option value="">Sélectionner un collègue</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Type de feedback</Label>
              <Select
                value={formData.feedbackType}
                onValueChange={(v) =>
                  setFormData({ ...formData, feedbackType: v as typeof formData.feedbackType })
                }
              >
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recognition">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-green-600" />
                      Reconnaissance
                    </div>
                  </SelectItem>
                  <SelectItem value="constructive">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-blue-600" />
                      Constructif
                    </div>
                  </SelectItem>
                  <SelectItem value="coaching">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-purple-600" />
                      Coaching
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Titre (optionnel)</Label>
              <Input
                id="title"
                placeholder="Ex: Super travail sur le projet X"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="min-h-[48px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">
                Message <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="content"
                placeholder="Décrivez votre feedback..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (séparés par des virgules)</Label>
              <Input
                id="tags"
                placeholder="teamwork, leadership, innovation"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="min-h-[48px]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={formData.isPrivate}
                  onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="isPrivate" className="text-sm font-normal">
                  <Lock className="h-3 w-3 inline mr-1" />
                  Feedback privé (visible uniquement par le destinataire)
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isAnonymous"
                  checked={formData.isAnonymous}
                  onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="isAnonymous" className="text-sm font-normal">
                  <EyeOff className="h-3 w-3 inline mr-1" />
                  Envoyer de façon anonyme
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}
              className="min-h-[48px]"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createFeedback.isPending}
              className="min-h-[48px]"
            >
              <Send className="mr-2 h-4 w-4" />
              {createFeedback.isPending ? 'Envoi...' : 'Envoyer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
