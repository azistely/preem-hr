/**
 * OTP Input Component
 *
 * 6-digit OTP input with countdown timer for SMS verification
 * Features:
 * - 6 separate input boxes for each digit
 * - Auto-advance to next input on entry
 * - Auto-submit when 6 digits entered
 * - Support paste of full OTP code
 * - Countdown timer with color changes (green → yellow → red)
 * - Resend button with cooldown
 * - Large touch targets (56x56px per digit)
 * - French labels and messages
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface OtpInputProps {
  /** Number of digits (default: 6) */
  length?: number;
  /** Called when all digits are entered */
  onComplete?: (otp: string) => void;
  /** Called when OTP value changes */
  onChange?: (otp: string) => void;
  /** Called when resend is requested */
  onResend?: () => Promise<void>;
  /** Phone number to display (formatted) */
  phoneNumber?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether OTP is being verified */
  isVerifying?: boolean;
  /** Error message to display */
  error?: string;
  /** Success state */
  success?: boolean;
  /** OTP expiry time in seconds (default: 300 = 5 min) */
  expirySeconds?: number;
  /** Resend cooldown in seconds (default: 30) */
  resendCooldown?: number;
  /** Additional CSS classes */
  className?: string;
}

export function OtpInput({
  length = 6,
  onComplete,
  onChange,
  onResend,
  phoneNumber,
  disabled = false,
  isVerifying = false,
  error,
  success = false,
  expirySeconds = 300, // 5 minutes for slow networks
  resendCooldown = 30,
  className,
}: OtpInputProps) {
  // State
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const [timeLeft, setTimeLeft] = useState(expirySeconds);
  const [resendTimeLeft, setResendTimeLeft] = useState(resendCooldown);
  const [isResending, setIsResending] = useState(false);

  // Refs for input elements
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer effect for OTP expiry
  useEffect(() => {
    if (timeLeft <= 0 || success) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, success]);

  // Timer effect for resend cooldown
  useEffect(() => {
    if (resendTimeLeft <= 0) return;

    const timer = setInterval(() => {
      setResendTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendTimeLeft]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Get timer color based on time left
  const getTimerColor = () => {
    if (timeLeft > 120) return 'text-green-600'; // > 2 min
    if (timeLeft > 30) return 'text-yellow-600'; // 30s - 2 min
    return 'text-red-600'; // < 30s
  };

  // Get progress bar color
  const getProgressColor = () => {
    if (timeLeft > 120) return 'bg-green-500';
    if (timeLeft > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle digit input
  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      // Only allow single digit
      const digit = value.replace(/\D/g, '').slice(-1);

      const newDigits = [...digits];
      newDigits[index] = digit;
      setDigits(newDigits);

      // Notify parent of change
      const otpValue = newDigits.join('');
      onChange?.(otpValue);

      // Auto-advance to next input
      if (digit && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Auto-submit when complete
      if (digit && index === length - 1) {
        const completeOtp = newDigits.join('');
        if (completeOtp.length === length) {
          onComplete?.(completeOtp);
        }
      }
    },
    [digits, length, onChange, onComplete]
  );

  // Handle key down for navigation
  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      // Backspace - clear current and move to previous
      if (e.key === 'Backspace') {
        if (!digits[index] && index > 0) {
          inputRefs.current[index - 1]?.focus();
        }
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
        onChange?.(newDigits.join(''));
      }

      // Arrow keys for navigation
      if (e.key === 'ArrowLeft' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      if (e.key === 'ArrowRight' && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits, length, onChange]
  );

  // Handle paste
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData('text');
      const pastedDigits = pastedData.replace(/\D/g, '').slice(0, length);

      if (pastedDigits.length === 0) return;

      const newDigits = [...digits];
      for (let i = 0; i < pastedDigits.length; i++) {
        newDigits[i] = pastedDigits[i];
      }
      setDigits(newDigits);

      // Notify parent
      const otpValue = newDigits.join('');
      onChange?.(otpValue);

      // Focus appropriate input
      const nextIndex = Math.min(pastedDigits.length, length - 1);
      inputRefs.current[nextIndex]?.focus();

      // Auto-submit if complete
      if (pastedDigits.length === length) {
        onComplete?.(otpValue);
      }
    },
    [digits, length, onChange, onComplete]
  );

  // Handle resend
  const handleResend = async () => {
    if (resendTimeLeft > 0 || isResending || !onResend) return;

    setIsResending(true);
    try {
      await onResend();
      // Reset timers
      setTimeLeft(expirySeconds);
      setResendTimeLeft(resendCooldown);
      // Clear inputs
      setDigits(Array(length).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsResending(false);
    }
  };

  // Clear inputs
  const clearInputs = () => {
    setDigits(Array(length).fill(''));
    inputRefs.current[0]?.focus();
  };

  const isExpired = timeLeft === 0;
  const canResend = resendTimeLeft === 0 && !isResending;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Title and phone number */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">
          Entrez le code reçu par SMS
        </h2>
        {phoneNumber && (
          <p className="text-muted-foreground">
            Envoyé au <span className="font-mono font-medium">{phoneNumber}</span>
          </p>
        )}
      </div>

      {/* OTP digit inputs */}
      <div className="flex justify-center gap-2 sm:gap-3">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            onChange={(e) => handleDigitChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled || isVerifying || isExpired || success}
            aria-label={`Chiffre ${index + 1} du code`}
            className={cn(
              'w-12 h-14 sm:w-14 sm:h-14 text-2xl text-center font-mono font-bold',
              'border-2 rounded-lg transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              // Normal state
              'border-input bg-background',
              'focus:border-primary focus:ring-primary',
              // Error state
              error && 'border-destructive focus:border-destructive focus:ring-destructive',
              // Success state
              success && 'border-green-500 bg-green-50 text-green-700',
              // Disabled state
              (disabled || isVerifying || isExpired) && 'opacity-50 cursor-not-allowed'
            )}
          />
        ))}
      </div>

      {/* Timer and progress bar */}
      {!success && (
        <div className="space-y-2">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-1000',
                getProgressColor()
              )}
              style={{ width: `${(timeLeft / expirySeconds) * 100}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className={cn('font-medium', getTimerColor())}>
              {isExpired ? (
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  Code expiré
                </span>
              ) : timeLeft <= 30 ? (
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  Expire dans {formatTime(timeLeft)}
                </span>
              ) : (
                <span>{formatTime(timeLeft)}</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </p>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            Code vérifié avec succès!
          </p>
        </div>
      )}

      {/* Verifying state */}
      {isVerifying && (
        <div className="flex justify-center items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Vérification en cours...</span>
        </div>
      )}

      {/* Resend section */}
      {!success && (
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Vous n&apos;avez pas reçu le code?
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={!canResend || disabled}
            className="min-h-[44px]"
          >
            {isResending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : canResend ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Renvoyer le code
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Renvoyer le code ({resendTimeLeft}s)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default OtpInput;
