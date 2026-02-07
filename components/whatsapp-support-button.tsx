/**
 * WhatsApp Support Button (Floating Action Button)
 *
 * HCI Principles Applied:
 * - Always visible (zero learning curve - users know it's there)
 * - Context-aware messages (immediate relevance)
 * - Touch-friendly (56×56px mobile, 64×64px desktop)
 * - Simple, clean design without distracting animations
 * - One tap away (minimal friction)
 */

'use client';

import { MessageCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

const WHATSAPP_NUMBER = '2250708786828';
const SUPPORT_NAME = 'Tidiane';

/**
 * Build contextual message based on current page
 */
function buildContextualMessage(pathname: string): string {
  // Homepage / Landing
  if (pathname === '/' || pathname === '/home') {
    return `Bonjour ${SUPPORT_NAME}! Je visite Jamana et j'aimerais en savoir plus sur votre solution de paie.`;
  }

  // Onboarding flow
  if (pathname.startsWith('/onboarding')) {
    if (pathname.includes('/q1')) {
      return `Bonjour ${SUPPORT_NAME}! J'ai besoin d'aide pour configurer mon entreprise dans Jamana.`;
    }
    if (pathname.includes('/q2')) {
      return `Bonjour ${SUPPORT_NAME}! J'ai besoin d'aide pour ajouter mon premier employé.`;
    }
    if (pathname.includes('/q3')) {
      return `Bonjour ${SUPPORT_NAME}! J'ai besoin d'aide pour configurer ma première paie.`;
    }
    return `Bonjour ${SUPPORT_NAME}! J'ai besoin d'aide avec l'installation de Jamana.`;
  }

  // Employee management
  if (pathname.startsWith('/employees')) {
    if (pathname.includes('/new')) {
      return `Bonjour ${SUPPORT_NAME}! J'ai besoin d'aide pour embaucher un nouvel employé.`;
    }
    if (pathname.match(/\/employees\/[a-f0-9-]{36}/)) {
      return `Bonjour ${SUPPORT_NAME}! J'ai besoin d'aide concernant un employé dans Jamana.`;
    }
    return `Bonjour ${SUPPORT_NAME}! J'ai besoin d'aide pour gérer mes employés.`;
  }

  // Payroll
  if (pathname.startsWith('/payroll')) {
    if (pathname.includes('/run')) {
      return `Bonjour ${SUPPORT_NAME}! J'ai besoin d'aide pour faire ma paie du mois.`;
    }
    if (pathname.includes('/history')) {
      return `Bonjour ${SUPPORT_NAME}! J'ai une question sur un bulletin de paie.`;
    }
    return `Bonjour ${SUPPORT_NAME}! J'ai besoin d'aide avec la paie.`;
  }

  // Time tracking
  if (pathname.startsWith('/time-tracking')) {
    return `Bonjour ${SUPPORT_NAME}! J'ai besoin d'aide avec les pointages.`;
  }

  // Leave management
  if (pathname.startsWith('/time-off') || pathname.startsWith('/leave')) {
    return `Bonjour ${SUPPORT_NAME}! J'ai besoin d'aide avec les congés.`;
  }

  // Reports
  if (pathname.startsWith('/reports')) {
    return `Bonjour ${SUPPORT_NAME}! J'ai besoin d'aide avec les rapports.`;
  }

  // Settings
  if (pathname.startsWith('/settings')) {
    return `Bonjour ${SUPPORT_NAME}! J'ai besoin d'aide avec les paramètres de mon compte.`;
  }

  // Main dashboard / default
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/manager') || pathname.startsWith('/admin')) {
    return `Bonjour ${SUPPORT_NAME}! J'ai besoin d'aide avec Jamana.`;
  }

  // Generic fallback
  return `Bonjour ${SUPPORT_NAME}! J'ai une question sur Jamana.`;
}

export function WhatsAppSupportButton() {
  const pathname = usePathname();

  const whatsappUrl = useMemo(() => {
    const message = buildContextualMessage(pathname);
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }, [pathname]);

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="
        fixed bottom-6 right-6 z-50
        flex items-center justify-center
        bg-[#25D366] hover:bg-[#1fb855]
        text-white
        rounded-full shadow-lg hover:shadow-xl
        transition-all duration-200
        w-14 h-14
        md:w-16 md:h-16
      "
      aria-label="Contacter le support WhatsApp"
    >
      {/* Icon */}
      <MessageCircle className="h-6 w-6 md:h-7 md:w-7" />
    </a>
  );
}
