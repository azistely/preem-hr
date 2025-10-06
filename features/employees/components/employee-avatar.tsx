/**
 * Employee Avatar
 *
 * Shows employee avatar with fallback to initials
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface EmployeeAvatarProps {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
};

export function EmployeeAvatar({
  firstName,
  lastName,
  photoUrl,
  size = 'md',
}: EmployeeAvatarProps) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <Avatar className={sizeClasses[size]}>
      {photoUrl && <AvatarImage src={photoUrl} alt={`${firstName} ${lastName}`} />}
      <AvatarFallback className="bg-primary/10 text-primary font-medium">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
