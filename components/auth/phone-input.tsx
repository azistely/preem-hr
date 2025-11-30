/**
 * Phone Input Component
 *
 * Phone number input with country code selector for West African countries
 * Features:
 * - Auto-formats phone number as user types
 * - Pre-selects country based on tenant context
 * - Validates phone number length per country
 * - Large touch targets for mobile (min 48px height)
 * - French labels and error messages
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  PHONE_COUNTRIES,
  PhoneCountryConfig,
  getPhoneCountryByCode,
  getDefaultPhoneCountry,
  formatPhoneNumber,
  toE164,
  isValidPhoneLength,
} from '@/lib/config/countries';
import { cn } from '@/lib/utils';

export interface PhoneInputProps {
  /** Current phone value (E.164 format) */
  value?: string;
  /** Called when phone value changes (E.164 format) */
  onChange?: (value: string) => void;
  /** Called when local number changes (for validation) */
  onLocalChange?: (localNumber: string, countryCode: string) => void;
  /** Default country code (ISO) */
  defaultCountryCode?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Error message to display */
  error?: string;
  /** Label text (defaults to "Numéro de téléphone") */
  label?: string;
  /** Helper text */
  helperText?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Input ID */
  id?: string;
}

export function PhoneInput({
  value,
  onChange,
  onLocalChange,
  defaultCountryCode = 'CI',
  disabled = false,
  error,
  label = 'Numéro de téléphone',
  helperText = 'Nous enverrons un code SMS à ce numéro',
  required = false,
  className,
  id = 'phone',
}: PhoneInputProps) {
  // State for selected country and local phone number
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountryConfig>(
    getPhoneCountryByCode(defaultCountryCode) || getDefaultPhoneCountry()
  );
  const [localNumber, setLocalNumber] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Parse initial value if provided in E.164 format
  useEffect(() => {
    if (value && value.startsWith('+')) {
      // Find matching country by dial code
      for (const country of PHONE_COUNTRIES) {
        if (value.startsWith(country.dialCode)) {
          setSelectedCountry(country);
          const local = value.slice(country.dialCode.length);
          setLocalNumber(formatPhoneNumber(local, country.code));
          break;
        }
      }
    }
  }, []);

  // Handle local number input
  const handleLocalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;

      // Allow only digits and spaces
      const cleaned = input.replace(/[^\d\s]/g, '');

      // Format the number
      const digitsOnly = cleaned.replace(/\s/g, '');
      const formatted = formatPhoneNumber(digitsOnly, selectedCountry.code);

      setLocalNumber(formatted);

      // Notify parent of changes
      const e164Value = toE164(digitsOnly, selectedCountry.code);

      // Debug logging for phone conversion
      console.log('[PhoneInput] ========== PHONE CONVERSION ==========');
      console.log('[PhoneInput] Raw input:', input);
      console.log('[PhoneInput] Cleaned input:', cleaned);
      console.log('[PhoneInput] Digits only:', digitsOnly);
      console.log('[PhoneInput] Digits length:', digitsOnly.length);
      console.log('[PhoneInput] Country:', selectedCountry.code, selectedCountry.dialCode);
      console.log('[PhoneInput] Expected length:', selectedCountry.phoneLength);
      console.log('[PhoneInput] Formatted for display:', formatted);
      console.log('[PhoneInput] E.164 output:', e164Value);
      console.log('[PhoneInput] Is valid length:', isValidPhoneLength(digitsOnly, selectedCountry.code));
      console.log('[PhoneInput] ==========================================');

      onChange?.(e164Value);
      onLocalChange?.(digitsOnly, selectedCountry.code);
    },
    [selectedCountry, onChange, onLocalChange]
  );

  // Handle country selection
  const handleCountrySelect = useCallback(
    (country: PhoneCountryConfig) => {
      setSelectedCountry(country);
      setIsOpen(false);

      // Re-format existing number for new country and notify parent
      const digitsOnly = localNumber.replace(/\s/g, '');
      const e164Value = toE164(digitsOnly, country.code);
      onChange?.(e164Value);
      onLocalChange?.(digitsOnly, country.code);
    },
    [localNumber, onChange, onLocalChange]
  );

  // Validate phone number length
  const isValid = localNumber
    ? isValidPhoneLength(localNumber, selectedCountry.code)
    : true;

  const showError = error || (!isValid && localNumber.length > 0);
  const errorMessage =
    error ||
    (!isValid
      ? `Le numéro doit avoir ${selectedCountry.phoneLength} chiffres pour ${selectedCountry.name}`
      : undefined);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      <Label htmlFor={id} className="text-base">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {/* Input container */}
      <div className="flex gap-2">
        {/* Country selector */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={isOpen}
              aria-label="Sélectionner le pays"
              className={cn(
                'min-h-[48px] min-w-[100px] justify-between px-3',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              disabled={disabled}
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">{selectedCountry.flag}</span>
                <span className="font-mono text-sm">{selectedCountry.dialCode}</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-0" align="start">
            <div className="py-1">
              {PHONE_COUNTRIES.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors',
                    selectedCountry.code === country.code && 'bg-accent'
                  )}
                  onClick={() => handleCountrySelect(country)}
                >
                  <span className="text-xl">{country.flag}</span>
                  <span className="flex-1">{country.name}</span>
                  <span className="font-mono text-sm text-muted-foreground">
                    {country.dialCode}
                  </span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Phone number input */}
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={selectedCountry.placeholder}
            value={localNumber}
            onChange={handleLocalChange}
            disabled={disabled}
            className={cn(
              'min-h-[48px] pl-10 text-base font-mono',
              showError && 'border-destructive focus-visible:ring-destructive'
            )}
            aria-invalid={showError ? 'true' : 'false'}
            aria-describedby={showError ? `${id}-error` : `${id}-helper`}
          />
        </div>
      </div>

      {/* Helper text or error message */}
      {showError ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-xs text-muted-foreground">
          📱 {helperText}
        </p>
      ) : null}
    </div>
  );
}

export default PhoneInput;
