'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FrequencySelectorProps {
  onSelect: (frequency: 'monthly' | 'bi_weekly') => void;
}

interface FrequencyCardProps {
  value: 'monthly' | 'bi_weekly';
  icon: string;
  title: string;
  description: string;
  example: string;
  onClick: () => void;
}

function FrequencyCard(props: FrequencyCardProps) {
  return (
    <Card
      className={cn(
        'p-6 cursor-pointer transition-all',
        'hover:shadow-lg hover:border-primary',
        'active:scale-[0.98]',
        'min-h-[120px]'
      )}
      onClick={props.onClick}
    >
      <div className="flex items-start gap-4">
        <div className="text-5xl">{props.icon}</div>
        <div className="flex-1">
          <h3 className="text-lg font-bold mb-1">{props.title}</h3>
          <p className="text-muted-foreground mb-2">{props.description}</p>
          <p className="text-sm text-primary">
            Exemple: {props.example}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function FrequencySelector({ onSelect }: FrequencySelectorProps) {
  return (
    <div className="space-y-3">
      <FrequencyCard
        value="monthly"
        icon="📅"
        title="Mensuel (fin du mois)"
        description="Paiement une fois par mois"
        example="31 janvier, 28 février, 31 mars..."
        onClick={() => onSelect('monthly')}
      />

      <FrequencyCard
        value="bi_weekly"
        icon="📆"
        title="Bi-mensuel (2x par mois)"
        description="Paiement deux fois par mois"
        example="15 et 30 de chaque mois"
        onClick={() => onSelect('bi_weekly')}
      />
    </div>
  );
}
