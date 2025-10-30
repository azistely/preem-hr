/**
 * WhatsApp Assistance (Path C)
 * For users who need personalized help
 * HCI: Clear expectations, instant contact, no pressure
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, MessageCircle, Clock, CheckCircle2, Phone } from 'lucide-react';

interface WhatsAppAssistanceProps {
  dataSource: 'excel' | 'sage' | 'manual' | null;
  onComplete: () => void;
  onBack: () => void;
  onSkip: () => void;
}

type Step = 'form' | 'confirming' | 'confirmed';

export function WhatsAppAssistance({ dataSource, onComplete, onBack, onSkip }: WhatsAppAssistanceProps) {
  const [step, setStep] = useState<Step>('form');
  const [formData, setFormData] = useState({
    system: dataSource || 'excel',
    employeeCount: '',
    whatsappNumber: '',
  });

  const handleSubmit = () => {
    // Open WhatsApp directly with all form data
    const message = encodeURIComponent(
      `Bonjour! J'ai besoin d'aide pour importer mes employés dans Preem HR.\n\nMon système actuel: ${getSystemLabel(formData.system)}\nNombre d'employés: ${formData.employeeCount}\nMon numéro WhatsApp: ${formData.whatsappNumber}`
    );
    const whatsappUrl = `https://wa.me/2250708786828?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleLaunchWhatsApp = () => {
    // Same as handleSubmit - kept for compatibility
    handleSubmit();
  };

  const getSystemLabel = (system: string) => {
    switch (system) {
      case 'sage':
        return 'SAGE / CIEL';
      case 'excel':
        return 'Excel / CSV';
      case 'manual':
        return 'Papier / Manuel';
      default:
        return system;
    }
  };

  if (step === 'confirmed') {
    return (
      <div className="space-y-6">
        {/* Success message */}
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-green-900 mb-2">
              ✅ Demande envoyée !
            </h3>
            <p className="text-muted-foreground">
              Notre équipe va vous contacter très bientôt
            </p>
          </div>
        </div>

        {/* Next steps */}
        <Card>
          <CardHeader>
            <CardTitle>Prochaines étapes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">1. Contact WhatsApp</p>
                <p className="text-sm text-muted-foreground">
                  Vous allez recevoir un message dans les 30 minutes (heures ouvrables)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium">2. Assistance personnalisée</p>
                <p className="text-sm text-muted-foreground">
                  Notre équipe vous guidera étape par étape ou fera l'import pour vous
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="font-medium">3. Validation</p>
                <p className="text-sm text-muted-foreground">
                  Nous vérifierons ensemble que tous vos employés sont bien importés
                </p>
              </div>
            </div>

            {/* Timing */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <Clock className="w-4 h-4 inline mr-2" />
                <strong>Délai estimé :</strong> 24-48 heures pour l'import complet
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleLaunchWhatsApp}
                className="min-h-[56px] text-lg bg-green-600 hover:bg-green-700"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Lancer la conversation WhatsApp
              </Button>

              <Button
                onClick={onSkip}
                variant="outline"
                className="min-h-[56px] text-lg"
              >
                Continuer sans importer maintenant
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'confirming') {
    return (
      <div className="space-y-6 text-center">
        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
          <MessageCircle className="w-10 h-10 text-blue-600 animate-pulse" />
        </div>
        <div>
          <h3 className="text-2xl font-bold mb-2">Envoi en cours...</h3>
          <p className="text-muted-foreground">
            Préparation de votre demande d'assistance
          </p>
        </div>
      </div>
    );
  }

  // Form view
  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={onBack}>
        <ChevronLeft className="w-4 h-4 mr-2" />
        Retour
      </Button>

      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold">
          💬 Assistance Migration WhatsApp
        </h2>
        <p className="text-muted-foreground text-lg">
          Notre équipe va vous aider à importer vos employés
        </p>
      </div>

      {/* Benefits */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-lg text-green-900">
            🤝 Ce que nous allons faire pour vous
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            'Vous guider par WhatsApp en français',
            'Récupérer vos données de manière sécurisée',
            'Les importer pour vous dans Preem HR',
            'Vérifier que tout est correct',
          ].map((benefit, index) => (
            <div key={index} className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-green-900">{benefit}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Informations de contact</CardTitle>
          <CardDescription>
            Pour que nous puissions vous contacter rapidement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* System */}
          <div className="space-y-2">
            <Label htmlFor="system">Votre système actuel *</Label>
            <Select
              value={formData.system}
              onValueChange={(value: 'excel' | 'sage' | 'manual') => setFormData({ ...formData, system: value })}
            >
              <SelectTrigger id="system" className="min-h-[48px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sage">💼 SAGE / CIEL</SelectItem>
                <SelectItem value="excel">📊 Excel / CSV</SelectItem>
                <SelectItem value="manual">📝 Papier / Manuel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Employee count */}
          <div className="space-y-2">
            <Label htmlFor="employeeCount">Nombre d'employés *</Label>
            <Input
              id="employeeCount"
              type="number"
              placeholder="Ex: 10"
              value={formData.employeeCount}
              onChange={(e) => setFormData({ ...formData, employeeCount: e.target.value })}
              className="min-h-[48px]"
            />
            <p className="text-sm text-muted-foreground">
              Approximatif, pour estimer le temps nécessaire
            </p>
          </div>

          {/* WhatsApp number */}
          <div className="space-y-2">
            <Label htmlFor="whatsappNumber">Votre numéro WhatsApp *</Label>
            <Input
              id="whatsappNumber"
              type="tel"
              placeholder="+225 XX XX XX XX XX"
              value={formData.whatsappNumber}
              onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
              className="min-h-[48px]"
            />
            <p className="text-sm text-muted-foreground">
              Nous vous contacterons sur ce numéro
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pricing info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          💰 <strong>Coût :</strong> Ce service est <span className="font-bold">gratuit pendant votre période d'essai</span>.
          Après l'essai: 10,000 FCFA par import.
        </p>
      </div>

      {/* Timing */}
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <p className="text-sm text-orange-900">
          <Clock className="w-4 h-4 inline mr-2" />
          <strong>Délai :</strong> Premier contact dans les 30 minutes (heures ouvrables: 8h-18h).
          Import complet en 24-48 heures.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Button
          onClick={handleSubmit}
          disabled={!formData.employeeCount || !formData.whatsappNumber}
          className="min-h-[56px] text-lg bg-green-600 hover:bg-green-700"
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          Demander l'assistance
        </Button>

        <Button
          onClick={onSkip}
          variant="outline"
          className="min-h-[56px]"
        >
          Je préfère importer moi-même
        </Button>
      </div>
    </div>
  );
}
