/**
 * Employee Status Badge
 *
 * Visual indicator for employee status with icon and color
 */

import { Badge } from '@/components/ui/badge';
import { Check, Clock, XCircle } from 'lucide-react';

interface EmployeeStatusBadgeProps {
  status: 'active' | 'terminated' | 'suspended';
}

const statusConfig = {
  active: {
    icon: Check,
    variant: 'default' as const,
    label: 'Actif',
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
  },
  terminated: {
    icon: XCircle,
    variant: 'secondary' as const,
    label: 'Cessé',
    className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  },
  suspended: {
    icon: Clock,
    variant: 'outline' as const,
    label: 'Suspendu',
    className: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  },
};

export function EmployeeStatusBadge({ status }: EmployeeStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={config.className}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
}
