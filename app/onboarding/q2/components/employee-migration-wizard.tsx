/**
 * Employee Migration Wizard
 * HCI-compliant questionnaire for importing existing employees
 */

'use client';

import { useState } from 'react';
import { HasEmployeesQuestion } from './questions/q1-has-employees';
import { DataLocationQuestion } from './questions/q2-data-location';
import { ComfortLevelQuestion } from './questions/q3-comfort-level';
import { SelfServiceImport } from './paths/self-service-import';
import { GuidedExportWizard } from './paths/guided-export-wizard';
import { WhatsAppAssistance } from './paths/whatsapp-assistance';

type WizardStep = 'has_employees' | 'data_location' | 'comfort_level' | 'self_service' | 'guided' | 'whatsapp';

export interface EmployeeMigrationWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function EmployeeMigrationWizard({ onComplete, onSkip }: EmployeeMigrationWizardProps) {
  const [step, setStep] = useState<WizardStep>('has_employees');
  const [hasEmployees, setHasEmployees] = useState<boolean | null>(null);
  const [dataSource, setDataSource] = useState<'excel' | 'sage' | 'manual' | null>(null);
  const [comfortLevel, setComfortLevel] = useState<'confident' | 'need_guide' | 'need_help' | null>(null);

  const handleHasEmployees = (answer: boolean) => {
    setHasEmployees(answer);
    if (!answer) {
      // No employees, skip to success
      onSkip();
    } else {
      // Has employees, ask where data is
      setStep('data_location');
    }
  };

  const handleDataLocation = (source: 'excel' | 'sage' | 'manual') => {
    setDataSource(source);
    if (source === 'manual') {
      // Manual/paper data, suggest WhatsApp help
      setComfortLevel('need_help');
      setStep('whatsapp');
    } else {
      // Digital data, ask comfort level
      setStep('comfort_level');
    }
  };

  const handleComfortLevel = (level: 'confident' | 'need_guide' | 'need_help') => {
    setComfortLevel(level);

    switch (level) {
      case 'confident':
        setStep('self_service');
        break;
      case 'need_guide':
        setStep('guided');
        break;
      case 'need_help':
        setStep('whatsapp');
        break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'data_location':
        setStep('has_employees');
        break;
      case 'comfort_level':
        setStep('data_location');
        break;
      case 'self_service':
      case 'guided':
      case 'whatsapp':
        setStep('comfort_level');
        break;
    }
  };

  return (
    <div className="space-y-6">
      {step === 'has_employees' && (
        <HasEmployeesQuestion onAnswer={handleHasEmployees} />
      )}

      {step === 'data_location' && (
        <DataLocationQuestion onAnswer={handleDataLocation} onBack={handleBack} />
      )}

      {step === 'comfort_level' && (
        <ComfortLevelQuestion
          dataSource={dataSource!}
          onAnswer={handleComfortLevel}
          onBack={handleBack}
        />
      )}

      {step === 'self_service' && (
        <SelfServiceImport
          dataSource={dataSource!}
          onComplete={onComplete}
          onBack={handleBack}
        />
      )}

      {step === 'guided' && (
        <GuidedExportWizard
          dataSource={dataSource!}
          onComplete={onComplete}
          onBack={handleBack}
        />
      )}

      {step === 'whatsapp' && (
        <WhatsAppAssistance
          dataSource={dataSource}
          onComplete={onComplete}
          onBack={handleBack}
          onSkip={onSkip}
        />
      )}
    </div>
  );
}
