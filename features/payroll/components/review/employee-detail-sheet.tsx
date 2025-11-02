'use client';

/**
 * Employee Detail Sheet Component
 *
 * Bottom sheet wrapper that renders different content based on mode
 * - Draft mode: Time entries, pay variables, approval actions
 * - Calculated mode: Calculation breakdown, comparison, verification
 *
 * Design: Mobile-first bottom sheet with swipe gestures
 */

import { ReactNode } from 'react';
import { X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface EmployeeDetailSheetProps {
  mode: 'draft' | 'calculated';
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  };
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function EmployeeDetailSheet({
  mode,
  employee,
  open,
  onClose,
  children,
}: EmployeeDetailSheetProps) {
  const title =
    mode === 'draft'
      ? `Révision - ${employee.firstName} ${employee.lastName}`
      : `Vérification - ${employee.firstName} ${employee.lastName}`;

  const description =
    mode === 'draft'
      ? 'Vérifiez et complétez les informations avant calcul'
      : 'Vérifiez les montants calculés';

  return (
    <Sheet open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[85vh] sm:h-[90vh] overflow-y-auto"
      >
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-lg sm:text-xl">
                {title}
              </SheetTitle>
              <SheetDescription className="text-sm">
                {employee.employeeNumber}
              </SheetDescription>
              <SheetDescription className="text-xs text-muted-foreground mt-1">
                {description}
              </SheetDescription>
            </div>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        {/* Dynamic content based on mode */}
        <div className="space-y-6 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
