/**
 * Training Evaluation Form Component
 *
 * Kirkpatrick 4-Level Evaluation form for training sessions.
 * - Level 1: Reaction - Immediate satisfaction survey
 * - Level 2: Learning - Knowledge assessment
 * - Level 3: Behavior - Post-training application (30-90 days)
 * - Level 4: Results - Business impact (3-6 months)
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  Send,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Smile,
  BookOpen,
  Briefcase,
  BarChart3,
} from 'lucide-react';
import {
  type KirkpatrickLevel,
  type EvaluationQuestion,
  type EvaluationResponse,
  KIRKPATRICK_LEVELS,
  getQuestionsForLevel,
} from '@/features/training/types/evaluation.types';

// Level icons
const levelIcons: Record<KirkpatrickLevel, React.ReactNode> = {
  1: <Smile className="h-5 w-5" />,
  2: <BookOpen className="h-5 w-5" />,
  3: <Briefcase className="h-5 w-5" />,
  4: <BarChart3 className="h-5 w-5" />,
};

// Level colors
const levelColors: Record<KirkpatrickLevel, string> = {
  1: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  2: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  3: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  4: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

interface EvaluationFormProps {
  evaluationId: string;
  enrollmentId: string;
  level: KirkpatrickLevel;
  courseName: string;
  sessionCode: string;
  onSubmitSuccess?: () => void;
  onCancel?: () => void;
}

export function EvaluationForm({
  evaluationId,
  enrollmentId,
  level,
  courseName,
  sessionCode,
  onSubmitSuccess,
  onCancel,
}: EvaluationFormProps) {
  const questions = getQuestionsForLevel(level);
  const levelInfo = KIRKPATRICK_LEVELS[level];

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, EvaluationResponse['value']>>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const utils = api.useUtils();

  const submitMutation = api.training.evaluations.submit.useMutation({
    onSuccess: () => {
      toast.success('Évaluation soumise avec succès');
      utils.training.evaluations.getPending.invalidate();
      onSubmitSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la soumission');
    },
  });

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  // Calculate progress
  const answeredCount = Object.keys(responses).length;
  const requiredQuestions = questions.filter(q => q.required);
  const requiredAnswered = requiredQuestions.filter(q => responses[q.id] !== undefined).length;
  const canSubmit = requiredQuestions.length === requiredAnswered;
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  const handleResponseChange = (questionId: string, value: EvaluationResponse['value']) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      setShowConfirmDialog(true);
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstQuestion) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    submitMutation.mutate({
      evaluationId,
      responses,
    });
    setShowConfirmDialog(false);
  };

  const renderQuestion = (question: EvaluationQuestion) => {
    const currentValue = responses[question.id];

    switch (question.type) {
      case 'rating':
        return (
          <RatingQuestion
            question={question}
            value={typeof currentValue === 'number' ? currentValue : undefined}
            onChange={(val) => handleResponseChange(question.id, val)}
          />
        );

      case 'yes_no':
        return (
          <YesNoQuestion
            question={question}
            value={typeof currentValue === 'boolean' ? currentValue : undefined}
            onChange={(val) => handleResponseChange(question.id, val)}
          />
        );

      case 'text':
        return (
          <TextQuestion
            question={question}
            value={typeof currentValue === 'string' ? currentValue : ''}
            onChange={(val) => handleResponseChange(question.id, val)}
          />
        );

      case 'multiple_choice':
        return (
          <MultipleChoiceQuestion
            question={question}
            value={Array.isArray(currentValue) ? currentValue : []}
            onChange={(val) => handleResponseChange(question.id, val)}
          />
        );

      case 'scale':
        return (
          <ScaleQuestion
            question={question}
            value={typeof currentValue === 'number' ? currentValue : undefined}
            onChange={(val) => handleResponseChange(question.id, val)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          {/* Level badge */}
          <div className="flex items-center justify-between mb-4">
            <Badge className={levelColors[level]}>
              <span className="mr-2">{levelIcons[level]}</span>
              Niveau {level}: {levelInfo.name}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {currentQuestionIndex + 1} / {questions.length}
            </span>
          </div>

          {/* Course info */}
          <CardTitle className="text-lg">{courseName}</CardTitle>
          <CardDescription>
            Session {sessionCode} • {levelInfo.description}
          </CardDescription>

          {/* Progress bar */}
          <div className="mt-4">
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {answeredCount} question{answeredCount !== 1 ? 's' : ''} répondue{answeredCount !== 1 ? 's' : ''} sur {questions.length}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Current question */}
          <div className="min-h-[200px]">
            <div className="mb-4">
              <p className="text-lg font-medium">
                {currentQuestion?.question}
                {currentQuestion?.required && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </p>
            </div>

            {currentQuestion && renderQuestion(currentQuestion)}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={isFirstQuestion}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Précédent
            </Button>

            <div className="flex gap-2">
              {onCancel && (
                <Button variant="ghost" onClick={onCancel}>
                  Annuler
                </Button>
              )}
              <Button
                onClick={handleNext}
                disabled={currentQuestion?.required && responses[currentQuestion.id] === undefined}
              >
                {isLastQuestion ? (
                  <>
                    Terminer
                    <Send className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    Suivant
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la soumission</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de soumettre votre évaluation de niveau {level} ({levelInfo.name}).
              Cette action est définitive.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {canSubmit ? (
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm text-green-800 dark:text-green-200">
                  Toutes les questions obligatoires ont été répondues.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {requiredQuestions.length - requiredAnswered} question{(requiredQuestions.length - requiredAnswered) > 1 ? 's' : ''} obligatoire{(requiredQuestions.length - requiredAnswered) > 1 ? 's' : ''} sans réponse.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitMutation.isPending}
            >
              {submitMutation.isPending ? 'Envoi...' : 'Soumettre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =============================================================================
// QUESTION COMPONENTS
// =============================================================================

interface RatingQuestionProps {
  question: EvaluationQuestion;
  value?: number;
  onChange: (value: number) => void;
}

function RatingQuestion({ question, value, onChange }: RatingQuestionProps) {
  const maxValue = question.maxValue || 5;

  return (
    <div className="space-y-4">
      {/* Star rating */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: maxValue }, (_, i) => i + 1).map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className={`p-2 rounded-full transition-all ${
              value && rating <= value
                ? 'text-yellow-500 scale-110'
                : 'text-gray-300 hover:text-yellow-400'
            }`}
          >
            <Star
              className={`h-8 w-8 ${value && rating <= value ? 'fill-current' : ''}`}
            />
          </button>
        ))}
      </div>

      {/* Labels */}
      {(question.minLabel || question.maxLabel) && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{question.minLabel}</span>
          <span>{question.maxLabel}</span>
        </div>
      )}

      {/* Current value display */}
      {value && (
        <p className="text-center text-sm font-medium">
          {value} / {maxValue}
        </p>
      )}
    </div>
  );
}

