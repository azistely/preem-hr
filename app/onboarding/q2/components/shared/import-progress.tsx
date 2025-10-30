/**
 * Import Progress
 * Shows realtime progress during import
 * HCI: Live updates, clear feedback
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface ImportProgressProps {
  total: number;
}

export function ImportProgress({ total }: ImportProgressProps) {
  const [imported, setImported] = useState(0);
  const [recentEmployees, setRecentEmployees] = useState<string[]>([]);

  const progress = Math.round((imported / total) * 100);

  // Simulate import progress
  useEffect(() => {
    const names = [
      'Jean Kouassi',
      'Aïcha Diallo',
      'Mamadou Traoré',
      'Fatou Koné',
      'Ibrahim Touré',
      'Marie Bamba',
      'Abdoul Soro',
      'Aminata Camara',
      'Youssouf Doumbia',
      'Kadiatou Cissé',
    ];

    if (imported < total) {
      const timer = setTimeout(() => {
        setImported((prev) => Math.min(prev + 1, total));
        setRecentEmployees((prev) => {
          const newName = names[imported % names.length];
          return [newName, ...prev].slice(0, 5);
        });
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [imported, total]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        </div>
        <h3 className="text-2xl font-bold">
          🔄 Import en cours...
        </h3>
        <p className="text-muted-foreground">
          Veuillez patienter pendant que nous importons vos employés
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Progression</span>
            <span className="text-2xl font-bold text-primary">{progress}%</span>
          </div>

          <Progress value={progress} className="h-4" />

          <div className="text-center text-sm text-muted-foreground">
            {imported} / {total} employés importés
          </div>
        </CardContent>
      </Card>

      {/* Recent imports */}
      {recentEmployees.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h4 className="font-medium mb-3">Derniers employés importés:</h4>
            <div className="space-y-2">
              {recentEmployees.map((name, index) => (
                <div
                  key={`${name}-${index}`}
                  className="flex items-center gap-3 p-2 rounded-lg bg-green-50 border border-green-200 animate-fade-in"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-green-900 font-medium">{name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Helper text */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          ⏱️ <strong>Temps estimé:</strong> Environ {Math.ceil((total - imported) * 0.2)} secondes restantes
        </p>
      </div>
    </div>
  );
}
