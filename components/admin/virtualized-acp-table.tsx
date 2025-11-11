/**
 * Virtualized ACP Employee Table
 *
 * High-performance table for displaying 100+ employees
 * Uses @tanstack/react-virtual for efficient rendering
 * Only renders visible rows in viewport
 */

'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';

interface ACPDashboardItem {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    contractType: string;
    hireDate: string;
    acpPaymentActive: boolean;
    acpPaymentDate: string | null;
    acpLastPaidAt: string | null;
  };
  latestPayment: {
    id: string;
    acpAmount: string;
    leaveDaysTakenCalendar: string;
    createdAt: string;
  } | null;
  totalPaid: number;
}

interface VirtualizedACPTableProps {
  data: ACPDashboardItem[];
  isLoading?: boolean;
}

export function VirtualizedACPTable({ data, isLoading }: VirtualizedACPTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Virtualizer configuration
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 73, // Estimated row height in pixels
    overscan: 5, // Number of items to render outside viewport
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' FCFA';
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Aucun employé trouvé</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      {/* Table Header (Fixed) */}
      <div className="grid grid-cols-[1fr_120px_1fr_1fr_80px] gap-4 bg-muted/50 p-4 font-medium text-sm border-b">
        <div>Employé</div>
        <div>Contrat</div>
        <div>Dernier paiement</div>
        <div>Total payé</div>
        <div className="text-right">Actions</div>
      </div>

      {/* Virtualized Table Body */}
      <div
        ref={parentRef}
        className="h-[600px] overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = data[virtualRow.index];

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="grid grid-cols-[1fr_120px_1fr_1fr_80px] gap-4 p-4 border-b hover:bg-muted/50 transition-colors"
              >
                {/* Employee */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback>
                      {getInitials(item.employee.firstName, item.employee.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {item.employee.firstName} {item.employee.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.employee.email}
                    </p>
                  </div>
                </div>

                {/* Contract Type */}
                <div className="flex items-center">
                  <Badge variant="outline">{item.employee.contractType}</Badge>
                </div>

                {/* Latest Payment */}
                <div className="flex items-center">
                  {item.latestPayment ? (
                    <div>
                      <p className="font-medium">
                        {formatCurrency(Number(item.latestPayment.acpAmount))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(item.latestPayment.createdAt), 'PPP', {
                          locale: fr,
                        })}
                      </p>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Aucun paiement</span>
                  )}
                </div>

                {/* Total Paid */}
                <div className="flex items-center">
                  <span className="font-medium">{formatCurrency(item.totalPaid || 0)}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end">
                  <Link href={`/employees/${item.employee.id}?tab=time`}>
                    <Button variant="ghost" size="sm" className="min-h-[44px]">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer with count */}
      <div className="p-4 bg-muted/50 border-t text-sm text-muted-foreground">
        Affichage de {data.length} employé{data.length > 1 ? 's' : ''}
      </div>
    </div>
  );
}
