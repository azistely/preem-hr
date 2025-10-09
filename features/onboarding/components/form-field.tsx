import { forwardRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement> {
  label: string;
  error?: string;
  helperText?: string;
  suffix?: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'select' | 'tel';
  children?: React.ReactNode; // For select options
}

export const FormField = forwardRef<HTMLInputElement | HTMLSelectElement, FormFieldProps>(
  ({ label, error, helperText, suffix, type = 'text', children, className, ...props }, ref) => {
    return (
      <div className="space-y-2">
        <Label htmlFor={props.name} className="text-base">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </Label>

        {type === 'select' ? (
          <select
            ref={ref as any}
            className={cn(
              "flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-red-500",
              className
            )}
            {...(props as any)}
          >
            {children}
          </select>
        ) : (
          <div className="relative">
            <Input
              ref={ref as any}
              type={type}
              className={cn(
                "min-h-[48px] text-base",
                error && "border-red-500",
                suffix && "pr-20",
                className
              )}
              {...(props as any)}
            />
            {suffix && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {suffix}
              </div>
            )}
          </div>
        )}

        {helperText && !error && (
          <p className="text-sm text-muted-foreground">{helperText}</p>
        )}

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';
