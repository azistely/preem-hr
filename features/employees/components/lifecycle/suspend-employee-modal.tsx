/**
 * Suspend Employee Modal
 *
 * Form to suspend an employee temporarily
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Loader2, Pause } from 'lucide-react';
import { useSuspendEmployee } from '@/features/employees/hooks/use-employee-mutations';
import { Alert, AlertDescription } from '@/components/ui/alert';

const suspendSchema = z.object({
  // We'll just suspend immediately for now
  // In a full implementation, you'd add suspension start/end dates
});

type FormData = z.infer<typeof suspendSchema>;

interface SuspendEmployeeModalProps {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  };
  open: boolean;
  onClose: () => void;
}

export function SuspendEmployeeModal({
  employee,
  open,
  onClose,
}: SuspendEmployeeModalProps) {
  const suspendEmployee = useSuspendEmployee();

  const form = useForm<FormData>({
    resolver: zodResolver(suspendSchema),
  });

  const onSubmit = async (data: FormData) => {
    await suspendEmployee.mutateAsync({
      employeeId: employee.id,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pause className="h-5 w-5 text-orange-600" />
            Suspendre l'employé
          </DialogTitle>
          <DialogDescription>
            {employee.firstName} {employee.lastName}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Alert>
              <AlertDescription>
                L'employé sera suspendu et exclu de la paie jusqu'à réactivation.
                Les affectations resteront actives mais marquées comme suspendues.
              </AlertDescription>
            </Alert>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={suspendEmployee.isPending}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={suspendEmployee.isPending}
                className="min-h-[44px] bg-orange-600 hover:bg-orange-700"
              >
                {suspendEmployee.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Suspension...
                  </>
                ) : (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Suspendre
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
