'use client';

import { Card } from '@/components/ui/card';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CountrySelectorProps {
  value: string | null;
  status?: 'idle' | 'saving' | 'saved' | 'error';
  onSelect: (countryCode: string) => void;
}

interface CountryCardProps {
  code: string;
  flag: string;
  name: string;
  details: string;
  selected?: boolean;
  disabled?: boolean;
  comingSoon?: boolean;
  onClick: () => void;
}

function CountryCard({
  flag,
  name,
  details,
  selected = false,
  disabled = false,
  comingSoon = false,
  onClick,
}: CountryCardProps) {
  return (
    <Card
      className={cn(
        'p-6 transition-all cursor-pointer relative',
        selected
          ? 'border-2 border-primary bg-primary/5'
          : 'hover:shadow-md hover:border-primary',
        'active:scale-[0.98]',
        disabled && 'opacity-50 cursor-not-allowed',
        'min-h-[100px]'
      )}
      onClick={disabled ? undefined : onClick}
    >
      <div className="flex items-start gap-4">
        <div className="text-5xl flex-shrink-0">
          {flag}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-bold text-xl">
              {name}
            </p>
            {selected && (
              <Check className="w-5 h-5 text-primary flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {details}
          </p>
          {comingSoon && (
            <span className="inline-block mt-2 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded">
              Bientôt disponible
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

export function CountrySelector({ value, status = 'idle', onSelect }: CountrySelectorProps) {
  const isDisabled = status === 'saving';

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <CountryCard
          code="CI"
          flag="🇨🇮"
          name="Côte d'Ivoire"
          details="CNPS 6.3%, ITS progressif, SMIG 75,000 FCFA"
          selected={value === 'CI'}
          disabled={isDisabled}
          onClick={() => onSelect('CI')}
        />

        <CountryCard
          code="SN"
          flag="🇸🇳"
          name="Sénégal"
          details="IPRES 14%, IRPP progressif, SMIG 52,500 FCFA"
          disabled
          comingSoon
          onClick={() => {}}
        />

        <CountryCard
          code="BF"
          flag="🇧🇫"
          name="Burkina Faso"
          details="CNSS, IUTS, SMIG 34,664 FCFA"
          disabled
          comingSoon
          onClick={() => {}}
        />

        <CountryCard
          code="ML"
          flag="🇲🇱"
          name="Mali"
          details="INPS, ITS, SMIG 40,000 FCFA"
          disabled
          comingSoon
          onClick={() => {}}
        />
      </div>

      {/* Loading indicator only */}
      {status === 'saving' && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Configuration en cours...</span>
        </div>
      )}
    </div>
  );
}
