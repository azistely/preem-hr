'use client';

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CI_CITIES, ABIDJAN_COMMUNES } from '@/lib/constants/ci-cities';

export default function TestSelectPage() {
  const [selectedCity, setSelectedCity] = useState('');

  return (
    <div className="container mx-auto py-12 max-w-2xl">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4">Test City Selector</h1>
          <p className="text-muted-foreground mb-8">
            This page tests if you can select all 48 cities from the dropdown
          </p>
        </div>

        <div className="space-y-4 border rounded-lg p-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Ville</label>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="min-h-[48px]">
                <SelectValue placeholder="Sélectionnez une ville" />
              </SelectTrigger>
              <SelectContent position="item-aligned" className="max-h-[300px]">
                {CI_CITIES.map((city) => (
                  <SelectItem key={city.value} value={city.value}>
                    {city.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Total: {CI_CITIES.length} villes disponibles
            </p>
          </div>

          {selectedCity && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-900">
                ✅ Ville sélectionnée: <strong>{selectedCity}</strong>
              </p>
            </div>
          )}
        </div>

        <div className="border rounded-lg p-4 bg-blue-50">
          <h2 className="font-semibold mb-2">Instructions de test:</h2>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Cliquez sur le sélecteur de ville</li>
            <li>Vérifiez que vous pouvez faire défiler la liste</li>
            <li>Essayez de sélectionner différentes villes (Abidjan, Bouaké, Yamoussoukro, etc.)</li>
            <li>La ville sélectionnée devrait s'afficher ci-dessous</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
