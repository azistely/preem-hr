/**
 * Auth Method Selector Component
 *
 * Large, clear cards for selecting authentication method (email vs phone)
 * Designed for low digital literacy users:
 * - Large touch targets (min 120px height)
 * - Simple, outcome-oriented language in French
 * - Clear visual distinction between options
 * - No technical jargon (no "2FA", "OTP", etc.)
 */

'use client';

import React from 'react';
import { Mail, Smartphone, Check, Shield, Key } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AuthMethod = 'email' | 'phone';

export interface AuthMethodSelectorProps {
  /** Currently selected method */
  value?: AuthMethod;
  /** Called when selection changes */
  onChange?: (method: AuthMethod) => void;
  /** Whether this is for signup (shows different descriptions) */
  isSignup?: boolean;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface MethodOption {
  id: AuthMethod;
  icon: React.ElementType;
  title: string;
  description: string;
  helper: string;
  badge?: string;
  features: string[];
}

const getSignupOptions = (): MethodOption[] => [
  {
    id: 'email',
    icon: Mail,
    title: 'Avec mon email',
    description: 'Créez un compte avec votre adresse email et un mot de passe',
    helper: 'Recommandé si vous avez un email',
    badge: 'Recommandé',
    features: [
      'Mot de passe à retenir',
      'Vérification par SMS pour plus de sécurité',
    ],
  },
  {
    id: 'phone',
    icon: Smartphone,
    title: 'Avec mon téléphone',
    description: 'Recevez un code par SMS à chaque connexion. Pas de mot de passe!',
    helper: "Recommandé si vous n'avez pas d'email",
    features: [
      'Pas de mot de passe à retenir',
      'Code SMS à chaque connexion',
    ],
  },
];

const getLoginOptions = (): MethodOption[] => [
  {
    id: 'email',
    icon: Mail,
    title: 'Avec mon email',
    description: 'Connectez-vous avec votre email et mot de passe',
    helper: 'Pour les comptes créés avec email',
    features: [],
  },
  {
    id: 'phone',
    icon: Smartphone,
    title: 'Avec mon téléphone',
    description: 'Recevez un code SMS pour vous connecter',
    helper: 'Pour les comptes créés avec téléphone',
    features: [],
  },
];

export function AuthMethodSelector({
  value,
  onChange,
  isSignup = true,
  disabled = false,
  className,
}: AuthMethodSelectorProps) {
  const options = isSignup ? getSignupOptions() : getLoginOptions();

  return (
    <div className={cn('space-y-4', className)}>
      {/* Title */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          Comment voulez-vous vous {isSignup ? 'inscrire' : 'connecter'}?
        </h2>
      </div>

      {/* Option cards */}
      <div className="grid gap-4">
        {options.map((option) => {
          const isSelected = value === option.id;
          const Icon = option.icon;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => !disabled && onChange?.(option.id)}
              disabled={disabled}
              className={cn(
                'relative w-full min-h-[120px] p-4 sm:p-5 rounded-xl border-2 text-left transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary',
                // Default state
                'border-border bg-card hover:border-primary/50 hover:bg-accent/50',
                // Selected state
                isSelected && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                // Disabled state
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              aria-pressed={isSelected}
            >
              {/* Badge */}
              {option.badge && (
                <span className="absolute -top-2 right-4 px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                  {option.badge}
                </span>
              )}

              <div className="flex gap-4">
                {/* Icon */}
                <div
                  className={cn(
                    'flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {option.title}
                    </h3>
                    {isSelected && (
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {option.description}
                  </p>

                  {/* Features (only on signup) */}
                  {isSignup && option.features.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {option.features.map((feature, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded-md text-muted-foreground"
                        >
                          {idx === 0 ? (
                            <Key className="h-3 w-3" />
                          ) : (
                            <Shield className="h-3 w-3" />
                          )}
                          {feature}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Helper text */}
              <p className="mt-3 text-xs text-muted-foreground pl-16">
                {option.helper}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default AuthMethodSelector;
