/**
 * Date formatting utilities
 */

import { format as formatFns, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export function formatDate(
  date: Date | string,
  formatStr: string = 'dd/MM/yyyy'
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatFns(dateObj, formatStr, { locale: fr });
}

export function formatDateTime(
  date: Date | string,
  formatStr: string = 'dd/MM/yyyy HH:mm'
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatFns(dateObj, formatStr, { locale: fr });
}

export function formatRelativeDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const now = new Date();
  const diffInDays = Math.floor(
    (now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffInDays === 0) return "Aujourd'hui";
  if (diffInDays === 1) return 'Hier';
  if (diffInDays < 7) return `Il y a ${diffInDays} jours`;
  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
  }
  if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return `Il y a ${months} mois`;
  }
  const years = Math.floor(diffInDays / 365);
  return `Il y a ${years} an${years > 1 ? 's' : ''}`;
}
