/**
 * Quick Actions Component for Automation Hub
 * HCI Compliance: Zero learning curve, one-click access to common automation tasks
 *
 * Design Principles:
 * - Task-oriented CTAs ("Créer un rappel" not "Add alert")
 * - Touch-friendly (≥44px targets)
 * - Progressive disclosure (simple form → advanced options)
 * - French business language
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Bell, Zap, Clock, Plus, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { api } from '@/trpc/react';
import { toast } from 'sonner';

interface QuickActionsProps {
  variant?: 'header' | 'fab'; // Header: horizontal buttons, FAB: floating action button
}

export function QuickActions({ variant = 'header' }: QuickActionsProps) {
  const router = useRouter();

  if (variant === 'fab') {
    return <QuickActionsFAB />;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <CreateReminderDialog>
        <Button size="default" className="gap-2 min-h-[44px]">
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">Créer un rappel</span>
          <span className="sm:hidden">Rappel</span>
        </Button>
      </CreateReminderDialog>

      <Button
        variant="outline"
        size="default"
        className="gap-2 min-h-[44px]"
        onClick={() => router.push('/workflows/new')}
      >
        <Clock className="h-4 w-4" />
        <span className="hidden sm:inline">Nouvelle règle</span>
        <span className="sm:hidden">Règle</span>
      </Button>

      <Button
        variant="outline"
        size="default"
        className="gap-2 min-h-[44px]"
        onClick={() => router.push('/employees')}
      >
        <Zap className="h-4 w-4" />
        <span className="hidden sm:inline">Action groupée</span>
        <span className="sm:hidden">Action</span>
      </Button>
    </div>
  );
}

/**
 * Floating Action Button (Mobile-optimized)
 */
function QuickActionsFAB() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* FAB Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
        aria-label="Actions rapides"
      >
        <Plus className="h-6 w-6 mx-auto" />
      </button>

      {/* FAB Menu */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-30 lg:hidden"
            onClick={() => setOpen(false)}
          />

          {/* Action Menu */}
          <div className="fixed bottom-36 right-4 lg:bottom-24 lg:right-6 z-40 flex flex-col gap-2">
            <CreateReminderDialog>
              <button className="flex items-center gap-3 bg-background border shadow-md rounded-full px-4 py-3 hover:bg-accent transition-colors min-h-[44px]">
                <Bell className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Créer un rappel</span>
              </button>
            </CreateReminderDialog>

            <button
              className="flex items-center gap-3 bg-background border shadow-md rounded-full px-4 py-3 hover:bg-accent transition-colors min-h-[44px]"
              onClick={() => {
                setOpen(false);
                // Navigate to workflows
              }}
            >
              <Clock className="h-5 w-5 text-green-600" />
              <span className="font-medium">Nouvelle règle</span>
            </button>

            <button
              className="flex items-center gap-3 bg-background border shadow-md rounded-full px-4 py-3 hover:bg-accent transition-colors min-h-[44px]"
              onClick={() => {
                setOpen(false);
                // Navigate to employees for bulk action
              }}
            >
              <Zap className="h-5 w-5 text-purple-600" />
              <span className="font-medium">Action groupée</span>
            </button>
          </div>
        </>
      )}
    </>
  );
}

/**
 * Create Reminder Dialog (Quick Action Shortcut)
 * HCI Principle: Use existing, tested flows instead of creating new ones
 * This dialog provides quick shortcuts to common automation tasks
 */
function CreateReminderDialog({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const shortcuts = [
    {
      id: 'contract_expiry',
      icon: Bell,
      title: 'Fin de contrat',
      description: 'Soyez alerté avant l\'expiration des contrats',
      action: () => {
        setOpen(false);
        router.push('/alerts?create=contract_expiry');
      },
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      id: 'payroll',
      icon: CalendarIcon,
      title: 'Période de paie',
      description: 'Rappel mensuel pour lancer la paie',
      action: () => {
        setOpen(false);
        router.push('/alerts?create=payroll_reminder');
      },
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      id: 'document',
      icon: Bell,
      title: 'Documents à renouveler',
      description: 'Alertes pour documents expirants',
      action: () => {
        setOpen(false);
        router.push('/alerts?create=document_expiry');
      },
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      id: 'custom',
      icon: Plus,
      title: 'Rappel personnalisé',
      description: 'Créez votre propre rappel',
      action: () => {
        setOpen(false);
        router.push('/alerts?create=custom');
      },
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            Créer un rappel automatique
          </DialogTitle>
          <DialogDescription>
            Choisissez le type de rappel que vous souhaitez configurer
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          {shortcuts.map((shortcut) => {
            const Icon = shortcut.icon;
            return (
              <button
                key={shortcut.id}
                onClick={shortcut.action}
                className={cn(
                  'flex items-start gap-4 p-4 rounded-lg border-2 border-transparent',
                  'hover:border-primary/30 hover:bg-accent',
                  'transition-all text-left min-h-[60px]',
                  'focus:outline-none focus:ring-2 focus:ring-primary'
                )}
              >
                <div className={cn('p-2 rounded-lg', shortcut.bgColor)}>
                  <Icon className={cn('h-5 w-5', shortcut.color)} />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-1">{shortcut.title}</h4>
                  <p className="text-sm text-muted-foreground">{shortcut.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="min-h-[44px]"
          >
            Annuler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
