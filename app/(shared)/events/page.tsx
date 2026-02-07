/**
 * Event Monitoring Page
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md - Phase 3
 *
 * Displays recent Inngest events for monitoring and debugging.
 * Shows event type, payload, and execution status.
 */

import { Metadata } from 'next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Calendar, Users, DollarSign, FileText, AlertCircle } from 'lucide-react';
import { getEventDocumentation, type EventName } from '@/lib/inngest/event-registry';

export const metadata: Metadata = {
  title: 'Événements Système | Jamana',
  description: 'Surveillance des événements et automatisations',
};

// Icon mapping for event types
const eventIcons: Record<string, any> = {
  'employee.status.changed': Users,
  'leave.status.changed': Calendar,
  'payroll.run.completed': DollarSign,
  'alert.created': AlertCircle,
  'batch.operation.completed': FileText,
  'employee.hired': Users,
  'employee.terminated': Users,
  'salary.changed': DollarSign,
  'leave.approved': Calendar,
};

// Get all registered event types
const registeredEvents: EventName[] = [
  'employee.status.changed',
  'leave.status.changed',
  'payroll.run.completed',
  'alert.created',
  'batch.operation.completed',
  'employee.hired',
  'employee.terminated',
  'salary.changed',
  'leave.approved',
];

export default function EventsPage() {
  return (
    <div className="container py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Suivi d'activité</h1>
          <p className="text-muted-foreground mt-2">
            Consultez l'historique de toutes les actions automatisées
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            <Activity className="mr-1 h-3 w-3" />
            9 types d'événements
          </Badge>
        </div>
      </div>

      {/* Event Types Registry */}
      <Card>
        <CardHeader>
          <CardTitle>Types d'événements enregistrés</CardTitle>
          <CardDescription>
            Événements disponibles dans le système d'automatisation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {registeredEvents.map((eventName) => {
              const doc = getEventDocumentation(eventName);
              const Icon = eventIcons[eventName] || Activity;

              return (
                <Card key={eventName} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Event
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-2">
                      {eventName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {doc.description}
                    </p>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Déclenché par:</span>{' '}
                        {doc.triggeredBy}
                      </p>
                    </div>
                    <details className="mt-2">
                      <summary className="text-xs font-medium cursor-pointer text-primary hover:underline">
                        Voir le payload
                      </summary>
                      <div className="mt-2 space-y-1">
                        {Object.entries(doc.payload).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="font-mono text-muted-foreground">{key}:</span>{' '}
                            <span className="text-muted-foreground">{value}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Event Monitoring Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Surveillance en temps réel</CardTitle>
          <CardDescription>
            Comment surveiller les événements et les exécutions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <h3 className="font-semibold mb-2">Inngest Dev Server (Développement)</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Pour surveiller les événements en temps réel pendant le développement:
            </p>
            <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
              <li>Démarrer le serveur de développement Next.js: <code className="bg-background px-1 rounded">npm run dev</code></li>
              <li>Ouvrir le tableau de bord Inngest: <a href="http://localhost:3000/api/inngest" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">http://localhost:3000/api/inngest</a></li>
              <li>Déclencher des événements manuellement depuis l'interface</li>
              <li>Voir les logs d'exécution et les erreurs en temps réel</li>
            </ol>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <h3 className="font-semibold mb-2">Inngest Cloud (Production)</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Pour surveiller les événements en production:
            </p>
            <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
              <li>Se connecter au tableau de bord Inngest Cloud</li>
              <li>Sélectionner l'environnement de production</li>
              <li>Voir l'historique complet des événements</li>
              <li>Analyser les métriques de performance</li>
              <li>Configurer des alertes pour les erreurs</li>
            </ol>
          </div>

          <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-400 mb-1">
                  Note de développement
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-500">
                  Cette page affiche actuellement les types d'événements enregistrés. Pour voir l'historique
                  complet des événements, nous devons implémenter:
                </p>
                <ul className="text-sm text-yellow-700 dark:text-yellow-500 mt-2 space-y-1 list-disc list-inside">
                  <li>Table <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">event_logs</code> dans la base de données</li>
                  <li>Middleware Inngest pour logger tous les événements</li>
                  <li>API tRPC pour récupérer l'historique</li>
                  <li>Interface de filtrage et recherche</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Liens rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <a
              href="/api/inngest"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Tableau de bord Inngest</div>
                <div className="text-xs text-muted-foreground">
                  Surveiller les fonctions et événements
                </div>
              </div>
            </a>

            <a
              href="/alerts"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <AlertCircle className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Alertes actives</div>
                <div className="text-xs text-muted-foreground">
                  Voir les alertes créées par les événements
                </div>
              </div>
            </a>

            <a
              href="/batch-operations"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Opérations groupées</div>
                <div className="text-xs text-muted-foreground">
                  Historique des opérations batch
                </div>
              </div>
            </a>

            <a
              href="/workflows"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Workflows</div>
                <div className="text-xs text-muted-foreground">
                  Gérer les workflows automatisés
                </div>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