interface YesNoQuestionProps {
  question: EvaluationQuestion;
  value?: boolean;
  onChange: (value: boolean) => void;
}

function YesNoQuestion({ question, value, onChange }: YesNoQuestionProps) {
  return (
    <div className="flex items-center justify-center gap-6">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex flex-col items-center gap-2 p-6 rounded-xl border-2 transition-all min-w-[120px] ${
          value === true
            ? 'border-green-500 bg-green-50 dark:bg-green-950'
            : 'border-gray-200 hover:border-green-300'
        }`}
      >
        <ThumbsUp className={`h-8 w-8 ${value === true ? 'text-green-600' : 'text-gray-400'}`} />
        <span className={`font-medium ${value === true ? 'text-green-700' : 'text-gray-600'}`}>
          Oui
        </span>
      </button>

      <button
        type="button"
        onClick={() => onChange(false)}
        className={`flex flex-col items-center gap-2 p-6 rounded-xl border-2 transition-all min-w-[120px] ${
          value === false
            ? 'border-red-500 bg-red-50 dark:bg-red-950'
            : 'border-gray-200 hover:border-red-300'
        }`}
      >
        <ThumbsDown className={`h-8 w-8 ${value === false ? 'text-red-600' : 'text-gray-400'}`} />
        <span className={`font-medium ${value === false ? 'text-red-700' : 'text-gray-600'}`}>
          Non
        </span>
      </button>
    </div>
  );
}

interface TextQuestionProps {
  question: EvaluationQuestion;
  value: string;
  onChange: (value: string) => void;
}

function TextQuestion({ question, value, onChange }: TextQuestionProps) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Tapez votre réponse ici..."
      rows={4}
      className="resize-none"
    />
  );
}

interface MultipleChoiceQuestionProps {
  question: EvaluationQuestion;
  value: string[];
  onChange: (value: string[]) => void;
}

function MultipleChoiceQuestion({ question, value, onChange }: MultipleChoiceQuestionProps) {
  const options = question.options || [];

  const handleToggle = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter(v => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  return (
    <div className="space-y-3">
      {options.map((option, index) => (
        <div
          key={index}
          className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
          onClick={() => handleToggle(option)}
        >
          <Checkbox
            id={`option-${index}`}
            checked={value.includes(option)}
            onCheckedChange={() => handleToggle(option)}
          />
          <Label
            htmlFor={`option-${index}`}
            className="flex-1 cursor-pointer"
          >
            {option}
          </Label>
        </div>
      ))}
    </div>
  );
}

interface ScaleQuestionProps {
  question: EvaluationQuestion;
  value?: number;
  onChange: (value: number) => void;
}

function ScaleQuestion({ question, value, onChange }: ScaleQuestionProps) {
  const maxValue = question.maxValue || 100;
  const currentValue = value ?? 0;

  return (
    <div className="space-y-4">
      <Slider
        value={[currentValue]}
        onValueChange={(vals) => onChange(vals[0])}
        max={maxValue}
        step={1}
        className="w-full"
      />

      {/* Labels */}
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{question.minLabel || '0'}</span>
        <span className="font-medium text-foreground">{currentValue}</span>
        <span>{question.maxLabel || `${maxValue}`}</span>
      </div>
    </div>
  );
}

// =============================================================================
// EVALUATION DIALOG WRAPPER
// =============================================================================

interface EvaluationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluation: {
    id: string;
    enrollmentId: string;
    level: number;
    courseName: string;
    sessionCode: string;
  };
  onSuccess?: () => void;
}

export function EvaluationDialog({ open, onOpenChange, evaluation, onSuccess }: EvaluationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <EvaluationForm
          evaluationId={evaluation.id}
          enrollmentId={evaluation.enrollmentId}
          level={evaluation.level as KirkpatrickLevel}
          courseName={evaluation.courseName}
          sessionCode={evaluation.sessionCode}
          onSubmitSuccess={() => {
            onOpenChange(false);
            onSuccess?.();
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
