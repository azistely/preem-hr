/**
 * Month Picker Component
 *
 * Allows selecting a month and year.
 * Returns value in format: YYYY-MM-01
 *
 * HCI Principles:
 * - Simple interface
 * - Clear value display
 * - Large touch targets
 */

'use client';

import { Input } from './input';
import { cn } from '@/lib/utils';

interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function MonthPicker({ value, onChange, className }: MonthPickerProps) {
  // Convert YYYY-MM-DD to YYYY-MM for input
  const monthValue = value.substring(0, 7);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Convert YYYY-MM to YYYY-MM-01
    const newValue = `${e.target.value}-01`;
    onChange(newValue);
  };

  return (
    <Input
      type="month"
      value={monthValue}
      onChange={handleChange}
      className={cn('min-h-[48px]', className)}
    />
  );
}
